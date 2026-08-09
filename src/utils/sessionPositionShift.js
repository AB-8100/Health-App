// [LOGIC] "Shift position in future weeks" — moves a recurring session's
// weekly day-of-week at the exercise level (e.g. "Run"), independent of
// whatever session type/detail that exercise happens to carry on a given
// week (Interval vs Tempo vs Long run), for whichever weeks are still ahead.
//
// The two session sources that can carry this recurring, day-of-week concept
// (see WeeklyOverviewScreen's buildWeekData) are handled separately because
// they're stored differently:
//  - `activity` sessions live in a weekday-indexed map with no per-week
//    variance, so there's no way to leave "this week" untouched — shifting
//    one necessarily moves every week, same as dragging a gym split day.
//  - `event_plan` sessions are date-keyed (via eventOverrides/eventSessions,
//    see utils/eventDaySessions.js), so a shift can leave the date already in
//    view alone and only rewrite dates from next week onward.
import { getEventSessionsForDate } from './eventDaySessions';

// Moves a single recurring activity entry from one weekday slot to another.
// `actData` is matched by reference (mirrors how App.jsx's
// removeScheduledSession already filters this same list).
export function shiftActivityWeekday(activities = {}, oldDayIdx, actData, newDayIdx) {
  if (oldDayIdx === newDayIdx) return activities;
  const fromList = activities[oldDayIdx] || [];
  if (!fromList.includes(actData)) return activities;
  const toList = activities[newDayIdx] || [];
  return {
    ...activities,
    [oldDayIdx]: fromList.filter(a => a !== actData),
    [newDayIdx]: [...toList, actData],
  };
}

// Plan dates are UTC-midnight-anchored throughout (see data/eventPlan.js) —
// mirrored here so a shifted date lines up exactly with the rest of the
// event-plan machinery.
function parseUTCDateKey(dk) {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

// Shifts every future weekly occurrence of `label` (exercise-level match,
// case/whitespace-insensitive — so "Run" matches regardless of that week's
// sessionType being Interval/Tempo/etc.) from `oldDayIdx` to `newDayIdx`,
// starting the week *after* `fromDateKey` — the currently-viewed occurrence
// is left exactly as scheduled, matching "future weeks" in the feature name.
// Bounded by `horizonWeeks` so an indefinite recurring override can't spin
// into an unbounded loop.
export function shiftEventPlanWeekday({
  eventOverrides = {}, eventSessions = {}, hasEventTraining = false,
  fromDateKey, oldDayIdx, newDayIdx, label, horizonWeeks = 52,
}) {
  if (oldDayIdx === newDayIdx || !label) return eventOverrides;
  const needle = label.trim().toLowerCase();
  const dayDelta = newDayIdx - oldDayIdx;
  let next = { ...eventOverrides };

  for (let w = 1; w <= horizonWeeks; w++) {
    const oldDate = addDays(parseUTCDateKey(fromDateKey), w * 7);
    const oldDk = toDateKey(oldDate);
    const current = getEventSessionsForDate(oldDk, next, eventSessions, hasEventTraining);
    const matches = current.filter(s => (s.label || '').trim().toLowerCase() === needle);
    if (matches.length === 0) continue;

    const remaining = current.filter(s => !matches.includes(s));
    const newDk = toDateKey(addDays(oldDate, dayDelta));
    const existingAtNew = getEventSessionsForDate(newDk, next, eventSessions, hasEventTraining);

    next = { ...next, [oldDk]: remaining, [newDk]: [...existingAtNew, ...matches] };
  }
  return next;
}
