# Weekly Overview "+ Add session" — one catalog, extending `ref_activities`

Status: authored inline for a direct user request, revised three times as
follow-up feedback narrowed in on the final shape. Kept to the same shape
the automated spec pipeline produces (see `features/PLANNING.md`) so scope
decisions are explicit and reviewable, per `CLAUDE.md`'s "do not implement a
feature whose spec you have not read in full" rule.

**This spec includes a Supabase migration — per `CLAUDE.md`'s escalation
list ("any file in `supabase/migrations/`"), the PR implementing this
should carry a `needs-human-review` label regardless of how mechanical the
change looks.**

## Revision history

1. **Draft 1:** narrowed the Weekly Overview's "+ Add session" picker to
   five fixed types (Bike/Run/Swim/Gym/Conditioning), dropping
   `ref_activities` as its source because it was supplying a load-scoring
   `category`, not a display `type`.
2. **Draft 2:** widened back out — Yoga etc. needed to stay, sourced from
   one shared catalog used by both the questionnaire and the Weekly
   Overview picker, plus a personalized "Yours" section and same-day
   numbering. Catalog stored as a static client-side file.
3. **Draft 3:** moved that static catalog into two new Supabase tables
   (`activity_catalog`, `session_type_matrix`), alongside the existing
   `ref_activities`.
4. **This draft:** collapses draft 3's two new tables into **one** — by
   extending `ref_activities` itself (renamed `activity_catalog`) with the
   one column it was actually missing, rather than standing up a
   parallel, smaller table next to it. `ref_activities` (63 seeded rows,
   real load data, name-level granularity like "Cycling (long ride)" vs
   "Cycling (easy / commute)") turned out to already be a *better* version
   of what draft 3 was inventing from scratch — its specific row names are
   a real, load-scored equivalent of draft 3's invented generic "Easy /
   Long / Tempo / Interval" matrix, just per-activity and backed by actual
   curated data instead of made-up labels. The invented
   `session_type_matrix` table is dropped entirely; picking a specific
   `ref_activities`/`activity_catalog` row **is** the specific-type choice.

## Context / why

The original bug: the Weekly Overview's "+ Add session" panel
(`AddSessionPanel`/`handleAddSession`, `WeeklyOverviewScreen.jsx`) stored
`ref_activities.category` — a coarse **training-load bucket**
(`endurance`, `team_sport`, ...), meant only for `utils/overtrain.js`'s
load-conflict scoring — directly as a session's display/analytics `type`.
Every cycling row shares `category: "endurance"` with running and rowing,
so a manually-added "Cycling (moderate ride)" got the 🏃 running icon
instead of 🚴, and its own disconnected "Endurance" Analytics bucket
instead of merging into "Bike".

Two more instances of the same bug class, unrelated to the Weekly
Overview, turned up while aligning things (still true of this draft, see
§B): `utils/scheduleGeneration.js`'s `ACTIVITY_DEFS` maps `rowing`/`hiit`/
`pilates`/`climbing`/`dancing` all to `type: 'other'` despite
`SESSION_DISPLAY` having a correct entry for each; `cycling` uses
`type: 'cycle'` while `planEngine.js` uses `type: 'bike'` for the same
discipline, splitting Analytics in two.

**What this draft changes vs. draft 3:** `ref_activities` was never
missing a *catalog* — it already has 63 rows with real names, categories,
and load data. What it was missing is a single column recording each row's
`SESSION_DISPLAY` key, so a consumer never again has to reach for
`category` (or invent a whole second table) to get one. Once that column
exists, `ref_activities` — renamed `activity_catalog` to match what it now
actually is — is the one and only "list of activities the app knows
about," used for load-scoring (existing columns, unchanged) *and*
display/analytics typing *and* the picker's specific-variant choice, all
at once.

## A. Migration — rename + one new column, not a new table

```sql
-- supabase/migrations/20260816_extend_activity_catalog.sql
alter table public.ref_activities rename to activity_catalog;
alter table public.activity_catalog add column type text;

alter policy "Anyone can read ref_activities" on public.activity_catalog
  rename to "Anyone can read activity_catalog";

select pg_notify('pgrst', 'reload schema');
```

Every existing column (`category`, `leg_load`, `upper_load`, `cardio_load`,
`core_load`, `intensity_default`, `recovery_hours`, `notes`) is untouched —
`utils/overtrain.js`/`utils/sessionLoadEstimate.js`'s Sequencing Advisor
keeps reading exactly what it reads today, from a table with a new name.
`category` keeps its existing role too (a coarser grouping, still useful
for the picker's section headers, §D) — `type` is additive, not a
replacement column. `type` is left nullable at the schema level (no other
column in this table has a hard constraint beyond `not null`/defaults
either) — populated for every row by the seed re-run (§B), with app code
treating a genuinely null `type` defensively (falls back to `'other'`,
same as today's `SESSION_DISPLAY[type] || SESSION_DISPLAY.other`).

**Why rename instead of leaving the name `ref_activities` and just adding
a column:** this is the table the user asked to "remove" — not literally
drop its data (that would break the Sequencing Advisor, an existing,
unrelated, working feature this spec has no reason to touch), but retire
the *name* and the *idea* of a separate `ref_activities`-only-for-load-
scoring table sitting next to a `activity_catalog`-only-for-picking table.
A rename achieves that with zero data loss and zero risk of the two
tables drifting out of sync, which copying data into a second table (then
deleting the first) would risk during the transition.

## B. Seed data — one new column populated, three new rows added

`supabase/seeds/forma_seed_data.json`'s `activities` array gains a `type`
value per row (`scripts/seed-reference-data.js`'s existing
`upsert('activity_catalog', ..., 'name')` call — renamed from
`ref_activities`, one added `type: a.type` field in the row-mapping
object). Assignment follows the existing `category` grouping, split further
wherever `category` alone conflates disciplines that need different icons
(`endurance` covers run/bike/swim/row/brick; `gym` covers actual gym-split
days and conditioning/HIIT/CrossFit/lifting):

| `category` | Row name pattern | `type` |
|---|---|---|
| `team_sport` | Football/Rugby/Basketball/Netball/Hockey/Volleyball/Cricket (all variants) | `team_sport` |
| `racket_sport` | Tennis/Badminton/Squash (all variants) | `racket_sport` |
| `endurance` | `Running (...)` (5 variants) | `run` |
| `endurance` | `Cycling (...)` (4 variants) | `bike` *(fix: was inconsistently `cycle` elsewhere in the codebase — see §C)* |
| `endurance` | `Swimming (...)` (3 variants), `Open water swimming` | `swim` |
| `endurance` | `Synchronised Swimming` | `swim` |
| `endurance` | `Rowing (on water)`, `Rowing (ergometer / erg)` | `row` |
| `endurance` | `Triathlon brick (bike + run)` | `brick` |
| `gym` | `Legs day`/`Push day`/`Pull day`/`Upper body day`/`Full body` (gym) | `gym` |
| `gym` | `Conditioning circuit`, `Core / abs session` | `conditioning` |
| `gym` | `HIIT class` | `hiit` |
| `gym` | `CrossFit WOD` | `hiit` *(closest existing fit; was previously unmapped/`other` in `SPORT_TYPES`)* |
| `gym` | `Powerlifting session`, `Olympic lifting session` | `gym` |
| `mobility` | `Yoga (...)` (2 variants) | `yoga` |
| `mobility` | `Pilates` | `pilates` |
| `mobility` | `Stretching / foam rolling`, `Mobility session` | `mobility` |
| `combat` | Boxing (2 variants), `MMA / BJJ training`, `Muay Thai` | `combat` |
| `water_sport` | Surfing/Paddleboarding/Kayaking | `water_sport` |
| `adventure` | `Climbing (...)` (2 variants) | `climb` |
| `adventure` | `Hiking (...)` (2 variants) | `adventure` |
| `recovery` | `Active recovery`, `Rest day` | `recovery` / `rest` respectively — **excluded from the picker** (§D), not real "add a session" choices |

**Three new rows**, needed for parity with what `GoalsSetupScreen.jsx`'s
`GENERAL_ACTIVITIES`/`SPORT_TYPES` offer today that `ref_activities`
doesn't yet have a row for:

| name | category | type | leg/upper/cardio/core load | intensity | recovery_hours |
|---|---|---|---|---|---|
| `Walking` | `recovery` | `walk` | none/none/low/none | low | 0 |
| `Dancing (social / fitness class)` | `mobility` | `dance` | low/low/medium/low | medium | 24 |
| `Golf` | `adventure` | `other` *(no dedicated `SESSION_DISPLAY` entry fits better — same fallback `SPORT_TYPES` already gave it)* | low/low/low/low | low | 0 |

## C. Cross-cutting alignment fix — `cycle` → `bike` everywhere, flagged

Unchanged in substance from draft 3, still flagged prominently per
`CLAUDE.md` (changes existing behaviour beyond this feature):
`utils/scheduleGeneration.js`'s `cycling`/`Cycling` entries
(`ACTIVITY_DEFS.cycling`, `DISCIPLINE_ACTIVITY_META.bike`, the old
`SPORT_NAME_TO_TYPE.Cycling`) switch from `type: 'cycle'` to
`type: 'bike'`, matching both `planEngine.js` and the new
`activity_catalog.type` column. **Practical consequence for the PR
description:** a user whose Weekly Overview already shows a
general-fitness-generated cycling session sees its colour change
(`#9333EA` → `#D97706`) the next time that schedule regenerates —
existing already-saved session data is untouched, no backfill, same
"generation-time change only" pattern used before.

**Not touched:** `screens/GymPlanScreens.jsx`'s `DayActivitiesScreen` and
its own `ACTIVITY_TYPES` list — still a separate screen/picker, out of
scope, unchanged from every prior draft. Its `refName` pattern (a broad
category button defaulting to one canonical `ref_activities`/
`activity_catalog` row by name) is exactly the pattern §D/§E below
generalize to the questionnaire and the Weekly Overview picker — reusing
the *idea* already proven there (`GymPlanScreens.test.js`'s "quick-add
naming convergence" coverage already asserts a `DayActivitiesScreen`
quick-add and a `WeeklyOverviewScreen` full-picker choice of the same row
name resolve identically for personal-RPE history — this draft's design
preserves that property, since it still stores the same `activity_catalog`
row name as `label` either way), without touching that screen's own code.

## D. The Weekly Overview picker — broad type first, specific row second (optional)

**Decision:** two-step picker, restoring the shape from the very first
follow-up request ("bike/run/swim/gym/conditioning [...] an optional
drop down that points to the specific type") — now backed by real data
instead of an invented matrix:

1. **Step 1 — broad type.** Buttons for each distinct `type` present in
   `activity_catalog` (excluding `recovery`/`rest`, §B), grouped under
   `category`-derived section headers for scanability (Training: run/bike/
   swim/gym/conditioning/row/brick; Mobility: yoga/pilates/mobility/dance;
   Team & racket sports: team_sport/racket_sport; Combat; Water sports;
   Adventure: climb/adventure/walk). Each button's icon/colour comes from
   `SESSION_DISPLAY[type]`, not a per-row duplicate.
2. **Step 2 — specific variant (optional, auto-hidden when there's only
   one row for that type).** Fetched rows filtered to the chosen `type`,
   shown by their real `name` ("Running (tempo)", "Cycling (long ride)",
   "Football (5-a-side, casual)", ...). Skipped automatically for a
   `type` with a single row (Walking, Dancing, Pilates, Golf, brick).

Picking a step-1 type alone (skipping step 2) stores a **default variant**
per type — same "moderate" convention `DayActivitiesScreen.ACTIVITY_TYPES`
already established for its own quick-add (`refName`), extended to every
type this picker now covers:

| type | default row |
|---|---|
| `run` | Running (tempo) |
| `bike` | Cycling (moderate ride) |
| `swim` | Swimming (moderate) |
| `row` | Rowing (ergometer / erg) |
| `gym` | Full body (gym) |
| `conditioning` | Conditioning circuit |
| `hiit` | HIIT class |
| `yoga` | Yoga (vinyasa / power) |
| `climb` | Climbing (bouldering) |
| `team_sport` | Football (5-a-side, casual) |
| `racket_sport` | Tennis (casual hit) |
| `combat` | Boxing (pad/bag work) |
| `water_sport` | Paddleboarding (SUP) |
| `adventure` | Hiking (moderate) |
| *(single-row types: `walk`, `pilates`, `dance`, `other`/Golf, `brick`)* | that type's one row |

Whichever row is resolved (explicit step-2 pick, or the default), its
**`name` becomes the session's `label`** and its **`type` column becomes
the session's `type`** — `type` is always correct by construction,
regardless of which specific row was picked, closing the original bug
completely. A lightweight optional text field lets the user override the
label text itself (pre-filled with the resolved row's name, editable) for
a genuinely custom wording — subsumes draft 3's Gym/Conditioning-only
"Name" field into one universal rule instead of a type-specific special
case.

## E. Personalized "Yours" section — unchanged in concept, simplified in implementation

Still shows the user's own `goalsPayload.standingCommitments` labels and
`sport_activity` goal's chosen sport as quick-add chips above the catalog
(client state, not reference data — unaffected by this table's rename).
**Simplified:** resolves each chip's `type` via `findRef(label,
activityCatalogRows)` (`utils/sessionLoadEstimate.js`'s existing
exact→prefix→substring matcher, already used by the Sequencing Advisor) —
falls back to `'other'` on no match — instead of draft 3's separate
hardcoded `SPORT_NAME_TO_TYPE` dict, which this draft removes entirely as
redundant now that the same fuzzy-match function can serve both callers.

## F. Same-day numbering — unchanged from draft 2/3

`handleAddSession` still disambiguates a new session's label against
`weekData[dayIdx].sessions` (second same-label session that day → " 2",
third → " 3", ...). Less likely to trigger now than in earlier drafts,
since two sessions of the same broad `type` will usually carry different
specific variant names (e.g. "Cycling (easy / commute)" vs "Cycling (long
ride)") and therefore never collide in the first place — still kept as
the safety net for the case where the same exact variant (or the same
custom-typed label) is picked twice in one day.

## Edge cases handled

- **`activity_catalog` fetch fails or is slow** — a hardcoded
  `FALLBACK_CATALOG` (a literal copy of §B's table, baked into
  `utils/activityCatalog.js`, same established pattern as
  `sessionLoadEstimate.js`'s `FALLBACK_LOAD`) renders immediately;
  onboarding and the Weekly Overview picker are never blocked or empty
  waiting on a network round-trip.
- **A row with `type` still null** (a pre-migration row that was never
  re-seeded) — falls back to `'other'`, same defensive default
  `SESSION_DISPLAY` lookups already use everywhere else.
- **Existing `eventOverrides`/`activities` entries created before this
  change** — untouched; only what populates the pickers going forward
  changes.
- **A "Yours" chip whose free-text name doesn't fuzzy-match any catalog
  row** (e.g. "Padel") — falls to `type: 'other'`, same fallback
  `sportActivityDef`-equivalent logic gave it before.
- Duration stays a free-text field on the add-session form, independent of
  the resolved row's own typical duration (unchanged).

## Explicitly out of scope

- `DayActivitiesScreen`'s own `ACTIVITY_TYPES`/`refName` — unchanged,
  separate screen (§C).
- Rewriting `utils/sessionCompletion.js`'s label-based matching to be
  id-based — §F's numbering remains the accepted mitigation, unchanged.
- Renumbering already-existing same-day duplicates, or resequencing on
  delete (§F) — unchanged, deliberately basic.
- Any change to how a session is *logged* (`MarkCompleteSheet`,
  `ActivityTimerScreen`) — unchanged, this spec only changes what a
  *scheduled* session is tagged/named with before it's logged.
- Renaming the `category` column, or removing it — still used for the
  picker's section headers and untouched by the Sequencing Advisor either
  way; no reason to touch it.
- An admin/in-app UI for editing `activity_catalog` rows — same as today,
  edited via the Supabase SQL editor or the seed script, not from the app.

## Data model implications

**Migration, flagged for mandatory human review per `CLAUDE.md`:**
`supabase/migrations/20260816_extend_activity_catalog.sql` (§A) renames
`ref_activities` → `activity_catalog` and adds one nullable `type` column.
No data loss, no RLS change beyond the policy's own rename for clarity,
no new table. Every other Supabase table (`ref_exercises`,
`ref_muscle_groups`, `training_plans`, ...) is untouched.

Seeding is manual, not CI-run, same as today (`docs/PROJECT_CONTEXT.md`
§8): re-run `scripts/seed-reference-data.js` (now upserting into
`activity_catalog`) with `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` after the
migration lands, to populate `type` on the existing 63 rows and add the
3 new ones (§B).

## Files this touches

- `supabase/migrations/20260816_extend_activity_catalog.sql` (new) — §A.
- `supabase/seeds/forma_seed_data.json` — `activities` array gains `type`
  per row + 3 new rows (§B).
- `scripts/seed-reference-data.js` — `upsert('ref_activities', ...)` →
  `upsert('activity_catalog', ...)`, adds `type: a.type` to the mapped
  row shape.
- `src/utils/overtrain.js` — `getRefActivities()` → rename to
  `getActivityCatalog()` (or keep the old name as a thin re-export if
  minimizing diff is preferred — implementer's call, noted as a minor
  decision, not a structural one); `.from('ref_activities')` →
  `.from('activity_catalog')`; `.select(...)` gains `type`.
- `src/utils/activityCatalog.js` (new) — thin wrapper: re-exports
  `overtrain.js`'s fetch under whichever name is chosen, plus
  `FALLBACK_CATALOG` (§ Edge cases), `rowsForType(rows, type)`,
  `defaultRowForType(rows, type)` (§D's default-variant table).
- `src/utils/activityCatalog.test.js` (new) — Vitest coverage:
  `FALLBACK_CATALOG` rows all resolve to a real `SESSION_DISPLAY` entry
  (regression guard for this whole bug class); `defaultRowForType`
  resolves correctly for every type in §D's table.
- `src/utils/scheduleGeneration.js` — `ACTIVITY_DEFS`/`SPORT_NAME_TO_TYPE`
  removed; `legacyGenerateActivitySchedule`, `goalAwareGenerateActivitySchedule`,
  `disciplineActivityDef`, `sportActivityDef` take the fetched catalog
  rows as a parameter instead of importing a module constant (stays pure/
  synchronous, per draft 3's reasoning — callers pass the already-resolved
  `getActivityCatalog()` cache); `cycling` switches to `type: 'bike'` (§C).
- `src/utils/scheduleGeneration.test.js` — updated call sites, plus
  regression coverage for the type fixes (§B/§C).
- `src/screens/GoalsSetupScreen.jsx` — `GENERAL_ACTIVITIES`/`SPORT_TYPES`
  replaced by a `getActivityCatalog()` fetch + loading state on mount,
  grouped/filtered the same way §D's step 1 is; no visible UI change to
  onboarding's button grid itself (same broad categories, same order).
- `src/screens/WeeklyOverviewScreen.jsx` — `AddSessionPanel` rebuilt as
  §D's two-step picker + §E's "Yours" section; `handleAddSession` stores
  the resolved row's `name`/`type` and applies §F's disambiguation.
- `src/App.jsx` — thread `goalsPayload` into `WeeklyOverviewScreen` (§E),
  same single addition flagged in every prior draft.
- `src/screens/WeeklyOverviewScreen.test.js` /
  `src/screens/GoalsSetupScreen.test.js` — mock `utils/activityCatalog.js`
  instead of a static import.
- `tests/e2e/smoke.spec.js` — one assertion: open "+ Add session," pick
  Bike, confirm the bike icon renders with the default "Cycling (moderate
  ride)" variant; pick a second Bike variant the same day, confirm it's
  labelled with a " 2" suffix.
- `docs/PROJECT_CONTEXT.md` §7.6/§8/§9/§13 — update every `ref_activities`
  mention to `activity_catalog`, note the new `type` column, keeping the
  "read first" doc accurate per `CLAUDE.md`.
