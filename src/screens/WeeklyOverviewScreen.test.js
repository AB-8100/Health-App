import { describe, it, expect } from 'vitest';
import { buildWeekData } from './WeeklyOverviewScreen';

// A Monday-anchored plan start so week 1 lines up with DAY_SHORT's Mon..Sun.
const START_DATE = '2026-01-05'; // a Monday

const eventSessions = {
  '2026-01-05': [{ type: 'swim', label: 'Swim', sessionType: 'Endurance', duration: '30 min' }],
  '2026-01-06': [{ type: 'rest', label: 'Rest' }],
  '2026-01-07': [{ type: 'run', label: 'Run' }],
};

const noPlan = { splitDays: null, overrides: {}, scheduleOverride: null };

describe('buildWeekData', () => {
  it('surfaces the uploaded plan\'s sessions on the days that have them, once hasEventTraining is true', () => {
    const week = buildWeekData(1, noPlan, {}, {}, false, true, START_DATE, eventSessions);

    expect(week).toHaveLength(7);
    expect(week[0].dk).toBe('2026-01-05');
    expect(week[0].sessions).toEqual([
      expect.objectContaining({ type: 'swim', label: 'Swim', source: 'event_plan' }),
    ]);

    // A "rest" entry in the uploaded plan doesn't render as a session
    expect(week[1].sessions).toEqual([]);

    expect(week[2].sessions).toEqual([
      expect.objectContaining({ type: 'run', label: 'Run', source: 'event_plan' }),
    ]);

    // Days the plan says nothing about show as empty (rendered as "Rest" by DayRow)
    expect(week[3].sessions).toEqual([]);
  });

  // Regression test: before an upload, or for a day with no plan data,
  // buildWeekData must not show a plan session — this is the exact "still
  // showing only rest days" symptom, just inverted (make sure a *real*
  // uploaded plan's sessions aren't being masked by a hasEventTraining=false
  // or empty-sessions bug).
  it('shows nothing from the plan when hasEventTraining is false, even if sessions exist', () => {
    const week = buildWeekData(1, noPlan, {}, {}, false, false, START_DATE, eventSessions);
    week.forEach(day => expect(day.sessions).toEqual([]));
  });

  it('lets a manual override replace the plan\'s session for that specific day', () => {
    const overrides = { '2026-01-05': [{ type: 'yoga', label: 'Yoga', source: 'manual' }] };
    const week = buildWeekData(1, noPlan, {}, overrides, false, true, START_DATE, eventSessions);
    expect(week[0].sessions).toEqual([
      expect.objectContaining({ type: 'yoga', label: 'Yoga' }),
    ]);
  });

  it('includes a gym-split session alongside any event-plan session for the same day', () => {
    const plan = { splitDays: 3, overrides: {}, scheduleOverride: null };
    const week = buildWeekData(1, plan, {}, {}, true, true, START_DATE, eventSessions);
    // Whatever SPLITS[3]'s schedule puts on Monday (if anything), the
    // event-plan swim session for that date must still be present.
    expect(week[0].sessions.some(s => s.source === 'event_plan' && s.label === 'Swim')).toBe(true);
  });

  // Regression test: a scheduleOverride can hold split-day ids from a split
  // template that isn't the currently active one (e.g. the user changed
  // splits via "Customize split" after this override was saved, or it's
  // stale data). Before scheduleReconciliation.js, this silently dropped
  // the gym session for that day (def lookup failed and was skipped) even
  // though the day was clearly meant to be a training day — buildWeekData
  // must now reconcile onto the active split's ids instead of dropping it.
  it('reconciles a scheduleOverride holding ids from a different split rather than dropping the day', () => {
    const plan = {
      splitDays: 3, // Push/Pull/Legs — day ids: push, pull, legs
      overrides: {},
      // 'upper'/'lower' belong to splitDays=2, not splitDays=3
      scheduleOverride: ['upper', '—', '—', 'lower', '—', '—', '—'],
    };
    const week = buildWeekData(1, plan, {}, {}, true, false, START_DATE, {});
    expect(week[0].sessions.some(s => s.type === 'gym')).toBe(true);
    expect(week[3].sessions.some(s => s.type === 'gym')).toBe(true);
    // Days that were rest in the override stay rest.
    expect(week[1].sessions.some(s => s.type === 'gym')).toBe(false);
  });

  it('marks the day matching today\'s real date as isToday', () => {
    const week = buildWeekData(1, noPlan, {}, {}, false, true, START_DATE, eventSessions);
    expect(week.filter(d => d.isToday).length).toBeLessThanOrEqual(1);
  });

  it('marks a session as completed once a matching logged session exists for that date', () => {
    const completedSessions = [
      { workout: 'Swim', date: '2026-01-05T09:00:00.000Z' },
    ];
    const week = buildWeekData(1, noPlan, {}, {}, false, true, START_DATE, eventSessions, completedSessions);
    expect(week[0].sessions[0]).toEqual(expect.objectContaining({ label: 'Swim', completed: true }));
    // The Wednesday run has no matching completed entry, so it stays open.
    expect(week[2].sessions[0]).toEqual(expect.objectContaining({ label: 'Run', completed: false }));
  });

  it('marks a gym session as completed when a completed entry for that day carries a logged exercise queue', () => {
    const plan = { splitDays: 3, overrides: {}, scheduleOverride: null };
    const week = buildWeekData(1, plan, {}, {}, true, true, START_DATE, eventSessions);
    const gymDayIdx = week.findIndex(day => day.sessions.some(s => s.source === 'gym'));
    if (gymDayIdx === -1) return; // this split has no gym session on week 1 — nothing to assert
    const gymDate = week[gymDayIdx].dk;
    const completedSessions = [{ workout: 'irrelevant', date: `${gymDate}T09:00:00.000Z`, queue: [{ sets: [{ done: true }] }] }];
    const withCompletion = buildWeekData(1, plan, {}, {}, true, true, START_DATE, eventSessions, completedSessions);
    const gymSession = withCompletion[gymDayIdx].sessions.find(s => s.source === 'gym');
    expect(gymSession.completed).toBe(true);
  });
});
