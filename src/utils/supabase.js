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
    { data: profile },
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

  return {
    profile:            profile   ? dbToProfile(profile)   : undefined,
    userSettings:       settings  ? dbToSettings(settings) : undefined,
    plan:               plan      ? dbToPlan(plan)         : undefined,
    completedSessions:  (sessions ?? []).map(r => r.raw),
    foodLog,
    customFoods:        (customFoods ?? []).map(dbToCustomFood),
    activities:         activitiesMap,
    // App currently uses triathlon plan; keyed by training_type for future plans
    triathlonOverrides: trainingPlans?.find(p => p.training_type === 'triathlon')?.overrides ?? {},
    triathlonDone:      trainingPlans?.find(p => p.training_type === 'triathlon')?.done      ?? {},
    trainingPlans:      trainingPlans ?? [],
    savedAt:            profile?.updated_at ?? new Date().toISOString(),
  };
}

// ── Save — upsert each table from the snapshot ────────────────────────────────

export async function saveUserData(userId, snapshot) {
  const ops = [];

  if (snapshot.profile) {
    ops.push(supabase.from('profiles').upsert({ user_id: userId, ...profileToDb(snapshot.profile), updated_at: new Date().toISOString() }));
  }
  if (snapshot.userSettings) {
    ops.push(supabase.from('user_settings').upsert({ user_id: userId, ...settingsToDb(snapshot.userSettings), updated_at: new Date().toISOString() }));
  }
  if (snapshot.plan) {
    ops.push(supabase.from('gym_plans').upsert({ user_id: userId, ...planToDb(snapshot.plan), updated_at: new Date().toISOString() }));
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
  if (snapshot.triathlonOverrides !== undefined || snapshot.triathlonDone !== undefined) {
    ops.push(supabase.from('training_plans').upsert({
      user_id:       userId,
      training_type: 'triathlon',
      overrides:     snapshot.triathlonOverrides ?? {},
      done:          snapshot.triathlonDone      ?? {},
      updated_at:    new Date().toISOString(),
    }));
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
    id:               s.id,
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
      const { id, name, calories, protein, carbs, fat, sugar, meal, ...extra } = entry;
      rows.push({
        id:        id || undefined,
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
  const { id, name, calories, protein, carbs, fat, sugar, ...extra } = f;
  return { id: id || undefined, user_id: userId, name, calories: calories ?? null, protein_g: protein ?? null, carbs_g: carbs ?? null, fat_g: fat ?? null, sugar_g: sugar ?? null, extra: Object.keys(extra).length ? extra : {} };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns today's date string (YYYY-MM-DD) in the user's local timezone via Supabase
export async function getUserLocalDate(userId) {
  const { data, error } = await supabase.rpc('get_user_local_date', { p_user_id: userId });
  if (error) throw error;
  return data; // 'YYYY-MM-DD'
}
