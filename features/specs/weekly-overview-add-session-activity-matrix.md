# Weekly Overview "+ Add session" — Supabase-backed activity catalog

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass), revised twice after follow-up feedback — first widening
scope from a 5-item picker to a shared catalog, then moving that catalog
into Supabase. Kept to the same shape the automated spec pipeline produces
(see `features/PLANNING.md`) so scope decisions are explicit and reviewable,
per `CLAUDE.md`'s "do not implement a feature whose spec you have not read in
full" rule.

**This spec now includes a Supabase migration — per `CLAUDE.md`'s escalation
list ("any file in `supabase/migrations/`"), the PR implementing this
should carry a `needs-human-review` label regardless of how mechanical the
change looks.**

## Revision history

1. **First draft:** narrowed the Weekly Overview's "+ Add session" picker to
   the five types `utils/planEngine.js` generates (Bike, Run, Swim, Gym,
   Conditioning), removing `ref_activities` as its source (it was supplying
   a load-scoring `category`, not a display `type` — the original bug).
2. **Second draft:** widened back out — Yoga and the rest of the
   general-fitness/sport list needed to stay, sourced from **one shared
   catalog** used by both the questionnaire and the Weekly Overview picker,
   plus a personalized "Yours" section and a same-day numbering scheme.
   That draft stored the catalog as a static client-side file
   (`src/data/activityCatalog.js`) and explicitly flagged, as a callout, the
   alternative of storing it in Supabase instead — reasoning that every
   picker it touched was already static, so a DB-backed table was a bigger
   change than the ask required.
3. **This draft:** reverses that specific call — **the catalog (and the
   §B specific-type matrix) lives in Supabase**, as two new read-only
   reference tables alongside `ref_activities`/`ref_exercises`/
   `ref_muscle_groups`. Everything else about the design (groups, the
   optional specific-type dropdown, the "Yours" personalization, same-day
   numbering) is unchanged from draft 2 — only *where the catalog data
   lives* changes, from a hardcoded array to a fetched-and-cached table.

## Context / why

Investigation of a user bug report found that the Weekly Overview's
"+ Add session" panel (`AddSessionPanel`/`handleAddSession`,
`src/screens/WeeklyOverviewScreen.jsx:362-467,678-696`) stored
`ref_activities.category` — a coarse **training-load bucket**
(`endurance`, `team_sport`, `water_sport`, ...) meant for
`utils/overtrain.js`'s load-conflict scoring — directly as a new session's
display/analytics `type`. A manually-added "Cycling (moderate ride)" got
the 🏃 running icon (`SESSION_DISPLAY.endurance`) instead of the 🚴 bike
icon (`SESSION_DISPLAY.bike`), and built its own separate "Endurance"
Analytics bucket instead of merging into the user's real "Bike" pace trend.

Tracing every place this same category-vs-type confusion could recur (per
the second draft's "align things app-wide" ask) turned up the same bug
class twice more, already shipping: `utils/scheduleGeneration.js`'s
`ACTIVITY_DEFS` maps `rowing`/`hiit`/`pilates`/`climbing`/`dancing` all to
`type: 'other'` even though `SESSION_DISPLAY` already has a correct,
unused entry for each; and `cycling` uses `type: 'cycle'` while
`planEngine.js` uses `type: 'bike'` for the same discipline, so a
general-fitness-generated bike session and an event-plan bike session
don't merge in Analytics even though the user experiences both as "my bike
rides." Both are fixed as part of this catalog, not left as further
"known limitations."

## A. Two new Supabase reference tables

**Decision:** two new read-only reference tables, seeded and RLS'd exactly
like `ref_activities`/`ref_exercises`/`ref_muscle_groups`
(`supabase/migrations/20260623_create_reference_tables.sql`) — public
`select`, no client-facing insert/update/delete, seeded via a service-role
script, not by the client:

```sql
-- supabase/migrations/20260816_create_activity_catalog.sql
create table if not exists public.activity_catalog (
  id               bigint generated always as identity primary key,
  catalog_id       text        not null unique,  -- stable short id, e.g. 'bike', 'yoga', 'football'
  type             text        not null,          -- SESSION_DISPLAY key — drives icon/colour/analytics
  label            text        not null,
  group_name       text        not null,          -- 'training' | 'fitness' | 'sport'
  duration_minutes int,                            -- default session length, nullable
  sort_order       int         not null default 0
);

create table if not exists public.session_type_matrix (
  id           bigint generated always as identity primary key,
  type_id      text        not null unique,        -- e.g. 'easy', 'long', 'hill'
  label        text        not null,
  disciplines  text[]      not null default '{}',   -- subset of {'bike','run','swim'}
  sort_order   int         not null default 0
);

alter table public.activity_catalog    enable row level security;
alter table public.session_type_matrix enable row level security;

create policy "Anyone can read activity_catalog"
  on public.activity_catalog for select using (true);
create policy "Anyone can read session_type_matrix"
  on public.session_type_matrix for select using (true);

select pg_notify('pgrst', 'reload schema');
```

`type` is validated only by convention (same as `ref_activities` today —
no FK/enum, per `docs/PROJECT_CONTEXT.md`'s existing pattern) but must
always be a value `SESSION_DISPLAY` (`data/sessionDisplay.js`) has a real
entry for — a Vitest check against the seed JSON (§ below) is the actual
guard, same role `activityCatalog.test.js` would have played for a static
file in draft 2.

**Why a new table instead of extending `ref_activities`:** `ref_activities`
already carries many near-duplicate rows per discipline for load-scoring
granularity (four separate cycling rows — easy/commute, moderate, long,
indoor-intervals — each with different `leg_load`/`intensity_default`).
The picker this spec builds wants one curated row per pickable activity,
not that full expanded list re-surfaced (which would just reintroduce a
long, granular dropdown — the thing draft 1 removed). Keeping it a
separate table also means this migration can't accidentally change
`ref_activities`' existing shape/RLS, which `utils/overtrain.js`'s
Sequencing Advisor depends on unchanged.

**Seed data** (`supabase/seeds/forma_seed_data.json` gains `activity_catalog`
and `session_type_matrix` arrays; `scripts/seed-reference-data.js` gains a
matching `upsert('activity_catalog', ..., 'catalog_id')` /
`upsert('session_type_matrix', ..., 'type_id')` call, same idempotent
upsert-by-unique-column pattern the script already uses for the other
three tables):

| `catalog_id` | `type` | `label` | `group_name` |
|---|---|---|---|
| `bike` | `bike` | Bike | training |
| `run` | `run` | Run | training |
| `swim` | `swim` | Swim | training |
| `gym` | `gym` | Gym | training |
| `conditioning` | `conditioning` | Conditioning | training |
| `yoga` | `yoga` | Yoga | fitness |
| `walking` | `walk` | Walking | fitness |
| `rowing` | `row` | Rowing | fitness |
| `hiit` | `hiit` | HIIT | fitness |
| `pilates` | `pilates` | Pilates | fitness |
| `climbing` | `climb` | Climbing | fitness |
| `dancing` | `dance` | Dancing | fitness |
| `football` | `team_sport` | Football | sport |
| `basketball` | `team_sport` | Basketball | sport |
| `tennis` | `racket_sport` | Tennis | sport |
| `rugby` | `team_sport` | Rugby | sport |
| `hockey` | `team_sport` | Hockey | sport |
| `volleyball` | `team_sport` | Volleyball | sport |
| `martial_arts` | `combat` | Martial Arts | sport |
| `crossfit` | `other` | CrossFit | sport |
| `golf` | `other` | Golf | sport |

(`fitness`-group `duration_minutes` values match the old `ACTIVITY_DEFS`
defaults — 60/60/45/30/45/90/60 respectively — carried into the seed row
rather than hardcoded at a call site.)

`session_type_matrix` seed rows: `easy`/Easy/`{bike,run,swim}`,
`recovery`/Recovery/`{bike,run,swim}`, `long`/Long/`{bike,run,swim}`,
`tempo`/Tempo/`{bike,run,swim}`, `interval`/Interval/`{bike,run,swim}`,
`hill`/Hill sprint/`{bike,run}`, `race_pace`/Race-pace/`{bike,run,swim}`,
`technique`/Technique/`{swim}` — unchanged content from draft 2's static
`SESSION_TYPE_MATRIX`, just relocated.

## A.1 Client fetch + cache — `utils/activityCatalog.js`

**Decision:** a new `utils/` module (not `data/`, since it's now a fetcher,
matching this codebase's existing `data/` = static vs. `utils/` = logic/
fetch convention), modelled directly on `overtrain.js`'s
`getRefActivities()` module-level cache (`_refCache`/`_refPending`):

```js
// src/utils/activityCatalog.js
import { supabase } from './supabase';

let _catalogCache = null, _catalogPending = null;
let _matrixCache  = null, _matrixPending  = null;

export async function getActivityCatalog() {
  if (_catalogCache) return _catalogCache;
  if (_catalogPending) return _catalogPending;
  _catalogPending = supabase.from('activity_catalog').select('*').order('sort_order')
    .then(({ data, error }) => {
      if (error) { console.warn('Forma: activity_catalog fetch failed', error); return FALLBACK_CATALOG; }
      _catalogCache = data?.length ? data : FALLBACK_CATALOG;
      _catalogPending = null;
      return _catalogCache;
    });
  return _catalogPending;
}
// getSessionTypeMatrix() — identical shape, session_type_matrix / FALLBACK_MATRIX.

export function catalogByGroup(rows, group) {
  return rows.filter(r => r.group_name === group);
}
export function sessionTypesForDiscipline(rows, discipline) {
  return rows.filter(r => r.disciplines.includes(discipline));
}
```

**Hardcoded fallback, same established pattern as
`sessionLoadEstimate.js`'s `FALLBACK_LOAD`** (per
`docs/PROJECT_CONTEXT.md` §7.6: "using the Supabase `ref_activities`
reference table (with a hardcoded fallback table if that fetch fails)") —
`FALLBACK_CATALOG`/`FALLBACK_MATRIX` are literal copies of the seed data
above, baked into `activityCatalog.js`, used whenever the fetch errors or
returns empty. **This is why the fetch failure isn't just logged and left
empty like a normal reference-data miss would be** — unlike the Sequencing
Advisor (where a missing `ref_activities` row just means one session gets
generic-fallback load scoring), an empty activity picker during onboarding
or on the Weekly Overview would block a core flow, so this one gets the
same belt-and-braces treatment `FALLBACK_LOAD` already established for
exactly that reason.

## A.2 Consumers — everywhere `ACTIVITY_DEFS`/`GENERAL_ACTIVITIES`/`SPORT_TYPES`/`SPORT_NAME_TO_TYPE` lived

| Today (static) | Becomes |
|---|---|
| `GoalsSetupScreen.jsx`'s `GENERAL_ACTIVITIES` | `catalogByGroup(catalog, 'fitness')`, `catalog` from `getActivityCatalog()` (fetched on mount, loading state while pending — see Edge cases) |
| `GoalsSetupScreen.jsx`'s `SPORT_TYPES` | `catalogByGroup(catalog, 'sport').map(r => r.label)` |
| `utils/scheduleGeneration.js`'s `ACTIVITY_DEFS` | These functions (`legacyGenerateActivitySchedule`, `goalAwareGenerateActivitySchedule`, `disciplineActivityDef`) stay **pure and synchronous** — they take the already-fetched catalog rows as a parameter instead of importing a module-level constant, so their existing "no Supabase import, fully testable" contract (`sessionLoadEstimate.js`'s stated reason for the equivalent split with `overtrain.js`) is preserved. Callers (`App.jsx`'s `handleGoalsSetupComplete`, `GoalsSetupScreen.jsx`'s live plan preview) pass in `getActivityCatalog()`'s already-resolved/cached result — by the time either runs, the catalog was already fetched to render the General Fitness/Sport Activity steps the user just completed, so this is a synchronous cache read in practice, never a fresh await. |
| `utils/scheduleGeneration.js`'s `SPORT_NAME_TO_TYPE` | A lookup built from the fetched catalog's `group: 'sport'` rows (`label → type`), passed alongside the catalog rows for the same reason. |
| Weekly Overview's `AddSessionPanel` | Fetches via `getActivityCatalog()`/`getSessionTypeMatrix()` directly (§A.3 unchanged: still reads `goalsPayload` client state for the "Yours" section, not Supabase — that data is per-user and already in memory, not reference data). |

**Cross-cutting alignment fix, unchanged from draft 2, still flagged
prominently:** the catalog's `cycling` row uses `type: 'bike'`, so every
consumer above switches from `type: 'cycle'` to `type: 'bike'` for
cycling — same practical consequence called out before (existing
already-saved sessions untouched, no migration/backfill of *session* data;
only newly-generated schedules pick up the new colour).

**Not touched:** `screens/GymPlanScreens.jsx`'s `DayActivitiesScreen` and
its own `ACTIVITY_TYPES` list — a different screen, out of scope, same as
draft 2.

### A.3 The Weekly Overview picker itself

Same shape as draft 2: `AddSessionPanel` renders `activity_catalog` rows
grouped under **Training** / **Fitness** / **Sport** headings, plus a
**"Yours"** section built from `goalsPayload.standingCommitments` and the
`sport_activity` goal's `sportType` (client state, already loaded — see
draft 2's reasoning, unchanged). Picking a catalog row sets `type`/`label`
straight from that row.

## B. Optional "Specific type" — now `session_type_matrix`-backed

Unchanged in behaviour from draft 2: appears only for Bike/Run/Swim rows,
fetched via `getSessionTypeMatrix()` and filtered with
`sessionTypesForDiscipline(rows, discipline)`. Picking one still sets the
existing `sessionType` field, rendered the same way
(`WeeklyOverviewScreen.jsx:114`'s `detail` line) — only the data's storage
location changed.

## C. Gym / Conditioning — unchanged from draft 2

Optional free-text "Name" field instead of §B's dropdown — no Supabase
involvement either way, this section is unaffected by the move.

## D. Same-day numbering — unchanged from draft 2

`handleAddSession` still disambiguates a new session's label against
`weekData[dayIdx].sessions` (second same-label session that day → " 2",
third → " 3", ...). Unaffected by where the catalog lives — this logic
runs after a catalog row has already been picked, purely on the day's
existing session labels.

## Edge cases handled

- **`activity_catalog`/`session_type_matrix` fetch fails or is slow during
  onboarding** — `FALLBACK_CATALOG`/`FALLBACK_MATRIX` (§A.1) render
  immediately; onboarding's General Fitness/Sport Activity steps are never
  blocked or empty waiting on a network round-trip. If the real fetch
  later succeeds with different data than the fallback (e.g. an admin
  edited the table), the UI already rendered from the fallback doesn't
  retroactively update mid-step — acceptable, since the two are expected
  to match exactly under normal operation; a genuinely edited catalog
  taking effect on the next screen mount (not React memory that's already
  rendered) is an acceptable staleness window for a "picker options".
- **Existing `eventOverrides`/`activities` entries created before this
  change** — untouched, no migration of *session* data, only of what
  populates the pickers going forward.
- **`goalsPayload` not yet loaded** for the "Yours" section — hidden,
  same as draft 2.
- **`utils/scheduleGeneration.js`'s pure functions called before the
  catalog has ever been fetched** (a theoretical ordering bug, not an
  expected runtime path since both onboarding steps that need it render
  first) — callers must pass `FALLBACK_CATALOG`/`FALLBACK_MATRIX`
  explicitly as the default parameter value in that case, so these
  functions never throw or silently produce `undefined` defs; covered by
  a unit test that calls them with no prior fetch.
- Duration stays a free-text field on the add-session form (unchanged) —
  the catalog's `duration_minutes` is only a default for onboarding-
  generated sessions, not force-filled into the manual-add form.

## Explicitly out of scope

- `DayActivitiesScreen`'s own `ACTIVITY_TYPES` list and its `cycle` typing
  — still a separate screen, not touched.
- A glossary/info-button hookup for §B's specific-type picks — unchanged
  from draft 2, still out of scope.
- Rewriting `utils/sessionCompletion.js`'s matching to be id-based instead
  of label-based — §D's numbering is still considered sufficient.
- Renumbering already-existing same-day duplicates, or resequencing on
  delete (§D) — unchanged, deliberately basic.
- Any change to how a session is *logged* — unchanged.
- `CrossFit`/`Golf` gaining a more specific `type` than `other` — unchanged,
  no existing `SESSION_DISPLAY` entry fits either well.
- An admin/in-app UI for editing `activity_catalog`/`session_type_matrix`
  rows — same as `ref_activities` today, these are edited directly via the
  Supabase SQL editor or by re-running the seed script, not from the app.
- Real-time propagation of a catalog edit to already-open sessions — the
  module-level cache (§A.1) is fetched once per page load, matching
  `getRefActivities()`'s existing caching behaviour; a catalog change takes
  effect on next app load, not live.

## Data model implications

**New migration, flagged for mandatory human review per `CLAUDE.md`:**
`supabase/migrations/20260816_create_activity_catalog.sql` (§A) adds
`activity_catalog` and `session_type_matrix`, both public-read/no-client-write,
following `20260623_create_reference_tables.sql`'s exact RLS pattern and
ending with `select pg_notify('pgrst', 'reload schema');` per
`docs/PROJECT_CONTEXT.md` §9's requirement (a migration that skips this can
leave PostgREST's schema cache stale and 400 on the new tables until its
own reload timer fires).

Seeding is manual, not CI-run, same as the existing reference tables
(`docs/PROJECT_CONTEXT.md` §8): `scripts/seed-reference-data.js` gains two
more `upsert(...)` calls, run once with `SUPABASE_URL`/
`SUPABASE_SERVICE_KEY` after the migration lands.

`eventOverrides`/`activities` (per-user session data) keep their existing
jsonb shapes — unaffected; only the *source of picker options* moves.

## Files this touches

- `supabase/migrations/20260816_create_activity_catalog.sql` (new) — §A.
- `supabase/seeds/forma_seed_data.json` — gains `activity_catalog` and
  `session_type_matrix` arrays (§A's seed tables).
- `scripts/seed-reference-data.js` — two more `upsert(...)` calls.
- `src/utils/activityCatalog.js` (new) — `getActivityCatalog()`,
  `getSessionTypeMatrix()`, `catalogByGroup`, `sessionTypesForDiscipline`,
  `FALLBACK_CATALOG`, `FALLBACK_MATRIX` (§A.1).
- `src/utils/activityCatalog.test.js` (new) — Vitest coverage:
  `FALLBACK_CATALOG` and `FALLBACK_MATRIX` rows all resolve to a real
  `SESSION_DISPLAY` entry (the regression guard for this whole bug class);
  `catalogByGroup`/`sessionTypesForDiscipline` filter correctly; a
  simulated fetch failure falls back correctly.
- `src/utils/scheduleGeneration.js` — `ACTIVITY_DEFS`/`SPORT_NAME_TO_TYPE`
  removed as module-level constants; `legacyGenerateActivitySchedule`,
  `goalAwareGenerateActivitySchedule`, `disciplineActivityDef`,
  `sportActivityDef` gain a `catalog`/`sportTypeMap` parameter (defaulting
  to `FALLBACK_CATALOG`-derived values) instead of importing the old
  constants; `cycling` switches to `type: 'bike'` (cross-cutting, §A.2).
- `src/utils/scheduleGeneration.test.js` — updated call sites (new
  parameter), plus regression coverage for the `rowing`/`hiit`/`pilates`/
  `climbing`/`dancing`/`cycling` type fixes.
- `src/screens/GoalsSetupScreen.jsx` — `GENERAL_ACTIVITIES`/`SPORT_TYPES`
  replaced by a `getActivityCatalog()` fetch + loading state on mount (new
  `React.useEffect`, same pattern draft 1's `AddSessionPanel` originally
  used for `ref_activities`); passes the resolved catalog down to
  `generateActivitySchedule`/`previewPlan` call sites.
- `src/screens/WeeklyOverviewScreen.jsx` — `AddSessionPanel` fetches
  `getActivityCatalog()`/`getSessionTypeMatrix()` instead of importing a
  static file; `handleAddSession` unchanged from draft 2 otherwise
  (§D numbering, §A.3 "Yours").
- `src/App.jsx` — thread `goalsPayload` into `WeeklyOverviewScreen`, same
  one addition as draft 2 (§A.3).
- `src/screens/WeeklyOverviewScreen.test.js` /
  `src/screens/GoalsSetupScreen.test.js` — mock `utils/activityCatalog.js`
  rather than reading a static import, otherwise same coverage goals as
  draft 2.
- `tests/e2e/smoke.spec.js` — same assertion as draft 2 (bike icon, same-day
  numbering), now exercising the real fetch-or-fallback path against the
  test Supabase project.
- `docs/PROJECT_CONTEXT.md` §8/§13 — add `activity_catalog`/
  `session_type_matrix` to the reference-tables list and file map, keeping
  the "read first" doc accurate per `CLAUDE.md`.
