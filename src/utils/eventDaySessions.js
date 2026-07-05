// Pure helper shared by WeeklyOverviewScreen (buildWeekData) and GymHubScreen
// (the Session tab's "today" card) for deciding which event-plan sessions
// apply on a given date key. Kept in one place so the two views can't drift
// out of sync on this logic — they used to duplicate it inline.
//
// Precedence: a per-day override (manually edited/added/moved sessions,
// keyed by date) always wins over the uploaded plan's own sessions for that
// date. Without an override, the uploaded plan's sessions apply (minus any
// explicit "rest" entries, which aren't rendered as sessions) — but only
// once a plan has actually been uploaded (`hasEventTraining`); otherwise a
// day with no override has no event-plan sessions at all.
export function getEventSessionsForDate(dk, eventOverrides = {}, eventSessions = {}, hasEventTraining = false) {
  if (Object.prototype.hasOwnProperty.call(eventOverrides, dk)) {
    return eventOverrides[dk];
  }
  if (!hasEventTraining) return [];
  return (eventSessions[dk] || []).filter(s => s.type !== 'rest');
}
