import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Forma: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local\n' +
    'Copy .env.example to .env.local and fill in your Supabase project credentials.'
  );
}

// Fall back to placeholder values so the module loads; auth calls will fail gracefully
// and the app will fall through to the login screen via the 6-second timeout.
export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'placeholder-key'
);

// ── Load — fetch from all tables and reconstruct the app snapshot ─────────────

export async function loadUserData(userId) {
  const [
    { data: profile, error: profileErr },
    { data: settings },
    { data: plan },
    { data: sessions },
    { data: foodRows },
    { data: customFoods },
    { data: activities },
    { data: trainingPlans },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    supabase.from('gym_plans').select('*').eq('user_id', userId).single(),
    supabase.from('gym_sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
    supabase.from('food_log').select('*').eq('user_id', userId),
    supabase.from('custom_foods').select('*').eq('user_id', userId),
    supabase.from('day_activities').select('*').eq('user_id', userId),
    supabase.from('training_plans').select('*').eq('user_id', userId),
  ]);

  // .single() returns `data: null` both when the row genuinely doesn't exist
  // (error code PGRST116, "no rows") and for any other failure (RLS hiccup,
  // dropped connection, etc). Only the former means "this user has no
  // profile yet" — treating every other error the same way silently handed
  // back an empty profile (hasEventTraining, goal, everything) even though
  // the real row — and the user's uploaded event plan flag on it — was
  // sitting there untouched. Anything else propagates so the caller's
  // existing network-error fallback (bootstrapUser falls back to the local
  // cache) kicks in instead of quietly treating a real profile as missing.
  if (profileErr && profileErr.code !== 'PGRST116') throw profileErr;

  if (!profile && !settings && !plan) return null;

  // Reconstruct foodLog: { 'YYYY-MM-DD': { entries: [...] } }
  const foodLog = {};
  for (const row of foodRows ?? []) {
    if (!foodLog[row.log_date]) foodLog[row.log_date] = { entries: [] };
    foodLog[row.log_date].entries.push({
      id:       row.id,
      name:     row.food_name,
      calories: row.calories,
      protein:  row.protein_g,
      carbs:    row.carbs_g,
      fat:      row.fat_g,
      sugar:    row.sugar_g ?? null,
      meal:     row.meal ?? null,
      ...(row.extra ?? {}),
    });
  }

  // Reconstruct activities: { [dayIdx]: [...] }
  const activitiesMap = {};
  for (const row of activities ?? []) {
    activitiesMap[row.day_idx] = row.items;
  }

  // bootstrapUser (App.jsx) trusts this snapshot's `savedAt` over the local
  // cache's whenever it's >= the cache's own timestamp — so it has to reflect
  // the freshness of *every* table below, not just one. saveUserData's writes
  // are independent, unawaited-together requests (Promise.all over several
  // separate upserts, no transaction), and a save always re-upserts every
  // table regardless of what actually changed — so in the healthy case their
  // `updated_at` values all land within the same instant. If one of those
  // requests is dropped or fails (e.g. the tab backgrounds mid-save — see
  // storage.js's flushPendingLocalSave comment on that exact window) while
  // the others succeed, that table's `updated_at` falls behind the rest.
  // Using only `profiles.updated_at` missed that: a completely unrelated
  // profile save could bump it to "now" while `training_plans.overrides` (a
  // moved Weekly Overview session) or `gym_plans.schedule_override` was still
  // sitting on stale data, so a fresher-looking remote snapshot would win the
  // reconciliation and stomp a local cache that actually had the correct,
  // fully-saved state — surfacing as a moved session reverting to its
  // original day after the app was backgrounded and reloaded. Taking the
  // *oldest* timestamp among the tables that matter for scheduling makes the
  // reported freshness a conservative lower bound instead: any one lagging
  // table drags it down, so the local cache — written as a single atomic
  // localStorage snapshot — correctly wins over an incompletely-saved remote.
  const eventRow = trainingPlans?.find(p => p.training_type === 'event');
  const tableTimestamps = [
    profile?.updated_at,
    settings?.updated_at,
    plan?.updated_at,
    eventRow?.updated_at,
    ...(activities ?? []).map(r => r.updated_at),
  ].filter(Boolean).map(t => new Date(t).getTime());

  return {
    profile:            profile   ? dbToProfile(profile)   : undefined,
    userSettings:       settings  ? dbToSettings(settings) : undefined,
    plan:               plan      ? dbToPlan(plan)         : undefined,
    completedSessions:  (sessions ?? []).map(r => r.raw),
    foodLog,
    customFoods:        (customFoods ?? []).map(dbToCustomFood),
    activities:         activitiesMap,
    eventOverrides:    eventRow?.overrides ?? {},
    planSessionsDone:  eventRow?.done      ?? {},
    preselectedQueues: eventRow?.preselected_queues ?? {},
    sequencingDecisions: eventRow?.sequencing_decisions ?? {},
    eventPlan: eventRow
      ? { meta: eventRow.meta ?? {}, phases: eventRow.phases ?? [], sessions: eventRow.sessions ?? {} }
      : undefined,
    trainingPlans:      trainingPlans ?? [],
    savedAt: tableTimestamps.length
      ? new Date(Math.min(...tableTimestamps)).toISOString()
      : new Date().toISOString(),
  };
}

// ── Save — upsert each table from the snapshot ────────────────────────────────

export async function saveUserData(userId, snapshot) {
  const ops = [];

  if (snapshot.profile) {
    ops.push(supabase.from('profiles').upsert({ user_id: userId, ...profileToDb(snapshot.profile), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  }
  if (snapshot.userSettings) {
    ops.push(supabase.from('user_settings').upsert({ user_id: userId, ...settingsToDb(snapshot.userSettings), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  }
  if (snapshot.plan) {
    ops.push(supabase.from('gym_plans').upsert({ user_id: userId, ...planToDb(snapshot.plan), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  }
  if (snapshot.completedSessions) {
    // Replace all sessions for this user
    ops.push(
      supabase.from('gym_sessions').delete().eq('user_id', userId).then(() =>
        snapshot.completedSessions.length
          ? supabase.from('gym_sessions').insert(snapshot.completedSessions.map(s => sessionToDb(userId, s)))
          : Promise.resolve()
      )
    );
  }
  if (snapshot.foodLog) {
    // Replace all food entries for this user
    const entries = foodLogToRows(userId, snapshot.foodLog);
    ops.push(
      supabase.from('food_log').delete().eq('user_id', userId).then(() =>
        entries.length
          ? supabase.from('food_log').insert(entries)
          : Promise.resolve()
      )
    );
  }
  if (snapshot.customFoods) {
    ops.push(
      supabase.from('custom_foods').delete().eq('user_id', userId).then(() =>
        snapshot.customFoods.length
          ? supabase.from('custom_foods').insert(snapshot.customFoods.map(f => customFoodToDb(userId, f)))
          : Promise.resolve()
      )
    );
  }
  if (snapshot.activities) {
    const rows = Object.entries(snapshot.activities).map(([dayIdx, items]) => ({
      user_id: userId, day_idx: Number(dayIdx), items,
    }));
    ops.push(
      supabase.from('day_activities').delete().eq('user_id', userId).then(() =>
        rows.length ? supabase.from('day_activities').insert(rows) : Promise.resolve()
      )
    );
  }
  if (snapshot.eventOverrides !== undefined || snapshot.planSessionsDone !== undefined || snapshot.eventPlan !== undefined || snapshot.preselectedQueues !== undefined || snapshot.sequencingDecisions !== undefined) {
    ops.push(supabase.from('training_plans').upsert({
      user_id:              userId,
      training_type:        'event',
      overrides:            snapshot.eventOverrides    ?? {},
      done:                 snapshot.planSessionsDone  ?? {},
      meta:                 snapshot.eventPlan?.meta,
      phases:               snapshot.eventPlan?.phases,
      sessions:             snapshot.eventPlan?.sessions,
      preselected_queues:   snapshot.preselectedQueues  ?? {},
      sequencing_decisions: snapshot.sequencingDecisions ?? {},
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'user_id,training_type' }));
  }

  const results = await Promise.all(ops);
  const failed = results.find(r => r?.error);
  if (failed?.error) throw failed.error;
}

// ── Field mappers ─────────────────────────────────────────────────────────────

function dbToProfile(r) {
  return {
    name: r.name, age: r.age, sex: r.sex,
    height: r.height_cm, weight: r.weight_kg,
    bmi: r.bmi,
    location: r.location, timezone: r.timezone ?? 'UTC',
    goal: r.goal, hasGym: r.has_gym,
    hasEventTraining: r.has_event_training,
    tracksCycle: r.tracks_cycle, splitDays: r.split_days,
    connected: r.connected ?? [],
    ...(r.extra ?? {}),
  };
}
function profileToDb(p) {
  const { name, age, sex, height, weight, goal, hasGym, hasEventTraining, tracksCycle, splitDays, connected, location, timezone, ...extra } = p;
  const bmi = (height && weight) ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null;
  return {
    name, age, sex, height_cm: height, weight_kg: weight, bmi,
    location: location ?? null, timezone: timezone ?? 'UTC',
    goal, has_gym: hasGym ?? true, has_event_training: hasEventTraining ?? false,
    tracks_cycle: tracksCycle ?? false, split_days: splitDays ?? 3,
    connected: connected ?? [], extra,
  };
}

function dbToSettings(r) {
  return { dailyCaloriesBase: r.daily_calories_base, gymDayBoost: r.gym_day_boost, weightUnit: r.weight_unit, heightUnit: r.height_unit };
}
function settingsToDb(s) {
  return { daily_calories_base: s.dailyCaloriesBase, gym_day_boost: s.gymDayBoost, weight_unit: s.weightUnit, height_unit: s.heightUnit };
}

function dbToPlan(r) {
  return { splitDays: r.split_days, todayIdx: r.today_idx, overrides: r.overrides ?? {}, scheduleOverride: r.schedule_override ?? null };
}
function planToDb(p) {
  return { split_days: p.splitDays, today_idx: p.todayIdx, overrides: p.overrides ?? {}, schedule_override: p.scheduleOverride ?? null };
}

function sessionToDb(userId, s) {
  return {
    // `s.id` is a client-generated Date.now().toString(), never a real uuid —
    // sending it as the `id` column (uuid primary key) makes every insert
    // fail after the sessions-for-this-user delete has already gone through,
    // silently emptying gym_sessions on the next save. Omit it so Postgres's
    // gen_random_uuid() default applies instead, matching how food_log/
    // custom_foods already do this (`id: id || undefined`). The app never
    // reads this DB-assigned id back — completedSessions is reconstructed
    // from `raw`, which still carries the original client-side id.
    user_id:          userId,
    session_date:     s.date || s.endedAt ? new Date(s.date || s.endedAt).toISOString() : new Date().toISOString(),
    workout_name:     s.workout || null,
    elapsed_seconds:  s.elapsed || 0,
    exercises:        s.queue || [],
    raw:              s,
  };
}

function foodLogToRows(userId, foodLog) {
  const rows = [];
  for (const [date, day] of Object.entries(foodLog)) {
    for (const entry of day.entries ?? []) {
      // A freshly-logged entry's `id` is a client-generated
      // Date.now().toString(), never a real uuid — `id || undefined` only
      // helps once an id is falsy, which it never is here. Since food_log
      // rows are always fully replaced (delete-then-insert), there's no
      // need to preserve any id across saves: always omit it and let
      // Postgres's gen_random_uuid() default apply, the same fix as
      // gym_sessions. The real DB id round-trips back via `dbToCustomFood`/
      // the food_log reconstruction in loadUserData on the next load.
      const { id, name, calories, protein, carbs, fat, sugar, meal, ...extra } = entry;
      rows.push({
        user_id:   userId,
        log_date:  date,
        food_name: name,
        calories:  calories ?? null,
        protein_g: protein  ?? null,
        carbs_g:   carbs    ?? null,
        fat_g:     fat      ?? null,
        sugar_g:   sugar    ?? null,
        meal:      meal     ?? null,
        extra:     Object.keys(extra).length ? extra : {},
      });
    }
  }
  return rows;
}

function dbToCustomFood(r) {
  return { id: r.id, name: r.name, calories: r.calories, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g, sugar: r.sugar_g, ...(r.extra ?? {}) };
}
function customFoodToDb(userId, f) {
  // Same fix as gym_sessions/food_log: a newly-saved custom food's `id` is a
  // client-generated `custom_${Date.now()}`, never a real uuid, and this
  // table is fully replaced on every save (delete-then-insert), so omit it
  // and let Postgres's gen_random_uuid() default apply.
  const { id, name, calories, protein, carbs, fat, sugar, ...extra } = f;
  return { user_id: userId, name, calories: calories ?? null, protein_g: protein ?? null, carbs_g: carbs ?? null, fat_g: fat ?? null, sugar_g: sugar ?? null, extra: Object.keys(extra).length ? extra : {} };
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function saveUserGoals(userId, goalsPayload) {
  const { error } = await supabase.from('user_goals').upsert({
    user_id:                userId,
    goals:                  goalsPayload.goals ?? [],
    training_days_per_week: goalsPayload.trainingDaysPerWeek ?? null,
    unavailable_days:       goalsPayload.unavailableDays ?? [],
    gym_access:             goalsPayload.gymAccess ?? false,
    pool_access:            goalsPayload.poolAccess ?? false,
    pool_days:              goalsPayload.poolDays ?? [],
    regular_sports:         goalsPayload.regularSports ?? [],
    primary_goal_type:      goalsPayload.goals?.[0]?.type ?? null,
    updated_at:             new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ── Intake (deep questionnaire) ───────────────────────────────────────────────

export async function saveUserIntake(userId, intakePayload) {
  const { error } = await supabase.from('user_intake').upsert({
    user_id:              userId,
    status:               intakePayload.status ?? 'draft',
    run_baseline:         intakePayload.runBaseline  ?? {},
    swim_baseline:        intakePayload.swimBaseline ?? {},
    bike_baseline:        intakePayload.bikeBaseline ?? {},
    discipline_ranking:   intakePayload.disciplineRanking ?? [],
    availability:         intakePayload.availability ?? {},
    preferences:          intakePayload.preferences ?? {},
    mindset:              intakePayload.mindset ?? {},
    injury:               intakePayload.injury ?? {},
    completed_at:         intakePayload.completedAt ?? null,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function loadUserIntake(userId) {
  const { data, error } = await supabase
    .from('user_intake')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    status:             data.status,
    completedAt:        data.completed_at,
    runBaseline:        data.run_baseline  ?? {},
    swimBaseline:       data.swim_baseline ?? {},
    bikeBaseline:       data.bike_baseline ?? {},
    disciplineRanking:  data.discipline_ranking ?? [],
    availability:       data.availability  ?? {},
    preferences:        data.preferences   ?? {},
    mindset:            data.mindset       ?? {},
    injury:             data.injury        ?? {},
  };
}

export async function loadUserGoals(userId) {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return {
    goals:                  data.goals ?? [],
    trainingDaysPerWeek:    data.training_days_per_week ?? null,
    unavailableDays:        data.unavailable_days ?? [],
    gymAccess:              data.gym_access ?? false,
    poolAccess:             data.pool_access ?? false,
    poolDays:               data.pool_days ?? [],
    regularSports:          data.regular_sports ?? [],
  };
}

// ── Feedback ──────────────────────────────────────────────────────────────────
// Insert-only — see supabase/migrations/20260811_create_user_feedback.sql and
// features/specs/feedback-entry-point.md. Not wrapped in try/catch here (unlike
// scheduleSave's other writes) so the caller can await it and show an inline
// error rather than silently losing what the user typed — see that spec's
// "Edge cases handled" section.
export async function submitFeedback(userId, message) {
  const { error } = await supabase.from('user_feedback').insert({ user_id: userId, message });
  if (error) throw error;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns today's date string (YYYY-MM-DD) in the user's local timezone via Supabase
export async function getUserLocalDate(userId) {
  const { data, error } = await supabase.rpc('get_user_local_date', { p_user_id: userId });
  if (error) throw error;
  return data; // 'YYYY-MM-DD'
}
