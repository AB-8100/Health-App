-- Reference tables for Forma: ref_activities, ref_exercises, ref_muscle_groups
-- These are read-only seed tables (no user_id); seeded via scripts/seed-reference-data.js

create table if not exists public.ref_activities (
  id               bigint generated always as identity primary key,
  name             text        not null unique,
  category         text        not null,
  leg_load         text        not null default 'none',
  upper_load       text        not null default 'none',
  cardio_load      text        not null default 'none',
  core_load        text        not null default 'none',
  intensity_default text       not null default 'low',
  recovery_hours   int         not null default 0,
  notes            text        not null default ''
);

create table if not exists public.ref_exercises (
  id               bigint generated always as identity primary key,
  name             text        not null unique,
  category         text        not null,
  primary_muscles  jsonb       not null default '[]',
  secondary_muscles jsonb      not null default '[]',
  movement_pattern text        not null,
  equipment        text        not null,
  wger_id          int
);

create table if not exists public.ref_muscle_groups (
  id                    bigint generated always as identity primary key,
  name                  text    not null unique,
  body_region           text    not null,
  recovery_hours_default int    not null default 48
);

-- Enable RLS (read-only for all authenticated users; no writes from client)
alter table public.ref_activities    enable row level security;
alter table public.ref_exercises     enable row level security;
alter table public.ref_muscle_groups enable row level security;

create policy "Anyone can read ref_activities"
  on public.ref_activities for select using (true);

create policy "Anyone can read ref_exercises"
  on public.ref_exercises for select using (true);

create policy "Anyone can read ref_muscle_groups"
  on public.ref_muscle_groups for select using (true);
