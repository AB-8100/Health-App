-- User intake table — stores the output of the DeepQuestionnaire screen (Stage 3, optional).
-- One row per user (upserted). All complex data stored as JSONB.
-- status: 'draft' when skipped or partially complete, 'complete' when submitted in full.

create table if not exists public.user_intake (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,

  -- 'draft' = skipped / partially complete | 'complete' = fully submitted
  status       text        not null default 'draft'
                           check (status in ('draft', 'complete')),

  -- Fitness baseline data (conditionally populated by goal type)
  run_baseline  jsonb not null default '{}'::jsonb,
  -- { time5k, time10k, timeHalfMarathon, timeMarathon, longestEffortKm, weeklyRunsCount }

  swim_baseline jsonb not null default '{}'::jsonb,
  -- { time400m, longestSessionM, weeklySessionsCount }

  bike_baseline jsonb not null default '{}'::jsonb,
  -- { ftpWatts, longestRideKm, weeklySessionsCount }

  -- Availability disruptions
  availability  jsonb not null default '{}'::jsonb,
  -- { holidays: [{label, from, to}], oneOffEvents: [{label, date}], standingCommitments: [{label, day, time}] }

  -- Health & injury
  injury        jsonb not null default '{}'::jsonb,
  -- { pastInjuries: [{area, description, resolved}], currentNiggles, healthConditions }

  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists user_intake_user_id_idx on public.user_intake (user_id);
create index if not exists user_intake_status_idx  on public.user_intake (status);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function public.set_user_intake_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_intake_updated_at on public.user_intake;

create trigger trg_user_intake_updated_at
  before update on public.user_intake
  for each row execute function public.set_user_intake_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.user_intake enable row level security;

create policy "Users can read own intake"
  on public.user_intake for select
  using (auth.uid() = user_id);

create policy "Users can insert own intake"
  on public.user_intake for insert
  with check (auth.uid() = user_id);

create policy "Users can update own intake"
  on public.user_intake for update
  using (auth.uid() = user_id);

create policy "Users can delete own intake"
  on public.user_intake for delete
  using (auth.uid() = user_id);
