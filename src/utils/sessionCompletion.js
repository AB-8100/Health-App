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

// A completed session's local calendar day, for matching against a plan
// day's date key (which is itself a local-feeling YYYY-MM-DD string).
export function completedDateKey(s) {
  const d = new Date(s.date || s.endedAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whether a scheduled session (from a Weekly Overview day) has a matching
// logged entry among that same day's completed sessions. Gym completions
// aren't labelled the same way as the scheduled gym session (split day name
// vs. "<name> day"), so a gym session is considered done as soon as any
// completed entry for the day carries logged exercises; non-gym sessions
// are matched by workout label instead.
export function isSessionCompleted(sess, completedForDay = []) {
  if (sess.source === 'gym') {
    return completedForDay.some(s => Array.isArray(s.queue) && s.queue.length > 0);
  }
  return completedForDay.some(s => s.workout === sess.label);
}

// A completed session that doesn't correspond to any of a day's scheduled
// sessions (by the same matching rules as isSessionCompleted) gets a
// synthetic bubble of its own, so it isn't silently missing from the Weekly
// Overview just because nothing is "scheduled" for that day any more. This
// covers e.g. a plan re-upload that (before a fix — see
// data/eventPlan.js's mergeEventPlanFromCutoff) discarded a past day's own
// schedule while its logged completion stayed in `completedSessions`, as
// well as a freeform "log a different activity" completion that never had a
// scheduled slot to begin with.
export function buildOrphanedCompletionSessions(dk, dayIdx, sessions, completedForDay = []) {
  return completedForDay
    .filter(cs => !sessions.some(s => isSessionCompleted(s, [cs])))
    .map(cs => ({
      id: `completed-${dk}-${cs.id}`,
      type: cs.type || (Array.isArray(cs.queue) && cs.queue.length > 0 ? 'gym' : 'other'),
      label: cs.workout || 'Session',
      detail: '',
      source: 'completed_only',
      dayIdx,
      completed: true,
    }));
}

// A past day's event-plan-sourced session that was never completed, on a day
// that already has at least one completed session, is a phantom left over
// from a plan upload that (before mergeEventPlanFromCutoff existed) applied
// its sessions onto dates before it was ever uploaded rather than a real
// missed session — drop it so it doesn't sit as a duplicate, never-done
// bubble next to the day's real logged session. Days with no completed
// session at all are left untouched, since there's no way to tell a
// leftover phantom apart from a genuinely missed session in that case.
export function dropPhantomPastEventPlanSessions(sessions, isPastDay) {
  if (!isPastDay) return sessions;
  const hasCompleted = sessions.some(s => s.completed);
  if (!hasCompleted) return sessions;
  return sessions.filter(s => s.source !== 'event_plan' || s.completed);
}
