-- Core user tables for Forma: profiles, user_settings, gym_plans, gym_sessions,
-- food_log, custom_foods, day_activities, training_plans.
-- All tables use user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE.
-- Run this in the Supabase SQL editor before launching the app.

-- ── profiles ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,

  name          text,
  age           integer,
  sex           text,
  height_cm     numeric,
  weight_kg     numeric,
  bmi           numeric,
  goal          text,
  location      text,
  timezone      text        not null default 'UTC',
  has_gym       boolean     not null default true,
  has_event_training boolean not null default false,
  tracks_cycle  boolean     not null default false,
  split_days    integer     not null default 3,
  connected     jsonb       not null default '[]'::jsonb,
  extra         jsonb       not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id)
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = user_id);
create policy "Users can delete own profile"
  on public.profiles for delete using (auth.uid() = user_id);

-- ── user_settings ─────────────────────────────────────────────────────────────

create table if not exists public.user_settings (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,

  weight_unit          text        not null default 'kg',
  height_unit          text        not null default 'cm',
  daily_calories_base  integer,
  gym_day_boost        integer,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (user_id)
);

create index if not exists user_settings_user_id_idx on public.user_settings (user_id);

alter table public.user_settings enable row level security;

create policy "Users can read own settings"
  on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);
create policy "Users can delete own settings"
  on public.user_settings for delete using (auth.uid() = user_id);

-- ── gym_plans ─────────────────────────────────────────────────────────────────

create table if not exists public.gym_plans (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,

  split_days       integer     not null default 3,
  today_idx        integer     not null default 0,
  overrides        jsonb       not null default '{}'::jsonb,
  schedule_override jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id)
);

create index if not exists gym_plans_user_id_idx on public.gym_plans (user_id);

alter table public.gym_plans enable row level security;

create policy "Users can read own gym plan"
  on public.gym_plans for select using (auth.uid() = user_id);
create policy "Users can insert own gym plan"
  on public.gym_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own gym plan"
  on public.gym_plans for update using (auth.uid() = user_id);
create policy "Users can delete own gym plan"
  on public.gym_plans for delete using (auth.uid() = user_id);

-- ── gym_sessions ──────────────────────────────────────────────────────────────

create table if not exists public.gym_sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,

  session_date     timestamptz not null default now(),
  workout_name     text,
  elapsed_seconds  integer     not null default 0,
  exercises        jsonb       not null default '[]'::jsonb,
  raw              jsonb       not null default '{}'::jsonb,

  created_at       timestamptz not null default now()
);

create index if not exists gym_sessions_user_id_idx  on public.gym_sessions (user_id);
create index if not exists gym_sessions_date_idx     on public.gym_sessions (session_date desc);

alter table public.gym_sessions enable row level security;

create policy "Users can read own sessions"
  on public.gym_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on public.gym_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions"
  on public.gym_sessions for update using (auth.uid() = user_id);
create policy "Users can delete own sessions"
  on public.gym_sessions for delete using (auth.uid() = user_id);

-- ── food_log ──────────────────────────────────────────────────────────────────

create table if not exists public.food_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,

  log_date    date        not null,
  food_name   text        not null,
  calories    numeric,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  sugar_g     numeric,
  meal        text,
  extra       jsonb       not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index if not exists food_log_user_id_idx  on public.food_log (user_id);
create index if not exists food_log_date_idx     on public.food_log (log_date);

alter table public.food_log enable row level security;

create policy "Users can read own food log"
  on public.food_log for select using (auth.uid() = user_id);
create policy "Users can insert own food log"
  on public.food_log for insert with check (auth.uid() = user_id);
create policy "Users can update own food log"
  on public.food_log for update using (auth.uid() = user_id);
create policy "Users can delete own food log"
  on public.food_log for delete using (auth.uid() = user_id);

-- ── custom_foods ──────────────────────────────────────────────────────────────

create table if not exists public.custom_foods (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,

  name        text        not null,
  calories    numeric,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  sugar_g     numeric,
  extra       jsonb       not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index if not exists custom_foods_user_id_idx on public.custom_foods (user_id);

alter table public.custom_foods enable row level security;

create policy "Users can read own custom foods"
  on public.custom_foods for select using (auth.uid() = user_id);
create policy "Users can insert own custom foods"
  on public.custom_foods for insert with check (auth.uid() = user_id);
create policy "Users can update own custom foods"
  on public.custom_foods for update using (auth.uid() = user_id);
create policy "Users can delete own custom foods"
  on public.custom_foods for delete using (auth.uid() = user_id);

-- ── day_activities ────────────────────────────────────────────────────────────

create table if not exists public.day_activities (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,

  day_idx     integer     not null,
  items       jsonb       not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, day_idx)
);

create index if not exists day_activities_user_id_idx on public.day_activities (user_id);

alter table public.day_activities enable row level security;

create policy "Users can read own day activities"
  on public.day_activities for select using (auth.uid() = user_id);
create policy "Users can insert own day activities"
  on public.day_activities for insert with check (auth.uid() = user_id);
create policy "Users can update own day activities"
  on public.day_activities for update using (auth.uid() = user_id);
create policy "Users can delete own day activities"
  on public.day_activities for delete using (auth.uid() = user_id);

-- ── training_plans ────────────────────────────────────────────────────────────

create table if not exists public.training_plans (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,

  training_type  text        not null,
  overrides      jsonb       not null default '{}'::jsonb,
  done           jsonb       not null default '{}'::jsonb,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (user_id, training_type)
);

create index if not exists training_plans_user_id_idx on public.training_plans (user_id);

alter table public.training_plans enable row level security;

create policy "Users can read own training plans"
  on public.training_plans for select using (auth.uid() = user_id);
create policy "Users can insert own training plans"
  on public.training_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own training plans"
  on public.training_plans for update using (auth.uid() = user_id);
create policy "Users can delete own training plans"
  on public.training_plans for delete using (auth.uid() = user_id);

-- ── get_user_local_date RPC ───────────────────────────────────────────────────
-- Returns the current date string in the user's stored timezone.

create or replace function public.get_user_local_date(p_user_id uuid)
returns text
language sql
stable
security definer
as $$
  select to_char(
    now() at time zone coalesce(
      (select timezone from public.profiles where user_id = p_user_id),
      'UTC'
    ),
    'YYYY-MM-DD'
  );
$$;
