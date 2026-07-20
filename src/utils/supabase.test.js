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
      sequencingDecisions: { 'same_day:a|b': { choice: 'keep', decidedAt: '2026-01-05T00:00:00Z' } },
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
      sequencing_decisions: { 'same_day:a|b': { choice: 'keep', decidedAt: '2026-01-05T00:00:00Z' } },
    });
  });

  it('writes sequencing_decisions on its own, without any other training_plans field present', async () => {
    // onUpdateSequencingDecisions only ever changes this one field — confirm
    // the upsert still fires (buildSnapshot in App.jsx always populates the
    // other training_plans fields from closure state, but this pins the
    // contract at the supabase.js layer too).
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    await saveUserData('user-1', { sequencingDecisions: { 'next_day:c|d': { choice: 'move', decidedAt: '2026-01-06T00:00:00Z' } } });

    const upsertCall = builder.calls.find(([name]) => name === 'upsert');
    expect(upsertCall).toBeTruthy();
    const [, [payload]] = upsertCall;
    expect(payload.sequencing_decisions).toEqual({ 'next_day:c|d': { choice: 'move', decidedAt: '2026-01-06T00:00:00Z' } });
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

  it('reconstructs eventPlan/eventOverrides/planSessionsDone/sequencingDecisions from the stored training_plans row', async () => {
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
          sequencing_decisions: { 'same_day:a|b': { choice: 'keep', decidedAt: '2026-01-05T00:00:00Z' } },
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
    expect(result.sequencingDecisions).toEqual({ 'same_day:a|b': { choice: 'keep', decidedAt: '2026-01-05T00:00:00Z' } });
  });

  it('returns an empty (not undefined) eventPlan when no training_plans row exists yet', async () => {
    const responses = { ...baseResponses, training_plans: { data: [], error: null } };
    fromMock.mockImplementation((table) => makeBuilder(responses[table]));

    const result = await loadUserData('user-1');
    expect(result.eventPlan).toBeUndefined();
    expect(result.eventOverrides).toEqual({});
    expect(result.planSessionsDone).toEqual({});
    expect(result.sequencingDecisions).toEqual({});
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

describe('saveUserData — gym_sessions insert payload', () => {
  // Regression test: a completed session's client-side `id` is
  // Date.now().toString() (e.g. "1751721441186"), never a real uuid. The
  // gym_sessions table's `id` column is `uuid primary key`, and sessions are
  // saved via delete-then-insert, so sending that id as-is makes every
  // insert fail *after* the user's prior sessions have already been
  // deleted — silently emptying gym_sessions on every save. The fix omits
  // `id` so Postgres's gen_random_uuid() default applies, the same way
  // food_log/custom_foods rows already do for unsaved client-side ids.
  it('never sends the client-generated session id as the row id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    const completedSessions = [
      { id: Date.now().toString(), date: new Date().toISOString(), workout: 'Swim', elapsed: 600, distance: 400, queue: null },
    ];
    await saveUserData('user-1', { completedSessions });

    const insertCall = builder.calls.find(([name]) => name === 'insert');
    expect(insertCall).toBeTruthy();
    const [, [rows]] = insertCall;
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('id');
    // The original client-side id must still round-trip via `raw` so the
    // app can keep matching/editing/deleting by it after a reload.
    expect(rows[0].raw.id).toBe(completedSessions[0].id);
  });
});

describe('saveUserData — food_log/custom_foods insert payload', () => {
  // Same class of bug as gym_sessions: a freshly-logged food entry's `id` is
  // a client-generated Date.now().toString(), never a real uuid, and both
  // tables' `id` columns are `uuid primary key`. Both are also saved via
  // delete-then-insert, so sending the fake id makes the insert fail after
  // the user's prior rows have already been deleted.
  it('never sends the client-generated id for a food_log entry', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    const foodLog = {
      '2026-07-05': { entries: [
        { id: Date.now().toString(), name: 'Toast', meal: 'breakfast', calories: 200, protein: 6, carbs: 30, fat: 4 },
      ] },
    };
    await saveUserData('user-1', { foodLog });

    const insertCall = builder.calls.find(([name]) => name === 'insert');
    expect(insertCall).toBeTruthy();
    const [, [rows]] = insertCall;
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('id');
    expect(rows[0]).toMatchObject({ food_name: 'Toast', user_id: 'user-1' });
  });

  it('never sends the client-generated id for a custom food', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockImplementation(() => builder);

    const customFoods = [
      { id: `custom_${Date.now()}`, name: 'Protein shake', calories: 180, protein: 30, carbs: 8, fat: 2 },
    ];
    await saveUserData('user-1', { customFoods });

    const insertCall = builder.calls.find(([name]) => name === 'insert');
    expect(insertCall).toBeTruthy();
    const [, [rows]] = insertCall;
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('id');
    expect(rows[0]).toMatchObject({ name: 'Protein shake', user_id: 'user-1' });
  });
});
