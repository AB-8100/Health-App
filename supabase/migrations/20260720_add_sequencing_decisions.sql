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

-- Force PostgREST to pick up the new column immediately. Without this,
-- a manual run via the SQL editor can leave the schema cache stale until
-- its own reload timer fires, so writes through the API 400 with
-- "Could not find the 'sequencing_decisions' column ... in the schema
-- cache" even though the column now exists.
select pg_notify('pgrst', 'reload schema');
