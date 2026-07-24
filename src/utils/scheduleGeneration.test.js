import { describe, it, expect } from 'vitest';
import { generateActivitySchedule, getAutoSplitDays, buildGymScheduleOverride, shouldBlockGeneratedSchedule, resetOnboardingProfileFields } from './scheduleGeneration';

describe('generateActivitySchedule — backward compatibility (no event_race/sport_activity/regularSports)', () => {
  // These fix today's exact behavior in place — every non-race onboarding
  // path in use must keep producing this output unchanged.

  it('general_fitness only, no gym: cycles activities evenly across training days', () => {
    const payload = {
      goals: [{ type: 'general_fitness', config: { activities: ['running', 'yoga'] } }],
      trainingDays: ['monday', 'wednesday', 'friday', 'sunday'],
      gymAccess: false,
    };
    const { schedule, gymDayCount } = generateActivitySchedule(payload);
    expect(gymDayCount).toBe(0);
    expect(schedule[0][0].type).toBe('run');   // monday -> running
    expect(schedule[2][0].type).toBe('yoga');  // wednesday -> yoga
    expect(schedule[4][0].type).toBe('run');   // friday -> running (wraps)
    expect(schedule[6][0].type).toBe('yoga');  // sunday -> yoga
  });

  it('gym access with no other activities: every training day is a gym day, no schedule entries', () => {
    const payload = {
      goals: [{ type: 'general_fitness', config: { activities: [] } }],
      trainingDays: ['monday', 'tuesday', 'wednesday'],
      gymAccess: true,
    };
    const { schedule, gymDayCount, gymDayIdxs } = generateActivitySchedule(payload);
    expect(gymDayCount).toBe(3);
    expect(schedule).toEqual({});
    expect(gymDayIdxs.sort()).toEqual([0, 1, 2]);
  });

  it('gym access on non-consecutive days: gymDayIdxs reflects the actual selected weekdays, not the first N days', () => {
    // The onboarding bug: user picks Mon/Wed/Fri, plan used to always land
    // on the split template's own hardcoded default schedule instead.
    const payload = {
      goals: [{ type: 'general_fitness', config: { activities: [] } }],
      trainingDays: ['monday', 'wednesday', 'friday'],
      gymAccess: true,
    };
    const { gymDayCount, gymDayIdxs } = generateActivitySchedule(payload);
    expect(gymDayCount).toBe(3);
    expect(gymDayIdxs.sort()).toEqual([0, 2, 4]); // Mon, Wed, Fri
  });

  it('no goals, no gym, no training days: empty schedule, zero gym days', () => {
    expect(generateActivitySchedule({})).toEqual({ schedule: {}, gymDayCount: 0, gymDayIdxs: [] });
  });

  it('gym + general_fitness activities: gym is one entry in the same even rotation as before', () => {
    const payload = {
      goals: [{ type: 'general_fitness', config: { activities: ['running'] } }],
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday'],
      gymAccess: true,
    };
    // Old rotation: selectedIds = ['gym', 'running'], cycled i % 2 across 4 days
    // -> mon:gym, tue:running, wed:gym, thu:running
    const { schedule, gymDayCount } = generateActivitySchedule(payload);
    expect(gymDayCount).toBe(2);
    expect(schedule[0]).toBeUndefined();       // monday = gym (no entry)
    expect(schedule[1][0].type).toBe('run');   // tuesday = running
    expect(schedule[2]).toBeUndefined();       // wednesday = gym
    expect(schedule[3][0].type).toBe('run');   // thursday = running
  });

  it('an event_race goal with no discipline frequency set at all still uses the legacy path', () => {
    const payload = {
      goals: [
        { type: 'event_race', config: { raceType: 'Marathon', raceDate: '2026-10-01', fitnessLevel: 'Beginner' } },
        { type: 'general_fitness', config: { activities: ['yoga'] } },
      ],
      trainingDays: ['monday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    expect(schedule[0][0].type).toBe('yoga');
    expect(schedule[0][0].note).toBeUndefined();
  });
});

describe('generateActivitySchedule — event_race discipline frequency (the fix)', () => {
  it('populates real sessions for a race-only user with no general_fitness activities (the confirmed bug)', () => {
    const payload = {
      goals: [{
        type: 'event_race',
        config: { raceType: 'Triathlon (Sprint)', disciplineFrequency: { swim: 2, bike: 2, run: 2 } },
      }],
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      gymAccess: false,
    };
    const { schedule, gymDayCount } = generateActivitySchedule(payload);
    const types = Object.values(schedule).map(s => s[0].type);
    expect(types.filter(t => t === 'swim').length).toBe(2);
    expect(types.filter(t => t === 'cycle').length).toBe(2);
    expect(types.filter(t => t === 'run').length).toBe(2);
    expect(gymDayCount).toBe(0);
    expect(Object.keys(schedule).length).toBe(6); // every training day gets a real session
  });

  it('a single-discipline race (10K) with frequency populates run sessions', () => {
    const payload = {
      goals: [{ type: 'event_race', config: { raceType: '10K', disciplineFrequency: { run: 3 } } }],
      trainingDays: ['monday', 'wednesday', 'friday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    expect(Object.values(schedule).every(s => s[0].type === 'run')).toBe(true);
    expect(Object.keys(schedule).length).toBe(3);
  });

  it('race + gym access: gym fills days beyond the stated race frequency', () => {
    const payload = {
      goals: [{ type: 'event_race', config: { raceType: '10K', disciplineFrequency: { run: 2 } } }],
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      gymAccess: true,
    };
    const { schedule, gymDayCount } = generateActivitySchedule(payload);
    const runDays = Object.values(schedule).filter(s => s[0].type === 'run').length;
    expect(runDays).toBe(2);
    expect(gymDayCount).toBe(3); // remaining 3 days become gym
  });

  it('race + regularSports: the regular sport claims its explicit day, race sessions fill the rest', () => {
    const payload = {
      goals: [{ type: 'event_race', config: { raceType: '10K', disciplineFrequency: { run: 2 } } }],
      regularSports: [{ sport: 'Football', day: 'saturday', intensity: 'High' }],
      trainingDays: ['monday', 'wednesday', 'saturday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    expect(schedule[5][0].label).toBe('Football'); // saturday
    expect(schedule[5][0].type).toBe('team_sport');
    expect(schedule[0][0].type).toBe('run');
    expect(schedule[2][0].type).toBe('run');
  });

  it('race + general_fitness: both contribute to the weighted rotation', () => {
    const payload = {
      goals: [
        { type: 'event_race', config: { raceType: '10K', disciplineFrequency: { run: 1 } } },
        { type: 'general_fitness', config: { activities: ['yoga'] } },
      ],
      trainingDays: ['monday', 'tuesday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    const types = Object.values(schedule).map(s => s[0].type).sort();
    expect(types).toEqual(['run', 'yoga']);
  });

  it('demand exceeding available days lands sessions as close to frequency as the day count allows, without crashing', () => {
    const payload = {
      goals: [{ type: 'event_race', config: { raceType: 'Triathlon (Sprint)', disciplineFrequency: { swim: 3, bike: 3, run: 3 } } }],
      trainingDays: ['monday', 'tuesday', 'wednesday'], // only 3 days for 9 requested sessions
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    expect(Object.keys(schedule).length).toBe(3);
    const types = Object.values(schedule).map(s => s[0].type).sort();
    expect(types).toEqual(['cycle', 'run', 'swim']); // interleaved, one of each rather than 3x one discipline
  });

  it('attaches a target-pace note when the goal has confirmed target paces, omits it otherwise', () => {
    const withPace = generateActivitySchedule({
      goals: [{
        type: 'event_race',
        config: {
          raceType: '10K',
          disciplineFrequency: { run: 1 },
          targetPaces: { run: 3000 }, // 50:00 for 10km -> 5:00/km
        },
      }],
      trainingDays: ['monday'],
      gymAccess: false,
    });
    expect(withPace.schedule[0][0].note).toBe('Target ~5:00/km');

    const withoutPace = generateActivitySchedule({
      goals: [{ type: 'event_race', config: { raceType: '10K', disciplineFrequency: { run: 1 } } }],
      trainingDays: ['monday'],
      gymAccess: false,
    });
    expect(withoutPace.schedule[0][0].note).toBeUndefined();
  });
});

describe('generateActivitySchedule — sport_activity and regularSports alone', () => {
  it('sport_activity alone (no event_race) now produces real sessions', () => {
    const payload = {
      goals: [{ type: 'sport_activity', config: { sportType: 'Tennis', daysPerWeek: 2 } }],
      trainingDays: ['monday', 'tuesday', 'wednesday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    const tennisDays = Object.values(schedule).filter(s => s[0].label === 'Tennis').length;
    expect(tennisDays).toBe(2);
  });

  it('regularSports alone (no event_race/sport_activity) now produces a real session on its day', () => {
    const payload = {
      goals: [],
      regularSports: [{ sport: 'Basketball', day: 'thursday', intensity: 'Moderate' }],
      trainingDays: ['monday', 'thursday'],
      gymAccess: false,
    };
    const { schedule } = generateActivitySchedule(payload);
    expect(schedule[3][0].label).toBe('Basketball');
    expect(schedule[3][0].type).toBe('team_sport');
  });

  it('a regularSports entry on a day outside trainingDays is ignored, not crashed on', () => {
    const payload = {
      goals: [],
      regularSports: [{ sport: 'Golf', day: 'sunday', intensity: 'Low' }],
      trainingDays: ['monday'],
      gymAccess: false,
    };
    expect(() => generateActivitySchedule(payload)).not.toThrow();
    expect(generateActivitySchedule(payload).schedule[6]).toBeUndefined();
  });
});

describe('getAutoSplitDays', () => {
  it('maps gym day counts 1-4 directly and caps at 5', () => {
    expect(getAutoSplitDays(0)).toBeNull();
    expect(getAutoSplitDays(1)).toBe(1);
    expect(getAutoSplitDays(4)).toBe(4);
    expect(getAutoSplitDays(7)).toBe(5);
  });
});

describe('buildGymScheduleOverride', () => {
  it('places split days on the exact weekdays selected (Mon/Wed/Fri), not a default consecutive run', () => {
    const gymDayIdxs = [0, 2, 4]; // monday, wednesday, friday
    const splitDayIds = ['push', 'pull', 'legs'];
    const override = buildGymScheduleOverride(gymDayIdxs, splitDayIds);
    expect(override).toEqual(['push', '—', 'pull', '—', 'legs', '—', '—']);
  });

  it('returns null when there are no gym days', () => {
    expect(buildGymScheduleOverride([], ['full'])).toBeNull();
    expect(buildGymScheduleOverride(undefined, ['full'])).toBeNull();
  });

  it('returns null when there is no split (no split day ids)', () => {
    expect(buildGymScheduleOverride([0, 2, 4], [])).toBeNull();
  });

  it('a single gym day lands on the selected weekday, not always Monday', () => {
    expect(buildGymScheduleOverride([3], ['full'])).toEqual(['—', '—', '—', 'full', '—', '—', '—']);
  });
});

describe('shouldBlockGeneratedSchedule', () => {
  it('blocks by default when an active event plan exists', () => {
    expect(shouldBlockGeneratedSchedule({
      hasEventTraining: true,
      eventPlanSessions: { '2026-08-01': [{ type: 'run' }] },
      discardEventPlan: false,
    })).toBe(true);
  });

  it('does not block when explicitly discarding the event plan', () => {
    expect(shouldBlockGeneratedSchedule({
      hasEventTraining: true,
      eventPlanSessions: { '2026-08-01': [{ type: 'run' }] },
      discardEventPlan: true,
    })).toBe(false);
  });

  it('does not block when hasEventTraining is true but there are no actual sessions (flag-only, no plan data)', () => {
    expect(shouldBlockGeneratedSchedule({
      hasEventTraining: true,
      eventPlanSessions: {},
      discardEventPlan: false,
    })).toBe(false);
  });

  it('does not block when there is no event plan at all', () => {
    expect(shouldBlockGeneratedSchedule({
      hasEventTraining: false,
      eventPlanSessions: {},
      discardEventPlan: false,
    })).toBe(false);
  });

  it('handles missing/undefined eventPlanSessions without throwing', () => {
    expect(() => shouldBlockGeneratedSchedule({ hasEventTraining: true, discardEventPlan: false })).not.toThrow();
    expect(shouldBlockGeneratedSchedule({ hasEventTraining: true, discardEventPlan: false })).toBe(false);
  });
});

describe('resetOnboardingProfileFields', () => {
  it('clears only the fields onboarding itself writes', () => {
    const profile = {
      name: 'Alex', age: 34, height: 178, weight: 74,
      hasGym: true, hasEventTraining: true, eventTotalWeeks: 18,
      goal: 'event_race', splitDays: 3, hasTrainingActivities: true, intakeCompleted: true,
    };
    const result = resetOnboardingProfileFields(profile);
    expect(result).toEqual({
      name: 'Alex', age: 34, height: 178, weight: 74,
      hasGym: true, hasEventTraining: true, eventTotalWeeks: 18,
      goal: '', splitDays: null, hasTrainingActivities: false, intakeCompleted: false,
    });
  });

  it('does not mutate the input profile', () => {
    const profile = { goal: 'event_race', hasEventTraining: true, splitDays: 3 };
    const snapshot = { ...profile };
    resetOnboardingProfileFields(profile);
    expect(profile).toEqual(snapshot);
  });

  it('preserves hasEventTraining as-is (reset never flips it)', () => {
    expect(resetOnboardingProfileFields({ hasEventTraining: true }).hasEventTraining).toBe(true);
    expect(resetOnboardingProfileFields({ hasEventTraining: false }).hasEventTraining).toBe(false);
  });
});

// Regression test for the actual guarantee behind the About screen's
// "Remove app-generated schedule" button: clearing the onboarding-generated
// gym split/activities must never touch the uploaded/AI-generated event
// plan or any other account data. App.jsx's handleResetOnboardingSchedule
// builds its save payload the same way handleUploadTrainingPlan and
// completeOnboarding do — buildSnapshot(overrides), where
// buildSnapshot = (overrides) => ({ ...currentState, ...overrides }) — so
// the guarantee holds as long as `overrides` only ever contains
// { plan, activities, profile }. This simulates that exact merge.
describe('reset-onboarding-schedule save payload (App.jsx handleResetOnboardingSchedule contract)', () => {
  it('leaves eventPlan and every other account data field untouched in the merged snapshot', () => {
    const uploadedEventPlan = {
      meta: { totalWeeks: 18, eventDistances: 'Olympic' },
      phases: [{ label: 'Base', weeks: [1, 6] }],
      sessions: { '2026-08-03': [{ type: 'swim', label: 'Swim' }] },
    };
    const currentState = {
      profile: { name: 'Alex', hasEventTraining: true, goal: 'event_race', splitDays: 3, intakeCompleted: true },
      plan: { splitDays: 3, todayIdx: 2, overrides: { 'push-day': { name: 'Custom Push' } } },
      userSettings: { dailyCaloriesBase: 1800 },
      completedSessions: [{ id: 's1', date: '2026-08-01' }],
      foodLog: { '2026-08-01': [{ name: 'Oats' }] },
      activities: { 1: [{ id: 'gen-1', type: 'run', source: 'generated' }] },
      customFoods: [{ name: 'Protein bar' }],
      eventOverrides: { '2026-08-05': [{ type: 'bike' }] },
      preselectedQueues: { 'push-day': ['bench-press'] },
      planSessionsDone: { '2026-08-01': true },
      eventPlan: uploadedEventPlan,
      sequencingDecisions: { 'conflict-1': { choice: 'keep' } },
      savedAt: '2026-07-20T00:00:00.000Z',
    };

    // What handleResetOnboardingSchedule actually passes as `overrides`.
    const nextPlan = { splitDays: null, todayIdx: 0, overrides: {} };
    const nextProfile = resetOnboardingProfileFields(currentState.profile);
    const overrides = { plan: nextPlan, activities: {}, profile: nextProfile };

    // buildSnapshot(overrides) in App.jsx.
    const savedSnapshot = { ...currentState, ...overrides, savedAt: '2026-07-21T00:00:00.000Z' };

    expect(savedSnapshot.eventPlan).toBe(uploadedEventPlan);
    expect(savedSnapshot.eventPlan.sessions).toEqual(uploadedEventPlan.sessions);
    expect(savedSnapshot.eventOverrides).toEqual(currentState.eventOverrides);
    expect(savedSnapshot.preselectedQueues).toEqual(currentState.preselectedQueues);
    expect(savedSnapshot.planSessionsDone).toEqual(currentState.planSessionsDone);
    expect(savedSnapshot.sequencingDecisions).toEqual(currentState.sequencingDecisions);
    expect(savedSnapshot.completedSessions).toEqual(currentState.completedSessions);
    expect(savedSnapshot.foodLog).toEqual(currentState.foodLog);
    expect(savedSnapshot.customFoods).toEqual(currentState.customFoods);
    expect(savedSnapshot.userSettings).toEqual(currentState.userSettings);

    // What actually got reset.
    expect(savedSnapshot.plan).toEqual({ splitDays: null, todayIdx: 0, overrides: {} });
    expect(savedSnapshot.activities).toEqual({});
    expect(savedSnapshot.profile.goal).toBe('');
    expect(savedSnapshot.profile.splitDays).toBeNull();
    expect(savedSnapshot.profile.intakeCompleted).toBe(false);
    // hasEventTraining (the flag driving whether the race plan is shown at
    // all) is left exactly as it was — the reset never turns it off.
    expect(savedSnapshot.profile.hasEventTraining).toBe(true);
  });
});
