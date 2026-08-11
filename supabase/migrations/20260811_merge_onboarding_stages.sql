-- Supports the merged goals+intake onboarding flow
-- (features/specs/deterministic-endurance-plan-generator.md §A). Data model
-- implications: user_goals gains per-discipline day selections (§A.7) and
-- the merged standing-commitments/regular-sports list (§A.5/§A.6), and loses
-- pool_access/pool_days (derived from whether 'swim' has any selected days
-- instead). user_goals and user_intake stay two separate tables — recorded
-- decision (see the spec's "flagging" note): smaller migration, no
-- behaviour change for anything else reading either table independently,
-- even though both are now filled from one screen flow.
--
-- user_intake needs no new columns: the trimmed/added baseline fields
-- (weekly-frequency counts removed; canRunContinuously60min,
-- openWaterExperience, wetsuitExperience, bikeType added) are just new/
-- removed keys within the existing run_baseline/swim_baseline/bike_baseline
-- JSONB columns.

alter table public.user_goals
  add column if not exists discipline_days jsonb not null default '{}'::jsonb,
  -- { swim: [...dayKeys], bike: [...dayKeys], run: [...dayKeys] } — event_race only

  add column if not exists standing_commitments jsonb not null default '[]'::jsonb;
  -- [{ label, day, time, countsTowardLoad }] — replaces regular_sports going
  -- forward; regular_sports is left in place (not dropped) so
  -- utils/supabase.js's loadUserGoals can still read an existing goal saved
  -- before this merge and map it into the new shape at load time.

alter table public.user_goals
  drop column if exists pool_access,
  drop column if exists pool_days;

select pg_notify('pgrst', 'reload schema');
