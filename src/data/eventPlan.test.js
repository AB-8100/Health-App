import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getPlanWeekStart, getWeekNumberForDate, getCurrentPlanWeek, getPlanCalendarWeeks,
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

// "Calendar view should always start on a Monday regardless of when the plan
// is set up": a plan started mid-week must still render Mon–Sun weeks.
describe('Monday-anchored plan weeks', () => {
  afterEach(() => vi.useRealTimers());

  const THURSDAY_START = '2026-10-29';

  it('snaps week 1 back to the Monday of a mid-week start date', () => {
    expect(getPlanWeekStart(1, THURSDAY_START).toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(getPlanWeekStart(2, THURSDAY_START).toISOString().slice(0, 10)).toBe('2026-11-02');
  });

  it('treats a Sunday start as the end of the week that began the Monday before', () => {
    expect(getPlanWeekStart(1, '2026-11-01').toISOString().slice(0, 10)).toBe('2026-10-26');
  });

  it('leaves a Monday start date unchanged', () => {
    expect(getPlanWeekStart(1, START_DATE).toISOString().slice(0, 10)).toBe(START_DATE);
  });

  it('every week starts on a Monday', () => {
    for (let week = 1; week <= 20; week++) {
      expect(getPlanWeekStart(week, THURSDAY_START).getUTCDay()).toBe(1);
    }
  });

  it('getWeekNumberForDate counts weeks Mon–Sun from a mid-week start', () => {
    expect(getWeekNumberForDate('2026-10-29', THURSDAY_START)).toBe(1); // Thu
    expect(getWeekNumberForDate('2026-11-01', THURSDAY_START)).toBe(1); // Sun
    expect(getWeekNumberForDate('2026-11-02', THURSDAY_START)).toBe(2); // Mon
  });

  it('getCurrentPlanWeek rolls over on Monday, not on the start weekday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 12)); // local Sun 1 Nov
    expect(getCurrentPlanWeek(THURSDAY_START, 18)).toBe(1);
    vi.setSystemTime(new Date(2026, 10, 2, 12)); // local Mon 2 Nov
    expect(getCurrentPlanWeek(THURSDAY_START, 18)).toBe(2);
  });

  it('getPlanCalendarWeeks adds a week when the event spills past the plan\'s own week count', () => {
    // Thu start + 18 seven-day blocks ends Wed 2027-03-03; a Monday 1 Mar race
    // sits in calendar week 19 once weeks run Mon–Sun.
    expect(getPlanCalendarWeeks(THURSDAY_START, '2027-03-01', 18)).toBe(19);
    expect(getPlanCalendarWeeks(THURSDAY_START, '2027-02-28', 18)).toBe(18);
    expect(getPlanCalendarWeeks(null, '2027-03-01', 18)).toBe(18);
  });
});
