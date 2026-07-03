import { describe, it, expect } from 'vitest';
import { getTodaysCompletedSessions, findCompletedForActivity, getUnmatchedCompletions } from './sessionCompletion';

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
