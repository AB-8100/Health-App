// [COMPONENT] Single merged onboarding flow (Stage 2 + former Stage 3 —
// see features/specs/deterministic-endurance-plan-generator.md §A). Absorbs
// DeepQuestionnaireScreen.jsx's steps: goal select → rank → per-goal config
// (race details, including target pace and cutoff time entered directly
// per discipline for a triathlon — see setTargetPaceLeg/setCutoffLeg, no
// separate "confirm a derived split" step) → per-discipline day picker →
// baselines (mandatory) → discipline ranking (triathlon) → [skip point] →
// availability → preferences → injury → done. No "Goals & mindset" step —
// those were free-text fields the deterministic engine has no way to act
// on (unlike the old AI path, which read them to shape prose tone);
// baselines are the actual signal now. No AI-generation step either —
// completion always runs the deterministic engine (utils/planEngine.js)
// for an event_race goal with a supported race type.
import React from 'react';
import themes from '../data/themes';
import {
  formatPaceForDiscipline, legDistanceKm, formatSecondsAsHMS,
} from '../utils/raceTargets';
import { isEngineSupportedRaceType, buildTrainingPlan, isTrailRaceType } from '../utils/planEngine';
import { CONDITIONING_EXERCISES } from '../data/conditioningLibrary';
import { PlanOverviewSection } from './AboutScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCIPLINE_META = {
  swim:  { icon: '🏊', label: 'Swim' },
  bike:  { icon: '🚴', label: 'Bike' },
  run:   { icon: '🏃', label: 'Run' },
  other: { icon: '🏁', label: 'Training sessions' },
};

function isTriathlonRaceType(raceType) {
  return /triathlon/i.test(raceType || '');
}

// Which disciplines a given race type needs a day-picker for (§A.7) — only
// event_race goals get this; other goal types keep the plain 7-day toggle.
function disciplinesForRaceType(raceType) {
  if (isTriathlonRaceType(raceType)) return ['swim', 'bike', 'run'];
  return ['run']; // 10K / Half Marathon / Marathon — the only other supported types
}

export const GOAL_TYPES = [
  { id: 'event_race',         label: 'Race / Event',       sub: 'Train for a specific race or event',    icon: '🏁' },
  { id: 'strength_programme', label: 'Strength Programme', sub: 'Progressive overload & strength gains', icon: '🏋️' },
  { id: 'sport_activity',     label: 'Sport Activity',     sub: 'Improve performance in a sport',        icon: '⚽' },
  { id: 'general_fitness',    label: 'General Fitness',    sub: 'Build overall health and wellbeing',    icon: '🌿' },
  { id: 'micro_target',       label: 'Micro Target',       sub: 'A specific, measurable goal',           icon: '🎯' },
];

// Only the race types the deterministic engine has rules for — 5K, Cycling
// Sportive, Open Water Swim, and Other are deliberately not offered here
// (see the spec's "Scope" section); an existing saved goal with one of those
// types still works via the basic scheduler, it just can't be re-selected.
const RACE_TYPES = [
  '10K', 'Half Marathon', 'Marathon', 'Trail Running',
  'Triathlon (Sprint)', 'Triathlon (Olympic)', 'Triathlon (70.3 / Half)', 'Triathlon (Full / Ironman)',
];

const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Fit but new to this'];
const STRENGTH_FOCUSES = ['Powerlifting', 'Olympic Lifting', 'General Strength', 'Body Recomposition', 'Calisthenics'];
const SPORT_TYPES = [
  'Football', 'Basketball', 'Tennis', 'Swimming', 'Synchronised Swimming', 'Cycling', 'Running',
  'Rugby', 'CrossFit', 'Martial Arts', 'Golf', 'Hockey', 'Volleyball', 'Other',
];
const INTENSITY_LEVELS = ['Low', 'Moderate', 'High'];
const GENERAL_ACTIVITIES = [
  { id: 'gym',       label: 'Gym',       icon: '🏋️' },
  { id: 'running',   label: 'Running',   icon: '🏃' },
  { id: 'cycling',   label: 'Cycling',   icon: '🚴' },
  { id: 'swimming',  label: 'Swimming',  icon: '🏊' },
  { id: 'rowing',    label: 'Rowing',    icon: '🚣' },
  { id: 'yoga',      label: 'Yoga',      icon: '🧘' },
  { id: 'hiit',      label: 'HIIT',      icon: '⚡' },
  { id: 'walking',   label: 'Walking',   icon: '🚶' },
  { id: 'pilates',   label: 'Pilates',   icon: '🤸' },
  { id: 'climbing',  label: 'Climbing',  icon: '🧗' },
  { id: 'dancing',   label: 'Dancing',   icon: '💃' },
];
const BODY_AREAS = [
  'Knee', 'Ankle', 'Hip', 'Lower back', 'Upper back', 'Shoulder',
  'Elbow', 'Wrist', 'Hamstring', 'Quad', 'Calf', 'Achilles', 'Other',
];

const DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const RANK_LABELS  = ['Primary', 'Secondary', 'Supporting'];
const RANK_COLOURS = ['#BE5A38', '#6D4AAF', '#15803D'];

const DISCIPLINE_RANK_LABELS  = ['Strongest', 'Middle', 'Weakest'];
const DISCIPLINE_RANK_COLOURS = ['#15803D', '#6D4AAF', '#BE5A38'];
const DEFAULT_DISCIPLINE_ORDER = ['bike', 'run', 'swim'];

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Default per-type config ──────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  event_race:         {
    raceType: '', raceDate: '', startDate: '', fitnessLevel: '',
    hasTargetTime: null,
    targetTimeHours: '', targetTimeMinutes: '', targetTimeSeconds: null,
    hasCutoffTime: null,
    cutoffTimeHours: '', cutoffTimeMinutes: '', cutoffTimeSeconds: null,
    cutoffTimes: null, // { swim, bike, run } seconds — per-discipline, triathlon only (§A.10)
    trailDistanceKm: '', // race distance in km — Trail Running only, sizes the peak long run
  },
  strength_programme: { focus: '' },
  sport_activity:     { sportType: '', daysPerWeek: 2, intensity: 'Moderate' },
  general_fitness:    { activities: [] },
  micro_target:       { description: '' },
};

const EMPTY_INTAKE = {
  runBaseline:  { time5k: '', time10k: '', timeHalfMarathon: '', timeMarathon: '', longestEffortKm: '', canRunContinuously60min: null, longestEffortMinutes: '' },
  swimBaseline: { time400m: '', longestSessionM: '', openWaterExperience: '', wetsuitExperience: '' },
  bikeBaseline: { ftpWatts: '', longestRideKm: '', bikeType: '' },
  disciplineRanking: [],
  targetPaces: null,
  availability: { holidays: [], oneOffEvents: [] },
  preferences: { longSessionDay: '', secondDisciplineDay: '', conditioningDay: '', hillDay: '' },
  injury: { pastInjuries: [], currentNiggles: '', healthConditions: '', avoidExerciseIds: [], aggravatingFactors: '' },
};

// `selectedGoals` (below) is an array of goal *type strings* (e.g.
// ['event_race', 'general_fitness']), not goal objects — these all take
// that shape directly rather than expecting a `.type`/`.config` object,
// which a `goals.some(g => g.type === ...)`-style check would silently
// always evaluate false against a plain string array.
function isRaceGoal(selectedGoalTypes = []) {
  return selectedGoalTypes.includes('event_race');
}
function isTriathlonGoal(selectedGoalTypes, eventRaceConfig) {
  return isRaceGoal(selectedGoalTypes) && isTriathlonRaceType(eventRaceConfig?.raceType);
}

// ─── GoalsSetupScreen ─────────────────────────────────────────────────────────

export function GoalsSetupScreen({
  width = 390, height = 820, theme = 'light', onComplete, userId,
  initialGoalsPayload, initialIntake, // re-entry — pre-fills every field below instead of starting blank
  onExit,
}) {
  const t = themes[theme];
  const initialGoals = initialGoalsPayload?.goals || [];

  // ── goal selection & config ──────────────────────────────────────────────
  const [selectedGoals, setSelectedGoals] = React.useState(() => initialGoals.map(g => g.type));
  const [goalConfigs,   setGoalConfigs]   = React.useState(() => {
    const configs = {};
    initialGoals.forEach(g => {
      const config = { ...DEFAULT_CONFIG[g.type], ...g.config };
      if (g.type === 'event_race' && !config.startDate) config.startDate = todayISO();
      configs[g.type] = config;
    });
    return configs;
  });

  // ── per-discipline day picker (§A.7) — event_race only; frequency = count ──
  // Read-time fallback for pre-merge saved payloads: derive from the old
  // poolDays/trainingDays shape if disciplineDays was never saved.
  const [disciplineDays, setDisciplineDays] = React.useState(() => {
    if (initialGoalsPayload?.disciplineDays) return initialGoalsPayload.disciplineDays;
    const legacyTrainingDays = initialGoalsPayload?.trainingDays || [];
    return {
      swim: initialGoalsPayload?.poolDays || [],
      bike: [], run: legacyTrainingDays,
    };
  });

  // ── generic training days — non-race goal combos only (unchanged legacy path) ──
  const [trainingDays, setTrainingDays] = React.useState(() => initialGoalsPayload?.trainingDays || []);

  // ── facilities ────────────────────────────────────────────────────────────
  const [gymAccess, setGymAccess] = React.useState(() => initialGoalsPayload?.gymAccess ?? false);

  // ── merged standing-commitments / regular-sports list (§A.5, §A.6) ─────────
  // {label, day, time, countsTowardLoad} — replaces the old separate
  // regularSports ({sport,day,intensity}) and availability.standingCommitments
  // ({label,day,time}) lists. Fall back to whichever old list exists so a
  // re-entering user doesn't lose what they already entered.
  const [standingCommitments, setStandingCommitments] = React.useState(() => {
    if (initialGoalsPayload?.standingCommitments) return initialGoalsPayload.standingCommitments;
    const fromSports = (initialGoalsPayload?.regularSports || []).map(s => ({ label: s.sport, day: s.day, time: '', countsTowardLoad: false }));
    const fromAvail = (initialIntake?.availability?.standingCommitments || []).map(c => ({ ...c, countsTowardLoad: false }));
    return [...fromSports, ...fromAvail];
  });
  const [commitmentDraft, setCommitmentDraft] = React.useState({ label: '', day: '', time: '', countsTowardLoad: false });

  // ── intake (former Stage 3) ─────────────────────────────────────────────────
  const [intake, setIntake] = React.useState(() => ({
    ...EMPTY_INTAKE,
    ...(initialIntake || {}),
    runBaseline:  { ...EMPTY_INTAKE.runBaseline,  ...(initialIntake?.runBaseline  || {}) },
    swimBaseline: { ...EMPTY_INTAKE.swimBaseline, ...(initialIntake?.swimBaseline || {}) },
    bikeBaseline: { ...EMPTY_INTAKE.bikeBaseline, ...(initialIntake?.bikeBaseline || {}) },
    availability: { holidays: [], oneOffEvents: [], ...(initialIntake?.availability || {}) },
    preferences:  { ...EMPTY_INTAKE.preferences,  ...(initialIntake?.preferences  || {}) },
    injury:       { ...EMPTY_INTAKE.injury,       ...(initialIntake?.injury       || {}) },
  }));
  const patchIntake = (key, patch) => setIntake(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const patchAvail  = (key, patch) => setIntake(prev => ({ ...prev, availability: { ...prev.availability, [key]: patch } }));
  const patchInjury = (patch) => setIntake(prev => ({ ...prev, injury: { ...prev.injury, ...patch } }));

  const [holidayDraft, setHolidayDraft] = React.useState({ label: '', from: '', to: '' });
  const [oneOffDraft,  setOneOffDraft]  = React.useState({ label: '', date: '' });
  const [injuryDraft,  setInjuryDraft]  = React.useState({ area: '', description: '', resolved: true });

  // ── step management ───────────────────────────────────────────────────────
  const buildSteps = (goals) => {
    const steps = ['select'];
    if (goals.length >= 2) steps.push('rank');
    goals.forEach(g => steps.push(`config_${g}`));
    const eventCfg = goalConfigsRef.current['event_race'] || {};
    // Target pace/cutoff times are entered directly per discipline inside
    // config_event_race now (no separate "confirm a derived split" step —
    // see setTargetPaceLeg above for why that step was removed).
    steps.push('day_picker');
    if (isRaceGoal(goals)) steps.push('run_baseline');
    if (isTriathlonGoal(goals, eventCfg)) steps.push('swim_baseline', 'bike_baseline', 'discipline_rank');
    // ── skip point: everything from here on is refinement, not required to get a plan ──
    steps.push('availability', 'preferences', 'injury');
    steps.push('done');
    return steps;
  };
  // buildSteps needs the *current* event_race config to decide on isTriathlonGoal,
  // but is itself called during render before goalConfigs updates settle —
  // a ref sidesteps a stale-closure step list without adding another effect.
  const goalConfigsRef = React.useRef(goalConfigs);
  goalConfigsRef.current = goalConfigs;

  const [stepIdx, setStepIdx] = React.useState(0);
  const steps   = buildSteps(selectedGoals);
  const current = steps[stepIdx] || 'select';
  const progress = (stepIdx + 1) / steps.length;
  const isLast   = stepIdx === steps.length - 1;
  const skipPointIdx = steps.indexOf('availability');
  const pastSkipPoint = skipPointIdx >= 0 && stepIdx >= skipPointIdx && current !== 'done';

  React.useEffect(() => {
    setStepIdx(s => Math.min(s, steps.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const next = () => isLast ? handleComplete(false) : setStepIdx(s => s + 1);
  const back = () => setStepIdx(s => Math.max(0, s - 1));

  const eventCfg = goalConfigs['event_race'] || {};
  const triathlon = isTriathlonRaceType(eventCfg.raceType);
  const raceDisciplines = disciplinesForRaceType(eventCfg.raceType);

  // Preview-only plan for the "done" step's Plan overview dropdown — built
  // from the exact same inputs handleGoalsSetupComplete (App.jsx) passes to
  // buildTrainingPlan, so it's a true preview of what completion will
  // produce, not a separate estimate. buildTrainingPlan is a pure function,
  // so recomputing it here and again on submit is redundant work but never
  // a source of drift. Only computed once the athlete actually reaches
  // 'done' — every other step would otherwise recompute this on each
  // keystroke for no reason, since it's not needed until then.
  const previewPlan = React.useMemo(() => {
    if (current !== 'done') return null;
    if (!isRaceGoal(selectedGoals) || !isEngineSupportedRaceType(eventCfg.raceType)) return null;
    if (!eventCfg.raceDate || !eventCfg.startDate) return null;
    try {
      return buildTrainingPlan({
        raceType: eventCfg.raceType,
        startDate: eventCfg.startDate,
        raceDate: eventCfg.raceDate,
        fitnessLevel: eventCfg.fitnessLevel,
        disciplineDays,
        disciplineRanking: intake.disciplineRanking,
        baselines: { run: intake.runBaseline, swim: intake.swimBaseline, bike: intake.bikeBaseline },
        preferences: intake.preferences,
        gymAccess,
        holidays: intake.availability?.holidays,
        oneOffEvents: intake.availability?.oneOffEvents,
        cutoffTimes: eventCfg.cutoffTimes,
        targetPaces: intake.targetPaces,
        trailDistanceKm: eventCfg.trailDistanceKm,
        injury: intake.injury,
      });
    } catch (e) {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, selectedGoals, eventCfg, disciplineDays, intake, gymAccess]);

  const canAdvance = (() => {
    if (current === 'select') return selectedGoals.length >= 1;
    if (current === 'config_event_race') {
      if (!(eventCfg.raceType && eventCfg.raceDate && eventCfg.startDate && eventCfg.fitnessLevel)) return false;
      if (isTrailRaceType(eventCfg.raceType) && !(Number(eventCfg.trailDistanceKm) > 0)) return false;
      if (eventCfg.hasTargetTime === null || eventCfg.hasTargetTime === undefined) return false;
      if (eventCfg.hasTargetTime && !(eventCfg.targetTimeSeconds > 0)) return false;
      if (eventCfg.hasCutoffTime === null || eventCfg.hasCutoffTime === undefined) return false;
      if (eventCfg.hasCutoffTime && !(eventCfg.cutoffTimeSeconds > 0)) return false;
      return true;
    }
    if (current === 'config_strength_programme') return !!(goalConfigs['strength_programme']?.focus);
    if (current === 'config_sport_activity') return !!(goalConfigs['sport_activity']?.sportType);
    if (current === 'config_general_fitness') return (goalConfigs['general_fitness']?.activities || []).length >= 1;
    if (current === 'day_picker') {
      if (isRaceGoal(selectedGoals)) {
        // Trail Running needs exactly 3-4 running days (1 long + 1 hill +
        // 1-2 easy) — stricter than the generic "at least one day" rule
        // every other race type uses.
        if (isTrailRaceType(eventCfg.raceType)) {
          const n = (disciplineDays.run || []).length;
          return n >= 3 && n <= 4;
        }
        // Every discipline the race needs must have at least one day selected
        // — block advancing rather than silently degrading to no sessions.
        return raceDisciplines.every(d => (disciplineDays[d] || []).length >= 1);
      }
      return trainingDays.length >= 1;
    }
    if (current === 'run_baseline' || current === 'swim_baseline' || current === 'bike_baseline') return true; // mandatory but self-reported — no hard block on specific fields
    return true;
  })();

  const updateConfig = (goalType, patch) => setGoalConfigs(c => ({ ...c, [goalType]: { ...(c[goalType] || {}), ...patch } }));
  const toggleGoal = (id) => {
    setSelectedGoals(prev => {
      if (prev.includes(id)) return prev.filter(g => g !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    if (!goalConfigs[id]) {
      // Start date's input displays today's date via a `|| todayISO()` visual
      // fallback so the field never looks empty — but that fallback only
      // lives in the input's `value` prop. Without seeding it into real
      // state here too, canAdvance's `eventCfg.startDate` check stays false
      // (and Continue stays permanently disabled) until the user happens to
      // manually re-touch a field that already looked filled in.
      const config = { ...DEFAULT_CONFIG[id] };
      if (id === 'event_race') config.startDate = todayISO();
      setGoalConfigs(c => ({ ...c, [id]: config }));
    }
  };
  const moveGoal = (idx, dir) => {
    setSelectedGoals(prev => {
      const nextArr = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= nextArr.length) return prev;
      [nextArr[idx], nextArr[swapIdx]] = [nextArr[swapIdx], nextArr[idx]];
      return nextArr;
    });
  };

  const toggleDisciplineDay = (discipline, dayKey) => {
    setDisciplineDays(prev => {
      const days = prev[discipline] || [];
      const next = days.includes(dayKey) ? days.filter(d => d !== dayKey) : [...days, dayKey];
      return { ...prev, [discipline]: next };
    });
  };

  const addCommitment = () => {
    if (!commitmentDraft.label || !commitmentDraft.day) return;
    setStandingCommitments(prev => [...prev, { ...commitmentDraft }]);
    setCommitmentDraft({ label: '', day: '', time: '', countsTowardLoad: false });
  };

  const addHoliday = () => {
    if (!holidayDraft.label || !holidayDraft.from) return;
    patchAvail('holidays', [...intake.availability.holidays, { ...holidayDraft }]);
    setHolidayDraft({ label: '', from: '', to: '' });
  };
  const addOneOff = () => {
    if (!oneOffDraft.label || !oneOffDraft.date) return;
    patchAvail('oneOffEvents', [...intake.availability.oneOffEvents, { ...oneOffDraft }]);
    setOneOffDraft({ label: '', date: '' });
  };
  const addInjury = () => {
    if (!injuryDraft.area) return;
    patchInjury({ pastInjuries: [...intake.injury.pastInjuries, { ...injuryDraft }] });
    setInjuryDraft({ area: '', description: '', resolved: true });
  };

  const disciplineRanking = intake.disciplineRanking.length ? intake.disciplineRanking : DEFAULT_DISCIPLINE_ORDER;
  const moveDiscipline = (idx, dir) => {
    const arr = [...disciplineRanking];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setIntake(prev => ({ ...prev, disciplineRanking: arr }));
  };

  // ── target pace, entered directly per discipline (no more "derive a
  // default split, then let the athlete edit it" step) ───────────────────
  // The old flow silently guessed a swim/bike/run/transition split from the
  // race type's typical proportions and only recomputed it once per
  // onboarding pass (guarded on `!intake.targetPaces`) — on a redo, that
  // guard meant a *freshly entered* overall target time never actually
  // recomputed the split, so the athlete kept seeing stale numbers from
  // whatever total was entered on an earlier pass. Asking for each leg
  // directly (same pattern as the per-discipline cutoff times below) avoids
  // the guess entirely and can't go stale the same way, since there's
  // nothing to derive.
  const setTargetPaceLeg = (discipline, hours, minutes) => {
    const existing = intake.targetPaces?.[discipline] || 0;
    const h = hours !== undefined ? hours : Math.floor(existing / 3600);
    const m = minutes !== undefined ? minutes : Math.floor((existing % 3600) / 60);
    const seconds = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60;
    const nextTargetPaces = { ...intake.targetPaces, [discipline]: seconds };
    const total = ['swim', 'transition', 'bike', 'run'].reduce((sum, d) => sum + (nextTargetPaces[d] || 0), 0);
    setIntake(prev => ({ ...prev, targetPaces: nextTargetPaces }));
    updateConfig('event_race', { targetTimeSeconds: total > 0 ? total : null });
  };
  const setTargetTransitionMinutes = (minutes) => {
    const seconds = (parseInt(minutes, 10) || 0) * 60;
    const nextTargetPaces = { ...intake.targetPaces, transition: seconds };
    const total = ['swim', 'transition', 'bike', 'run'].reduce((sum, d) => sum + (nextTargetPaces[d] || 0), 0);
    setIntake(prev => ({ ...prev, targetPaces: nextTargetPaces }));
    updateConfig('event_race', { targetTimeSeconds: total > 0 ? total : null });
  };

  // ── per-discipline cutoff times (§A.10) ─────────────────────────────────
  // For a triathlon, the individual swim/bike/run cutoffs are the primary
  // entry — the overall cutoffTimeSeconds (read by canAdvance's validation,
  // the pace-confirm step, and passed straight through to planEngine.js) is
  // derived as their sum rather than asked for separately.
  const setCutoffLeg = (discipline, hours, minutes) => {
    const existing = eventCfg.cutoffTimes?.[discipline] || 0;
    const h = hours !== undefined ? hours : Math.floor(existing / 3600);
    const m = minutes !== undefined ? minutes : Math.floor((existing % 3600) / 60);
    const seconds = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60;
    const nextCutoffTimes = { ...eventCfg.cutoffTimes, [discipline]: seconds };
    const total = ['swim', 'bike', 'run'].reduce((sum, d) => sum + (nextCutoffTimes[d] || 0), 0);
    updateConfig('event_race', { cutoffTimes: nextCutoffTimes, cutoffTimeSeconds: total > 0 ? total : null });
  };

  // ── completion ────────────────────────────────────────────────────────────
  const [saving, setSaving] = React.useState(false);
  const handleSkip = () => handleComplete(true);

  const handleComplete = async (skipped) => {
    if (saving) return;
    const trainingDaysUnion = isRaceGoal(selectedGoals)
      ? [...new Set(raceDisciplines.flatMap(d => disciplineDays[d] || []))]
      : trainingDays;
    const unavailableDays = DAY_KEYS.filter(d => !trainingDaysUnion.includes(d));

    const goalsPayload = {
      goals: selectedGoals.map((type, i) => ({ type, rank: RANK_LABELS[i] || 'Supporting', config: goalConfigs[type] || {} })),
      trainingDays: trainingDaysUnion,
      trainingDaysPerWeek: trainingDaysUnion.length,
      unavailableDays,
      gymAccess,
      disciplineDays: isRaceGoal(selectedGoals) ? disciplineDays : { swim: [], bike: [], run: [] },
      standingCommitments,
      savedAt: new Date().toISOString(),
    };

    const intakePayload = {
      ...intake,
      status: skipped ? 'draft' : 'complete',
      completedAt: skipped ? null : new Date().toISOString(),
    };

    if (userId) {
      try {
        localStorage.setItem(`forma_goals_${userId}`, JSON.stringify(goalsPayload));
        localStorage.setItem(`forma_intake_${userId}`, JSON.stringify(intakePayload));
      } catch {}
    }

    const goalConfigPatch = intake.targetPaces ? { targetPaces: intake.targetPaces } : null;
    // onComplete (App.jsx's handleGoalsSetupComplete) is async — it awaits
    // the actual Supabase writes before resolving. Blocking on it here
    // (disabling the buttons below via `saving`) stops a double-submit and,
    // more importantly, stops the athlete navigating away mid-save, which
    // is exactly the race that made a completed redo intermittently look
    // like it hadn't taken effect.
    setSaving(true);
    try {
      await onComplete({ goalsPayload, intakePayload, goalConfigPatch, skipped });
    } finally {
      setSaving(false);
    }
  };

  const stepLabel = (s) => ({
    select: 'Goals', rank: 'Priority',
    config_event_race: 'Race details', config_strength_programme: 'Strength focus',
    config_sport_activity: 'Sport details', config_micro_target: 'Your target',
    config_general_fitness: 'Activities', day_picker: 'Schedule & access',
    run_baseline: 'Run baseline', swim_baseline: 'Swim baseline', bike_baseline: 'Bike baseline',
    discipline_rank: 'Discipline ranking', availability: 'Availability',
    preferences: 'Day preferences', injury: 'Health & injury', done: '',
  }[s] || s);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}28, transparent 65%)`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, #6D4AAF18, transparent 65%)`, pointerEvents: 'none',
      }} />

      <div style={{ height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 22px 8px', fontSize: 14, fontWeight: 600 }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}><span>●●●</span><span>📶</span><span>🔋</span></div>
      </div>

      <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {stepIdx > 0 && current !== 'done' ? (
          <button onClick={back} style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>←</button>
        ) : stepIdx === 0 && onExit ? (
          <button onClick={onExit} style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
        ) : <div style={{ width: 32, flexShrink: 0 }} />}

        <div style={{ flex: 1 }}>
          <div style={{ height: 3, background: t.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: t.accent, borderRadius: 99, width: `${progress * 100}%`, transition: 'width .4s cubic-bezier(.2,.7,.2,1)' }} />
          </div>
          <div style={{ fontSize: 9.5, color: t.text3, marginTop: 4, letterSpacing: '.06em', display: 'flex', justifyContent: 'space-between' }}>
            <span>Step {stepIdx + 1} of {steps.length}</span>
            <span style={{ textTransform: 'uppercase' }}>{stepLabel(current)}</span>
          </div>
        </div>
        {stepIdx > 0 && onExit ? (
          <button onClick={onExit} style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: `1px solid ${t.border}`, color: t.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
        ) : <div style={{ width: 32 }} />}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 20px' }} className="phone-scroll">

        {current === 'select' && (
          <div>
            <StepTitle t={t}>What are your goals?</StepTitle>
            <StepSub t={t}>Pick up to 3. You'll rank them by priority next.</StepSub>
            {GOAL_TYPES.map(g => {
              const active = selectedGoals.includes(g.id);
              const rank = selectedGoals.indexOf(g.id);
              const disabled = !active && selectedGoals.length >= 3;
              return (
                <button key={g.id} onClick={() => !disabled && toggleGoal(g.id)} style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 13,
                  background: active ? t.accent + '10' : disabled ? t.surface2 : t.surface,
                  border: `1.5px solid ${active ? t.accent : t.border}`,
                  cursor: disabled ? 'default' : 'pointer', fontFamily: t.sans, marginBottom: 8,
                  display: 'flex', gap: 11, alignItems: 'center', opacity: disabled ? 0.45 : 1,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? t.accent + '20' : t.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{g.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.label}</div>
                    <div style={{ fontSize: 10.5, color: t.text3, marginTop: 1 }}>{g.sub}</div>
                  </div>
                  {active && (
                    <div style={{ minWidth: 52, height: 22, borderRadius: 11, background: RANK_COLOURS[rank] || t.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', padding: '0 8px', textTransform: 'uppercase' }}>
                      {RANK_LABELS[rank] || 'Supporting'}
                    </div>
                  )}
                </button>
              );
            })}
            {selectedGoals.length >= 3 && (
              <div style={{ padding: '9px 12px', borderRadius: 10, background: t.surface2, border: `1px dashed ${t.border}`, fontSize: 11.5, color: t.text3, marginTop: 4 }}>
                Maximum 3 goals selected. Tap one to remove it.
              </div>
            )}
          </div>
        )}

        {current === 'rank' && (
          <div>
            <StepTitle t={t}>Set your priority.</StepTitle>
            <StepSub t={t}>Use the arrows to rank your goals. Your Primary goal drives the plan most.</StepSub>
            {selectedGoals.map((goalId, idx) => {
              const meta = GOAL_TYPES.find(g => g.id === goalId);
              return (
                <div key={goalId} style={{ padding: '12px 14px', borderRadius: 13, marginBottom: 8, background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: RANK_COLOURS[idx] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta?.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{meta?.label}</div>
                    <div style={{ fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700, color: RANK_COLOURS[idx], textTransform: 'uppercase', marginTop: 2 }}>{RANK_LABELS[idx]}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button onClick={() => moveGoal(idx, -1)} disabled={idx === 0} style={{ width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: idx === 0 ? t.text3 : t.text, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
                    <button onClick={() => moveGoal(idx, 1)} disabled={idx === selectedGoals.length - 1} style={{ width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: idx === selectedGoals.length - 1 ? t.text3 : t.text, cursor: idx === selectedGoals.length - 1 ? 'default' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {current === 'config_event_race' && (
          <div>
            <StepTitle t={t}>Race details.</StepTitle>
            <StepSub t={t}>Tell us about your event so we can build your plan.</StepSub>

            <GField label="Race type" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RACE_TYPES.map(rt => {
                  const active = eventCfg.raceType === rt;
                  return (
                    <button key={rt} onClick={() => updateConfig('event_race', { raceType: rt })} style={{
                      padding: '7px 11px', borderRadius: 9,
                      background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`,
                      color: active ? t.accent : t.text, fontFamily: t.sans, fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
                    }}>{rt}</button>
                  );
                })}
              </div>
              {isTrailRaceType(eventCfg.raceType) && (
                <div data-testid="trail-distance-bubble" style={{
                  marginTop: 10, padding: '12px 14px', borderRadius: 12,
                  background: t.surface2, border: `1px solid ${t.border}`,
                }}>
                  <div style={{ fontSize: 11, color: t.text2, marginBottom: 8, lineHeight: 1.4 }}>
                    How far is your race (km)? We'll build your long run toward being able to cover that distance, on top of the hill and easy trail sessions.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" inputMode="decimal" min="0" max="500" step="1"
                      value={eventCfg.trailDistanceKm || ''}
                      onChange={e => updateConfig('event_race', { trailDistanceKm: e.target.value })}
                      placeholder="e.g. 42" style={{ ...inputSt(t), flex: 1 }} />
                    <span style={{ fontSize: 12.5, color: t.text3, fontWeight: 600 }}>km</span>
                  </div>
                </div>
              )}
            </GField>

            <GField label="Start date" t={t}>
              <input type="date" value={eventCfg.startDate || todayISO()} min={todayISO()}
                onChange={e => updateConfig('event_race', { startDate: e.target.value })}
                style={dateInputSt(t)} />
            </GField>

            <GField label="Race date" t={t}>
              <input type="date" value={eventCfg.raceDate || ''} min={eventCfg.startDate || todayISO()}
                onChange={e => updateConfig('event_race', { raceDate: e.target.value })}
                style={dateInputSt(t)} />
            </GField>

            <GField label="Your current fitness level for this event" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FITNESS_LEVELS.map(fl => {
                  const active = eventCfg.fitnessLevel === fl;
                  return (
                    <button key={fl} onClick={() => updateConfig('event_race', { fitnessLevel: fl })} style={optionRowSt(t, active)}>
                      {fl}{active && <span style={{ color: t.accent, fontSize: 14 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </GField>

            <GField label="Do you have a target finish time in mind?" t={t}>
              <YesNoRow value={eventCfg.hasTargetTime} onChange={v => updateConfig('event_race', { hasTargetTime: v })} t={t} />
              {eventCfg.hasTargetTime && (
                triathlon ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: t.text3, marginBottom: 8 }}>Enter your target for each leg — the total below adds them up automatically.</div>
                    {['swim', 'bike', 'run'].map(disc => {
                      const seconds = intake.targetPaces?.[disc] || 0;
                      const distanceKm = legDistanceKm(disc, eventCfg.raceType);
                      const pace = formatPaceForDiscipline(disc, seconds, distanceKm, false);
                      return (
                        <div key={disc} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: t.text2, marginBottom: 4 }}>
                            {DISCIPLINE_META[disc].icon} {DISCIPLINE_META[disc].label}{pace ? <span style={{ color: t.text3 }}> — ≈ {pace}</span> : null}
                          </div>
                          <HoursMinutesInput
                            hours={Math.floor(seconds / 3600)} minutes={Math.floor((seconds % 3600) / 60)}
                            onChange={(h, m) => setTargetPaceLeg(disc, h, m)} t={t} />
                        </div>
                      );
                    })}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: t.text2, marginBottom: 4 }}>🔄 Transitions (T1+T2), optional</div>
                      <select value={Math.round((intake.targetPaces?.transition || 0) / 60) || ''}
                        onChange={e => setTargetTransitionMinutes(e.target.value)} style={{ ...inputSt(t), width: 120 }}>
                        <option value="">–</option>
                        {Array.from({ length: 21 }, (_, m) => <option key={m} value={m}>{m} min</option>)}
                      </select>
                    </div>
                    {eventCfg.targetTimeSeconds > 0 && (
                      <div style={{
                        marginTop: 10, padding: '9px 12px', borderRadius: 10,
                        background: t.surface2, border: `1px solid ${t.border}`,
                        fontSize: 12, color: t.text, fontWeight: 600,
                      }}>
                        Total target time: {formatSecondsAsHMS(eventCfg.targetTimeSeconds)}
                      </div>
                    )}
                  </div>
                ) : (
                  <HoursMinutesInput hours={eventCfg.targetTimeHours} minutes={eventCfg.targetTimeMinutes} t={t}
                    onChange={(h, m) => {
                      const hh = h !== undefined ? h : eventCfg.targetTimeHours;
                      const mm = m !== undefined ? m : eventCfg.targetTimeMinutes;
                      const seconds = (parseInt(hh, 10) || 0) * 3600 + (parseInt(mm, 10) || 0) * 60;
                      updateConfig('event_race', { targetTimeHours: hh, targetTimeMinutes: mm, targetTimeSeconds: seconds > 0 ? seconds : null });
                      setIntake(prev => ({ ...prev, targetPaces: seconds > 0 ? { run: seconds } : prev.targetPaces }));
                    }} />
                )
              )}
            </GField>

            <GField label="Does this race have a cutoff or qualifying time you need to meet?" t={t}>
              <div style={{ fontSize: 11.5, color: t.text3, marginBottom: 8, lineHeight: 1.4 }}>Some races require finishing within a set time limit.</div>
              <YesNoRow value={eventCfg.hasCutoffTime} onChange={v => updateConfig('event_race', { hasCutoffTime: v })} t={t} />
              {eventCfg.hasCutoffTime && (
                triathlon ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: t.text3, marginBottom: 8 }}>Enter the cutoff for each leg (swim/bike/run only) — the total below adds them up automatically.</div>
                    {['swim', 'bike', 'run'].map(disc => (
                      <div key={disc} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: t.text2, marginBottom: 4 }}>{DISCIPLINE_META[disc].icon} {DISCIPLINE_META[disc].label}</div>
                        <HoursMinutesInput
                          hours={Math.floor((eventCfg.cutoffTimes?.[disc] || 0) / 3600)}
                          minutes={Math.floor(((eventCfg.cutoffTimes?.[disc] || 0) % 3600) / 60)}
                          onChange={(h, m) => setCutoffLeg(disc, h, m)} t={t} />
                      </div>
                    ))}
                    {eventCfg.cutoffTimeSeconds > 0 && (
                      <div style={{
                        marginTop: 10, padding: '9px 12px', borderRadius: 10,
                        background: t.surface2, border: `1px solid ${t.border}`,
                        fontSize: 12, color: t.text, fontWeight: 600,
                      }}>
                        Total cutoff: {formatSecondsAsHMS(eventCfg.cutoffTimeSeconds)}
                      </div>
                    )}
                  </div>
                ) : (
                  <HoursMinutesInput hours={eventCfg.cutoffTimeHours} minutes={eventCfg.cutoffTimeMinutes} t={t}
                    onChange={(h, m) => {
                      const hh = h !== undefined ? h : eventCfg.cutoffTimeHours;
                      const mm = m !== undefined ? m : eventCfg.cutoffTimeMinutes;
                      const seconds = (parseInt(hh, 10) || 0) * 3600 + (parseInt(mm, 10) || 0) * 60;
                      updateConfig('event_race', { cutoffTimeHours: hh, cutoffTimeMinutes: mm, cutoffTimeSeconds: seconds > 0 ? seconds : null });
                    }} />
                )
              )}
            </GField>
          </div>
        )}

        {current === 'config_strength_programme' && (
          <div>
            <StepTitle t={t}>Strength focus.</StepTitle>
            <StepSub t={t}>What kind of strength training are you aiming for?</StepSub>
            <GField label="Focus area" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STRENGTH_FOCUSES.map(sf => {
                  const active = goalConfigs['strength_programme']?.focus === sf;
                  return (
                    <button key={sf} onClick={() => updateConfig('strength_programme', { focus: sf })} style={optionRowSt(t, active)}>
                      {sf}{active && <span style={{ color: t.accent, fontSize: 14 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </GField>
          </div>
        )}

        {current === 'config_sport_activity' && (
          <div>
            <StepTitle t={t}>Sport details.</StepTitle>
            <StepSub t={t}>Which sport are you training around?</StepSub>
            <GField label="Sport" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SPORT_TYPES.map(st => {
                  const active = goalConfigs['sport_activity']?.sportType === st;
                  return (
                    <button key={st} onClick={() => updateConfig('sport_activity', { sportType: st })} style={{
                      padding: '7px 11px', borderRadius: 9, background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`, color: active ? t.accent : t.text,
                      fontFamily: t.sans, fontSize: 11.5, cursor: 'pointer', fontWeight: 500,
                    }}>{st}</button>
                  );
                })}
              </div>
            </GField>
            <GField label="Sessions per week" t={t}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(d => {
                  const active = goalConfigs['sport_activity']?.daysPerWeek === d;
                  return (
                    <button key={d} onClick={() => updateConfig('sport_activity', { daysPerWeek: d })} style={{
                      flex: 1, padding: '13px 0', borderRadius: 11, background: active ? t.text : t.surface,
                      color: active ? (theme === 'dark' ? t.bg : '#fff') : t.text, border: `1px solid ${active ? t.text : t.border}`,
                      fontFamily: t.serif, fontSize: 20, cursor: 'pointer',
                    }}>{d}</button>
                  );
                })}
              </div>
            </GField>
            <GField label="Typical training intensity" t={t}>
              <div style={{ display: 'flex', gap: 6 }}>
                {INTENSITY_LEVELS.map(il => {
                  const active = goalConfigs['sport_activity']?.intensity === il;
                  return (
                    <button key={il} onClick={() => updateConfig('sport_activity', { intensity: il })} style={{
                      flex: 1, padding: '10px 0', borderRadius: 11, background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border}`, color: active ? t.accent : t.text,
                      fontFamily: t.sans, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}>{il}</button>
                  );
                })}
              </div>
            </GField>
          </div>
        )}

        {current === 'config_micro_target' && (
          <div>
            <StepTitle t={t}>Your target.</StepTitle>
            <StepSub t={t}>Describe your specific goal in a sentence or two.</StepSub>
            <GField label="Target" t={t}>
              <textarea
                value={goalConfigs['micro_target']?.description || ''}
                onChange={e => updateConfig('micro_target', { description: e.target.value })}
                placeholder="e.g. Run a sub-25 min 5K by August · Add 20 kg to my squat · Lose 5 kg by summer"
                rows={4} style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }} />
            </GField>
          </div>
        )}

        {current === 'config_general_fitness' && (
          <div>
            <StepTitle t={t}>What do you enjoy?</StepTitle>
            <StepSub t={t}>Pick the activities you like — we'll weave these into your weekly plan.</StepSub>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GENERAL_ACTIVITIES.map(act => {
                const selected = (goalConfigs['general_fitness']?.activities || []).includes(act.id);
                return (
                  <button key={act.id} onClick={() => {
                    const prev = goalConfigs['general_fitness']?.activities || [];
                    const next = selected ? prev.filter(a => a !== act.id) : [...prev, act.id];
                    updateConfig('general_fitness', { activities: next });
                  }} style={{
                    padding: '10px 14px', borderRadius: 11, background: selected ? t.accent + '15' : t.surface,
                    border: `1.5px solid ${selected ? t.accent : t.border}`, color: selected ? t.accent : t.text,
                    fontFamily: t.sans, fontSize: 13, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7,
                  }}><span>{act.icon}</span><span>{act.label}</span>{selected && <span style={{ fontSize: 12 }}>✓</span>}</button>
                );
              })}
            </div>
          </div>
        )}

        {current === 'day_picker' && (
          <div>
            <StepTitle t={t}>Your training setup.</StepTitle>
            <StepSub t={t}>{isRaceGoal(selectedGoals) ? 'Which days do you want to train each discipline?' : 'Days you can train, and what you have access to.'}</StepSub>

            {isRaceGoal(selectedGoals) ? (
              raceDisciplines.map(disc => {
                const meta = DISCIPLINE_META[disc];
                const days = disciplineDays[disc] || [];
                return (
                  <GField key={disc} label={`${meta.icon} ${meta.label} — pick days`} t={t}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                      {DAYS.map((day, i) => {
                        const key = DAY_KEYS[i];
                        const on = days.includes(key);
                        return (
                          <button key={key} data-testid={`day-toggle-${disc}-${key}`} data-selected={on} onClick={() => toggleDisciplineDay(disc, key)} style={{
                            padding: '10px 0', borderRadius: 10, fontSize: 10.5, fontWeight: 600,
                            background: on ? t.accent : t.surface, color: on ? t.accentText : t.text3,
                            border: `1.5px solid ${on ? t.accent : t.border}`, fontFamily: t.sans, cursor: 'pointer',
                          }}>{day}</button>
                        );
                      })}
                    </div>
                    {isTrailRaceType(eventCfg.raceType) ? (
                      (days.length < 3 || days.length > 4) && (
                        <div style={{ fontSize: 10.5, color: t.rose || '#BE3B2E', marginTop: 6 }}>Pick 3 or 4 days for trail running — 1 long run, 1 hill workout, and 1–2 easy runs.</div>
                      )
                    ) : (
                      !days.length && (
                        <div style={{ fontSize: 10.5, color: t.rose || '#BE3B2E', marginTop: 6 }}>Pick at least one day for {meta.label.toLowerCase()}.</div>
                      )
                    )}
                  </GField>
                );
              })
            ) : (
              <GField label="Training days" t={t}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {DAYS.map((day, i) => {
                    const key = DAY_KEYS[i];
                    const on = trainingDays.includes(key);
                    return (
                      <button key={key} onClick={() => setTrainingDays(prev => on ? prev.filter(d => d !== key) : [...prev, key])} style={{
                        padding: '11px 0', borderRadius: 11, fontSize: 11, fontWeight: 600,
                        background: on ? t.accent : t.surface, color: on ? t.accentText : t.text3,
                        border: `1.5px solid ${on ? t.accent : t.border}`, fontFamily: t.sans, cursor: 'pointer',
                      }}>{day}</button>
                    );
                  })}
                </div>
              </GField>
            )}
            <div style={{ fontSize: 10.5, color: t.text3, marginTop: -6, marginBottom: 16 }}>Don't worry — you can change these later.</div>

            <GField label="Access" t={t}>
              <ToggleCard icon="🏋️" title="Gym access" sub="Weight room, machines, cables" active={gymAccess} onToggle={() => setGymAccess(v => !v)} t={t} />
            </GField>

            <GField label="Other regular commitments" t={t}>
              <div style={{ fontSize: 11.5, color: t.text3, marginBottom: 10, lineHeight: 1.4 }}>
                Gym, football, anything regular outside your training — we'll factor the load in if you say so. Skip if none.
              </div>
              {standingCommitments.map((c, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 12, background: t.surface, border: `1px solid ${t.border}`, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>
                      {c.day ? c.day.charAt(0).toUpperCase() + c.day.slice(1) : ''}{c.time ? ` · ${c.time}` : ''} · {c.countsTowardLoad ? 'Counts toward training load' : 'Outside training load'}
                    </div>
                  </div>
                  <button onClick={() => setStandingCommitments(prev => prev.filter((_, j) => j !== i))} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.text3, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <div style={{ padding: '14px', borderRadius: 13, background: t.surface2, border: `1px dashed ${t.border}`, marginTop: standingCommitments.length ? 8 : 0 }}>
                <input placeholder="Label (e.g. Football)" value={commitmentDraft.label}
                  onChange={e => setCommitmentDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12, marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <select value={commitmentDraft.day} onChange={e => setCommitmentDraft(d => ({ ...d, day: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }}>
                    <option value="">Day</option>
                    {DAYS.map((day, i) => <option key={i} value={DAY_KEYS[i]}>{day}</option>)}
                  </select>
                  <input type="time" value={commitmentDraft.time} onChange={e => setCommitmentDraft(d => ({ ...d, time: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={commitmentDraft.countsTowardLoad} onChange={e => setCommitmentDraft(d => ({ ...d, countsTowardLoad: e.target.checked }))} />
                  <span style={{ fontSize: 11.5, color: t.text2 }}>Should this count toward my training load?</span>
                </label>
                <button onClick={addCommitment} disabled={!commitmentDraft.label || !commitmentDraft.day} style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: (commitmentDraft.label && commitmentDraft.day) ? t.accent : t.border,
                  color: (commitmentDraft.label && commitmentDraft.day) ? t.accentText : t.text3,
                  border: 'none', fontFamily: t.sans, fontSize: 12.5, fontWeight: 600,
                  cursor: (commitmentDraft.label && commitmentDraft.day) ? 'pointer' : 'default',
                }}>+ Add</button>
              </div>
            </GField>
          </div>
        )}

        {current === 'run_baseline' && (
          <div>
            <StepTitle t={t}>Run baseline.</StepTitle>
            <StepSub t={t}>Best recent times — leave blank if you haven't raced that distance. The engine treats no usable time as a beginner starting point.</StepSub>
            <DQField label="5K time" hint="e.g. 25:30" t={t}><TimeInput value={intake.runBaseline.time5k} onChange={v => patchIntake('runBaseline', { time5k: v })} placeholder="mm:ss" t={t} /></DQField>
            <DQField label="10K time" hint="e.g. 53:00" t={t}><TimeInput value={intake.runBaseline.time10k} onChange={v => patchIntake('runBaseline', { time10k: v })} placeholder="mm:ss" t={t} /></DQField>
            <DQField label="Half marathon time" hint="e.g. 1:58:00" t={t}><TimeInput value={intake.runBaseline.timeHalfMarathon} onChange={v => patchIntake('runBaseline', { timeHalfMarathon: v })} placeholder="h:mm:ss" t={t} /></DQField>
            <DQField label="Marathon time" hint="e.g. 4:12:00" t={t}><TimeInput value={intake.runBaseline.timeMarathon} onChange={v => patchIntake('runBaseline', { timeMarathon: v })} placeholder="h:mm:ss" t={t} /></DQField>
            <DQField label="Longest single run recently (km)" t={t}>
              <input type="number" inputMode="decimal" min="0" max="200" step="0.5" value={intake.runBaseline.longestEffortKm}
                onChange={e => patchIntake('runBaseline', { longestEffortKm: e.target.value })} placeholder="e.g. 18" style={inputSt(t)} />
            </DQField>
            <DQField label="Can you run continuously for 60 minutes?" t={t}>
              <YesNoRow value={intake.runBaseline.canRunContinuously60min} onChange={v => patchIntake('runBaseline', { canRunContinuously60min: v })} t={t} />
            </DQField>
            {isTrailRaceType(eventCfg.raceType) && (
              <DQField label="Roughly how long is the longest continuous run or hike you've done recently? (minutes)" t={t}>
                <input type="number" inputMode="numeric" min="0" max="600" step="5" value={intake.runBaseline.longestEffortMinutes}
                  onChange={e => patchIntake('runBaseline', { longestEffortMinutes: e.target.value })} placeholder="e.g. 90" style={inputSt(t)} />
              </DQField>
            )}
          </div>
        )}

        {current === 'swim_baseline' && (
          <div>
            <StepTitle t={t}>Swim baseline.</StepTitle>
            <StepSub t={t}>Your current pool performance — approximate is fine.</StepSub>
            <DQField label="400m swim time" hint="e.g. 7:45" t={t}><TimeInput value={intake.swimBaseline.time400m} onChange={v => patchIntake('swimBaseline', { time400m: v })} placeholder="mm:ss" t={t} /></DQField>
            <DQField label="Longest continuous swim (metres)" t={t}>
              <input type="number" inputMode="numeric" min="0" max="50000" step="100" value={intake.swimBaseline.longestSessionM}
                onChange={e => patchIntake('swimBaseline', { longestSessionM: e.target.value })} placeholder="e.g. 1500" style={inputSt(t)} />
            </DQField>
            <DQField label="Open-water swimming experience" hint="Optional" t={t}>
              <input value={intake.swimBaseline.openWaterExperience} onChange={e => patchIntake('swimBaseline', { openWaterExperience: e.target.value })}
                placeholder="e.g. A few lake swims last summer" style={inputSt(t)} />
            </DQField>
            <DQField label="Wetsuit experience" hint="Optional" t={t}>
              <input value={intake.swimBaseline.wetsuitExperience} onChange={e => patchIntake('swimBaseline', { wetsuitExperience: e.target.value })}
                placeholder="e.g. Never worn one" style={inputSt(t)} />
            </DQField>
          </div>
        )}

        {current === 'bike_baseline' && (
          <div>
            <StepTitle t={t}>Bike baseline.</StepTitle>
            <StepSub t={t}>Your current cycling fitness — FTP and longest recent ride.</StepSub>
            <DQField label="FTP — Functional Threshold Power (watts)" hint="Leave blank if untested." t={t}>
              <input type="number" inputMode="numeric" min="0" max="600" step="1" value={intake.bikeBaseline.ftpWatts}
                onChange={e => patchIntake('bikeBaseline', { ftpWatts: e.target.value })} placeholder="e.g. 210" style={inputSt(t)} />
            </DQField>
            <DQField label="Longest ride recently (km)" t={t}>
              <input type="number" inputMode="decimal" min="0" max="500" step="1" value={intake.bikeBaseline.longestRideKm}
                onChange={e => patchIntake('bikeBaseline', { longestRideKm: e.target.value })} placeholder="e.g. 60" style={inputSt(t)} />
            </DQField>
            <DQField label="Bike type" t={t}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Road/tri bike', 'Other'].map(bt => {
                  const active = intake.bikeBaseline.bikeType === bt;
                  return (
                    <button key={bt} onClick={() => patchIntake('bikeBaseline', { bikeType: bt })} style={{
                      flex: 1, padding: '10px 0', borderRadius: 9, background: active ? t.accent + '15' : t.surface,
                      border: `1.5px solid ${active ? t.accent : t.border2}`, color: active ? t.accent : t.text2, fontFamily: t.sans, fontSize: 12, cursor: 'pointer',
                    }}>{bt}</button>
                  );
                })}
              </div>
            </DQField>
          </div>
        )}

        {current === 'discipline_rank' && (
          <div>
            <StepTitle t={t}>Rank your disciplines.</StepTitle>
            <StepSub t={t}>Strongest to weakest. During the early Foundation phase, your weakest discipline gets priority for extra sessions within the days you've already picked — this doesn't change Build or Taper, and plans short enough to skip a Foundation phase won't see an effect.</StepSub>
            {disciplineRanking.map((disc, idx) => {
              const meta = DISCIPLINE_META[disc];
              return (
                <div key={disc} style={{ padding: '12px 14px', borderRadius: 13, marginBottom: 8, background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: DISCIPLINE_RANK_COLOURS[idx] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</div>
                    <div style={{ fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700, color: DISCIPLINE_RANK_COLOURS[idx], textTransform: 'uppercase', marginTop: 2 }}>{DISCIPLINE_RANK_LABELS[idx]}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button onClick={() => moveDiscipline(idx, -1)} disabled={idx === 0} style={{ width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: idx === 0 ? t.text3 : t.text, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
                    <button onClick={() => moveDiscipline(idx, 1)} disabled={idx === disciplineRanking.length - 1} style={{ width: 28, height: 26, borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: idx === disciplineRanking.length - 1 ? t.text3 : t.text, cursor: idx === disciplineRanking.length - 1 ? 'default' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {current === 'availability' && (
          <div>
            <StepTitle t={t}>Availability.</StepTitle>
            <StepSub t={t}>Holidays or events that affect your training. Skip any that don't apply.</StepSub>
            <DQField label="Holidays / time away" t={t}>
              {intake.availability.holidays.map((h, i) => (
                <EntryChip key={i} label={`${h.label} · ${h.from}${h.to ? ' → ' + h.to : ''}`}
                  onRemove={() => patchAvail('holidays', intake.availability.holidays.filter((_, j) => j !== i))} t={t} />
              ))}
              <div style={{ padding: '12px', borderRadius: 12, background: t.surface2, border: `1px dashed ${t.border}` }}>
                <input placeholder="Label (e.g. Tenerife)" value={holidayDraft.label}
                  onChange={e => setHolidayDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...inputSt(t), fontSize: 12, marginBottom: 8, width: '100%' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={miniLabelSt(t)}>Start date</div>
                    <input type="date" value={holidayDraft.from} onChange={e => setHolidayDraft(d => ({ ...d, from: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }} />
                  </div>
                  <div>
                    <div style={miniLabelSt(t)}>End date</div>
                    <input type="date" value={holidayDraft.to} onChange={e => setHolidayDraft(d => ({ ...d, to: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }} />
                  </div>
                </div>
                <AddBtn onClick={addHoliday} disabled={!holidayDraft.label || !holidayDraft.from} t={t} full />
              </div>
            </DQField>
            <DQField label="One-off events (weddings, travel days, etc.)" t={t}>
              {intake.availability.oneOffEvents.map((e, i) => (
                <EntryChip key={i} label={`${e.label} · ${e.date}`} onRemove={() => patchAvail('oneOffEvents', intake.availability.oneOffEvents.filter((_, j) => j !== i))} t={t} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                <input placeholder="Label" value={oneOffDraft.label} onChange={e => setOneOffDraft(d => ({ ...d, label: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }} />
                <input type="date" value={oneOffDraft.date} onChange={e => setOneOffDraft(d => ({ ...d, date: e.target.value }))} style={{ ...inputSt(t), fontSize: 12 }} />
                <AddBtn onClick={addOneOff} disabled={!oneOffDraft.label || !oneOffDraft.date} t={t} />
              </div>
            </DQField>
          </div>
        )}

        {current === 'preferences' && (
          <div>
            <StepTitle t={t}>Day preferences.</StepTitle>
            <StepSub t={t}>Shape your weekly structure. Leave blank to use sensible defaults.</StepSub>
            <DQField label="Long / key session day" hint="Your longest or most demanding session of the week. Default: Sunday." t={t}>
              <DaySelect value={intake.preferences.longSessionDay} onChange={v => patchIntake('preferences', { longSessionDay: v })} t={t} />
            </DQField>
            <DQField label="Second session day" hint="Second key session of the week. Default: Saturday." t={t}>
              <DaySelect value={intake.preferences.secondDisciplineDay} onChange={v => patchIntake('preferences', { secondDisciplineDay: v })} t={t} />
            </DQField>
            {isTrailRaceType(eventCfg.raceType) && (
              <DQField label="Hill workout day" hint="Which of your selected days fits your weekly hill-repeat session." t={t}>
                <DaySelect value={intake.preferences.hillDay} onChange={v => patchIntake('preferences', { hillDay: v })} t={t} />
              </DQField>
            )}
            {gymAccess && (
              <DQField label="Conditioning day" hint="Won't be placed on the same day as a long or high-intensity session unless chosen here." t={t}>
                <DaySelect value={intake.preferences.conditioningDay} onChange={v => patchIntake('preferences', { conditioningDay: v })} t={t} />
              </DQField>
            )}
          </div>
        )}

        {current === 'injury' && (
          <div>
            <StepTitle t={t}>Health & injury.</StepTitle>
            <StepSub t={t}>Helps us avoid loading areas at risk. Skip anything you're not comfortable sharing.</StepSub>
            <DQField label="Past injuries" t={t}>
              {intake.injury.pastInjuries.map((inj, i) => (
                <EntryChip key={i} label={`${inj.area}${inj.description ? ' — ' + inj.description : ''} · ${inj.resolved ? 'Resolved' : 'Ongoing'}`}
                  onRemove={() => patchInjury({ pastInjuries: intake.injury.pastInjuries.filter((_, j) => j !== i) })} t={t} />
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {BODY_AREAS.map(a => (
                  <button key={a} onClick={() => setInjuryDraft(d => ({ ...d, area: a }))} style={{
                    padding: '5px 9px', borderRadius: 7, background: injuryDraft.area === a ? t.accent + '15' : t.surface,
                    border: `1.5px solid ${injuryDraft.area === a ? t.accent : t.border2}`, color: injuryDraft.area === a ? t.accent : t.text2, fontFamily: t.sans, fontSize: 11, cursor: 'pointer',
                  }}>{a}</button>
                ))}
              </div>
              <input placeholder="Brief description (optional)" value={injuryDraft.description} onChange={e => setInjuryDraft(d => ({ ...d, description: e.target.value }))} style={{ ...inputSt(t), marginBottom: 6, fontSize: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: true, label: 'Resolved' }, { v: false, label: 'Ongoing' }].map(opt => (
                    <button key={opt.label} onClick={() => setInjuryDraft(d => ({ ...d, resolved: opt.v }))} style={{
                      flex: 1, padding: '9px', borderRadius: 9, fontSize: 11.5, background: injuryDraft.resolved === opt.v ? t.accent + '10' : t.surface,
                      border: `1.5px solid ${injuryDraft.resolved === opt.v ? t.accent : t.border}`, color: injuryDraft.resolved === opt.v ? t.accent : t.text, fontFamily: t.sans, cursor: 'pointer',
                    }}>{opt.label}</button>
                  ))}
                </div>
                <AddBtn onClick={addInjury} disabled={!injuryDraft.area} t={t} />
              </div>
            </DQField>
            <DQField label="Any current niggles or soreness?" hint="We'll reduce load on these areas" t={t}>
              <textarea value={intake.injury.currentNiggles} onChange={e => patchInjury({ currentNiggles: e.target.value })} placeholder="e.g. Tight left calf, mild IT band soreness" rows={3} style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }} />
            </DQField>
            <DQField label="Any health conditions we should know about?" hint="Heart conditions, asthma, diabetes, etc." t={t}>
              <textarea value={intake.injury.healthConditions} onChange={e => patchInjury({ healthConditions: e.target.value })} placeholder="e.g. Mild asthma — use inhaler before hard sessions" rows={3} style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }} />
            </DQField>
            <DQField label="Any conditioning exercises to avoid?" hint="Excluded outright from your conditioning circuit, not just flagged — e.g. skip squats if that's advised for a knee." t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {CONDITIONING_EXERCISES.map(ex => {
                  const selected = (intake.injury.avoidExerciseIds || []).includes(ex.id);
                  return (
                    <button key={ex.id} onClick={() => {
                      const prev = intake.injury.avoidExerciseIds || [];
                      const next = selected ? prev.filter(id => id !== ex.id) : [...prev, ex.id];
                      patchInjury({ avoidExerciseIds: next });
                    }} style={{
                      padding: '5px 9px', borderRadius: 7, background: selected ? '#DC262615' : t.surface,
                      border: `1.5px solid ${selected ? '#DC2626' : t.border2}`, color: selected ? '#DC2626' : t.text2,
                      fontFamily: t.sans, fontSize: 11, cursor: 'pointer',
                    }}>{ex.name}</button>
                  );
                })}
              </div>
            </DQField>
            <DQField label="Any movements or surfaces that consistently aggravate symptoms?" t={t}>
              <textarea value={intake.injury.aggravatingFactors} onChange={e => patchInjury({ aggravatingFactors: e.target.value })} placeholder="e.g. Downhill running flares up my knee" rows={2} style={{ ...inputSt(t), resize: 'none', lineHeight: 1.6 }} />
            </DQField>
          </div>
        )}

        {current === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 18 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${t.green}, ${t.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 32, color: '#fff', boxShadow: `0 14px 40px ${t.accent}30` }}>✓</div>
            <div style={{ fontFamily: t.serif, fontSize: 32, lineHeight: 1.1, marginBottom: 12, letterSpacing: '-.01em' }}>
              {isRaceGoal(selectedGoals) && isEngineSupportedRaceType(eventCfg.raceType) ? 'Your plan is ready.' : 'Forma is set up.'}
            </div>
            <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.55, marginBottom: 24, padding: '0 12px' }}>
              {isRaceGoal(selectedGoals) && isEngineSupportedRaceType(eventCfg.raceType)
                ? 'A full week-by-week training plan has been generated instantly from your answers.'
                : 'Your Forma is built around what matters most to you.'}
            </div>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '12px 14px', textAlign: 'left' }}>
              {selectedGoals.map((goalId, i) => {
                const meta = GOAL_TYPES.find(g => g.id === goalId);
                return (
                  <div key={goalId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i > 0 ? `1px solid ${t.border}` : 'none', fontSize: 12 }}>
                    <span style={{ color: t.text2 }}>{meta?.icon} {meta?.label}</span>
                    <span style={{ fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700, color: RANK_COLOURS[i], textTransform: 'uppercase' }}>{RANK_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
            {previewPlan && <PlanOverviewSection eventPlan={previewPlan} theme={theme} />}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 22px 18px', background: t.bg, borderTop: `1px solid ${t.border}` }}>
        {pastSkipPoint ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={next} disabled={!canAdvance || saving} style={primaryBtnSt(t, canAdvance && !saving)}>
              {saving ? 'Saving…' : (isLast ? 'Enter Forma →' : 'Continue →')}
            </button>
            <button onClick={handleSkip} disabled={saving} style={{
              width: '100%', padding: '11px', borderRadius: 13, background: 'transparent', color: t.text2,
              border: `1px solid ${t.border}`, fontFamily: t.sans, fontSize: 12.5, fontWeight: 500,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>Skip the rest for now</button>
          </div>
        ) : (
          <button onClick={next} disabled={!canAdvance || saving} style={primaryBtnSt(t, canAdvance && !saving)}>
            {saving ? 'Saving…' : (current === 'done' ? 'Enter Forma →' : 'Continue →')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepTitle({ t, children }) {
  return <div style={{ fontFamily: t.serif, fontSize: 30, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-.01em' }}>{children}</div>;
}
function StepSub({ t, children }) {
  return <div style={{ fontSize: 12.5, color: t.text2, marginBottom: 22, lineHeight: 1.5 }}>{children}</div>;
}
function GField({ label, t, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: t.text3, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}
function DQField({ label, hint, t, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: t.text3, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: t.text3, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
function optionRowSt(t, active) {
  return {
    padding: '11px 14px', borderRadius: 11, textAlign: 'left',
    background: active ? t.accent + '10' : t.surface, border: `1.5px solid ${active ? t.accent : t.border}`,
    fontFamily: t.sans, fontSize: 13, cursor: 'pointer', color: t.text,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  };
}
function primaryBtnSt(t, enabled) {
  return {
    width: '100%', padding: '14px', borderRadius: 13,
    background: enabled ? t.accent : t.surface2, color: enabled ? t.accentText : t.text3,
    border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}
function inputSt(t) {
  return {
    width: '100%', padding: '11px 13px', borderRadius: 10, border: `1px solid ${t.border2}`, background: t.surface,
    fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none', boxSizing: 'border-box',
  };
}
function dateInputSt(t) {
  return { ...inputSt(t), padding: '12px 14px', fontSize: 14 };
}
function YesNoRow({ value, onChange, t }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['Yes', true], ['No', false]].map(([label, v]) => {
        const active = value === v;
        return (
          <button key={label} onClick={() => onChange(v)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, background: active ? t.accent + '15' : t.surface,
            border: `1.5px solid ${active ? t.accent : t.border}`, color: active ? t.accent : t.text,
            fontFamily: t.sans, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        );
      })}
    </div>
  );
}
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
function HoursMinutesInput({ hours, minutes, onChange, t }) {
  const selectSt = { width: '100%', padding: '10px 8px', borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface, fontFamily: t.sans, fontSize: 13, color: t.text, outline: 'none' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
      <div>
        <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Hours</div>
        <select value={hours || ''} onChange={e => onChange(e.target.value, undefined)} style={selectSt}>
          <option value="">–</option>{HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>Minutes</div>
        <select value={minutes || ''} onChange={e => onChange(undefined, e.target.value)} style={selectSt}>
          <option value="">–</option>{MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
function ToggleCard({ icon, title, sub, active, onToggle, t }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14, background: active ? t.accent + '10' : t.surface,
      border: `1.5px solid ${active ? t.accent : t.border}`, cursor: 'pointer', fontFamily: t.sans, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: active ? t.accent + '25' : t.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: t.text, fontWeight: 500, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: t.text2, lineHeight: 1.5 }}>{sub}</div>
      </div>
      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: active ? t.accent : 'transparent', border: active ? 'none' : `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? t.accentText : t.text3, fontSize: 12 }}>{active ? '✓' : ''}</div>
    </button>
  );
}
function TimeInput({ value, onChange, placeholder, t }) {
  return <input type="text" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSt(t)} />;
}
function DaySelect({ value, onChange, t }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputSt(t)}>
      <option value="">No preference — use default</option>
      {DAYS.map((day, i) => <option key={i} value={DAY_KEYS[i]}>{day}</option>)}
    </select>
  );
}
function EntryChip({ label, onRemove, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: t.surface, border: `1px solid ${t.border}`, marginBottom: 6 }}>
      <span style={{ flex: 1, fontSize: 11.5, color: t.text2, lineHeight: 1.4 }}>{label}</span>
      <button onClick={onRemove} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.text3, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
    </div>
  );
}
function AddBtn({ onClick, disabled, t, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 14px', borderRadius: 9, whiteSpace: 'nowrap', background: disabled ? t.border : t.accent,
      color: disabled ? t.text3 : t.accentText, border: 'none', fontFamily: t.sans, fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer', ...(full ? { width: '100%' } : {}),
    }}>+ Add</button>
  );
}
function miniLabelSt(t) {
  return { fontSize: 9.5, color: t.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 };
}
