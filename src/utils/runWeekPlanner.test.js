import { describe, it, expect } from 'vitest';
import {
  recommendedRunsPerWeek, resolveRunsPerWeek, selectRunDays, qualityCountFor, assignRunRoles,
  placeStrengthDays, estimateTenKPace, paceZones, formatPace, currentLongRunMinutes,
  supportingRunMinutes, describeRunTarget, DAY_ORDER,
} from './runWeekPlanner';

const ALL_DAYS = [...DAY_ORDER];

describe('recommendedRunsPerWeek', () => {
  it('defaults by fitness level', () => {
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Beginner' })).toBe(3);
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Intermediate' })).toBe(4);
  });
  it('never jumps more than one run above current frequency', () => {
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Intermediate', currentRunsPerWeek: 1 })).toBe(2);
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Intermediate', currentRunsPerWeek: 2 })).toBe(3);
  });
  it('keeps an athlete already running more than the default at their current frequency, capped at 6', () => {
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Beginner', currentRunsPerWeek: 5 })).toBe(5);
    expect(recommendedRunsPerWeek({ fitnessLevel: 'Intermediate', currentRunsPerWeek: 7 })).toBe(6);
  });
});

describe('resolveRunsPerWeek', () => {
  it('caps at 6 so there is always a rest day', () => {
    expect(resolveRunsPerWeek(7, 7)).toBe(6);
  });
  it('caps at the number of available days', () => {
    expect(resolveRunsPerWeek(4, 2)).toBe(2);
  });
});

describe('selectRunDays', () => {
  it('spreads runs around the week from the long-run day instead of using every available day', () => {
    expect(selectRunDays(ALL_DAYS, 4, { longDay: 'sunday' })).toEqual(['monday', 'wednesday', 'friday', 'sunday']);
  });
  it('avoids preferred rest days when other days are available', () => {
    const days = selectRunDays(ALL_DAYS, 4, { longDay: 'sunday', restDays: ['monday', 'friday'] });
    expect(days).toHaveLength(4);
    expect(days).not.toContain('monday');
    expect(days).not.toContain('friday');
  });
  it('takes a preferred second-session day', () => {
    expect(selectRunDays(ALL_DAYS, 3, { longDay: 'sunday', preferredDays: ['tuesday'] })).toContain('tuesday');
  });
});

describe('qualityCountFor', () => {
  it('has no quality sessions in Foundation', () => {
    expect(qualityCountFor({ phase: 'Foundation', runsPerWeek: 6, raceGoal: 'race' })).toBe(0);
  });
  it('scales with runs per week and race goal', () => {
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 3, raceGoal: 'time' })).toBe(1);
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 4, raceGoal: 'time' })).toBe(1);
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 4, raceGoal: 'race' })).toBe(2);
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 5, raceGoal: 'finish' })).toBe(1);
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 5, raceGoal: 'time' })).toBe(2);
  });
  it('keeps at most one in Taper and recovery weeks', () => {
    expect(qualityCountFor({ phase: 'Taper', runsPerWeek: 6, raceGoal: 'race' })).toBe(1);
    expect(qualityCountFor({ phase: 'Build', runsPerWeek: 6, raceGoal: 'race', isRecoveryWeek: true })).toBe(1);
  });
});

describe('assignRunRoles', () => {
  it('puts quality sessions mid-week, apart from each other, with a recovery run after the long run', () => {
    expect(assignRunRoles(['monday', 'wednesday', 'friday', 'sunday'], 'sunday', 2)).toEqual({
      monday: 'recovery', wednesday: 'quality', friday: 'quality', sunday: 'long',
    });
  });
  it('drops a quality session rather than stacking hard days back to back or before the long run', () => {
    const roles = assignRunRoles(['thursday', 'friday', 'saturday', 'sunday'], 'sunday', 2);
    expect(Object.values(roles).filter(r => r === 'quality')).toHaveLength(1);
    expect(roles.saturday).not.toBe('quality');
  });
  it('honours a preferred quality day when the rules allow it', () => {
    const roles = assignRunRoles(['tuesday', 'thursday', 'sunday'], 'sunday', 1, 'tuesday');
    expect(roles.tuesday).toBe('quality');
  });
});

describe('placeStrengthDays', () => {
  const runDays = ['monday', 'wednesday', 'friday', 'sunday'];
  const roles = assignRunRoles(runDays, 'sunday', 2);

  it('never uses the long-run day, a quality day, or a preferred rest day', () => {
    const days = placeStrengthDays({ runDays, roles, availableDays: ALL_DAYS, count: 2, restDays: ['tuesday'] });
    expect(days).toHaveLength(2);
    days.forEach(d => {
      expect(d).not.toBe('sunday');
      expect(roles[d]).not.toBe('quality');
      expect(d).not.toBe('tuesday');
    });
  });
  it('avoids the day before the long run', () => {
    expect(placeStrengthDays({ runDays, roles, availableDays: ALL_DAYS, count: 2 })).not.toContain('saturday');
  });
  it('prefers a separate day when the athlete does not want two sessions in a day', () => {
    const days = placeStrengthDays({ runDays, roles, availableDays: ALL_DAYS, count: 1, allowDoubleDays: false });
    expect(runDays).not.toContain(days[0]);
  });
  it('always leaves at least one full rest day', () => {
    const six = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'];
    const r = assignRunRoles(six, 'sunday', 1);
    const days = placeStrengthDays({ runDays: six, roles: r, availableDays: ALL_DAYS, count: 2, allowDoubleDays: false });
    expect(days.every(d => six.includes(d))).toBe(true);
  });
  it('uses an explicitly chosen strength day', () => {
    expect(placeStrengthDays({ runDays, roles, availableDays: ALL_DAYS, count: 1, explicitDay: 'thursday' })).toEqual(['thursday']);
  });
});

describe('pace zones', () => {
  it('derives 10K pace from a 5K time with Riegel scaling', () => {
    const { secPerKm, source } = estimateTenKPace({ baselines: { run: { time5k: '25:00' } }, raceType: '10K' });
    expect(source).toBe('race');
    expect(secPerKm).toBeGreaterThan(300);
    expect(secPerKm).toBeLessThan(320);
  });
  it('prefers the target finish time', () => {
    const { secPerKm, source } = estimateTenKPace({ baselines: { run: { time5k: '25:00' } }, targetPaces: { run: 3000 }, raceType: '10K' });
    expect(source).toBe('target');
    expect(Math.round(secPerKm)).toBe(300);
  });
  it('falls back to a fitness-level default', () => {
    expect(estimateTenKPace({ raceType: '10K', fitnessLevel: 'Beginner' }).source).toBe('default');
  });
  it('orders zones fast → slow: race/fast < tempo < easy < recovery', () => {
    const z = paceZones(300, '10K');
    expect(z.tempo[0]).toBeGreaterThan(z.fast[1]);
    expect(z.easy[0]).toBeGreaterThan(z.tempo[1]);
    expect(z.recovery[0]).toBeGreaterThanOrEqual(z.easy[1]);
  });
  it('formats pace as m:ss', () => {
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(305.4)).toBe('5:05');
  });
});

describe('currentLongRunMinutes', () => {
  it('uses the usual long run first', () => {
    expect(currentLongRunMinutes({ usualLongRunMinutes: '75', canRunContinuously60min: true }, 400)).toBe(75);
  });
  it('treats "can run 60 minutes" as a 60-minute long run when nothing more specific is given', () => {
    expect(currentLongRunMinutes({ canRunContinuously60min: true }, 400)).toBe(60);
  });
  it('converts a longest run in km at easy pace', () => {
    expect(currentLongRunMinutes({ longestEffortKm: '9' }, 400)).toBe(60);
  });
  it('returns null with no signal', () => {
    expect(currentLongRunMinutes({}, 400)).toBeNull();
  });
});

describe('session sizing and targets', () => {
  it('sizes supporting runs off the long run, with quality long enough for warm-up + main set + cool-down', () => {
    const m = supportingRunMinutes(60);
    expect(m.easy).toBe(33);
    expect(m.recovery).toBe(24);
    expect(m.quality).toBeGreaterThanOrEqual(35);
  });
  it('gives easy runs a distance and pace range', () => {
    const { target, distanceKm } = describeRunTarget({ sessionType: 'Easy run', minutes: 40, zones: paceZones(300, '10K'), raceType: '10K' });
    expect(distanceKm).toBeGreaterThan(5);
    expect(target).toMatch(/≈[\d.]+ km · \d:\d\d–\d:\d\d\/km/);
  });
  it('spells out tempo structure with warm-up and cool-down', () => {
    const { target } = describeRunTarget({ sessionType: 'Tempo run', minutes: 40, zones: paceZones(300, '10K'), raceType: '10K' });
    expect(target).toMatch(/^10' easy · .* @ \d:\d\d–\d:\d\d\/km · 10' easy · ≈[\d.]+ km$/);
  });
  it('sizes race-pace reps by race distance', () => {
    const { target } = describeRunTarget({ sessionType: 'Race-pace intervals', minutes: 50, zones: paceZones(300, 'Half Marathon'), raceType: 'Half Marathon' });
    expect(target).toMatch(/×2 km @/);
  });
  it('marks targets built from a fitness-level default pace as estimates', () => {
    const { target } = describeRunTarget({ sessionType: 'Easy run', minutes: 30, zones: paceZones(420, '10K'), raceType: '10K', estimated: true });
    expect(target).toMatch(/\(est\.\)$/);
  });
});

describe('triathlon run paces and short sessions', () => {
  it('ignores a triathlon run-leg target when inferring open-road 10K pace', () => {
    expect(estimateTenKPace({ baselines: { run: { time10k: '48:00' } }, targetPaces: { run: 3000 }, raceType: 'Triathlon (Olympic)' }).source).toBe('race');
  });
  it('makes triathlon race pace slower than the open 10K equivalent (running off the bike)', () => {
    const z = paceZones(300, 'Triathlon (Olympic)');
    expect(z.race[0]).toBeGreaterThan(300);
  });
  it('scales warm-up/cool-down down for short quality sessions so the parts add up', () => {
    const { target } = describeRunTarget({ sessionType: 'Tempo run', minutes: 20, zones: paceZones(300, '10K'), raceType: '10K' });
    expect(target).toMatch(/^5' easy · 10' @ .* · 5' easy/);
  });
  it('avoids every long day when there is more than one', () => {
    const roles = { tuesday: 'easy', saturday: 'long', sunday: 'long' };
    const days = placeStrengthDays({ runDays: ['tuesday', 'saturday', 'sunday'], roles, availableDays: ALL_DAYS, count: 2 });
    expect(days).not.toContain('saturday');
    expect(days).not.toContain('sunday');
  });
});
