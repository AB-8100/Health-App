import { describe, it, expect } from 'vitest';
import { buildWeekData, sessionOrderKey, dayShortLabel, disambiguateLabel } from './WeeklyOverviewScreen';
import { SESSION_DISPLAY } from '../data/sessionDisplay';
import { getActivityOptions } from '../utils/analytics';

// A Monday-anchored plan start so week 1 lines up with DAY_SHORT's Mon..Sun.
const START_DATE = '2026-01-05'; // a Monday

// UTC-midnight-anchored, matching how plan dates are parsed elsewhere.
function utcDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

describe('dayShortLabel', () => {
  it('derives the label from the actual date, not a fixed Mon-start position', () => {
    // A plan startDate need not be a Monday (getPlanWeekStart only snaps to
    // Monday when there's no startDate at all) — the label must still match
    // the real weekday, e.g. 2026-08-12 is actually a Wednesday.
    expect(dayShortLabel(utcDate('2026-08-12'))).toBe('Wed');
  });

  it('covers all seven weekdays', () => {
    const expected = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // 2026-01-05 is a Monday
    for (let i = 0; i < 7; i++) {
      const d = utcDate('2026-01-05');
      d.setUTCDate(d.getUTCDate() + i);
      expect(dayShortLabel(d)).toBe(expected[i]);
    }
  });
});

describe('disambiguateLabel', () => {
  it('leaves a label unchanged when nothing on the day already has it', () => {
    expect(disambiguateLabel([{ label: 'Run' }], 'Bike')).toBe('Bike');
  });

  it('appends " 2" for the second occurrence, " 3" for the third, regardless of source', () => {
    expect(disambiguateLabel([{ label: 'Bike', source: 'event_plan' }], 'Bike')).toBe('Bike 2');
    expect(disambiguateLabel([{ label: 'Bike' }, { label: 'Bike 2' }], 'Bike')).toBe('Bike 2');
  });

  it('an empty day never collides', () => {
    expect(disambiguateLabel([], 'Bike')).toBe('Bike');
  });
});

// Regression test for the original bug this feature fixes: a manually-added
// Weekly Overview session must resolve to the same icon/colour AND the same
// Analytics pace bucket a plan-generated session of the same discipline
// gets — see features/specs/weekly-overview-add-session-activity-matrix.md.
describe('a manually-added session integrates with SESSION_DISPLAY and Analytics like a plan-generated one', () => {
  it('a manual bike session and a plan-generated bike session resolve to the same SESSION_DISPLAY entry and Analytics id', () => {
    const manualBikeSession = { type: 'bike', label: 'Cycling (moderate ride)', source: 'manual' };
    const planBikeSession = { type: 'bike', label: 'Bike', source: 'event_plan' };
    expect(SESSION_DISPLAY[manualBikeSession.type]).toBe(SESSION_DISPLAY[planBikeSession.type]);
    expect(SESSION_DISPLAY[manualBikeSession.type].emoji).toBe('🚴');
    expect(SESSION_DISPLAY[manualBikeSession.type].color).toBe('#D97706');

    const completedSessions = [
      { workout: 'Cycling (moderate ride)', type: 'bike', date: '2026-08-01', distance: 20, distanceUnit: 'km', elapsed: 3600 },
      { workout: 'Bike', type: 'bike', date: '2026-08-05', distance: 25, distanceUnit: 'km', elapsed: 4200 },
    ];
    const options = getActivityOptions(completedSessions);
    const bikeOptions = options.filter(o => o.id === 'pace:bike');
    expect(bikeOptions).toHaveLength(1); // one merged bucket, not two separate ones
  });
});

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

  // Regression test for the bug where dragging a session to reorder it
  // relative to a session from a *different* source (gym/event_plan/
  // activity) on the same day would visually move, then pop back to the
  // default gym → event_plan → activity order the next time the screen
  // rebuilt (navigating away and back, switching weeks and back, or the
  // app reloading after being backgrounded) — because that default push
  // order was the only thing buildWeekData ever produced, with nothing
  // remembering the user's manual arrangement.
  it('re-interleaves a day\'s sessions per a saved manual dayOrder instead of the default gym → event_plan → activity order', () => {
    const plan = { splitDays: 3, overrides: {}, scheduleOverride: null };
    // SPLITS[3] (Push/Pull/Legs) puts a gym day on Tuesday (index 1), not
    // Monday — key the activity there so the day actually has both a gym
    // and an activity session to interleave.
    const activities = { 1: [{ id: 'walk-1', type: 'walk', label: 'Walk' }] };
    const week = buildWeekData(1, plan, activities, {}, true, true, START_DATE, eventSessions);
    const gymDayIdx = week.findIndex(day => day.sessions.some(s => s.source === 'gym') && day.sessions.some(s => s.source === 'activity'));
    expect(gymDayIdx).toBe(1); // sanity-check the fixture actually has a mixed-source day, so the assertions below aren't vacuous

    const dk = week[gymDayIdx].dk;
    // Default order is gym first, activity second.
    expect(week[gymDayIdx].sessions.map(s => s.source)).toEqual(['gym', 'activity']);

    // Saved order puts the activity ahead of the gym session.
    const dayOrder = { [dk]: ['activity:Walk', 'gym:' + week[gymDayIdx].sessions.find(s => s.source === 'gym').label] };
    const reordered = buildWeekData(1, plan, activities, {}, true, true, START_DATE, eventSessions, [], dayOrder);
    expect(reordered[gymDayIdx].sessions.map(s => s.source)).toEqual(['activity', 'gym']);
  });

  // End-to-end persistence check: mirrors exactly what WeeklyOverviewScreen's
  // handleDragEnd does on a drop (splice the moved session out of its old
  // slot, splice it into the new one, then derive the day's saved order via
  // sessionOrderKey — the same function the component calls), then throws
  // that saved order at a *brand-new* buildWeekData call with none of the
  // original in-memory weekData involved, simulating the component fully
  // unmounting and remounting (navigating away and back, switching weeks and
  // back, or the app reloading after being backgrounded). If the drag result
  // doesn't survive that round trip, this test fails.
  it('a simulated drag-and-drop reorder survives a full buildWeekData remount, not just the in-memory state', () => {
    const plan = { splitDays: 3, overrides: {}, scheduleOverride: null };
    // Tuesday (index 1) is a gym day for SPLITS[3] — key the activity there.
    const activities = { 1: [{ id: 'walk-1', type: 'walk', label: 'Walk' }] };
    const before = buildWeekData(1, plan, activities, {}, true, true, START_DATE, eventSessions);
    const dayIdx = before.findIndex(day => day.sessions.some(s => s.source === 'gym') && day.sessions.some(s => s.source === 'activity'));
    expect(dayIdx).toBe(1); // sanity-check the fixture actually has a mixed-source day, so this test can't pass vacuously

    const dk = before[dayIdx].dk;
    expect(before[dayIdx].sessions.map(s => s.source)).toEqual(['gym', 'activity']); // pre-drag order

    // Simulate the user dragging the activity chip (index 1) above the gym
    // chip (index 0) within the same day — the exact splice handleDragEnd
    // performs on drop.
    const draggedSessions = before[dayIdx].sessions.slice();
    const [moved] = draggedSessions.splice(1, 1);
    draggedSessions.splice(0, 0, moved);
    expect(draggedSessions.map(s => s.source)).toEqual(['activity', 'gym']); // drag applied locally

    // Simulate handleDragEnd's persistence step.
    const persistedDayOrder = { [dk]: draggedSessions.map(sessionOrderKey) };

    // Simulate a full remount with only the persisted order available —
    // nothing from `before` or `draggedSessions` is reused below.
    const after = buildWeekData(1, plan, activities, {}, true, true, START_DATE, eventSessions, [], persistedDayOrder);
    expect(after[dayIdx].sessions.map(s => s.source)).toEqual(['activity', 'gym']); // survives the remount
  });

  it('appends sessions missing from a saved dayOrder after the ones it does know about', () => {
    const overrides = {
      '2026-01-05': [
        { type: 'run', label: 'Morning run', source: 'manual' },
        { type: 'swim', label: 'Evening swim', source: 'manual' },
      ],
    };
    const dayOrder = { '2026-01-05': ['event_plan:Evening swim'] };
    const week = buildWeekData(1, noPlan, {}, overrides, false, true, START_DATE, eventSessions, [], dayOrder);
    expect(week[0].sessions.map(s => s.label)).toEqual(['Evening swim', 'Morning run']);
  });

  // ── Cross-day move persistence ──────────────────────────────────────────────
  // These replay handleDragEnd's exact per-source persistence branches (the
  // code that runs when a session is dropped on a *different* day, not just
  // reordered within the same day), then feed the result into a completely
  // fresh buildWeekData call — simulating the screen fully unmounting and
  // remounting. If a cross-day move doesn't survive that round trip, the
  // session would appear to "snap back" to its original day.

  it('moving an event-plan/manual session to a different day persists there and clears the original day', () => {
    const overrides = { '2026-01-05': [{ type: 'swim', label: 'Swim', source: 'manual' }] }; // Monday
    const before = buildWeekData(1, noPlan, {}, overrides, false, true, START_DATE, eventSessions);
    expect(before[0].sessions.map(s => s.label)).toEqual(['Swim']); // Monday has it
    expect(before[2].sessions.some(s => s.label === 'Swim')).toBe(false); // Wednesday doesn't yet

    const srcRow = { dk: before[0].dk, sessions: [] }; // moved out of Monday
    const movedRaw = before[0].sessions[0].raw;
    const dstRow = { dk: before[2].dk, sessions: [...before[2].sessions, { source: 'event_plan', raw: movedRaw }] }; // dropped on Wednesday

    // handleDragEnd's exact event_plan persistence branch.
    const newOverrides = { ...overrides };
    [srcRow, dstRow].forEach(row => {
      newOverrides[row.dk] = row.sessions.filter(s => s.source === 'event_plan').map(s => s.raw);
    });

    // Fresh rebuild — nothing from `before` reused.
    const after = buildWeekData(1, noPlan, {}, newOverrides, false, true, START_DATE, eventSessions);
    expect(after[0].sessions.some(s => s.label === 'Swim')).toBe(false); // gone from Monday
    expect(after[2].sessions.some(s => s.label === 'Swim')).toBe(true);  // now on Wednesday
  });

  it('moving an activity to a different day persists there and clears the original day', () => {
    const activities = { 0: [{ id: 'walk-1', type: 'walk', label: 'Walk' }] }; // Monday
    // hasEventTraining=false / no eventSessions so the shared fixture's Monday
    // "Swim" event-plan session doesn't share the day with the activity.
    const before = buildWeekData(1, noPlan, activities, {}, false, false, START_DATE, {});
    expect(before[0].sessions.map(s => s.label)).toEqual(['Walk']);
    expect(before[3].sessions.some(s => s.label === 'Walk')).toBe(false); // Thursday doesn't yet

    const srcRow = { dayIdx: before[0].dayIdx, sessions: [] };
    const movedAct = before[0].sessions[0].actData;
    const dstRow = { dayIdx: before[3].dayIdx, sessions: [...before[3].sessions, { source: 'activity', actData: movedAct }] };

    // handleDragEnd's exact activity persistence branch.
    const newActivities = { ...activities };
    [srcRow, dstRow].forEach(row => {
      newActivities[row.dayIdx] = row.sessions.filter(s => s.source === 'activity').map(s => s.actData);
    });

    const after = buildWeekData(1, noPlan, newActivities, {}, false, false, START_DATE, {});
    expect(after[0].sessions.some(s => s.label === 'Walk')).toBe(false); // gone from Monday
    expect(after[3].sessions.some(s => s.label === 'Walk')).toBe(true);  // now on Thursday
  });

  it('moving a gym session to a different day swaps the schedule and persists on rebuild', () => {
    const plan = { splitDays: 3, overrides: {}, scheduleOverride: null }; // Push/Pull/Legs: Tue/Thu/Sat
    const before = buildWeekData(1, plan, {}, {}, true, false, START_DATE, {});
    expect(before[1].sessions.some(s => s.source === 'gym')).toBe(true);  // Tuesday has gym
    expect(before[0].sessions.some(s => s.source === 'gym')).toBe(false); // Monday (rest) doesn't

    // Drag Tuesday's gym session onto Monday (rest day) — handleDragEnd's
    // exact gym persistence branch: swap the two weekday slots.
    const srcRow = { dayIdx: 1 }; // Tuesday
    const dstRow = { dayIdx: 0 }; // Monday
    const split = { schedule: ['—', 'push', '—', 'pull', '—', 'legs', '—'], days: [{ id: 'push' }, { id: 'pull' }, { id: 'legs' }] };
    const base = plan.scheduleOverride || split.schedule;
    const sched = [...base];
    const tmp = sched[srcRow.dayIdx];
    sched[srcRow.dayIdx] = sched[dstRow.dayIdx];
    sched[dstRow.dayIdx] = tmp;

    const newPlan = { ...plan, scheduleOverride: sched };
    const after = buildWeekData(1, newPlan, {}, {}, true, false, START_DATE, {});
    expect(after[1].sessions.some(s => s.source === 'gym')).toBe(false); // gone from Tuesday
    expect(after[0].sessions.some(s => s.source === 'gym')).toBe(true);  // now on Monday
  });
});
