-- Reference tables for Forma: activities, exercises, muscle_groups
-- These are read-only seed tables (no user_id); seeded via scripts/seed-reference-data.js

create table if not exists public.activities (
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

create table if not exists public.exercises (
  id               bigint generated always as identity primary key,
  name             text        not null unique,
  category         text        not null,
  primary_muscles  jsonb       not null default '[]',
  secondary_muscles jsonb      not null default '[]',
  movement_pattern text        not null,
  equipment        text        not null,
  wger_id          int
);

create table if not exists public.muscle_groups (
  id                    bigint generated always as identity primary key,
  name                  text    not null unique,
  body_region           text    not null,
  recovery_hours_default int    not null default 48
);

-- Enable RLS (read-only for all authenticated users; no writes from client)
alter table public.activities    enable row level security;
alter table public.exercises     enable row level security;
alter table public.muscle_groups enable row level security;

create policy "Anyone can read activities"
  on public.activities for select using (true);

create policy "Anyone can read exercises"
  on public.exercises for select using (true);

create policy "Anyone can read muscle_groups"
  on public.muscle_groups for select using (true);
