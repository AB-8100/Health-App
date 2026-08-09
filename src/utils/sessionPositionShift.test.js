import { describe, it, expect } from 'vitest';
import { shiftActivityWeekday, shiftEventPlanWeekday } from './sessionPositionShift';

describe('shiftActivityWeekday', () => {
  it('moves the matching entry from the old weekday to the new one', () => {
    const run = { id: 'a1', label: 'Run' };
    const activities = { 1: [run], 3: [{ id: 'a2', label: 'Swim' }] };
    const next = shiftActivityWeekday(activities, 1, run, 4);
    expect(next[1]).toEqual([]);
    expect(next[4]).toEqual([run]);
    expect(next[3]).toEqual([{ id: 'a2', label: 'Swim' }]);
  });

  it('appends to an existing list on the destination day rather than replacing it', () => {
    const run = { id: 'a1', label: 'Run' };
    const activities = { 1: [run], 4: [{ id: 'a3', label: 'Yoga' }] };
    const next = shiftActivityWeekday(activities, 1, run, 4);
    expect(next[4]).toEqual([{ id: 'a3', label: 'Yoga' }, run]);
  });

  it('is a no-op when old and new weekday are the same', () => {
    const activities = { 1: [{ id: 'a1', label: 'Run' }] };
    expect(shiftActivityWeekday(activities, 1, activities[1][0], 1)).toBe(activities);
  });

  it('is a no-op when the entry is not actually on the claimed weekday', () => {
    const other = { id: 'a9', label: 'Ghost' };
    const activities = { 1: [{ id: 'a1', label: 'Run' }] };
    expect(shiftActivityWeekday(activities, 1, other, 4)).toBe(activities);
  });
});

describe('shiftEventPlanWeekday', () => {
  // A 3-week plan with a Tuesday (dayIdx 1) run varying type each week, plus
  // an unrelated Thursday swim that should never move.
  const eventSessions = {
    '2026-07-07': [{ type: 'run', label: 'Run', sessionType: 'Interval' }],
    '2026-07-09': [{ type: 'swim', label: 'Swim' }],
    '2026-07-14': [{ type: 'run', label: 'Run', sessionType: 'Tempo' }],
    '2026-07-21': [{ type: 'run', label: 'Run', sessionType: 'Long run' }],
  };

  it('leaves the currently-viewed week untouched and moves later weeks to the new weekday', () => {
    const next = shiftEventPlanWeekday({
      eventOverrides: {}, eventSessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 1, newDayIdx: 3, label: 'Run', horizonWeeks: 4,
    });
    // This week (07-07) is untouched — no override written for it.
    expect(Object.prototype.hasOwnProperty.call(next, '2026-07-07')).toBe(false);
    // Next week's Tuesday run (07-14) is removed and re-added on Thursday (07-16).
    expect(next['2026-07-14']).toEqual([]);
    expect(next['2026-07-16']).toEqual([{ type: 'run', label: 'Run', sessionType: 'Tempo' }]);
    // Week after (07-21) shifts the same way, two weeks later (07-23).
    expect(next['2026-07-21']).toEqual([]);
    expect(next['2026-07-23']).toEqual([{ type: 'run', label: 'Run', sessionType: 'Long run' }]);
  });

  it('matches by label only, ignoring sessionType/detail (exercise-level match)', () => {
    const next = shiftEventPlanWeekday({
      eventOverrides: {}, eventSessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 1, newDayIdx: 3, label: 'run', horizonWeeks: 1,
    });
    expect(next['2026-07-16']).toEqual([{ type: 'run', label: 'Run', sessionType: 'Tempo' }]);
  });

  it('never touches a session with a different label on the same weekday', () => {
    const sessions = { '2026-07-09': eventSessions['2026-07-09'] };
    const next = shiftEventPlanWeekday({
      eventOverrides: {}, eventSessions: sessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 3, newDayIdx: 5, label: 'Run', horizonWeeks: 2,
    });
    expect(next).toEqual({});
  });

  it('merges into an existing session on the destination date instead of clobbering it', () => {
    const sessions = {
      '2026-07-14': [{ type: 'run', label: 'Run', sessionType: 'Tempo' }],
      '2026-07-16': [{ type: 'gym', label: 'Leg Day' }],
    };
    const next = shiftEventPlanWeekday({
      eventOverrides: {}, eventSessions: sessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 1, newDayIdx: 3, label: 'Run', horizonWeeks: 1,
    });
    expect(next['2026-07-16']).toEqual([
      { type: 'gym', label: 'Leg Day' },
      { type: 'run', label: 'Run', sessionType: 'Tempo' },
    ]);
  });

  it('respects an existing eventOverrides entry as the source of truth for that date', () => {
    const overrides = { '2026-07-14': [{ type: 'run', label: 'Run', sessionType: 'overridden' }] };
    const next = shiftEventPlanWeekday({
      eventOverrides: overrides, eventSessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 1, newDayIdx: 3, label: 'Run', horizonWeeks: 1,
    });
    expect(next['2026-07-16']).toEqual([{ type: 'run', label: 'Run', sessionType: 'overridden' }]);
  });

  it('is a no-op when old and new weekday are the same', () => {
    const overrides = {};
    expect(shiftEventPlanWeekday({
      eventOverrides: overrides, eventSessions, hasEventTraining: true,
      fromDateKey: '2026-07-07', oldDayIdx: 1, newDayIdx: 1, label: 'Run',
    })).toBe(overrides);
  });

  it('works for manually-added sessions (eventOverrides) with no uploaded plan at all', () => {
    const overrides = {
      '2026-07-07': [{ type: 'run', label: 'Run', source: 'manual' }],
    };
    const next = shiftEventPlanWeekday({
      eventOverrides: overrides, eventSessions: {}, hasEventTraining: false,
      fromDateKey: '2026-06-30', oldDayIdx: 1, newDayIdx: 3, label: 'Run', horizonWeeks: 1,
    });
    expect(next['2026-07-07']).toEqual([]);
    expect(next['2026-07-09']).toEqual([{ type: 'run', label: 'Run', source: 'manual' }]);
  });
});
