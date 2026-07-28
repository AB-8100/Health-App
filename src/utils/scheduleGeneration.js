// Turns a Stage-2 goalsPayload into a day-by-day activities schedule plus a
// gym-day count (used to pick the auto gym split). Extracted from App.jsx so
// this pure logic is testable directly, per the project's convention of
// keeping generated-data logic in utils/ (see sessionCompletion.js, etc.).
import { legDistanceKm, formatPaceForDiscipline } from './raceTargets';
import { REST, reconcileScheduleWithSplitIds } from './scheduleReconciliation';

export const DAY_KEY_TO_IDX = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 };

export const ACTIVITY_DEFS = {
  gym:      { type:'gym',   label:'Gym',     emoji:'🏋️', color:'#BE5A38', duration:60, isGym: true },
  running:  { type:'run',   label:'Run',     emoji:'🏃', color:'#0090FF', duration:45 },
  cycling:  { type:'cycle', label:'Cycle',   emoji:'🚴', color:'#9333EA', duration:60 },
  swimming: { type:'swim',  label:'Swim',    emoji:'🏊', color:'#0369A1', duration:45 },
  rowing:   { type:'other', label:'Row',     emoji:'🚣', color:'#4B5563', duration:45 },
  yoga:     { type:'yoga',  label:'Yoga',    emoji:'🧘', color:'#6D4AAF', duration:60 },
  hiit:     { type:'other', label:'HIIT',    emoji:'⚡', color:'#DC2626', duration:30 },
  walking:  { type:'walk',  label:'Walk',    emoji:'🚶', color:'#15803D', duration:60 },
  pilates:  { type:'other', label:'Pilates', emoji:'🤸', color:'#6D4AAF', duration:45 },
  climbing: { type:'other', label:'Climb',   emoji:'🧗', color:'#854D0E', duration:90 },
  dancing:  { type:'other', label:'Dancing', emoji:'💃', color:'#EC4899', duration:60 },
};

// Spreads selected activities across training days (capped at trainingDays.length).
// Gym sessions are not stored in the activities state — they're tracked via plan.splitDays.
// Returns { schedule, gymDayCount } so the caller can pick the right gym split.
//
// This is the ORIGINAL, unmodified algorithm — general_fitness/gym only, no
// awareness of event_race/sport_activity/regularSports. Kept byte-identical
// and dispatched to directly (see generateActivitySchedule below) whenever
// none of those three newer sources are present, so existing non-race
// onboarding paths can never regress.
export function legacyGenerateActivitySchedule(goalsPayload) {
  const { goals = [], trainingDays = [], gymAccess = false } = goalsPayload;
  const generalGoal = goals.find(g => g.type === 'general_fitness');
  let selectedIds = [...(generalGoal?.config?.activities || [])];

  // Ensure gym appears in the rotation whenever the user has gym access
  if (gymAccess && !selectedIds.includes('gym')) {
    selectedIds = ['gym', ...selectedIds];
  }

  if (!trainingDays.length) return { schedule: {}, gymDayCount: 0, gymDayIdxs: [] };

  // Only gym (or nothing selected) → all training days count as gym sessions
  const nonGymActivities = selectedIds.filter(id => id !== 'gym');
  if (!nonGymActivities.length) {
    const gymDayIdxs = gymAccess
      ? trainingDays.map(day => DAY_KEY_TO_IDX[day]).filter(idx => idx !== undefined)
      : [];
    return { schedule: {}, gymDayCount: gymDayIdxs.length, gymDayIdxs };
  }

  // Cycle through activity list (gym + others) across training days
  const schedule = {};
  let gymDayCount = 0;
  const gymDayIdxs = [];

  trainingDays.forEach((day, i) => {
    const dayIdx = DAY_KEY_TO_IDX[day];
    if (dayIdx === undefined) return;
    const actId = selectedIds[i % selectedIds.length];

    if (actId === 'gym') {
      gymDayCount++;
      // Gym days are represented by plan.splitDays — no entry needed in
      // activities, but the weekday is tracked in gymDayIdxs so the caller
      // can place the split's days on the days actually chosen, instead of
      // falling back to the split template's own default schedule.
      gymDayIdxs.push(dayIdx);
    } else {
      const def = ACTIVITY_DEFS[actId];
      if (def) {
        schedule[dayIdx] = [{ id: `gen-${dayIdx}`, ...def, isGym: false, source: 'generated' }];
      }
    }
  });

  return { schedule, gymDayCount, gymDayIdxs };
}

// Discipline key (from an event_race goal's disciplineFrequency, set in
// GoalsSetupScreen) → display metadata for a generated session.
const DISCIPLINE_ACTIVITY_META = {
  swim:  { type: 'swim',  label: 'Swim',     duration: 45 },
  bike:  { type: 'cycle', label: 'Bike',     duration: 60 },
  run:   { type: 'run',   label: 'Run',      duration: 45 },
  other: { type: 'other', label: 'Training', duration: 45 },
};

export function disciplineActivityDef(discipline, raceType, targetPaces) {
  const meta = DISCIPLINE_ACTIVITY_META[discipline] || DISCIPLINE_ACTIVITY_META.other;
  const def = { ...meta };
  const legSeconds = targetPaces?.[discipline];
  if (Number.isFinite(legSeconds)) {
    const pace = formatPaceForDiscipline(discipline, legSeconds, legDistanceKm(discipline, raceType), false);
    if (pace) def.note = `Target ~${pace}`;
  }
  return def;
}

// A regularSports/sport_activity entry's free-text sport name → a `type` key
// that `getSessionDisplay` (data/sessionDisplay.js) already has emoji/color
// for. `label` is kept as the specific sport name, not the category.
const SPORT_NAME_TO_TYPE = {
  Football: 'team_sport', Basketball: 'team_sport', Rugby: 'team_sport', Hockey: 'team_sport', Volleyball: 'team_sport',
  Tennis: 'racket_sport',
  Swimming: 'swim', 'Synchronised Swimming': 'swim', Cycling: 'cycle', Running: 'run',
  'Martial Arts': 'combat',
};

export function sportActivityDef(sportName) {
  return { type: SPORT_NAME_TO_TYPE[sportName] || 'other', label: sportName || 'Sport', duration: 60 };
}

// Marker pushed into the demand pool when gymAccess is true — gym days have
// no `activities` entry (tracked via plan.splitDays instead), so this is
// filtered out before building schedule entries, only counted.
const GYM_DEMAND_MARKER = { __gym: true };

// Repeatedly takes one ticket from each demand source in turn (round-robin),
// so e.g. "run x2, gym x3" interleaves as run/gym/run/gym/gym rather than
// clumping each source together.
export function interleaveBySource(sources) {
  const remaining = sources.map(s => ({ def: s.def, count: s.count }));
  const result = [];
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const r of remaining) {
      if (r.count > 0) {
        result.push(r.def);
        r.count--;
        anyLeft = true;
      }
    }
  }
  return result;
}

// Goal-aware scheduler — builds a demand list from every relevant source
// (event_race discipline frequency, sport_activity, general_fitness, gym)
// instead of only general_fitness, so a race-goal user's stated training
// frequency actually produces sessions. regularSports claims its explicit
// day first (unchanged concept — day-anchored), then everything else fills
// the remaining training days via a weighted round-robin. When total demand
// exceeds available days, sessions land as close to the stated frequency as
// the day count allows rather than being silently dropped.
export function goalAwareGenerateActivitySchedule(goalsPayload) {
  const { goals = [], trainingDays = [], gymAccess = false, regularSports = [] } = goalsPayload;
  if (!trainingDays.length) return { schedule: {}, gymDayCount: 0, gymDayIdxs: [] };

  const schedule = {};
  const claimedDayIdxs = new Set();

  regularSports.forEach((entry, i) => {
    const dayIdx = DAY_KEY_TO_IDX[entry?.day];
    if (dayIdx === undefined || !trainingDays.includes(entry.day) || claimedDayIdxs.has(dayIdx)) return;
    schedule[dayIdx] = [{ id: `sport-${dayIdx}-${i}`, ...sportActivityDef(entry.sport), isGym: false, source: 'generated' }];
    claimedDayIdxs.add(dayIdx);
  });

  const remainingDayIdxs = trainingDays
    .map(d => DAY_KEY_TO_IDX[d])
    .filter(idx => idx !== undefined && !claimedDayIdxs.has(idx));

  const sources = [];
  const eventGoal = goals.find(g => g.type === 'event_race');
  if (eventGoal) {
    const freq = eventGoal.config?.disciplineFrequency || {};
    const targetPaces = eventGoal.config?.targetPaces || null;
    Object.entries(freq).forEach(([discipline, count]) => {
      const n = Number(count) || 0;
      if (n > 0) sources.push({ def: disciplineActivityDef(discipline, eventGoal.config?.raceType, targetPaces), count: n });
    });
  }
  const sportGoal = goals.find(g => g.type === 'sport_activity');
  if (sportGoal?.config?.sportType) {
    sources.push({ def: sportActivityDef(sportGoal.config.sportType), count: Number(sportGoal.config.daysPerWeek) || 1 });
  }
  const generalGoal = goals.find(g => g.type === 'general_fitness');
  (generalGoal?.config?.activities || []).forEach(actId => {
    if (actId === 'gym') return;
    const def = ACTIVITY_DEFS[actId];
    if (def) sources.push({ def, count: 1 });
  });
  if (gymAccess && remainingDayIdxs.length) {
    sources.push({ def: GYM_DEMAND_MARKER, count: remainingDayIdxs.length });
  }

  const filled = interleaveBySource(sources).slice(0, remainingDayIdxs.length);
  let gymDayCount = 0;
  const gymDayIdxs = [];
  remainingDayIdxs.forEach((dayIdx, i) => {
    const def = filled[i];
    if (!def) return;
    if (def.__gym) {
      gymDayCount++;
      gymDayIdxs.push(dayIdx);
    } else {
      schedule[dayIdx] = [{ id: `gen-${dayIdx}`, ...def, isGym: false, source: 'generated' }];
    }
  });

  return { schedule, gymDayCount, gymDayIdxs };
}

export function generateActivitySchedule(goalsPayload) {
  const { goals = [], regularSports = [] } = goalsPayload;
  const eventGoal = goals.find(g => g.type === 'event_race');
  const hasRaceFrequency = Object.values(eventGoal?.config?.disciplineFrequency || {}).some(n => Number(n) > 0);
  const hasSportActivity = !!goals.find(g => g.type === 'sport_activity')?.config?.sportType;
  const hasRegularSports = (regularSports || []).length > 0;

  if (!hasRaceFrequency && !hasSportActivity && !hasRegularSports) {
    return legacyGenerateActivitySchedule(goalsPayload);
  }
  return goalAwareGenerateActivitySchedule(goalsPayload);
}

// Decides whether Stage 3 (DeepQuestionnaireScreen) completing should be
// allowed to apply its generated gym split / activity schedule onto
// plan.splitDays / activities. When the user already has an active event
// training plan (uploaded or AI-generated — real session data, not just the
// flag) and hasn't explicitly opted to discard it, applying a generated
// schedule would inject gym-split/activity sessions on the same Weekly
// Overview days as the race plan's own sessions ("populated over the top of
// my training plan"). Default is to block; only an explicit opt-in unblocks it.
export function shouldBlockGeneratedSchedule({ hasEventTraining, eventPlanSessions, discardEventPlan }) {
  const hasActiveEventPlan = !!hasEventTraining && Object.keys(eventPlanSessions || {}).length > 0;
  return hasActiveEventPlan && !discardEventPlan;
}

// Profile fields onboarding (Stage 3, or a redo) derives and writes — reset
// back to "never done onboarding" by the About screen's "Remove
// app-generated schedule" action. Deliberately narrow: only clears fields
// this app's own onboarding writes to (goal, splitDays, hasTrainingActivities,
// intakeCompleted). Does NOT touch hasEventTraining, hasGym, or any
// identity/body-stat field — and callers must build their save overrides
// from only { profile, plan, activities }, leaving eventPlan/eventOverrides/
// preselectedQueues/planSessionsDone/sequencingDecisions/completedSessions/
// foodLog/customFoods out entirely, so an active uploaded/generated race
// plan and all other account data are left completely untouched.
export function resetOnboardingProfileFields(profile) {
  return {
    ...profile,
    goal: '',
    splitDays: null,
    hasTrainingActivities: false,
    intakeCompleted: false,
  };
}

// Gym split is determined by how many gym sessions are in the weekly plan,
// not the total number of training days.
export function getAutoSplitDays(gymDayCount) {
  if (!gymDayCount || gymDayCount <= 0) return null;
  if (gymDayCount === 1) return 1;
  if (gymDayCount === 2) return 2;
  if (gymDayCount === 3) return 3;
  if (gymDayCount === 4) return 4;
  return 5;
}

// Turns the gym weekday indices produced by generateActivitySchedule into a
// plan.scheduleOverride (7-slot, index 0=Mon..6=Sun) that places the auto
// split's days on the weekdays the user actually selected during onboarding,
// instead of leaving plan.scheduleOverride unset — which made every screen
// that reads the schedule (WeeklyOverviewScreen, GymPlanScreens) fall back to
// the split template's own hardcoded default schedule, ignoring the user's
// chosen training days entirely. Uses the same round-robin assignment as
// reconcileScheduleWithSplitIds/toggleTrainingDay so a freshly generated
// schedule behaves identically to one built by manually toggling days.
export function buildGymScheduleOverride(gymDayIdxs, splitDayIds) {
  if (!gymDayIdxs?.length || !splitDayIds?.length) return null;
  const template = Array(7).fill(REST);
  gymDayIdxs.forEach(idx => {
    if (idx >= 0 && idx < 7) template[idx] = splitDayIds[0];
  });
  return reconcileScheduleWithSplitIds(template, splitDayIds);
}
