# Deterministic endurance training plan generator

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass). Kept to the same shape the automated spec pipeline produces
(see `features/PLANNING.md`) so scope decisions are explicit and reviewable,
per `CLAUDE.md`'s "do not implement a feature whose spec you have not read in
full" rule.

## Context / why

The current event-plan generator (`utils/planPrompt.js` → Supabase edge
function `generate-training-plan` → Claude API → `utils/planGeneration.js`)
asks a single LLM completion to both construct a full multi-week day-by-day
schedule *and* self-audit its own volume/intensity numbers, with no code
execution and a 32k output-token ceiling. The two source documents this was
adapted from (`Triathlon_Plan_Intake_Questionnaire.md`,
`Triathlon_Plan_Generator_Prompt.md`) are themselves almost entirely
deterministic table lookups and arithmetic — none of which needs generation.
This spec replaces the generation step with a rules engine that encodes
those tables as data/code, mirroring the pattern the app already uses for
gym content (`SPLITS`/`EX_LIB` in `GymPlanScreens.jsx`) and rule-based
scheduling (`utils/scheduleGeneration.js`, `utils/raceTargets.js`).

With AI removed from the plan-generation path, the original reason
onboarding was split into two stages no longer holds. Stage 3
(`DeepQuestionnaireScreen`) existed as a separately re-enterable, skippable
"refine your plan" step partly *because* it fed a slow, optional AI call —
its own intro copy says "five minutes," framed as an add-on you could do
later. A deterministic engine generates instantly from whatever's captured,
so there's no reason to gate part of the intake behind a second stage
transition. This spec merges Stage 2 and Stage 3 into one onboarding flow.

## Scope: the same 7 race types the reference docs define

Only **10K, Half Marathon, Marathon, Triathlon (Sprint / Olympic / 70.3 /
Full)** get a full generated event plan — the only race types either
reference doc defines taper/phase/volume rules for. **5K, Cycling Sportive,
Open Water Swim, and Other are removed from Stage 2's race-type picker
entirely** (`RACE_TYPES` in `GoalsSetupScreen.jsx`) — the picker should only
ever offer a race type that can actually produce a generated plan
end-to-end, not silently degrade to the basic scheduler with no explanation.
Coverage is revisited based on signal from
`features/specs/feedback-entry-point.md`; if a type is added back later, it
re-enters `RACE_TYPES` at the same time rules are added for it, not before.

This is scoped to the `event_race` goal type's race-type options only — the
other goal types (Strength Programme, Sport Activity, General Fitness,
Micro Target) aren't affected. They were never meant to produce a periodized
"plan" in the sense this spec means; they correctly use the existing basic
scheduler (`utils/scheduleGeneration.js`) as their intended end-to-end path,
so there's nothing dead-ended about them.

## User story

As a new user, I want one continuous onboarding flow that asks exactly what's
needed for my goal — no irrelevant questions, no duplicate questions, no
separate "advanced" stage to remember to come back to — and produces a
periodized, week-by-week plan immediately, with no external API wait.

## A. Single-stage onboarding (merges former Stage 2 + Stage 3)

1. **Merge `GoalsSetupScreen.jsx` and `DeepQuestionnaireScreen.jsx` into one
   onboarding flow.** `onboardingStage` (`App.jsx`) goes from
   `'profile' | 'goals' | 'intake' | null` to `'profile' | 'goals' | null` —
   **flagging per `CLAUDE.md`: this changes shared onboarding-routing state
   in `App.jsx`'s `renderScreen`, not just a single screen component; call
   this out explicitly in the PR rather than changing it silently.**
   `handleIntakeComplete`/`handleStartQuestionnaire` collapse into the single
   flow's completion/re-entry handlers.
2. **Skippability is preserved, reframed as an in-flow action, not a
   separate stage.** Partway through — at the point where questions stop
   being "required to get a plan at all" and start being "refinement" (i.e.
   roughly where Stage 3 used to begin: availability details, mindset,
   injury) — keep a "Skip the rest for now" exit, same as today's Stage 3
   skip. Skipping still produces a `draft`-status intake and a plan generated
   from what's already been answered (goal, discipline days, baselines) with
   sensible defaults for the rest, exactly as `EMPTY_INTAKE` defaults do
   today. Re-entering later (from About/settings) resumes the same merged
   flow at the first unanswered step, not a separate screen.
3. **Full merged step order** (goal select → rank if >1 → per-goal config →
   per-discipline day picker → availability → mindset → injury →
   pace-confirm if applicable → done). Steps are gated by goal/race type so
   irrelevant questions never show. This is simpler than originally scoped:
   once the race-type picker only offers the 7 engine-supported types (see
   "Scope" above), **every** `event_race` goal legitimately involves running
   (10K/Half/Marathon are pure running; all 4 triathlon distances include a
   run leg) — so the original bug this item was written to fix (run-baseline
   questions forced on Cycling Sportive/Open Water Swim, which have nothing
   to do with running) disappears along with those race types, rather than
   needing its own gating logic:
   - Run baseline (+ Q16, "can you run continuously for 60 min?"): shown for
     every `event_race` goal, since all 7 remaining race types need it.
   - Swim baseline, bike baseline, discipline ranking: triathlon only
     (unchanged from today's gating) — this conditional gating is still
     real and still needed.
   - Swim baseline step gains the two previously-missing reference
     questions: open-water swimming experience, and wetsuit experience.
   - Bike baseline step gains the previously-missing reference question:
     bike type (road/tri bike vs. other).
4. **Start date, asked explicitly** (reference Q3) — defaults to today,
   editable — instead of the current hardcoded `new Date().toISOString()` in
   `planPrompt.js`. Total-weeks calculation uses this instead of assuming an
   immediate start.
5. **Standing commitments gain an explicit load toggle** (reference Q19):
   "Should this count toward your training load, or sit outside it?" —
   replacing the current hardcoded assumption that every standing commitment
   is automatically outside training load.
6. **Duplicate question removed**: Stage 2's "regular sports" (`config_event_race`
   inline section / `schedule_access`'s `RegularSportsSection`) and Stage 3's
   "standing weekly commitments" ask the same thing — both use football as
   their own example. Merge into **one** list, asked once, using the
   standing-commitment shape (`{label, day, time}`) plus the new load toggle
   from A.5, since that's the shape actually read by the plan engine. Drop
   the separate `regularSports` intensity picker — the load toggle plus the
   day/time already gives the engine what it needs; if intensity turns out
   to matter for the engine's load scoring, fold it into the same entry
   rather than keeping two lists.
   - **Flagging per `CLAUDE.md`: `regularSports` is read directly by
     `utils/scheduleGeneration.js`** (the non-AI basic scheduler used for
     non-event goals) — that function needs to read the merged list under
     its new field name, or this silently breaks non-race onboarding.
7. **Per-discipline day picker** (as previously agreed): replaces the
   discipline-frequency count picker and the generic 7-day training-days
   toggle. For each discipline relevant to the goal, a 7-day multi-select —
   frequency is derived as the count of selected days. `trainingDays` /
   `trainingDaysPerWeek` / `unavailableDays` (read by
   `scheduleGeneration.js`, `WeeklyOverviewScreen.jsx`, `overtrain.js`) are
   derived as the union of all discipline-day selections. Copy note: "Don't
   worry — you can change these later."
8. **Pool access removed entirely.** `poolAccess`/`poolDays` derived from
   whether "swim" has any selected days. `gymAccess` stays a plain toggle
   (no day sub-question today; unaffected).
9. **Baselines are mandatory**, asked as part of the merged flow (not
   skippable, not deferred) — closes the analytics cold-start gap (a
   brand-new user has no `completedSessions` yet; a Stage-2-captured
   baseline gives the pace chart a starting reference point). Companion
   change needed in `features/specs/analytics-home-pace-reps.md`'s data
   model (currently "None" — will need to accept an optional baseline seed).
   **Current per-discipline frequency fields removed** (`weeklyRunsCount`,
   `swimBaseline.weeklySessionsCount`, `bikeBaseline.weeklySessionsCount`) —
   per decision, the day picker (A.7) is the single source of the *to-be*
   state the plan is built around; asking "how often do you currently do
   this" as a separate number is less relevant than it looked. The engine
   calibrates the Foundation-phase ramp from the baseline performance data
   that's being kept instead (5K/10K/half/marathon times, longest recent
   run, 400m swim time, longest swim, FTP, longest ride) — someone with no
   usable baseline times is treated as a true beginner for ramp purposes;
   someone with recent times gets ramped from wherever those times imply
   they already are.
10. **Per-discipline cutoff times for triathlon** (swim/bike/run only, no
    T1/T2) — extends the existing single `hasCutoffTime`/`cutoffTimeSeconds`
    into a per-discipline map, shown only if the athlete confirms the race
    has cutoffs.
11. **Holidays**: extend `{label, from, to}` with per-day/sub-range
    granularity within the range — a per-day toggle between "no training"
    (defaulted for first/last day) and "limited — pick which disciplines are
    possible" for days in between, so the engine can apply sea-swim
    substitution / running-only days instead of collapsing every holiday to
    a blanket rest block.
12. `preferences.longSessionDay` / `secondDisciplineDay` / `conditioningDay`
    stay, layered on top of the per-discipline day picker (picking days
    answers "which days train this discipline"; these answer "which of
    those is the long/key one").
13. `fitnessLevel` — already collected, already mandatory — starts actually
    being read by the engine (currently collected and unused).

## B. Deterministic scheduling engine (new)

1. New pure-function module (e.g. `utils/planEngine.js`) building the full
   day-by-day plan from the merged onboarding payload — same shape as
   `scheduleGeneration.js`/`raceTargets.js`: no I/O, fully Vitest-covered.
2. Encodes Steps 1–6 of `Triathlon_Plan_Generator_Prompt.md` as data tables
   and pure functions: taper length/volume-cut by race type,
   minimum/recommended weeks, phase-split percentages, peak volume targets,
   discipline-frequency-in-Foundation allocation, brick rules, recovery-week
   cadence, one-off-event handling (replace/recover/reschedule/absorb),
   holiday date mapping (now day-granular per A.11), and the
   10%-rule/80-20-rule checks — computed as verifiable properties of the
   generated schedule, not a self-reported audit.
3. **Session-type content**: three separate libraries — one each for run,
   swim, bike — keyed by (weekly frequency, phase) → ordered session
   archetypes, with a rotation rule for week-to-week variety. Not a shared
   generic table: each discipline has its own vocabulary, taken from the
   reference doc's own Glossary tab requirements —
   run (strides, tempo, fartlek, race pace, easy/recovery, long run), swim
   (technique drills, build sets, sighting practice, open water/dress
   rehearsal, pyramid sets, kick sets), bike (spin-ups, tempo, hill repeats,
   hard/easy intervals, race effort). Static data, same pattern as
   `SPLITS`/`EX_LIB` — not generated per-user. Concrete pace/duration
   numbers come from the athlete's confirmed target split
   (`intake.targetPaces`) and the volume-progression formulas.
4. **Glossary** becomes a static dictionary (new `data/planGlossary.js`),
   filtered to terms actually present in the generated plan.
5. **Overview narrative** (phase breakdown, warm-up/cool-down reference,
   holiday/event summary, health note, compression warning) becomes
   sentence templates with computed values interpolated in.
6. Output shape matches the existing `{ meta, phases, sessions }` contract
   `normalizePlan` already produces, so `handleUploadTrainingPlan`, Weekly
   Overview, and everything downstream of an applied plan need no changes.

## C. Surfacing the plan's own content in the app (new — closes a gap the original review flagged and this spec had dropped)

Today, `meta.overview`, `glossary`, and the audit output are normalized and
stored on the plan object but **never rendered anywhere** — confirmed by
grep across every screen; only `meta.eventDistances` is ever displayed
(`AboutScreen.jsx:679,802`). Making generation deterministic doesn't fix that
by itself — it just means the content being thrown away is now guaranteed
correct instead of possibly-hallucinated. This spec must also surface it:

1. A reachable "Plan overview" view (extending `AboutScreen.jsx`'s existing
   plan section, or a new detail screen off `WeeklyOverviewScreen.jsx`'s
   `PhaseBar`) showing: the phase breakdown with calendar date ranges, the
   warm-up/cool-down reference, the holiday/one-off-event adjustments
   summary, the health note (if injury/health data was declared), and the
   compression warning (if total weeks fell short of recommended).
2. **A short plan-mix summary**, distinct from the logistics content in C.1
   — a few plain-language sentences explaining the actual session-type
   methodology the engine applied for this athlete, generated from the same
   rotation choices the engine used to build the schedule (B.3), not a
   separate prose-writing step. E.g. *"Your 3 runs a week mix an easy run
   with a long run and a rotating interval/tempo session, alternating week
   to week. Bike builds from easy spin + tempo toward hill repeats as you
   move into Build. Swim stays technique-focused through Foundation, adding
   pyramid sets and open-water sessions from Build onward."* Shown at the
   top of the same "Plan overview" view.
3. **The glossary, accessible in two places**, both filtered to terms
   present in the athlete's actual plan:
   - The full list in the About Me / `AboutScreen.jsx` plan section
     (expandable list, term + plain-English description).
   - A contextual info affordance on individual session cards themselves —
     `SessionDetailScreen.jsx`'s existing session rows (next to the "Start
     session" / "✓ Record" / "↕ Shift position in future weeks" actions
     confirmed in that file) get a small info icon that shows just that
     session's own term definition (e.g. tapping the icon on a "Tempo run"
     card shows the tempo-run definition inline), rather than sending the
     athlete away to the full list. Same treatment for the equivalent
     session summaries in `WeeklyOverviewScreen.jsx` if that screen also
     renders per-session labels needing definition.
4. The 10%-rule/80-20-rule results — no longer a self-reported "audit" since
   they're computed properties of the schedule, but still worth surfacing as
   a short "plan health" summary (e.g. "Weekly volume stays within the 10%
   guideline except 2 weeks — both after a holiday, which is expected") so
   the athlete can see the plan is sound, not just trust it silently.

## D. AI path — moved out of the onboarding flow, validated externally, then removed

1. Onboarding's completion step always uses the deterministic engine — no
   button, no choice, no wait state, since generation is now instant. The
   "Generate my plan with AI" UI (`canGenerate`/`aiGen` state in the current
   `DeepQuestionnaireScreen`) is removed from onboarding entirely, and **no
   equivalent UI is added anywhere else in the app** — confirmed: no
   AboutScreen entry, no dev-panel toggle.
2. Validation against the old AI path happens **outside the app**, as a
   one-off development/QA activity, not a shipped feature: a small
   standalone script feeds a handful of representative sample intake
   payloads (covering each of the 7 supported race types, plus edge cases —
   holidays, one-off events, injuries) through both the existing
   `buildPlanPrompt`/edge-function path and the new `planEngine.js`, and
   dumps both outputs for side-by-side review. Nothing end users can reach.
3. The existing Claude/edge-function code (`utils/planPrompt.js`,
   `utils/planGeneration.js`, `supabase/functions/generate-training-plan`)
   stays in the codebase and stays deployed only long enough to run that
   comparison script against it — not because anything in the shipped app
   calls it anymore.
4. `buildAnswersBlock` in `planPrompt.js` still needs updating to read the
   merged onboarding payload shape, since the comparison script needs it to
   keep producing valid prompts during the trial.
5. Once the engine's output has been validated against the comparison runs,
   actual removal (edge function, `ANTHROPIC_API_KEY` secret,
   `planPrompt.js`/`planGeneration.js`, the comparison script) is its own
   follow-up PR — tag the pre-removal commit, and add a pointer in
   `docs/PROJECT_CONTEXT.md` §7.4 noting where/why it was removed.

## Data model implications

- `user_goals`: gains per-discipline day selections, per-discipline cutoff
  times, the merged standing-commitments/regular-sports list, start date;
  loses `pool_access`/`pool_days`.
- `user_intake`: gains baseline fields moving up from being optional
  (mandatory now) plus Q7/Q8/Q10/Q16 answers and the day-granular holiday
  shape; the two tables likely still exist as separate Supabase tables even
  though they're now filled from one screen flow (goals-shaped vs.
  intake-shaped data is still logically distinct) — **flagging as a decision
  to confirm**: keep two tables written from one flow, or actually merge
  them into one table now that there's no longer a stage boundary between
  them? Recommend keeping two tables (smaller migration, no behaviour change
  for anything else reading `user_goals`/`user_intake` independently) unless
  you'd rather collapse them.
- `analytics-home-pace-reps.md`: needs a follow-up amendment so its
  "Data model implications: None" accepts an optional Stage-2 baseline seed
  point (see A.9).
- No new Supabase tables required for this spec.

## Edge cases handled

- Existing users with a saved payload in the old two-stage shape (generic
  `trainingDays`, `poolDays`, separate `regularSports` list, Stage-3-only
  baselines) need a read-time fallback so they aren't blocked from
  re-entering onboarding or regenerating a plan — concrete shape TBD at
  implementation time, but must be handled, not assumed away.
- Athlete selects zero days for a discipline that's part of their race
  (e.g. triathlon with no swim days) — block advancing with a clear message,
  same pattern as today's `canAdvance` gating.
- A goal combination with no race at all (e.g. general fitness only) skips
  every race-specific step (baselines, cutoffs, discipline ranking,
  pace-confirm) automatically via the existing gating pattern.
- Existing users whose saved `event_race` goal has a now-removed race type
  (5K, Cycling Sportive, Open Water Swim, Other) — don't hard-block them.
  They keep working on the existing basic scheduler exactly as today (that
  behaviour genuinely doesn't change for them); they just can't newly select
  one of these types going forward, since the picker no longer offers it. If
  they redo their goals, they need to pick one of the 7 supported types to
  get a generated plan.

## Explicitly out of scope

- Deleting the AI generation code (see D.4).
- Re-adding 5K / Cycling Sportive / Open Water Swim / Other as race-type
  options before rules exist for them (see "Scope").
- Reference Q24 ("which regular session a one-off event replaces") staying
  un-asked — left for the engine to infer deterministically from the
  existing schedule, since it doesn't need the athlete to state it.
- Reference Q10 bike-type answer changing any actual scheduling logic beyond
  being captured and shown back to the athlete — no aero/positioning
  coaching content in this spec.
- More robust baseline testing (e.g. a proper Critical Swim Speed protocol,
  a structured running threshold/time-trial test, an equivalent bike test)
  instead of relying on self-reported PB times — logged as a future idea in
  `features/ideas.md`, not designed here.
- Any change to how an *uploaded* `.xlsx` plan is parsed
  (`utils/trainingPlanImport.js`) — unaffected, separate code path.
- Rebuilding `HomeScreen.jsx`'s demo dashboard.
- The feedback entry point — see `features/specs/feedback-entry-point.md`.

## Files this touches

- `src/screens/GoalsSetupScreen.jsx` — becomes the single merged onboarding
  screen (absorbs `DeepQuestionnaireScreen.jsx`'s steps).
- `src/screens/DeepQuestionnaireScreen.jsx` — removed, folded into the above.
- `src/App.jsx` — `onboardingStage` routing collapses from three values to
  two; `handleIntakeComplete`/`handleStartQuestionnaire` merge.
- `src/utils/planEngine.js` (new) + `src/utils/planEngine.test.js` (new).
- `src/data/planGlossary.js` (new).
- `src/screens/AboutScreen.jsx` — plan overview/plan-mix summary/glossary
  list/plan-health surface (C).
- `src/screens/WeeklyOverviewScreen.jsx` — possible entry point into the new
  plan-overview view from `PhaseBar` (C); per-session glossary info icon if
  this screen also renders per-session labels needing definition.
- `src/screens/SessionDetailScreen.jsx` — per-session glossary info icon
  next to the existing "Start session"/"✓ Record"/"Shift position" actions
  (C.3).
- `src/utils/planPrompt.js` — updated to the merged payload shape, kept live
  only for the external comparison script during the trial (D.4).
- *(dev-only, not shipped)* a standalone comparison script run during the
  trial (D.2) — not part of the app build; exact location/whether it's
  checked in at all is an implementation-time call, not a spec requirement.
- `src/utils/scheduleGeneration.js` — reads the derived `trainingDays`/
  `unavailableDays` shape and the merged standing-commitments list.
- `src/utils/supabase.js` — mappers for the changed `user_goals`/
  `user_intake` shapes.
- `supabase/migrations/` — new migration(s) for the column changes above.
- `tests/e2e/smoke.spec.js` — onboarding flow assertions updated for the
  merged, single-stage flow.
- `docs/PROJECT_CONTEXT.md` §6 and §7.4 — kept in sync (required reading per
  `CLAUDE.md`, so it must stay accurate — the §6 "3-stage flow" description
  becomes a 2-stage description).
- `features/specs/analytics-home-pace-reps.md` — follow-up amendment for the
  baseline-seed data model change (A.9).
