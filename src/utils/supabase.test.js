import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks the Supabase JS client so these tests exercise the actual
// save/load mapping code in supabase.js — which fields get written to which
// column, and how a stored row gets turned back into app state — without
// needing a live database. Verifies the contract this repo's own migration
// (supabase/migrations/20260702_add_training_plan_data.sql) depends on: the
// `training_plans` row carries `meta`/`phases`/`sessions` alongside the
// older `overrides`/`done` columns.
const fromMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}));

const { saveUserData, loadUserData } = await import('./supabase');

function makeBuilder(resolvedValue = { data: null, error: null }) {
  const calls = [];
  const builder = {
    select: (...a) => { calls.push(['select', a]); return builder; },
    eq: (...a) => { calls.push(['eq', a]); return builder; },
    single: (...a) => { calls.push(['single', a]); return builder; },
    order: (...a) => { calls.push(['order', a]); return builder; },
    upsert: (...a) => { calls.push(['upsert', a]); return builder; },
    delete: (...a) => { calls.push(['delete', a]); return builder; },
    insert: (...a) => { calls.push(['insert', a]); return builder; },
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
    calls,
  };
  return builder;
}

beforeEach(() => fromMock.mockReset());

describe('saveUserData — training_plans upsert', () => {
  it('writes meta/phases/sessions alongside overrides/done, keyed on user_id+training_type', async () => {
    const builder = makeBuilder({ data: null, error: null });
    const tablesUsed = [];
    fromMock.mockImplementation((table) => { tablesUsed.push(table); return builder; });

    const eventPlan = {
      meta: { startDate: '2026-01-05', totalWeeks: 18 },
      phases: [{ label: 'Foundation', weeks: [1, 4] }],
      sessions: { '2026-01-05': [{ type: 'swim', label: 'Swim' }] },
    };
    await saveUserData('user-1', {
      eventOverrides: { '2026-01-06': [] },
      planSessionsDone: { '2026-01-05': true },
      eventPlan,
    });

    expect(tablesUsed).toEqual(['training_plans']);
    const upsertCall = builder.calls.find(([name]) => name === 'upsert');
    expect(upsertCall).toBeTruthy();
    const [, [payload, opts]] = upsertCall;
    expect(opts).toEqual({ onConflict: 'user_id,training_type' });
    expect(payload).toMatchObject({
      user_id: 'user-1',
      training_type: 'event',
      overrides: { '2026-01-06': [] },
      done: { '2026-01-05': true },
      meta: eventPlan.meta,
      phases: eventPlan.phases,
      sessions: eventPlan.sessions,
    });
  });

  it('surfaces (does not swallow) an upsert error, e.g. from a not-yet-migrated column', async () => {
    // If `meta`/`phases`/`sessions` don't exist on the live table (the
    // migration was never run against it), Supabase returns an error object
    // rather than throwing — saveUserData is expected to turn that into a
    // thrown error so callers' `.catch()` actually fires instead of the
    // failure going unnoticed.
    const builder = makeBuilder({ data: null, error: { message: 'column "meta" of relation "training_plans" does not exist' } });
    fromMock.mockImplementation(() => builder);

    await expect(saveUserData('user-1', { eventPlan: { meta: {}, phases: [], sessions: {} } }))
      .rejects.toMatchObject({ message: expect.stringContaining('does not exist') });
  });
});

describe('loadUserData — eventPlan reconstruction', () => {
  const baseResponses = {
    profiles: { data: { user_id: 'user-1', name: 'Alex', updated_at: '2026-07-05T00:00:00Z' }, error: null },
    user_settings: { data: null, error: null },
    gym_plans: { data: null, error: null },
    gym_sessions: { data: [], error: null },
    food_log: { data: [], error: null },
    custom_foods: { data: [], error: null },
    day_activities: { data: [], error: null },
  };

  it('reconstructs eventPlan/eventOverrides/planSessionsDone from the stored training_plans row', async () => {
    const responses = {
      ...baseResponses,
      training_plans: {
        data: [{
          training_type: 'event',
          overrides: { '2026-01-06': [] },
          done: { '2026-01-05': true },
          meta: { startDate: '2026-01-05', totalWeeks: 18 },
          phases: [{ label: 'Foundation', weeks: [1, 4] }],
          sessions: { '2026-01-05': [{ type: 'swim', label: 'Swim' }] },
        }],
        error: null,
      },
    };
    fromMock.mockImplementation((table) => makeBuilder(responses[table]));

    const result = await loadUserData('user-1');
    expect(result.eventPlan).toEqual({
      meta: { startDate: '2026-01-05', totalWeeks: 18 },
      phases: [{ label: 'Foundation', weeks: [1, 4] }],
      sessions: { '2026-01-05': [{ type: 'swim', label: 'Swim' }] },
    });
    expect(result.eventOverrides).toEqual({ '2026-01-06': [] });
    expect(result.planSessionsDone).toEqual({ '2026-01-05': true });
  });

  it('returns an empty (not undefined) eventPlan when no training_plans row exists yet', async () => {
    const responses = { ...baseResponses, training_plans: { data: [], error: null } };
    fromMock.mockImplementation((table) => makeBuilder(responses[table]));

    const result = await loadUserData('user-1');
    expect(result.eventPlan).toBeUndefined();
    expect(result.eventOverrides).toEqual({});
    expect(result.planSessionsDone).toEqual({});
  });

  it('falls back to {}/[]/{}"} when the row exists but meta/phases/sessions are null', async () => {
    // A row saved before the 20260702 migration backfilled these columns
    // would have real column defaults on INSERT, but a row updated by an
    // upsert that only set `overrides`/`done` (e.g. an old client version)
    // could still have literal nulls here — make sure that doesn't crash
    // downstream code that expects an object/array shape.
    const responses = {
      ...baseResponses,
      training_plans: {
        data: [{ training_type: 'event', overrides: {}, done: {}, meta: null, phases: null, sessions: null }],
        error: null,
      },
    };
    fromMock.mockImplementation((table) => makeBuilder(responses[table]));

    const result = await loadUserData('user-1');
    expect(result.eventPlan).toEqual({ meta: {}, phases: [], sessions: {} });
  });
});
