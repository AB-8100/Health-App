import { describe, it, expect } from 'vitest';
import {
  parseBaselineDurationToSeconds, parseTargetTimeToSeconds, formatSecondsAsHMS,
  computeDefaultSplit, deriveSplitFromBaseline,
  formatPaceForDiscipline, legDistanceKm,
  canComputePace, isTriathlonRaceType, isRunRaceType,
} from './raceTargets';

describe('parseBaselineDurationToSeconds', () => {
  it('parses "MM:SS"', () => {
    expect(parseBaselineDurationToSeconds('22:30')).toBe(22 * 60 + 30);
  });
  it('parses "H:MM:SS"', () => {
    expect(parseBaselineDurationToSeconds('2:00:00')).toBe(2 * 3600);
  });
  it('rejects non-numeric or malformed input instead of throwing', () => {
    expect(parseBaselineDurationToSeconds('abc')).toBeNull();
    expect(parseBaselineDurationToSeconds('1:2:3:4')).toBeNull();
    expect(parseBaselineDurationToSeconds('')).toBeNull();
    expect(parseBaselineDurationToSeconds(undefined)).toBeNull();
  });
  it('rejects a zero or negative duration', () => {
    expect(parseBaselineDurationToSeconds('0:00')).toBeNull();
  });
});

describe('parseTargetTimeToSeconds', () => {
  it('parses "H:MM" (the target/cutoff field format)', () => {
    expect(parseTargetTimeToSeconds('1:45')).toBe(1 * 3600 + 45 * 60);
  });
  it('parses "H:MM:SS"', () => {
    expect(parseTargetTimeToSeconds('2:00:00')).toBe(2 * 3600);
  });
  it('rejects non-numeric or malformed input instead of throwing', () => {
    expect(parseTargetTimeToSeconds('abc')).toBeNull();
    expect(parseTargetTimeToSeconds('1:2:3:4')).toBeNull();
    expect(parseTargetTimeToSeconds('')).toBeNull();
  });
  it('rejects a zero duration', () => {
    expect(parseTargetTimeToSeconds('0:00')).toBeNull();
  });
});

describe('formatSecondsAsHMS', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatSecondsAsHMS(150)).toBe('2:30');
  });
  it('formats an hour or more as H:MM:SS', () => {
    expect(formatSecondsAsHMS(7500)).toBe('2:05:00');
  });
  it('returns empty string for a non-positive/invalid value', () => {
    expect(formatSecondsAsHMS(0)).toBe('');
    expect(formatSecondsAsHMS(NaN)).toBe('');
  });
});

describe('canComputePace / isTriathlonRaceType / isRunRaceType', () => {
  it('recognizes the 4 supported triathlon types', () => {
    expect(isTriathlonRaceType('Triathlon (Sprint)')).toBe(true);
    expect(isTriathlonRaceType('Triathlon (Full / Ironman)')).toBe(true);
  });
  it('recognizes the 4 supported single-discipline run types', () => {
    expect(isRunRaceType('10K')).toBe(true);
    expect(isRunRaceType('Marathon')).toBe(true);
  });
  it('reports no computable pace for race types with no fixed distance', () => {
    expect(canComputePace('Cycling Sportive')).toBe(false);
    expect(canComputePace('Open Water Swim')).toBe(false);
    expect(canComputePace('Other')).toBe(false);
  });
});

describe('computeDefaultSplit', () => {
  it('splits a Sprint triathlon target using the proportion table, summing to the total', () => {
    const total = 2 * 3600; // 2:00:00
    const split = computeDefaultSplit('Triathlon (Sprint)', total);
    expect(split.swim + split.transition + split.bike + split.run).toBe(total);
    expect(split.bike).toBeGreaterThan(split.run);
    expect(split.run).toBeGreaterThan(split.swim);
  });

  it('converts a single-discipline target directly to one discipline (run)', () => {
    const total = 50 * 60;
    expect(computeDefaultSplit('10K', total)).toEqual({ run: total });
  });

  it('returns null for a race type with no fixed distance/proportions', () => {
    expect(computeDefaultSplit('Cycling Sportive', 3600)).toBeNull();
  });

  it('returns null for a non-positive total', () => {
    expect(computeDefaultSplit('Triathlon (Sprint)', 0)).toBeNull();
  });
});

describe('deriveSplitFromBaseline', () => {
  const total = 2 * 3600;

  it('falls back to the default split when no baseline data is present', () => {
    expect(deriveSplitFromBaseline('Triathlon (Sprint)', total, {})).toEqual(
      computeDefaultSplit('Triathlon (Sprint)', total)
    );
  });

  it('falls back to the default split for a non-triathlon race type regardless of baseline', () => {
    expect(deriveSplitFromBaseline('10K', total, { run: { time10k: '40:00' } })).toEqual({ run: total });
  });

  it('shifts time from swim to run when the baseline shows a relatively strong swimmer', () => {
    // Fast swim (well under reference), average run — swimmer should get a
    // smaller swim share and a larger run share than the generic default.
    const base = computeDefaultSplit('Triathlon (Sprint)', total);
    const derived = deriveSplitFromBaseline('Triathlon (Sprint)', total, {
      swim: { time400m: '5:00' },   // fast: 75 sec/100m vs ~130 reference
      run: { time10k: '65:00' },    // slow-ish: ~390 sec/km, close to reference
    });
    expect(derived.swim).toBeLessThan(base.swim);
    expect(derived.run).toBeGreaterThan(base.run);
  });

  it('shifts time from run to swim when the baseline shows a relatively strong runner', () => {
    const base = computeDefaultSplit('Triathlon (Sprint)', total);
    const derived = deriveSplitFromBaseline('Triathlon (Sprint)', total, {
      run: { time10k: '35:00' },     // fast: 210 sec/km vs ~390 reference
      swim: { time400m: '11:00' },   // slow: 165 sec/100m vs ~130 reference
    });
    expect(derived.run).toBeLessThan(base.run);
    expect(derived.swim).toBeGreaterThan(base.swim);
  });

  it('keeps bike and transition unchanged from the default (not reweighted)', () => {
    const base = computeDefaultSplit('Triathlon (Sprint)', total);
    const derived = deriveSplitFromBaseline('Triathlon (Sprint)', total, {
      swim: { time400m: '5:00' }, run: { time10k: '65:00' },
    });
    expect(derived.bike).toBe(base.bike);
    expect(derived.transition).toBe(base.transition);
  });

  it('preserves the total (swim+run shift is zero-sum) within rounding', () => {
    const base = computeDefaultSplit('Triathlon (Sprint)', total);
    const derived = deriveSplitFromBaseline('Triathlon (Sprint)', total, {
      swim: { time400m: '5:00' }, run: { time10k: '65:00' },
    });
    const baseSum = base.swim + base.run;
    const derivedSum = derived.swim + derived.run;
    expect(Math.abs(baseSum - derivedSum)).toBeLessThanOrEqual(1);
  });
});

describe('legDistanceKm', () => {
  it('returns the run distance for a single-discipline run race', () => {
    expect(legDistanceKm('run', 'Marathon')).toBeCloseTo(42.195);
  });
  it('returns per-leg distances for a triathlon type', () => {
    expect(legDistanceKm('swim', 'Triathlon (Olympic)')).toBe(1.5);
    expect(legDistanceKm('bike', 'Triathlon (Olympic)')).toBe(40);
  });
  it('returns null for a race type with no known distance', () => {
    expect(legDistanceKm('run', 'Cycling Sportive')).toBeNull();
  });
});

describe('formatPaceForDiscipline', () => {
  it('formats a run leg as pace per km by default', () => {
    // 25 min for 5km => 5:00/km
    expect(formatPaceForDiscipline('run', 25 * 60, 5, false)).toBe('5:00/km');
  });
  it('formats a run leg as pace per mile when useMiles is true', () => {
    expect(formatPaceForDiscipline('run', 25 * 60, 5, true)).toMatch(/\/mi$/);
  });
  it('formats a swim leg as pace per 100m', () => {
    // 1500s for 1500m (Olympic swim leg) => 100s/100m => 1:40/100m
    expect(formatPaceForDiscipline('swim', 1500, 1.5, false)).toBe('1:40/100m');
  });
  it('formats a bike leg as average speed, not pace-per-distance', () => {
    // 40km in 1 hour => 40.0 km/h
    expect(formatPaceForDiscipline('bike', 3600, 40, false)).toBe('40.0 km/h');
  });
  it('formats a transition leg as a plain duration (no distance)', () => {
    expect(formatPaceForDiscipline('transition', 180, null, false)).toBe('3:00');
  });
  it('returns empty string for a non-positive leg time', () => {
    expect(formatPaceForDiscipline('run', 0, 5, false)).toBe('');
  });
});
