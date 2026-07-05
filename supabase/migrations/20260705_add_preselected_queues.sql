-- Adds per-date pre-selected exercise queues for gym/conditioning sessions,
-- so a user can pick "what I'm doing" ahead of time from the Weekly Overview
-- day detail and have it seed the actual session queue when they start it.
-- Stored alongside the other one-off, date-keyed session data already on
-- training_plans (overrides/done), rather than a new table, since it's the
-- same "date -> stuff for that day" shape.

alter table public.training_plans
  add column if not exists preselected_queues jsonb not null default '{}'::jsonb;
