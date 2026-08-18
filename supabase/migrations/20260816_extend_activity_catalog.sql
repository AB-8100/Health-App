-- Renames ref_activities -> activity_catalog and adds a `type` column.
--
-- ref_activities already held everything a "list of activities the app
-- knows about" needs (name, category, load-scoring columns) except a
-- column recording each row's SESSION_DISPLAY key (data/sessionDisplay.js)
-- for display/Analytics purposes — every consumer that needed a display
-- type was instead reaching for `category` (a coarse load bucket shared by
-- e.g. running/cycling/rowing under "endurance"), which produced the wrong
-- icon and the wrong Analytics bucket (features/specs/weekly-overview-add-
-- session-activity-matrix.md). Rather than stand up a second, smaller
-- table next to this one, this migration renames it and adds the one
-- column it was missing — no data loss, no change to the columns
-- utils/overtrain.js's Sequencing Advisor already reads.
--
-- See features/specs/weekly-overview-add-session-activity-matrix.md §A.

alter table public.ref_activities rename to activity_catalog;

alter table public.activity_catalog add column type text;

alter policy "Anyone can read ref_activities" on public.activity_catalog
  rename to "Anyone can read activity_catalog";

select pg_notify('pgrst', 'reload schema');
