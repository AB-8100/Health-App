-- Adds storage for the actual event training plan content (as parsed from a
-- user-uploaded spreadsheet), alongside the existing per-day overrides/done
-- state on training_plans.

alter table public.training_plans
  add column if not exists meta     jsonb not null default '{}'::jsonb,
  add column if not exists phases   jsonb not null default '[]'::jsonb,
  add column if not exists sessions jsonb not null default '{}'::jsonb;
