import { describe, it, expect } from 'vitest';
import { generateActivitySchedule, getAutoSplitDays } from './scheduleGeneration';

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
    const { schedule, gymDayCount } = generateActivitySchedule(payload);
    expect(gymDayCount).toBe(3);
    expect(schedule).toEqual({});
  });

  it('no goals, no gym, no training days: empty schedule, zero gym days', () => {
    expect(generateActivitySchedule({})).toEqual({ schedule: {}, gymDayCount: 0 });
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
