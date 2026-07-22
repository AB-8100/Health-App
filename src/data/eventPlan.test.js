import { describe, it, expect } from 'vitest';
import { getPlanWeekStart, getWeekNumberForDate } from './eventPlan';

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
