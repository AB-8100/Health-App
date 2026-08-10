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
Open Water Swim, and Other remain on the existing basic non-event scheduler**
(`utils/scheduleGeneration.js`), unchanged by this spec. Coverage is
revisited based on signal from `features/specs/feedback-entry-point.md`.

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
   irrelevant questions never show — this fixes a concrete bug in the
   current flow, where `DeepQuestionnaireScreen.buildSteps` shows the full
   run-baseline step (`isRaceGoal`) for *any* `event_race` goal, including
   Cycling Sportive and Open Water Swim, which have nothing to do with
   running:
   - Run baseline (+ Q16, "can you run continuously for 60 min?", for
     running-appropriate goals only): shown for running races and
     triathlon, **not** Cycling Sportive/Open Water Swim/Other.
   - Swim baseline, bike baseline, discipline ranking: triathlon only
     (unchanged from today's gating).
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
   Current per-discipline frequency ("how many times a week do you
   *currently* train X") stays, distinct from the target-day picker in A.7 —
   it calibrates how gentle the Foundation-phase ramp needs to be, not day
   placement.
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
3. **Session-type content**: a library keyed by (discipline, weekly
   frequency, phase) → ordered session archetypes, with a rotation rule for
   week-to-week variety. Static data, same pattern as `SPLITS`/`EX_LIB` —
   not generated per-user. Concrete pace/duration numbers come from the
   athlete's confirmed target split (`intake.targetPaces`) and the
   volume-progression formulas.
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
2. The glossary, filtered to terms present in the athlete's actual plan,
   shown from the same view (expandable list, term + plain-English
   description).
3. The 10%-rule/80-20-rule results — no longer a self-reported "audit" since
   they're computed properties of the schedule, but still worth surfacing as
   a short "plan health" summary (e.g. "Weekly volume stays within the 10%
   guideline except 2 weeks — both after a holiday, which is expected") so
   the athlete can see the plan is sound, not just trust it silently.

## D. AI path — moved out of the onboarding flow, kept only for manual comparison

1. Onboarding's completion step always uses the deterministic engine — no
   button, no choice, no wait state, since generation is now instant. The
   "Generate my plan with AI" UI (`canGenerate`/`aiGen` state in the current
   `DeepQuestionnaireScreen`) is removed from onboarding entirely.
2. The existing Claude/edge-function code
   (`utils/planPrompt.js`, `utils/planGeneration.js`,
   `supabase/functions/generate-training-plan`) **stays in the codebase and
   stays deployed** for now, but only as a manually-triggered comparison
   path (e.g. a "Regenerate with AI (experimental)" action in `AboutScreen`,
   gated behind the dev `TweaksPanel` or similar) — used solely to validate
   the deterministic engine's output against it before the follow-up removal
   PR. **Flagging as an assumption to confirm**: this is my interpretation
   of "removed" for planning purposes — actual deletion of the AI code is
   still a separate follow-up once validated, per the earlier decision; if
   you'd rather the comparison path not exist in the UI at all during the
   trial (e.g. run manually via a script instead), say so and I'll drop D.2.
3. `buildAnswersBlock` in `planPrompt.js` still needs updating to read the
   merged onboarding payload shape, since it stays live for comparison.
4. Actual removal (edge function, secret, `planPrompt.js`/`planGeneration.js`,
   any comparison UI) is its own follow-up PR once you've validated the
   engine by hand — tag the pre-removal commit, and add a pointer in
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

## Explicitly out of scope

- Deleting the AI generation code (see D.4).
- Extending generated-plan coverage to 5K / Cycling Sportive / Open Water
  Swim / Other.
- Reference Q24 ("which regular session a one-off event replaces") staying
  un-asked — left for the engine to infer deterministically from the
  existing schedule, since it doesn't need the athlete to state it.
- Reference Q10 bike-type answer changing any actual scheduling logic beyond
  being captured and shown back to the athlete — no aero/positioning
  coaching content in this spec.
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
- `src/screens/AboutScreen.jsx` — plan overview/glossary/plan-health surface
  (C); AI comparison trigger if D.2 is confirmed.
- `src/screens/WeeklyOverviewScreen.jsx` — possible entry point into the new
  plan-overview view from `PhaseBar` (C).
- `src/utils/planPrompt.js` — updated to the merged payload shape (D.3).
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
