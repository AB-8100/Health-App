import { describe, it, expect } from 'vitest';
import { getEventSessionsForDate } from './eventDaySessions';

describe('getEventSessionsForDate', () => {
  const planSessions = {
    '2026-07-05': [{ type: 'swim', label: 'Swim' }],
    '2026-07-06': [{ type: 'rest', label: 'Rest' }],
  };

  it('returns the uploaded plan\'s sessions for a date, minus rest entries', () => {
    expect(getEventSessionsForDate('2026-07-05', {}, planSessions, true))
      .toEqual([{ type: 'swim', label: 'Swim' }]);
  });

  it('filters out rest-type sessions from the uploaded plan', () => {
    expect(getEventSessionsForDate('2026-07-06', {}, planSessions, true)).toEqual([]);
  });

  it('returns nothing for a date with no uploaded-plan data', () => {
    expect(getEventSessionsForDate('2026-01-01', {}, planSessions, true)).toEqual([]);
  });

  it('returns nothing when there is no uploaded plan at all', () => {
    expect(getEventSessionsForDate('2026-07-05', {}, planSessions, false)).toEqual([]);
  });

  // Regression test: a manually-added one-off session (via Weekly Overview's
  // "+ Add session", stored in eventOverrides) is allowed even without an
  // uploaded plan — GymHubScreen's Session tab used to gate its entire
  // lookup behind `hasEventTraining`, so an override for today would show up
  // in the Weekly Overview but silently vanish from the Session tab.
  it('honours a manual override for a date even without an uploaded plan', () => {
    const override = [{ type: 'run', label: 'Easy run', source: 'manual' }];
    expect(getEventSessionsForDate('2026-07-05', { '2026-07-05': override }, {}, false))
      .toBe(override);
  });

  it('lets an override win even when the uploaded plan also has sessions for that date', () => {
    const override = [{ type: 'run', label: 'Easy run', source: 'manual' }];
    expect(getEventSessionsForDate('2026-07-05', { '2026-07-05': override }, planSessions, true))
      .toBe(override);
  });

  it('treats an explicit empty-array override as "nothing scheduled" (not "fall back to the plan")', () => {
    expect(getEventSessionsForDate('2026-07-05', { '2026-07-05': [] }, planSessions, true)).toEqual([]);
  });
});
