# Weekly Overview "+ Add session" — shared activity catalog

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass), revised once after follow-up feedback widened the scope
from a 5-item picker to an app-wide shared catalog. Kept to the same shape
the automated spec pipeline produces (see `features/PLANNING.md`) so scope
decisions are explicit and reviewable, per `CLAUDE.md`'s "do not implement a
feature whose spec you have not read in full" rule.

## Revision note

The first draft of this spec narrowed the Weekly Overview's "+ Add session"
picker to exactly the five types `utils/planEngine.js` generates (Bike, Run,
Swim, Gym, Conditioning), removing `ref_activities` as its source. Follow-up
feedback asked for two changes to that draft:

1. **Yoga (and the rest of the general-fitness/sport activity list) should
   stay available** — not narrowed away — but should come from **one shared
   catalog** used consistently by the questionnaire (onboarding's General
   Fitness / Sport Activity steps) *and* the Weekly Overview picker, instead
   of each surface keeping its own separate, drifting list. A user's own
   custom entries from onboarding (standing commitments — free-text sports
   they told the app they already do) should also be selectable again from
   the Weekly Overview picker.
2. **A basic numbering system** (1, 2, 3...) for same-day sessions that
   share a label, to remove the "two Bike cards collide" edge case the
   first draft flagged as an accepted limitation rather than fixed.

This revision keeps §A/§B/§C's core fix (a session's `type` must come from a
curated, `SESSION_DISPLAY`-correct source, never `ref_activities.category`)
but replaces the fixed 5-item list with a shared catalog (§A), and adds §D
for the numbering fix.

## Context / why

Investigation of a user bug report found that the Weekly Overview's
"+ Add session" panel (`AddSessionPanel`/`handleAddSession`,
`src/screens/WeeklyOverviewScreen.jsx:362-467,678-696`) stored
`ref_activities.category` — a coarse **training-load bucket**
(`endurance`, `team_sport`, `water_sport`, ...) meant for
`utils/overtrain.js`'s load-conflict scoring — directly as a new session's
display/analytics `type`. Every cycling row in the seed data
(`supabase/seeds/forma_seed_data.json`) is tagged `category: "endurance"`,
so a manually-added "Cycling (moderate ride)" got the 🏃 running icon
(`SESSION_DISPLAY.endurance`) instead of the 🚴 bike icon
(`SESSION_DISPLAY.bike`) an event-plan-generated bike session gets, and
built its own separate "Endurance" Analytics bucket instead of merging into
the user's real "Bike" pace trend.

**While tracing every place this same category-vs-type confusion could
recur (per the follow-up ask to align things app-wide), the same bug class
turned up twice more, already shipping, unrelated to the Weekly Overview:**

- `utils/scheduleGeneration.js`'s `ACTIVITY_DEFS` — the table onboarding's
  General Fitness step schedules from — maps `rowing`, `hiit`, `pilates`,
  `climbing`, and `dancing` all to `type: 'other'`, even though
  `SESSION_DISPLAY` already has a dedicated, correct entry for every one of
  them (`row` 🚣, `hiit` ⚡, `pilates` 🤸, `climb` 🧗, `dance` 💃,
  `data/sessionDisplay.js:15-19`) — those entries just aren't reachable
  today because nothing points at them by the right key. A user who
  schedules "Rowing" via onboarding gets the same generic ⚡ icon a
  never-otherwise-classified activity gets, and its Analytics pace series
  groups under `pace:other` alongside everything else that fell through to
  the same fallback, not its own "Row" series.
- The same file's `cycling`/`Cycling` entries (`ACTIVITY_DEFS.cycling`,
  `DISCIPLINE_ACTIVITY_META.bike`, `SPORT_NAME_TO_TYPE.Cycling`) use
  `type: 'cycle'`, while `utils/planEngine.js`'s event-race engine uses
  `type: 'bike'` for the same discipline. Both render correctly (each has
  its own `SESSION_DISPLAY` entry — different colours, `#9333EA` vs
  `#D97706`) but `utils/analytics.js`'s pace-series bucketing keys are
  exact-`type` (`pace:${type}`), so a general-fitness-generated cycling
  session and an event-plan bike session **do not merge into the same pace
  chart** even though both are, to the user, "my bike rides." This is the
  same disconnect the original bug report described, just triggered by a
  different onboarding path.

Both are fixed as part of building the shared catalog below (§A), not left
as further "known limitations" — they're the same root cause the user
already asked to fix, just discovered in two more places while aligning
things.

## A. `src/data/activityCatalog.js` — the one list everything selects from

**Decision:** a new file, `ACTIVITY_CATALOG`, becomes the single source of
truth for "activities the app knows about." Every existing activity picker
either reads from it directly or is reduced to a thin filtered view of it,
instead of keeping its own independently-drifting list:

| Today | Becomes |
|---|---|
| `GoalsSetupScreen.jsx`'s `GENERAL_ACTIVITIES` (11 hardcoded entries, General Fitness step) | Reads `ACTIVITY_CATALOG.filter(a => a.group === 'fitness')` |
| `GoalsSetupScreen.jsx`'s `SPORT_TYPES` (14 hardcoded sport names, Sport Activity step) | Reads `ACTIVITY_CATALOG.filter(a => a.group === 'sport').map(a => a.label)` |
| `utils/scheduleGeneration.js`'s `ACTIVITY_DEFS` | Derived from `ACTIVITY_CATALOG` (`type`/`label`/`duration` per entry; emoji/colour resolved via `getSessionDisplay`, not duplicated locally — see below) |
| `utils/scheduleGeneration.js`'s `SPORT_NAME_TO_TYPE` | Derived from `ACTIVITY_CATALOG`'s `group: 'sport'` entries' own `type` field |
| Weekly Overview's `AddSessionPanel` (this spec's actual target) | Reads the full `ACTIVITY_CATALOG`, grouped, **plus** the user's own onboarding entries (§A.3) |

```js
// src/data/activityCatalog.js
// Single source of truth for every activity picker in the app (onboarding's
// General Fitness / Sport Activity steps, Weekly Overview's + Add session
// panel). `type` must always be a key SESSION_DISPLAY (sessionDisplay.js)
// has a real entry for — that's what actually drives icon/colour and
// Analytics pace-series bucketing everywhere a session renders. Adding a
// new activity means adding both a row here AND (if none of the existing
// keys fit) a SESSION_DISPLAY entry — never inventing a `type` on the fly
// at a call site, which is the exact mistake this file exists to prevent.
export const ACTIVITY_CATALOG = [
  // ── group: 'training' — same types utils/planEngine.js's event-race engine emits.
  { id: 'bike',         type: 'bike',         label: 'Bike',         group: 'training' },
  { id: 'run',          type: 'run',          label: 'Run',          group: 'training' },
  { id: 'swim',         type: 'swim',         label: 'Swim',         group: 'training' },
  { id: 'gym',          type: 'gym',          label: 'Gym',          group: 'training' },
  { id: 'conditioning', type: 'conditioning', label: 'Conditioning', group: 'training' },

  // ── group: 'fitness' — was GoalsSetupScreen.jsx's GENERAL_ACTIVITIES / scheduleGeneration.js's ACTIVITY_DEFS.
  { id: 'yoga',      type: 'yoga',    label: 'Yoga',     group: 'fitness', duration: 60 },
  { id: 'walking',   type: 'walk',    label: 'Walking',  group: 'fitness', duration: 60 },
  { id: 'rowing',    type: 'row',     label: 'Rowing',   group: 'fitness', duration: 45 }, // fix: was 'other'
  { id: 'hiit',      type: 'hiit',    label: 'HIIT',     group: 'fitness', duration: 30 }, // fix: was 'other'
  { id: 'pilates',   type: 'pilates', label: 'Pilates',  group: 'fitness', duration: 45 }, // fix: was 'other'
  { id: 'climbing',  type: 'climb',   label: 'Climbing', group: 'fitness', duration: 90 }, // fix: was 'other'
  { id: 'dancing',   type: 'dance',   label: 'Dancing',  group: 'fitness', duration: 60 }, // fix: was 'other'

  // ── group: 'sport' — was GoalsSetupScreen.jsx's SPORT_TYPES / scheduleGeneration.js's SPORT_NAME_TO_TYPE.
  { id: 'football',     type: 'team_sport',   label: 'Football',     group: 'sport' },
  { id: 'basketball',   type: 'team_sport',   label: 'Basketball',   group: 'sport' },
  { id: 'tennis',        type: 'racket_sport', label: 'Tennis',       group: 'sport' },
  { id: 'rugby',         type: 'team_sport',   label: 'Rugby',        group: 'sport' },
  { id: 'hockey',        type: 'team_sport',   label: 'Hockey',       group: 'sport' },
  { id: 'volleyball',    type: 'team_sport',   label: 'Volleyball',   group: 'sport' },
  { id: 'martial_arts',  type: 'combat',       label: 'Martial Arts', group: 'sport' },
  { id: 'crossfit',      type: 'other',        label: 'CrossFit',     group: 'sport' }, // unchanged — no existing fit
  { id: 'golf',          type: 'other',        label: 'Golf',         group: 'sport' }, // unchanged — no existing fit
  // 'Swimming'/'Synchronised Swimming'/'Cycling'/'Running' from the old
  // SPORT_TYPES list are dropped as separate sport rows — they're just the
  // 'training' group's swim/bike/run entries, picking them there instead
  // means the Sport Activity step's "which sport" step and the Weekly
  // Overview picker both resolve to the exact same catalog row, not two
  // different-`type` entries for the same real-world activity.
];

export function catalogByGroup(group) {
  return ACTIVITY_CATALOG.filter(a => a.group === group);
}
```

**Cross-cutting alignment fix, flagged prominently per `CLAUDE.md`** (this
changes existing behaviour beyond the Weekly Overview, same as
trail-running-support.md §B.6 flagged its one non-trail-specific change):
every `cycle`-typed entry in `scheduleGeneration.js`
(`ACTIVITY_DEFS.cycling`, `DISCIPLINE_ACTIVITY_META.bike`,
`SPORT_NAME_TO_TYPE.Cycling`) switches to `type: 'bike'`, matching
`planEngine.js`'s convention. **Practical consequence to call out in the PR
description:** any user whose Weekly Overview currently shows a
general-fitness-generated cycling session gets a colour change on that
card next time it's regenerated (purple `#9333EA` → orange `#D97706`) —
existing already-saved `activities`/`eventOverrides` entries are
untouched (no migration/backfill), this only affects newly-generated
schedules going forward, same "generation-time change, no backfill" pattern
`trail-running-support.md` used for its own cross-cutting change.

**Not touched:** `screens/GymPlanScreens.jsx`'s `DayActivitiesScreen` and
its own `ACTIVITY_TYPES` list (`GymPlanScreens.jsx:3247-3256` — the
recurring-per-weekday-activity editor reached from the Gym Hub tab, a
different screen from Weekly Overview's "+ Add session"). Out of scope per
the original ask, which named the questionnaire and the Weekly Overview
picker specifically — not expanding to a third picker without a separate
ask. Its own `cycle`-typed entry keeps that inconsistency for now.

### A.1 The Weekly Overview picker itself

`AddSessionPanel` drops its `ref_activities` fetch (`getRefActivities()`,
the `refActivities`/`activitiesLoaded` state, the `<select>`-or-free-text
fallback) entirely — no network call in this panel any more — and renders
`ACTIVITY_CATALOG` grouped under three headings matching `group`:
**Training** (Bike/Run/Swim/Gym/Conditioning), **Fitness** (Yoga/Walking/
Rowing/HIIT/Pilates/Climbing/Dancing), **Sport** (Football/Basketball/
Tennis/Rugby/Hockey/Volleyball/Martial Arts/CrossFit/Golf). Picking any
catalog entry sets `type`/`label` straight from that row — no lookup step
that could get the type wrong, by construction.

### A.2 Bike / Run / Swim keep the §B specific-type dropdown; everything else doesn't

Per the answered follow-up question: the optional "Specific type"
matrix dropdown (§B, unchanged from the first draft — Easy/Recovery/Long/
Tempo/Interval/Hill sprint/Race-pace/Technique) still appears **only** for
the `training` group's Bike/Run/Swim rows. Every other catalog entry
(Gym/Conditioning excepted, §C) is added exactly as picked — no dropdown,
no name override, no extra step. This keeps the fitness/sport rows exactly
as simple to add as they were meant to be, and avoids inventing subtype
vocabulary for activities (Yoga, Football, CrossFit, ...) where "Easy/Long/
Interval" doesn't obviously apply anyway.

### A.3 Personalized entries — the user's own onboarding answers, surfaced back

**Decision:** above the catalog groups, the panel shows a **"Yours"**
section (hidden if empty) built from the app's already-loaded
`goalsPayload` state (`App.jsx`'s top-level `goalsPayload`, currently not
threaded into `WeeklyOverviewScreen` — a new prop, flagged per `CLAUDE.md`'s
"say so explicitly" rule for anything touching shared root state):

- `goalsPayload.standingCommitments` (array of `{ label, day, time,
  countsTowardLoad }`, free-text `label` the user typed on the "Other
  regular commitments" onboarding step, `GoalsSetupScreen.jsx:917-935`) —
  each distinct `label` becomes a "Yours" chip.
- `goalsPayload.goals.find(g => g.type === 'sport_activity')?.config
  ?.sportType` — the single sport chosen on the Sport Activity step, if
  any, as one more chip (skipped if it already matches a catalog `sport`
  row by label, to avoid an exact duplicate — e.g. "Tennis" already exists
  as a catalog row and wouldn't also show under "Yours").

Each "Yours" chip resolves its `type` via `sportActivityDef()`
(`utils/scheduleGeneration.js:112-114`, unchanged, already exported) — the
same best-effort free-text-name → `type` function `standingCommitments`/
`sport_activity` sessions already resolve through when the questionnaire's
own generated schedule places them, so a "Yours" chip and the recurring
session that same commitment already generates elsewhere in the week
render with the *same* icon. Unmatched names (e.g. "Padel," not in
`SPORT_NAME_TO_TYPE`) fall to `type: 'other'`, same fallback
`sportActivityDef` already gives them today.

## B. Optional "Specific type" — unchanged from the first draft

*(No change from the previous revision — kept here for completeness.)*
A second, optional dropdown for Bike/Run/Swim rows, sourced from one flat
cross-discipline table instead of duplicating "Long"/"Easy"/etc. per
discipline:

```js
// src/data/sessionTypeMatrix.js
export const SESSION_TYPE_MATRIX = [
  { id: 'easy',      label: 'Easy',        disciplines: ['bike', 'run', 'swim'] },
  { id: 'recovery',  label: 'Recovery',    disciplines: ['bike', 'run', 'swim'] },
  { id: 'long',      label: 'Long',        disciplines: ['bike', 'run', 'swim'] },
  { id: 'tempo',     label: 'Tempo',       disciplines: ['bike', 'run', 'swim'] },
  { id: 'interval',  label: 'Interval',    disciplines: ['bike', 'run', 'swim'] },
  { id: 'hill',      label: 'Hill sprint', disciplines: ['bike', 'run'] },
  { id: 'race_pace', label: 'Race-pace',   disciplines: ['bike', 'run', 'swim'] },
  { id: 'technique', label: 'Technique',   disciplines: ['swim'] },
];

export function sessionTypesForDiscipline(discipline) {
  return SESSION_TYPE_MATRIX.filter(t => t.disciplines.includes(discipline));
}
```

Picking one sets the existing `sessionType` field (same field
`planEngine.js`-generated sessions populate, already rendered into a
session card's `detail` line by `buildWeekData`,
`WeeklyOverviewScreen.jsx:114`) — `label` stays the fixed catalog name
("Bike"/"Run"/"Swim"). Label choices deliberately overlap
`SESSION_TYPE_INTENSITY` keywords (`data/sessionDisplay.js:52-56`) so the
Sequencing Advisor's Tier 3 tag classification
(`sessionLoadEstimate.js:219-230`) still fires for a manually-added
session, same as the first draft reasoned through.

## C. Gym / Conditioning — optional name field, unchanged from the first draft

*(No change.)* Picking Gym or Conditioning shows one optional free-text
"Name" input (e.g. "Leg day," "Full Body (Gym)") instead of §B's dropdown,
defaulting to the plain "Gym"/"Conditioning" label if left blank — matters
most for Conditioning, since `utils/analytics.js`'s `repsActivityIdFor`
groups conditioning sessions by that label (`conditioning:${s.workout}`),
so "Football" and "Climbing" conditioning sessions need to stay
distinguishable to build separate reps series.

## D. Same-day numbering — disambiguating sessions that share a label

**Decision:** `handleAddSession` checks the target day's already-built
session list (`weekData[dayIdx].sessions` — every gym/event-plan/activity/
manually-added session already on that day, from `buildWeekData`) for
existing entries whose `label` exactly matches the new session's candidate
label (the catalog's fixed label, or the §C custom name). If none match,
the label is used as-is — the common case (one "Bike" a day) stays exactly
as clean as today. If one or more match, the new session's label gets a
` N` suffix, where `N` is one more than the number of existing matches —
so a second "Bike" that day becomes "Bike 2", a third "Bike 3", and so on:

```js
function withDisambiguatedLabel(candidateLabel, daySessions) {
  const matches = daySessions.filter(s => s.label === candidateLabel).length;
  return matches > 0 ? `${candidateLabel} ${matches + 1}` : candidateLabel;
}
```

This directly closes the first draft's flagged "two same-day sessions
collide" gap: `utils/sessionCompletion.js`'s `isSessionCompleted`/
`findCompletedForActivity` match a completed entry to a scheduled one by
exact `workout === label` string — once every same-day session has a
distinct label, that matching is unambiguous again, with no change needed
to `sessionCompletion.js` itself.

**Scope of this fix, kept basic per the request:**

- Only applied at the moment a new session is added via this panel —
  doesn't retroactively renumber sessions already sitting in
  `eventOverrides`/`activities` from before this change, or from
  `planEngine.js`-generated collisions (which don't happen in practice —
  the engine places at most one session per discipline per day).
- Numbers aren't reclaimed/shifted on delete — deleting "Bike 1" from a day
  that also has "Bike 2" leaves "Bike 2" as-is rather than renaming it back
  to "Bike 1". A numbering gap is harmless (labels only need to be
  *distinct* within a day for `sessionCompletion.js` to work, not
  *sequential*); actively renumbering on delete would mean rewriting
  `label` on an already-saved, possibly-already-completed session, which
  risks breaking that session's own completion match — deliberately not
  done.
- Applies uniformly to every session source this panel can create — catalog
  picks, §C's custom Gym/Conditioning name, and §A.3's "Yours" chips alike
  — one rule, no per-type special-casing.

## Edge cases handled

- **Existing `eventOverrides`/`activities` entries created before this
  change** (old `ref_activities.category` types, or `type: 'cycle'`
  cycling sessions) — untouched, no migration. `SESSION_DISPLAY` keeps
  every key it has today so old entries keep rendering exactly as before;
  they just aren't reachable from either picker going forward.
- **No `ref_activities` fetch to fail any more** in this panel —
  `overtrain.js`'s own `getRefActivities()` cache (Sequencing Advisor,
  unrelated to this panel) is unaffected.
- **A "Yours" chip whose free-text name doesn't match any
  `SPORT_NAME_TO_TYPE` entry** (e.g. "Padel") — falls to `type: 'other'`,
  same fallback behaviour the questionnaire's own generated schedule
  already gives that commitment elsewhere; not a new failure mode.
- **`goalsPayload` not yet loaded / user has no goals payload at all**
  (e.g. account mid-migration, or the legacy single-screen onboarding
  path) — the "Yours" section is simply hidden; the catalog groups render
  unaffected.
- Duration stays a free-text field (unchanged) — not part of this spec's
  scope.

## Explicitly out of scope

- `DayActivitiesScreen`'s own `ACTIVITY_TYPES` list and its `cycle` typing
  — separate screen, separate picker, not touched (§A).
- A glossary/info-button hookup for §B's specific-type picks — unlike
  event-plan sessions' `sessionType`, these won't resolve against
  `data/planGlossary.js` (discipline-specific term strings). Not needed for
  this fix.
- Rewriting `utils/sessionCompletion.js`'s matching to be id-based instead
  of label-based — §D's numbering makes labels unique in the one place
  they could collide from this panel, which is enough; a deeper rewrite of
  the matching primitive itself is still out of scope.
- Renumbering already-existing same-day duplicates, or resequencing on
  delete (§D) — deliberately basic, per the request.
- Any change to how a session is *logged* (`MarkCompleteSheet`,
  `ActivityTimerScreen`) — this spec only changes what a *scheduled*
  session is tagged with (and now numbered) before it's logged.
- `SPORT_TYPES`' `CrossFit`/`Golf` gaining a more specific `type` than
  `'other'` — no existing `SESSION_DISPLAY` entry fits either well, and
  inventing new ones is a separate design decision, not an alignment fix.

## Data model implications

None — no Supabase migration. `ref_activities` stays exactly what it is
today (the Sequencing Advisor's load-scoring reference table); the new
`ACTIVITY_CATALOG` is a static client-side data file, same pattern as the
`GENERAL_ACTIVITIES`/`ACTIVITY_DEFS`/`SPORT_TYPES` consts it replaces.
`eventOverrides`/`activities` keep their existing jsonb shapes — this spec
only changes which values the client puts into `type`/`label`/`sessionType`
when creating a session, never the storage shape.

**Decision, worth flagging explicitly since it's the more consequential of
two reasonable designs:** `ref_activities` (the actual Supabase table)
was *not* chosen as the shared catalog, even though "come from the same
table" could also have meant extending that table with a proper display
`type` column and pointing every picker at it. Reasons: (1) every picker
this spec touches is currently static/hardcoded already — moving to a
DB-backed catalog would be a bigger, riskier change than the ask required;
(2) it would need a migration (`ref_activities` gains a column, or a new
table) and RLS review, which `CLAUDE.md` flags for mandatory human review
regardless; (3) the "Yours" personalization (§A.3) is inherently
per-user data already loaded in-memory (`goalsPayload`), not reference
data, so it was never going to live in `ref_activities` regardless of
which way the rest of the catalog went. If a DB-backed catalog is actually
wanted (e.g. to manage the list without a code deploy), that's a follow-up
worth its own spec, not folded in here.

## Files this touches

- `src/data/activityCatalog.js` (new) — `ACTIVITY_CATALOG`,
  `catalogByGroup` (§A).
- `src/data/activityCatalog.test.js` (new) — Vitest coverage: every
  catalog row's `type` resolves to a real `SESSION_DISPLAY` entry (a
  regression guard for the exact bug class this spec fixes — would have
  caught the `rowing`/`hiit`/`pilates`/`climbing`/`dancing` → `'other'`
  bug on its own); `catalogByGroup` filters correctly.
- `src/data/sessionTypeMatrix.js` (new) — `SESSION_TYPE_MATRIX`,
  `sessionTypesForDiscipline` (§B, unchanged from first draft).
- `src/data/sessionTypeMatrix.test.js` (new) — Vitest coverage per §B.
- `src/utils/scheduleGeneration.js` — `ACTIVITY_DEFS` and
  `SPORT_NAME_TO_TYPE` become derived from `ACTIVITY_CATALOG` instead of
  their own literals (§A); `cycling`/`Cycling`/`DISCIPLINE_ACTIVITY_META
  .bike` switch from `type: 'cycle'` to `type: 'bike'` (flagged
  cross-cutting change, §A).
- `src/utils/scheduleGeneration.test.js` — regression coverage: a
  general-fitness-generated rowing/HIIT/pilates/climbing/dancing session
  now carries its correct `type`, not `'other'`; a general-fitness or
  sport-activity cycling session now carries `type: 'bike'`, not
  `'cycle'`.
- `src/screens/GoalsSetupScreen.jsx` — `GENERAL_ACTIVITIES`/`SPORT_TYPES`
  read from `ACTIVITY_CATALOG` instead of their own literals (§A); no
  visible change to the onboarding UI itself (same ids, same labels, same
  order preserved).
- `src/screens/WeeklyOverviewScreen.jsx` — `AddSessionPanel` (catalog-
  grouped picker UI + "Yours" section, drop the `ref_activities`
  fetch/state), `handleAddSession` (build the session from
  `type`/optional name/optional `sessionType`, apply §D's disambiguation
  before saving), drop the now-unused `getRefActivities` import
  (`checkWeek`, still used, pulls its own copy from `overtrain.js`
  internally).
- `src/App.jsx` — thread `goalsPayload` into the `WeeklyOverviewScreen`
  call (`App.jsx:1442`) as a new prop, for §A.3's "Yours" section. Called
  out explicitly per `CLAUDE.md` — this is the one change in this spec
  that touches root `App.jsx` state wiring, even though it's additive
  (an existing state value gains one more consumer, nothing about how
  `goalsPayload` itself is loaded/saved changes).
- `src/screens/WeeklyOverviewScreen.test.js` — extend coverage: a
  manually-added `type: 'bike'` session resolves to `SESSION_DISPLAY.bike`
  and the same `pace:bike` Analytics id a plan-generated bike session
  uses; `withDisambiguatedLabel`-style coverage for the numbering rule
  (§D) — second same-label session on a day gets " 2", third gets " 3",
  a session on a *different* day is unaffected.
- `tests/e2e/smoke.spec.js` — one smoke assertion: open "+ Add session,"
  pick Bike, save, confirm the bike icon renders; add a second Bike the
  same day, confirm it's labelled "Bike 2," per `tests/e2e/README.md`.
