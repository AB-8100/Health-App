import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks the Supabase client so checkWeek's ref_activities fetch (the only
// remaining Supabase dependency in this module) doesn't need a live
// connection — mirrors the mocking pattern in utils/supabase.test.js.
const fromMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}));

const { checkWeek, findRef } = await import('./overtrain');

const REF_ROWS = [
  { name: 'Football', category: 'team_sport', leg_load: 'high', upper_load: 'low', cardio_load: 'high', core_load: 'low', recovery_hours: 48, intensity_default: 'high' },
  { name: 'Running', category: 'endurance', leg_load: 'high', upper_load: 'none', cardio_load: 'high', core_load: 'low', recovery_hours: 24, intensity_default: 'medium' },
];

function makeBuilder(resolvedValue) {
  const builder = {
    select: () => builder,
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  fromMock.mockReset();
  fromMock.mockImplementation(() => makeBuilder({ data: REF_ROWS, error: null }));
});

// Builds a buildWeekData()-shaped week: one session per day.
function weekWith(daySessions) {
  const dayIdxByDate = {};
  return daySessions.map(({ date, dayIdx, sessions }) => {
    dayIdxByDate[date] = dayIdx;
    return { dk: date, dayIdx, sessions };
  });
}

describe('checkWeek — regression: fires from a direct call, not just after a drag', () => {
  it('flags an already-in-place conflict when called on a static week (no drag involved)', async () => {
    const weekData = weekWith([
      { date: '2026-08-05', dayIdx: 2, sessions: [{ id: 'a', type: 'team_sport', label: 'Football' }] },
      { date: '2026-08-06', dayIdx: 3, sessions: [{ id: 'b', type: 'run', label: 'Easy run' }] },
    ]);
    const completedSessions = [
      { workout: 'Football', rpe: 9, date: '2026-07-01T00:00:00Z' },
      { workout: 'Football', rpe: 8, date: '2026-07-08T00:00:00Z' },
    ];

    const decisions = await checkWeek(weekData, completedSessions);
    expect(decisions.some(d => d.check_type === 'next_day')).toBe(true);
  });

  it('produces zero conflicts for a normal, sensible week', async () => {
    const weekData = weekWith([
      { date: '2026-08-03', dayIdx: 0, sessions: [{ id: 'a', type: 'gym', label: 'Push day' }] },
      { date: '2026-08-04', dayIdx: 1, sessions: [{ id: 'b', type: 'gym', label: 'Pull day' }] },
      { date: '2026-08-05', dayIdx: 2, sessions: [{ id: 'c', type: 'run', label: 'Easy run' }] },
      { date: '2026-08-06', dayIdx: 3, sessions: [] },
      { date: '2026-08-07', dayIdx: 4, sessions: [{ id: 'd', type: 'gym', label: 'Legs day' }] },
      { date: '2026-08-08', dayIdx: 5, sessions: [] },
      { date: '2026-08-09', dayIdx: 6, sessions: [] },
    ]);
    const decisions = await checkWeek(weekData, []);
    expect(decisions).toEqual([]);
  });
});

describe('findRef still exported from overtrain.js', () => {
  it('matches by exact name', () => {
    expect(findRef('Football', REF_ROWS)?.name).toBe('Football');
  });
});
