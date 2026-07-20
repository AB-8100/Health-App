-- Persists the user's reduce/move/keep choice for each Session Sequencing
-- Advisor conflict, keyed by that decision's stable key
-- (utils/sessionLoadEstimate.js's buildDecisionKey), so the same conflict
-- shows the user's earlier choice instead of the full prompt again -- on
-- this device or any other -- rather than resetting on every render.
-- Stored alongside the other one-off, keyed data already on training_plans
-- (overrides/done/preselected_queues), rather than a new table, since it's
-- the same "map of key -> stuff" shape.

alter table public.training_plans
  add column if not exists sequencing_decisions jsonb not null default '{}'::jsonb;
