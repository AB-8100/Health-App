-- User goals table — stores the output of the GoalsSetup onboarding screen (Stage 2).
-- One row per user (upserted on save). Full payload is stored as JSONB alongside
-- normalised scalar columns for easy querying.

create table if not exists public.user_goals (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,

  -- Ordered array of goal objects: [{ type, rank, config }]
  -- type: event_race | strength_programme | sport_activity | general_fitness | micro_target
  -- rank: Primary | Secondary | Supporting
  goals                  jsonb       not null default '[]'::jsonb,

  -- Derived from goals[0].type for fast filtering
  primary_goal_type      text,

  -- Weekly schedule
  training_days_per_week integer,
  unavailable_days       text[]      not null default '{}'::text[],

  -- Facility access
  gym_access             boolean     not null default false,
  pool_access            boolean     not null default false,
  pool_days              text[]      not null default '{}'::text[],

  -- Regular sports: [{ sport, day, intensity }]
  regular_sports         jsonb       not null default '[]'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists user_goals_user_id_idx       on public.user_goals (user_id);
create index if not exists user_goals_primary_goal_idx  on public.user_goals (primary_goal_type);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function public.set_user_goals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_goals_updated_at on public.user_goals;

create trigger trg_user_goals_updated_at
  before update on public.user_goals
  for each row execute function public.set_user_goals_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.user_goals enable row level security;

create policy "Users can read own goals"
  on public.user_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.user_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.user_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.user_goals for delete
  using (auth.uid() = user_id);
