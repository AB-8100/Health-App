import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getPlanWeekStart, getWeekNumberForDate,
  getCurrentWeekStartDateKey, getNextWeekStartDateKey, pickBeforeCutoff, mergeEventPlanFromCutoff,
} from './eventPlan';

const START_DATE = '2026-01-05'; // a Monday

describe('getWeekNumberForDate', () => {
  it('is the inverse of getPlanWeekStart for the first day of a week', () => {
    for (let week = 1; week <= 10; week++) {
      const start = getPlanWeekStart(week, START_DATE);
      const dk = start.toISOString().slice(0, 10);
      expect(getWeekNumberForDate(dk, START_DATE)).toBe(week);
    }
  });

  it('resolves any day within a week to that week number, not just its Monday', () => {
    const weekStart = getPlanWeekStart(4, START_DATE);
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + offset);
      const dk = d.toISOString().slice(0, 10);
      expect(getWeekNumberForDate(dk, START_DATE)).toBe(4);
    }
  });
});

// Regression coverage for the "uploading a new training plan removed prior
// weeks' completions from the Weekly Overview" bug: a replacement plan must
// only apply from the current week onward, never retroactively.
describe('getCurrentWeekStartDateKey', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the Monday of the current UTC calendar week', () => {
    // Wednesday 2026-07-22 -> Monday 2026-07-20
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 22, 15, 0, 0)));
    expect(getCurrentWeekStartDateKey()).toBe('2026-07-20');
  });

  it('rolls a Sunday back to the Monday that started its week, not the next one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 26, 9, 0, 0))); // Sunday 2026-07-26
    expect(getCurrentWeekStartDateKey()).toBe('2026-07-20');
  });
});

// Regression coverage for "uploading mid-week reshuffled the rest of the
// current week's plan": a replacement plan must only apply from the week
// after the upload, never the upload's own (possibly still in-progress) week.
describe('getNextWeekStartDateKey', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the Monday of the week after the current UTC calendar week', () => {
    // Wednesday 2026-07-22 -> Monday 2026-07-27 (the following week)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 22, 15, 0, 0)));
    expect(getNextWeekStartDateKey()).toBe('2026-07-27');
  });

  it('rolls a Sunday forward to the Monday starting the following week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 26, 9, 0, 0))); // Sunday 2026-07-26
    expect(getNextWeekStartDateKey()).toBe('2026-07-27');
  });
});

describe('pickBeforeCutoff', () => {
  it('keeps only entries with a date key strictly before the cutoff', () => {
    const map = { '2026-07-19': 'a', '2026-07-20': 'b', '2026-07-21': 'c' };
    expect(pickBeforeCutoff(map, '2026-07-20')).toEqual({ '2026-07-19': 'a' });
  });

  it('handles an empty/undefined map', () => {
    expect(pickBeforeCutoff(undefined, '2026-07-20')).toEqual({});
    expect(pickBeforeCutoff({}, '2026-07-20')).toEqual({});
  });
});

describe('mergeEventPlanFromCutoff', () => {
  it('keeps the old plan\'s sessions before the cutoff and the new plan\'s from the cutoff onward', () => {
    const oldPlan = {
      meta: { totalWeeks: 12 },
      sessions: {
        '2026-07-13': [{ type: 'run', label: 'Old easy run' }],
        '2026-07-20': [{ type: 'run', label: 'Old tempo run' }],
      },
    };
    const newPlan = {
      meta: { totalWeeks: 18 },
      sessions: {
        '2026-07-20': [{ type: 'swim', label: 'New swim' }],
        '2026-07-27': [{ type: 'bike', label: 'New bike' }],
      },
    };
    const merged = mergeEventPlanFromCutoff(oldPlan, newPlan, '2026-07-20');

    expect(merged.sessions).toEqual({
      '2026-07-13': [{ type: 'run', label: 'Old easy run' }],
      '2026-07-20': [{ type: 'swim', label: 'New swim' }],
      '2026-07-27': [{ type: 'bike', label: 'New bike' }],
    });
    // Everything else (meta, phases, etc.) comes from the new plan.
    expect(merged.meta).toEqual({ totalWeeks: 18 });
  });

  it('works when there was no plan before (fresh upload)', () => {
    const newPlan = { meta: {}, sessions: { '2026-07-27': [{ type: 'run' }] } };
    const merged = mergeEventPlanFromCutoff(undefined, newPlan, '2026-07-20');
    expect(merged.sessions).toEqual({ '2026-07-27': [{ type: 'run' }] });
  });
});
