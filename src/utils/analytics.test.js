import { describe, it, expect } from 'vitest';
import {
  getActivityOptions, getPaceSeries, paceUnitForType, formatPaceValue,
  getExerciseOptionsForActivity, getRepsSeries,
  getAverageValue, getPaceTrackStatus, getGoalPaceValue,
} from './analytics';

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('getActivityOptions', () => {
  it('lists only activities actually logged, deduped by type/label', () => {
    const sessions = [
      { id: '1', date: iso(-2), type: 'run', distance: 5, distanceUnit: 'km', elapsed: 1500, queue: null },
      { id: '2', date: iso(-1), type: 'run', distance: 6, distanceUnit: 'km', elapsed: 1800, queue: null },
      { id: '3', date: iso(0), type: 'swim', distance: 1000, distanceUnit: 'm', elapsed: 1200, queue: null },
    ];
    const options = getActivityOptions(sessions);
    expect(options.map(o => o.id).sort()).toEqual(['pace:run', 'pace:swim']);
  });

  it('groups plain gym sessions under a single "Gym" activity', () => {
    const sessions = [
      { id: '1', date: iso(-1), workout: 'Push day', queue: [{ id: 'bench', name: 'Bench press', sets: [] }] },
      { id: '2', date: iso(0), workout: 'Pull day', queue: [{ id: 'row', name: 'Row', sets: [] }] },
    ];
    const options = getActivityOptions(sessions);
    expect(options).toEqual([{ id: 'gym', label: 'Gym', emoji: expect.any(String), color: expect.any(String), metric: 'reps' }]);
  });

  it('groups conditioning sessions by their own workout label, not a generic bucket', () => {
    const sessions = [
      { id: '1', date: iso(-1), type: 'conditioning', workout: 'Football', queue: [{ id: 'sprints', name: 'Sprints', sets: [] }] },
      { id: '2', date: iso(0), type: 'conditioning', workout: 'Climbing', queue: [{ id: 'pullups', name: 'Pull-ups', sets: [] }] },
    ];
    const options = getActivityOptions(sessions);
    expect(options.map(o => o.label).sort()).toEqual(['Climbing', 'Football']);
  });

  it('ignores sessions with no distance and no exercise queue', () => {
    expect(getActivityOptions([{ id: '1', date: iso(0), workout: 'Rest' }])).toEqual([]);
  });

  it('returns an empty list when completedSessions is omitted', () => {
    expect(getActivityOptions()).toEqual([]);
  });
});

describe('paceUnitForType', () => {
  it('uses per-100m for swim', () => {
    expect(paceUnitForType('swim')).toBe('per100m');
  });
  it('uses km/h speed for cycle and bike', () => {
    expect(paceUnitForType('cycle')).toBe('kmh');
    expect(paceUnitForType('bike')).toBe('kmh');
  });
  it('defaults to mm:ss/km pace for everything else', () => {
    expect(paceUnitForType('run')).toBe('perKm');
    expect(paceUnitForType('walk')).toBe('perKm');
  });
});

describe('getPaceSeries', () => {
  it('computes mm:ss/km pace for a run, sorted oldest to newest', () => {
    const sessions = [
      { id: '2', date: iso(0), type: 'run', distance: 5, distanceUnit: 'km', elapsed: 1500, queue: null },  // 5:00/km
      { id: '1', date: iso(-3), type: 'run', distance: 10, distanceUnit: 'km', elapsed: 3600, queue: null }, // 6:00/km
    ];
    const series = getPaceSeries(sessions, 'run');
    expect(series.map(p => p.id)).toEqual(['1', '2']);
    expect(series[0].value).toBeCloseTo(360); // 6:00/km in seconds
    expect(series[1].value).toBeCloseTo(300); // 5:00/km in seconds
  });

  it('normalizes metres to km before computing pace', () => {
    const sessions = [{ id: '1', date: iso(0), type: 'run', distance: 5000, distanceUnit: 'm', elapsed: 1500, queue: null }];
    expect(getPaceSeries(sessions, 'run')[0].value).toBeCloseTo(300);
  });

  it('computes seconds-per-100m for swim from a total distance in metres', () => {
    const sessions = [{ id: '1', date: iso(0), type: 'swim', distance: 1600, distanceUnit: 'm', elapsed: 1920, queue: null }]; // 120s/100m
    expect(getPaceSeries(sessions, 'swim')[0].value).toBeCloseTo(120);
  });

  it('computes km/h speed for cycling', () => {
    const sessions = [{ id: '1', date: iso(0), type: 'cycle', distance: 20, distanceUnit: 'km', elapsed: 3600, queue: null }]; // 20 km/h
    expect(getPaceSeries(sessions, 'cycle')[0].value).toBeCloseTo(20);
  });

  it('excludes sessions missing distance or elapsed (avoids divide-by-zero)', () => {
    const sessions = [
      { id: '1', date: iso(0), type: 'run', distance: null, distanceUnit: 'km', elapsed: 1500, queue: null },
      { id: '2', date: iso(0), type: 'run', distance: 5, distanceUnit: 'km', elapsed: 0, queue: null },
    ];
    expect(getPaceSeries(sessions, 'run')).toEqual([]);
  });

  it('only includes sessions matching the requested activity type', () => {
    const sessions = [
      { id: '1', date: iso(0), type: 'run', distance: 5, distanceUnit: 'km', elapsed: 1500, queue: null },
      { id: '2', date: iso(0), type: 'swim', distance: 1000, distanceUnit: 'm', elapsed: 1200, queue: null },
    ];
    expect(getPaceSeries(sessions, 'run').map(p => p.id)).toEqual(['1']);
  });
});

describe('formatPaceValue', () => {
  it('formats a km-pace value as mm:ss/km', () => {
    expect(formatPaceValue(305, 'perKm')).toBe('5:05/km');
  });
  it('formats a swim pace value as mm:ss/100m', () => {
    expect(formatPaceValue(90, 'per100m')).toBe('1:30/100m');
  });
  it('formats a speed value as one-decimal km/h', () => {
    expect(formatPaceValue(19.96, 'kmh')).toBe('20.0 km/h');
  });
  it('pads single-digit seconds', () => {
    expect(formatPaceValue(305 + 4, 'perKm')).toBe('5:09/km');
  });
  it('returns an em dash for null/non-finite input instead of "NaN:NaN"', () => {
    expect(formatPaceValue(null, 'perKm')).toBe('—');
    expect(formatPaceValue(Infinity, 'kmh')).toBe('—');
  });
});

describe('getAverageValue', () => {
  it('averages a series\' values', () => {
    expect(getAverageValue([{ value: 300 }, { value: 360 }])).toBeCloseTo(330);
  });
  it('returns null for an empty series', () => {
    expect(getAverageValue([])).toBeNull();
  });
});

describe('getPaceTrackStatus', () => {
  it('is on-track when a time-based average is at or faster than goal', () => {
    expect(getPaceTrackStatus(300, 310, 'perKm')).toBe(true);
    expect(getPaceTrackStatus(300, 300, 'perKm')).toBe(true);
  });
  it('is off-track when a time-based average is slower than goal', () => {
    expect(getPaceTrackStatus(320, 300, 'perKm')).toBe(false);
  });
  it('is on-track when a km/h average meets or beats goal speed', () => {
    expect(getPaceTrackStatus(21, 20, 'kmh')).toBe(true);
    expect(getPaceTrackStatus(18, 20, 'kmh')).toBe(false);
  });
  it('returns null when there is no average or no goal yet', () => {
    expect(getPaceTrackStatus(null, 300, 'perKm')).toBeNull();
    expect(getPaceTrackStatus(300, null, 'perKm')).toBeNull();
  });
});

describe('getGoalPaceValue', () => {
  it('derives a run goal pace (seconds/km) from the confirmed target split', () => {
    // Half Marathon = 21.0975km; a 21097.5s run leg is exactly 1000s/km.
    const cfg = { raceType: 'Half Marathon', targetPaces: { run: 21097.5 } };
    expect(getGoalPaceValue('run', cfg)).toBeCloseTo(1000);
  });

  it('derives a swim goal pace (seconds/100m) from the confirmed target split', () => {
    // Olympic tri swim leg = 1.5km; 1950s over 15x100m is 130s/100m.
    const cfg = { raceType: 'Triathlon (Olympic)', targetPaces: { swim: 1950 } };
    expect(getGoalPaceValue('swim', cfg)).toBeCloseTo(130);
  });

  it('derives a cycle/bike goal speed (km/h) from the confirmed target split, mapping "cycle" to the "bike" discipline', () => {
    // Olympic tri bike leg = 40km in 7200s (2h) is 20 km/h.
    const cfg = { raceType: 'Triathlon (Olympic)', targetPaces: { bike: 7200 } };
    expect(getGoalPaceValue('cycle', cfg)).toBeCloseTo(20);
    expect(getGoalPaceValue('bike', cfg)).toBeCloseTo(20);
  });

  it('returns null for activity types with no discipline mapping (no distance table to derive a pace from)', () => {
    const cfg = { raceType: 'Marathon', targetPaces: { run: 15000 } };
    expect(getGoalPaceValue('walk', cfg)).toBeNull();
    expect(getGoalPaceValue('row', cfg)).toBeNull();
  });

  it('returns null when there is no event_race goal at all', () => {
    expect(getGoalPaceValue('run', null)).toBeNull();
    expect(getGoalPaceValue('run', undefined)).toBeNull();
  });

  it('returns null when this discipline\'s target pace has not been confirmed yet', () => {
    const cfg = { raceType: 'Marathon', targetPaces: {} };
    expect(getGoalPaceValue('run', cfg)).toBeNull();
  });

  it('returns null for race types with no fixed distance table (nothing to convert against)', () => {
    const cfg = { raceType: 'Cycling Sportive', targetPaces: { bike: 7200 } };
    expect(getGoalPaceValue('cycle', cfg)).toBeNull();
  });
});

describe('getExerciseOptionsForActivity', () => {
  const sessions = [
    { id: '1', date: iso(-2), workout: 'Push day', queue: [{ id: 'bench', name: 'Bench press', sets: [] }, { id: 'ohp', name: 'Overhead press', sets: [] }] },
    { id: '2', date: iso(-1), workout: 'Push day', queue: [{ id: 'bench', name: 'Bench press', sets: [] }] },
    { id: '3', date: iso(0), type: 'conditioning', workout: 'Football', queue: [{ id: 'sprints', name: 'Sprints', sets: [] }] },
  ];

  it('lists exercises logged under the Gym bucket, most-frequent first', () => {
    expect(getExerciseOptionsForActivity(sessions, 'gym').map(e => e.id)).toEqual(['bench', 'ohp']);
  });

  it('keeps conditioning-activity exercises out of the Gym bucket', () => {
    expect(getExerciseOptionsForActivity(sessions, 'gym').some(e => e.id === 'sprints')).toBe(false);
    expect(getExerciseOptionsForActivity(sessions, 'conditioning:Football').map(e => e.id)).toEqual(['sprints']);
  });
});

describe('getRepsSeries', () => {
  it('sums bilateral set reps per session for the selected exercise, sorted oldest to newest', () => {
    const sessions = [
      {
        id: '2', date: iso(0), workout: 'Push day',
        queue: [{ id: 'bench', name: 'Bench press', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }] }],
      },
      {
        id: '1', date: iso(-3), workout: 'Push day',
        queue: [{ id: 'bench', name: 'Bench press', sets: [{ w: 55, r: 10, done: true }] }],
      },
    ];
    const series = getRepsSeries(sessions, 'gym', 'bench');
    expect(series).toEqual([
      { id: '1', date: sessions[1].date, value: 10 },
      { id: '2', date: sessions[0].date, value: 15 },
    ]);
  });

  it('sums left + right reps for unilateral exercises', () => {
    const sessions = [{
      id: '1', date: iso(0), workout: 'Push day',
      queue: [{ id: 'lateral', name: 'Lateral raises', sets: [{ wR: 12, rR: 15, wL: 12, rL: 14, done: true }] }],
    }];
    expect(getRepsSeries(sessions, 'gym', 'lateral')[0].value).toBe(29);
  });

  it('ignores sets that were never marked done', () => {
    const sessions = [{
      id: '1', date: iso(0), workout: 'Push day',
      queue: [{ id: 'bench', name: 'Bench press', sets: [{ w: 60, r: 8, done: false }] }],
    }];
    expect(getRepsSeries(sessions, 'gym', 'bench')).toEqual([]);
  });

  it('only includes sessions belonging to the requested activity bucket', () => {
    const sessions = [
      { id: '1', date: iso(0), type: 'conditioning', workout: 'Football', queue: [{ id: 'bench', name: 'Bench press', sets: [{ r: 8, done: true }] }] },
    ];
    expect(getRepsSeries(sessions, 'gym', 'bench')).toEqual([]);
    expect(getRepsSeries(sessions, 'conditioning:Football', 'bench')[0].value).toBe(8);
  });
});
