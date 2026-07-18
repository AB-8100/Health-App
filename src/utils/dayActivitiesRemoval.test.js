import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unlike the per-call mock in supabase.test.js (which only inspects request
// shape), this fake keeps state across calls so it can simulate a real
// Postgres round-trip: save, then a fresh load in a separate "page load"
// sees exactly what was saved. That's what actually proves a removal (via
// App.jsx's removeScheduledSession `source === 'activity'` branch, and
// GymPlanScreens.jsx's DayActivitiesScreen `removeItem`) survives a refresh
// instead of only updating in-memory React state.
let dayActivitiesRows = [];

const fromMock = vi.fn((table) => {
  if (table !== 'day_activities') {
    // profiles must resolve to a row or loadUserData short-circuits to null
    // (its "no data at all → new user" check).
    const stubData = table === 'profiles' ? { name: 'Test', has_gym: true } : null;
    const builder = {
      select: () => builder, eq: () => builder, single: () => builder, order: () => builder,
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => builder, insert: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => Promise.resolve({ data: stubData, error: null }).then(resolve),
    };
    return builder;
  }
  const builder = {
    select: () => builder,
    eq: (col, val) => { builder._userId = val; return builder; },
    delete: () => { builder._isDelete = true; return builder; },
    insert: (rows) => { dayActivitiesRows.push(...rows); return Promise.resolve({ data: null, error: null }); },
    then: (resolve) => {
      if (builder._isDelete) {
        dayActivitiesRows = dayActivitiesRows.filter(r => r.user_id !== builder._userId);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      const data = dayActivitiesRows.filter(r => r.user_id === builder._userId);
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return builder;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock, auth: {} }),
}));

const { saveUserData, loadUserData } = await import('./supabase');

beforeEach(() => { dayActivitiesRows = []; });

describe('day_activities removal persistence', () => {
  it('a removed activity does not reappear after a simulated reload', async () => {
    const userId = 'user-1';
    const act = { id: 'gen-0', type: 'run', label: 'Run', duration: 45, source: 'generated' };

    await saveUserData(userId, { activities: { 0: [act] } });
    let loaded = await loadUserData(userId);
    expect(loaded.activities).toEqual({ 0: [act] });

    // Mirrors removeScheduledSession's `source === 'activity'` branch.
    const activities = { 0: [act] };
    const next = { ...activities, 0: activities[0].filter(a => a !== act) };
    await saveUserData(userId, { activities: next });

    loaded = await loadUserData(userId);
    expect(loaded.activities[0] ?? []).toEqual([]);
  });
});
