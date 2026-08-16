# Weekly Overview "+ Add session" — activity matrix

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass). Kept to the same shape the automated spec pipeline produces
(see `features/PLANNING.md`) so scope decisions are explicit and reviewable,
per `CLAUDE.md`'s "do not implement a feature whose spec you have not read in
full" rule.

## Context / why

Investigation of a user bug report (session: same conversation, prior turn)
found that the Weekly Overview's "+ Add session" panel
(`AddSessionPanel`/`handleAddSession`, `src/screens/WeeklyOverviewScreen.jsx:362-467,678-696`)
lets the user pick from every row in the Supabase `ref_activities` table and
stores that row's `category` column directly as the new session's `type`:

```js
const typeKey = SESSION_DISPLAY[category] ? category : 'other';
```

`ref_activities.category` is a coarse **training-load bucket**
(`endurance`, `team_sport`, `water_sport`, `mobility`, ...) used by
`utils/overtrain.js`/`utils/sessionLoadEstimate.js` for load-conflict
scoring — every cycling row in the seed data
(`supabase/seeds/forma_seed_data.json`) is tagged `category: "endurance"`,
same as running, rowing, and hiking. Two consequences, both confirmed by
reading the code (not just the symptom):

1. **Wrong icon/colour.** `getSessionDisplay`/`SESSION_DISPLAY`
   (`src/data/sessionDisplay.js`) key their emoji/colour lookup by `type`.
   A manually-added "Cycling (moderate ride)" gets `type: 'endurance'` →
   the 🏃 running icon on blue (`#0090FF`), not the 🚴 bike icon on orange
   (`#D97706`) an event-plan-generated bike session gets (`type: 'bike'`,
   set directly by `utils/planEngine.js`).
2. **Analytics under- or mis-counts it.** `utils/analytics.js`'s pace
   charts group by `type` (`pace:${type}`) — a session tagged `endurance`
   builds its own separate "Endurance" bucket instead of merging into the
   "Bike" bucket the user's other bike sessions build up, so logged
   progress on manually-added rides looks disconnected from (or missing
   from) the real bike pace trend.

The fix agreed with the user: stop sourcing the picker from
`ref_activities` (a load-scoring table, never meant to double as a
display-type/analytics-type source) and instead offer exactly the
discipline set the questionnaire's plan engine already produces — **Bike,
Run, Swim, Gym, Conditioning** — so a manually-added session always carries
one of the same `type` values `planEngine.js` generates, with no separate
mapping step to get wrong. An optional second dropdown lets the user note
*what kind* of bike/run/swim session it was (easy, long, interval, ...)
without reintroducing a type that competes with the fixed discipline value.

## User story

As a user adding a one-off session to my Weekly Overview, I want to pick
from the same simple activity types my training plan already uses (Bike,
Run, Swim, Gym, Conditioning), and optionally say what kind of effort it
was, so the session gets the right icon and correctly contributes to my
Analytics pace charts — the same as a session my plan generated.

## A. Activity picker — five fixed options, no more `ref_activities` query

**Decision:** `AddSessionPanel` drops its `ref_activities` fetch
(`getRefActivities()`, the `refActivities`/`activitiesLoaded` state, and the
`<select>`-or-free-text-fallback rendering) entirely and replaces it with a
fixed button row, styled like the panel's existing Day picker
(`AddSessionPanel`, `WeeklyOverviewScreen.jsx:396-409`):

```js
const ACTIVITY_TYPES = [
  { type: 'bike',         label: 'Bike' },
  { type: 'run',          label: 'Run' },
  { type: 'swim',         label: 'Swim' },
  { type: 'gym',          label: 'Gym' },
  { type: 'conditioning', label: 'Conditioning' },
];
```

These five `type` values are exactly what they need to be for every
downstream consumer to already do the right thing with no further change:

- `SESSION_DISPLAY['bike'|'run'|'swim'|'gym'|'conditioning']`
  (`data/sessionDisplay.js:8-25`) already has a correct emoji/colour entry
  for each — identical to what an event-plan-generated session of that type
  gets.
- `utils/analytics.js`'s `DISCIPLINE_FOR_TYPE`/`SPEED_TYPES`/pace-bucketing
  already treat `'bike'`/`'run'`/`'swim'` as first-class discipline keys —
  a manually-added bike ride now buckets into the exact same `pace:bike`
  series an event-plan bike session does.
- `SessionDetailScreen.jsx`'s `isGymType`/`isConditioning` checks
  (`SessionDetailScreen.jsx:387-389`, matching on `sess.type`) already give
  a `type: 'gym'` or `type: 'conditioning'` manual session the same
  exercise-picker treatment ("Plan exercises" / pick-exercises-then-start)
  a conditioning session gets anywhere else in the app — this already
  works today for the rare case where `ref_activities.category` happened
  to be `'gym'`/`'conditioning'`; after this change it works every time a
  user picks those types, not by accident.
- `utils/sessionLoadEstimate.js`'s Tier 4 fallback
  (`FALLBACK_LOAD.cardio/leg/upper`, keyed by exactly
  `swim/bike/run/conditioning/gym`) already resolves a session with no
  `ref_activities` name-match by its `type` — this is the same fallback
  path event-plan sessions already go through today (their `label` is
  always the fixed "Bike"/"Run"/"Swim" string too, which also never
  exact-matches a `ref_activities.name` row), so manually-added sessions
  now get **identical** Sequencing Advisor treatment to plan-generated
  ones, not degraded treatment.

**Removed, not replaced:** the free-text fallback input that appeared when
`ref_activities` was empty/unreachable. With no network call in this panel
any more, that failure mode no longer exists.

## B. Optional "Specific type" — a small cross-discipline matrix, not a per-activity table

**Decision:** a second, optional dropdown appears **only when Bike, Run, or
Swim is selected** (Gym/Conditioning skip straight to the exercise-picker
flow downstream, per §A, so a sub-type dropdown for those two would have no
consumer). Its options come from one flat table — the "matrix" the user
asked for — where each row is a single generic effort-type label and a set
of which disciplines it applies to, so e.g. "Long" is defined once and
reused for bike and run rather than duplicated as "Long ride" / "Long run"
entries:

```js
// New: src/data/sessionTypeMatrix.js
export const SESSION_TYPE_MATRIX = [
  { id: 'easy',      label: 'Easy',       disciplines: ['bike', 'run', 'swim'] },
  { id: 'recovery',  label: 'Recovery',   disciplines: ['bike', 'run', 'swim'] },
  { id: 'long',      label: 'Long',       disciplines: ['bike', 'run', 'swim'] },
  { id: 'tempo',     label: 'Tempo',      disciplines: ['bike', 'run', 'swim'] },
  { id: 'interval',  label: 'Interval',   disciplines: ['bike', 'run', 'swim'] },
  { id: 'hill',      label: 'Hill sprint',disciplines: ['bike', 'run'] },
  { id: 'race_pace', label: 'Race-pace',  disciplines: ['bike', 'run', 'swim'] },
  { id: 'technique', label: 'Technique',  disciplines: ['swim'] },
];

export function sessionTypesForDiscipline(discipline) {
  return SESSION_TYPE_MATRIX.filter(t => t.disciplines.includes(discipline));
}
```

Picking one sets the session's existing `sessionType` field — the same
field `planEngine.js`-generated sessions already populate
(`sessionType: archetype.sessionType`, `planEngine.js:327` etc.) and that
`buildWeekData` already renders into a session card's `detail` line
(`detail: [s.sessionType, s.duration, s.flag].filter(Boolean).join(' · ')`,
`WeeklyOverviewScreen.jsx:114`) — no new display wiring needed. `label`
stays the fixed discipline name ("Bike"/"Run"/"Swim") from §A; the effort
type is carried in `sessionType` exactly like a plan-generated session's
"Bike" card carries `sessionType: 'Tempo ride'` separately from its
"Bike" label.

**Label choices deliberately overlap `SESSION_TYPE_INTENSITY` keywords**
(`data/sessionDisplay.js:52-56`, used by the Sequencing Advisor's Tier 3
tag classification, `sessionLoadEstimate.js:219-230`) where possible —
"Easy"/"Recovery"/"Tempo"/"Interval"/"Hill sprint"/"Race-pace" each contain
one of that table's substrings, so a manually-added session with one of
those picked gets the same tag-based load classification a matching
event-plan session would. "Long" and "Technique" don't match any existing
keyword and fall through to the Tier 4 fallback (§A) — a graceful
degradation, not a break; not worth contorting the label text (e.g. "Long
run"/"Long ride") to force a match, since that would reintroduce the
per-discipline duplication this matrix exists to avoid.

This table is intentionally small and hand-picked, not derived from
`data/planGlossary.js`'s existing per-discipline term list (e.g. "Easy
run" / "Easy spin" as distinct terms) — that list is discipline-specific
by design (feeds the plan glossary info-button's exact-string lookup,
`SessionDetailScreen.jsx`'s `findGlossaryEntry`) and reusing it here would
reintroduce exactly the "one row per discipline" duplication being
removed. No glossary hookup for this dropdown's picks — out of scope, see
below.

## C. Gym / Conditioning — optional name field instead of a sub-type dropdown

**Decision:** when Gym or Conditioning is selected, the panel shows one
optional free-text input ("Name — optional, e.g. Leg day, Football") in
place of the §B dropdown, defaulting to the plain "Gym"/"Conditioning"
label if left blank:

- Matches the existing comment in `SessionDetailScreen.jsx:383-386`
  describing exactly this pattern for a manually-added one-off "gym-typed"
  session (`"Full Body (Gym)"`/`"Leg Day (Gym)"`).
- For Conditioning specifically, this also matters for Analytics:
  `utils/analytics.js`'s `repsActivityIdFor` groups conditioning sessions
  by their `workout` label (`conditioning:${s.workout}`), e.g. "Football"
  vs "Climbing" stay separate reps series — a fixed "Conditioning" label
  for every conditioning session would collapse them all into one bucket,
  which is worse than today's behaviour, not neutral. Gym-type sessions
  don't have this concern (`repsActivityIdFor` always returns the single
  `'gym'` id regardless of label), so the field is cosmetic there, but
  offered for both types for a consistent form.

## Edge cases handled

- **Two same-day sessions of the same discipline with no distinguishing
  name** (this spec's own trigger case — a second "Bike" added on a day
  that already has a plan "Bike" session) — `utils/sessionCompletion.js`'s
  `isSessionCompleted`/`findCompletedForActivity` match a completed entry
  to a scheduled one by exact `workout === label` string, with no
  awareness of `sessionType`. Two "Bike" cards on the same day (one from
  the plan, one manually added, both left at the default label) can
  therefore both resolve to whichever one gets logged first. **This is a
  pre-existing limitation of the label-matching design, not a regression
  introduced here** — a plan-generated "Bike" and a second plan-generated
  "Bike" would collide identically today if that ever happened, and even
  today's `ref_activities`-sourced labels weren't guaranteed unique
  (picking "Cycling (moderate ride)" twice in one day collides the same
  way). Not fixed in this pass — a real fix means teaching
  `sessionCompletion.js` to match by id/index instead of label, which is a
  bigger change than this spec's scope and affects every session source,
  not just manually-added ones. Flagging here so it's a known, accepted
  trade-off rather than a silent gap.
- **Existing `eventOverrides` entries created before this change** (any
  `type` value from the old `ref_activities.category` list — `endurance`,
  `team_sport`, `water_sport`, etc.) — untouched. This is a UI-input-surface
  change only, no data migration: `SESSION_DISPLAY` keeps every category
  key it has today so old entries keep rendering exactly as before; they
  just can't be *created* that way going forward.
- **No `ref_activities` fetch to fail any more** in this panel — the
  previous "table unreachable → fall back to free text" branch is removed
  because there's nothing to fail; `overtrain.js`'s own `getRefActivities()`
  cache (used by the Sequencing Advisor, unrelated to this panel) is
  unaffected.
- Duration stays a free-text field (unchanged) — not part of this spec's
  scope.

## Explicitly out of scope

- `screens/GymPlanScreens.jsx`'s `DayActivitiesScreen`
  (`ACTIVITY_TYPES` at `GymPlanScreens.jsx:3247-3256`, its own broader
  gym/run/walk/swim/yoga/hike/cycle/other list for recurring per-weekday
  activities) and `utils/scheduleGeneration.js`'s `ACTIVITY_DEFS`
  (used by onboarding's `general_fitness`/`sport_activity` auto-schedule,
  broader still — yoga/hiit/walking/pilates/climbing/dancing) are
  **separate pickers, not touched**. Both already have their own
  `type` conventions (some use `'cycle'` instead of `'bike'` — a
  pre-existing inconsistency, also out of scope) and are out of scope per
  the user's request, which named the Weekly Overview's "+ Add session"
  panel specifically. Not expanding this simplification to them without a
  separate ask.
- Reconciling the `'bike'` (planEngine) vs `'cycle'` (`ACTIVITY_DEFS`,
  `DayActivitiesScreen`) naming split across the codebase — noted above,
  not fixed here; `utils/analytics.js` already treats both as the same
  discipline (`SPEED_TYPES`, `DISCIPLINE_FOR_TYPE`) so this split causes
  no user-visible bug today, just inconsistent internal naming.
- A glossary/info-button hookup for the §B specific-type picks (unlike
  event-plan sessions' `sessionType`, these won't resolve against
  `data/planGlossary.js` since that list's terms are discipline-specific
  strings, e.g. "Easy run" not "Easy"). Not needed for this fix; a future
  spec can add one if the info-icon UX is wanted here too.
- Rewriting `utils/sessionCompletion.js`'s label-based matching to be
  collision-proof (see Edge cases above) — a larger, cross-cutting change
  outside this spec's scope.
- Any change to how a session is *logged* (`MarkCompleteSheet`,
  `ActivityTimerScreen`) — this spec only changes what a *scheduled*
  manually-added session is tagged with before it's logged.

## Data model implications

None. `eventOverrides` (Supabase `training_plans.overrides`, jsonb) already
stores arbitrary `{ type, label, sessionType, duration, flag, done,
source }` session objects — this spec changes which values the client
puts in `type`/`label`/`sessionType` when creating one from this panel, not
the shape or storage location. No migration.

## Files this touches

- `src/screens/WeeklyOverviewScreen.jsx` — `AddSessionPanel` (rewritten
  picker UI, drop the `ref_activities` fetch/state), `handleAddSession`
  (build the session from `type`/optional name/optional `sessionType`
  instead of a `category` lookup), drop the now-unused `getRefActivities`
  import (`checkWeek`, still used, pulls its own copy from `overtrain.js`
  internally).
- `src/data/sessionTypeMatrix.js` (new) — the `SESSION_TYPE_MATRIX` table
  and `sessionTypesForDiscipline` helper (§B).
- `src/data/sessionTypeMatrix.test.js` (new) — Vitest coverage:
  `sessionTypesForDiscipline` filters correctly per discipline (e.g. `'hill'`
  excluded for swim, `'technique'` only for swim).
- `src/screens/WeeklyOverviewScreen.test.js` — extend `buildWeekData`/
  `handleAddSession`-adjacent coverage: a manually-added `type: 'bike'`
  session resolves to `SESSION_DISPLAY.bike`'s emoji/colour and is
  discoverable by `utils/analytics.js`'s `getActivityOptions` under the
  same `pace:bike` id a plan-generated bike session uses (integration-style
  check across the two modules, matching how the original bug was
  diagnosed).
- `tests/e2e/smoke.spec.js` — one smoke assertion: open "+ Add session",
  pick Bike, optionally pick a specific type, save, confirm the new
  session card renders the bike icon (not the previous default/other
  icon), per `tests/e2e/README.md`.
