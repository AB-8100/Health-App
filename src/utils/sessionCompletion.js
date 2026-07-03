// Pure helpers for matching a day's completed sessions (from `completedSessions`)
// against that day's scheduled activities, used by ActivitySessionView (the
// non-gym "Session" tab) to decide whether to show "Start session" or
// "Logged — view" for each scheduled activity, and for the day as a whole.

// Sessions in `completedSessions` whose local calendar date matches `now`.
export function getTodaysCompletedSessions(completedSessions = [], now = new Date()) {
  const todayStr = now.toDateString();
  return completedSessions.filter(s => new Date(s.date).toDateString() === todayStr);
}

// The completed session (if any) that was logged specifically for this
// scheduled activity, matched by workout label.
export function findCompletedForActivity(act, todaysCompleted = []) {
  if (!act) return null;
  return todaysCompleted.find(s => s.workout === act.label) || null;
}

// Completed-today sessions that don't correspond to any of today's scheduled
// activities by label — e.g. logged via the generic "Log a different
// activity" flow (no specific activity selected, so `markSessionComplete`
// falls back to a generic workout name that won't match any scheduled
// activity's label). Without surfacing these, a session that was genuinely
// logged today looks like nothing happened, since none of the scheduled
// activity cards change state.
export function getUnmatchedCompletions(todayActs = [], todaysCompleted = []) {
  return todaysCompleted.filter(s => !todayActs.some(act => act.label === s.workout));
}
