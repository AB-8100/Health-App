import { describe, it, expect } from 'vitest';
import {
  getTrainingDayIndices,
  isScheduleValidForSplit,
  toggleTrainingDay,
  reconcileScheduleWithSplitIds,
  getActivityDayIndices,
  getAllTrainingDayIndices,
  REST,
} from './scheduleReconciliation';

describe('getTrainingDayIndices', () => {
  it('returns the indices of non-rest slots', () => {
    const schedule = ['push', REST, 'pull', REST, 'legs', REST, REST];
    expect(getTrainingDayIndices(schedule)).toEqual([0, 2, 4]);
  });

  it('returns an empty array for an all-rest schedule', () => {
    expect(getTrainingDayIndices(Array(7).fill(REST))).toEqual([]);
  });

  it('defaults to an empty array when schedule is omitted', () => {
    expect(getTrainingDayIndices()).toEqual([]);
  });
});

describe('isScheduleValidForSplit', () => {
  const splitIds = ['push', 'pull', 'legs'];

  it('is true when every non-rest slot belongs to the split', () => {
    const schedule = ['push', REST, 'pull', REST, 'legs', REST, REST];
    expect(isScheduleValidForSplit(schedule, splitIds)).toBe(true);
  });

  it('is false when a slot holds an id outside the split', () => {
    const schedule = ['push', REST, 'upperA', REST, REST, REST, REST];
    expect(isScheduleValidForSplit(schedule, splitIds)).toBe(false);
  });

  it('is true for an all-rest schedule regardless of split', () => {
    expect(isScheduleValidForSplit(Array(7).fill(REST), splitIds)).toBe(true);
  });
});

describe('toggleTrainingDay', () => {
  const splitIds = ['push', 'pull', 'legs'];

  it('turns a rest day into a training day, assigned the next id in rotation', () => {
    const schedule = ['push', REST, 'pull', REST, REST, REST, REST];
    // 2 days already on (push, pull) -> next id in rotation is splitIds[2] = 'legs'
    const next = toggleTrainingDay(schedule, splitIds, 3);
    expect(next[3]).toBe('legs');
    // Existing assignments are untouched.
    expect(next[0]).toBe('push');
    expect(next[2]).toBe('pull');
  });

  it('wraps around the rotation once every split-day id has been used', () => {
    const schedule = ['push', 'pull', 'legs', REST, REST, REST, REST];
    // 3 days already on -> next id wraps back to splitIds[0] = 'push'
    const next = toggleTrainingDay(schedule, splitIds, 3);
    expect(next[3]).toBe('push');
  });

  it('turns an existing training day back into a rest day, leaving others untouched', () => {
    const schedule = ['push', 'pull', REST, REST, REST, REST, REST];
    const next = toggleTrainingDay(schedule, splitIds, 0);
    expect(next[0]).toBe(REST);
    expect(next[1]).toBe('pull');
  });

  it('does not mutate the input array', () => {
    const schedule = ['push', REST, REST, REST, REST, REST, REST];
    const next = toggleTrainingDay(schedule, splitIds, 1);
    expect(schedule[1]).toBe(REST);
    expect(next).not.toBe(schedule);
  });

  it('is a no-op when turning on a day with no split-day ids available (non-gym)', () => {
    const schedule = Array(7).fill(REST);
    const next = toggleTrainingDay(schedule, [], 2);
    expect(next[2]).toBe(REST);
  });
});

describe('reconcileScheduleWithSplitIds', () => {
  it('preserves which days are training days while remapping content to the new split', () => {
    const schedule = ['upperA', REST, 'lowerA', REST, 'upperB', REST, REST];
    const newIds = ['push', 'pull', 'legs'];
    const next = reconcileScheduleWithSplitIds(schedule, newIds);
    // Same days on (0, 2, 4), now holding valid ids from the new split, round-robin in weekday order.
    expect(getTrainingDayIndices(next)).toEqual([0, 2, 4]);
    expect(next[0]).toBe('push');
    expect(next[2]).toBe('pull');
    expect(next[4]).toBe('legs');
    expect(isScheduleValidForSplit(next, newIds)).toBe(true);
  });

  it('wraps round-robin when there are more training days than split-day ids', () => {
    const schedule = ['a', 'b', 'c', 'd', REST, REST, REST];
    const newIds = ['push', 'pull'];
    const next = reconcileScheduleWithSplitIds(schedule, newIds);
    expect(next).toEqual(['push', 'pull', 'push', 'pull', REST, REST, REST]);
  });

  it('returns an all-rest schedule when the new split has no day ids', () => {
    const schedule = ['a', REST, 'b', REST, REST, REST, REST];
    expect(reconcileScheduleWithSplitIds(schedule, [])).toEqual(Array(7).fill(REST));
  });
});

describe('getActivityDayIndices', () => {
  it('returns indices with at least one non-gym activity, ignoring empty/rest days', () => {
    const activities = { 0: [{ id: 'a' }], 1: [], 3: [{ id: 'b' }, { id: 'c' }] };
    expect(getActivityDayIndices(activities)).toEqual([0, 3]);
  });

  it('defaults to an empty array when activities is omitted', () => {
    expect(getActivityDayIndices()).toEqual([]);
  });

  it('returns an empty array when every day is empty', () => {
    expect(getActivityDayIndices({ 0: [], 2: [] })).toEqual([]);
  });
});

describe('getAllTrainingDayIndices', () => {
  it('unions gym-schedule days and activity days used by AboutScreen\'s Training days toggle', () => {
    expect(getAllTrainingDayIndices([0, 2, 4], [1, 4])).toEqual([0, 1, 2, 4]);
  });

  it('defaults to an empty array when both inputs are omitted', () => {
    expect(getAllTrainingDayIndices()).toEqual([]);
  });

  it('returns just the schedule days when there are no activity days', () => {
    expect(getAllTrainingDayIndices([1, 3], [])).toEqual([1, 3]);
  });
});
