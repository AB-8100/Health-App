import { describe, it, expect } from 'vitest';
import {
  getTodaysCompletedSessions, findCompletedForActivity, getUnmatchedCompletions,
  buildOrphanedCompletionSessions, dropPhantomPastEventPlanSessions,
} from './sessionCompletion';

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('getTodaysCompletedSessions', () => {
  it('keeps only sessions logged on the current calendar day', () => {
    const sessions = [
      { id: '1', workout: 'Run', date: iso(0) },
      { id: '2', workout: 'Swim', date: iso(-1) },
      { id: '3', workout: 'Yoga', date: iso(1) },
    ];
    expect(getTodaysCompletedSessions(sessions).map(s => s.id)).toEqual(['1']);
  });

  it('returns an empty array when nothing was logged today', () => {
    expect(getTodaysCompletedSessions([{ id: '1', date: iso(-3) }])).toEqual([]);
  });

  it('defaults to an empty list when completedSessions is omitted', () => {
    expect(getTodaysCompletedSessions()).toEqual([]);
  });
});

describe('findCompletedForActivity', () => {
  const todaysCompleted = [
    { id: '1', workout: 'Rugby', date: iso(0) },
    { id: '2', workout: 'Session', date: iso(0) },
  ];

  it('matches a completed session by exact workout label', () => {
    const found = findCompletedForActivity({ label: 'Rugby' }, todaysCompleted);
    expect(found?.id).toBe('1');
  });

  it('returns null when no completed session matches the activity label', () => {
    expect(findCompletedForActivity({ label: 'Swim' }, todaysCompleted)).toBeNull();
  });

  it('returns null for a null/undefined activity instead of throwing', () => {
    expect(findCompletedForActivity(null, todaysCompleted)).toBeNull();
  });
});

describe('getUnmatchedCompletions', () => {
  const todayActs = [{ label: 'Rugby' }, { label: 'Swim' }];

  it('excludes sessions that match a scheduled activity by label', () => {
    const todaysCompleted = [{ id: '1', workout: 'Rugby' }];
    expect(getUnmatchedCompletions(todayActs, todaysCompleted)).toEqual([]);
  });

  // Regression test: logging a session via the generic "Log a different
  // activity" flow (no specific activity selected) saves it under a generic
  // workout name ("Session", or a gym-split-derived name) that never matches
  // a scheduled activity's label. Before this fix, that meant every
  // scheduled activity card kept showing "Start session" / "Record" as if
  // the user's tap on "Log a different activity" had done nothing.
  it('surfaces a completed session that does not match any scheduled activity', () => {
    const todaysCompleted = [{ id: '1', workout: 'Session' }];
    expect(getUnmatchedCompletions(todayActs, todaysCompleted)).toEqual([{ id: '1', workout: 'Session' }]);
  });

  it('surfaces unmatched sessions even when there are no scheduled activities at all', () => {
    const todaysCompleted = [{ id: '1', workout: 'Session' }];
    expect(getUnmatchedCompletions([], todaysCompleted)).toEqual(todaysCompleted);
  });
});

// Regression coverage for "uploading a new training plan removed prior
// weeks' completions from the Weekly Overview" — the data was never
// destroyed (still in completedSessions), but a day with no scheduled
// session left it with no bubble to attach to. These two helpers reconcile
// buildWeekData's output so logged sessions resurface and phantom
// duplicates left over from the pre-fix behavior get cleaned up.
describe('buildOrphanedCompletionSessions', () => {
  it('synthesizes a completed bubble for a logged session with no scheduled match', () => {
    const completedForDay = [{ id: 'c1', workout: 'Old tempo run', type: 'run' }];
    const orphans = buildOrphanedCompletionSessions('2026-07-13', 2, [], completedForDay);
    expect(orphans).toEqual([{
      id: 'completed-2026-07-13-c1', type: 'run', label: 'Old tempo run',
      detail: '', source: 'completed_only', dayIdx: 2, completed: true,
    }]);
  });

  it('infers a gym type from a logged session that has an exercise queue but no type', () => {
    const completedForDay = [{ id: 'c1', workout: 'Push day', queue: [{ id: 'bench' }] }];
    const orphans = buildOrphanedCompletionSessions('2026-07-13', 0, [], completedForDay);
    expect(orphans[0].type).toBe('gym');
  });

  it('does not duplicate a completion already matched by an existing session', () => {
    const sessions = [{ id: 'gym-2026-07-13', source: 'gym', label: 'Push', completed: true }];
    const completedForDay = [{ id: 'c1', workout: 'Push day', queue: [{ id: 'bench' }] }];
    expect(buildOrphanedCompletionSessions('2026-07-13', 0, sessions, completedForDay)).toEqual([]);
  });
});

describe('dropPhantomPastEventPlanSessions', () => {
  const pastEventSession = { id: 'event-1', source: 'event_plan', label: 'New swim', completed: false };
  const completedGymSession = { id: 'gym-1', source: 'gym', label: 'Push', completed: true };

  it('leaves sessions alone on a day that is not in the past', () => {
    const sessions = [pastEventSession, completedGymSession];
    expect(dropPhantomPastEventPlanSessions(sessions, false)).toEqual(sessions);
  });

  it('leaves a past day alone when nothing on it is completed (cannot distinguish a real miss)', () => {
    const sessions = [pastEventSession];
    expect(dropPhantomPastEventPlanSessions(sessions, true)).toEqual(sessions);
  });

  it('drops a never-completed event-plan session on a past day that already has a completed session', () => {
    const sessions = [pastEventSession, completedGymSession];
    expect(dropPhantomPastEventPlanSessions(sessions, true)).toEqual([completedGymSession]);
  });

  it('keeps a completed event-plan session on a past day', () => {
    const completedEvent = { ...pastEventSession, completed: true };
    const sessions = [completedEvent, completedGymSession];
    expect(dropPhantomPastEventPlanSessions(sessions, true)).toEqual(sessions);
  });

  it('keeps non-event-plan, non-completed sessions on a past day (e.g. a missed activity)', () => {
    const missedActivity = { id: 'act-1', source: 'activity', label: 'Yoga', completed: false };
    const sessions = [missedActivity, completedGymSession];
    expect(dropPhantomPastEventPlanSessions(sessions, true)).toEqual(sessions);
  });
});
