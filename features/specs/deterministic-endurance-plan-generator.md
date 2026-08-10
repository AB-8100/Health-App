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
deterministic table lookups and arithmetic (taper length by race type,
phase-split percentages, minimum-weeks thresholds, peak volume targets,
discipline-frequency allocation, day-of-week defaults, the 10%/80-20 audits)
— none of which needs generation. This spec replaces the generation step with
a rules engine that encodes those tables as data/code, mirroring the pattern
the app already uses for gym content (`SPLITS`/`EX_LIB` in
`GymPlanScreens.jsx`) and rule-based scheduling (`utils/scheduleGeneration.js`,
`utils/raceTargets.js`), and restructures Stage 2/3 onboarding to collect
what the engine needs (and stop collecting fields nothing reads).

## Scope: the same 7 race types the reference docs define

Only **10K, Half Marathon, Marathon, Triathlon (Sprint / Olympic / 70.3 /
Full)** get a full generated event plan — these are the only race types
either reference doc defines taper/phase/volume rules for. **5K, Cycling
Sportive, Open Water Swim, and Other remain on the existing basic non-event
scheduler** (`utils/scheduleGeneration.js`), unchanged by this spec. Coverage
is revisited based on signal from the companion feedback feature
(`features/specs/feedback-entry-point.md`), not assumed here.

## User story

As an athlete training for one of the 7 supported race types, I want a
periodized, week-by-week training plan generated immediately from my
onboarding answers — no external API call, no wait, no risk of truncated or
inconsistent output — that reliably follows the same coaching rules every
time it runs.

## Acceptance criteria

### A. Stage 2 (`GoalsSetupScreen.jsx`) restructuring

1. **New per-discipline day picker**, replacing today's two disconnected
   questions (the discipline-frequency count picker inside
   `config_event_race`, and the generic 7-day `schedule_access` toggle):
   - For each discipline relevant to the goal (swim/bike/run for triathlon;
     run for running races; the chosen activities list for non-race goals),
     show a 7-day multi-select: "Which days do you want to train this?"
   - Per-discipline frequency is derived as the count of selected days — no
     separate frequency question.
   - `trainingDays` / `trainingDaysPerWeek` / `unavailableDays` — read
     outside Stage 2 by `scheduleGeneration.js`, `WeeklyOverviewScreen.jsx`,
     and `overtrain.js` — are derived as the union of all discipline-day
     selections, preserving the existing payload shape so nothing downstream
     breaks without its own review. **Flagging per `CLAUDE.md`: this touches
     shared state consumed outside this feature's scope** — call this out
     explicitly in the PR rather than changing those consumers silently.
   - One-time copy note: "Don't worry — you can change these later."
2. **Remove `poolAccess` and `poolDays` entirely.** Pool access is derived:
   `poolAccess = (swim day-selection).length > 0`; swim's selected days are
   the pool days. No standalone question. `gymAccess` stays as a plain
   toggle — unrelated, since gym has no race-discipline day question today
   (confirmed nothing else needs the same fold-in).
3. **Move baseline questions into Stage 2**, mandatory (gates `canAdvance`,
   same as `fitnessLevel` today): everything currently in Stage 3's `run` /
   `swim` / `bike` steps — `time5k`/`time10k`/`timeHalfMarathon`/
   `timeMarathon`/`longestEffortKm`, `time400m`/`longestSessionM`,
   `ftpWatts`/`longestRideKm`. This unblocks the analytics cold-start case
   (see the Data model implications note below) and lets the engine calibrate
   starting volume.
   - The existing "how many times a week do you **currently** train X"
     fields (`weeklyRunsCount`/`weeklySessionsCount`) move with the
     baselines and are kept — they are a distinct signal from the new
     target-day picker (current habit vs. target commitment) and calibrate
     how gentle the Foundation-phase ramp needs to be.
4. **Per-discipline cutoff times for triathlon** (swim/bike/run only, no
   T1/T2): extends the existing single `hasCutoffTime`/`cutoffTimeSeconds`
   into a per-discipline map, same shape as `disciplineFrequency`. Shown
   only for triathlon race types, only if the athlete confirms the race has
   cutoffs.
5. `fitnessLevel` — already collected, already mandatory — starts actually
   being read by the new engine (currently collected and unused).

### B. Stage 3 (`DeepQuestionnaireScreen.jsx`) restructuring

1. Remove the `run`/`swim`/`bike` baseline steps (moved to Stage 2, A.3).
2. **Holidays**: extend `{label, from, to}` with per-day/sub-range
   granularity within the range — at minimum, a per-day toggle between "no
   training" (defaulted for the first/last day) and "limited — pick which
   disciplines are possible" for days in between, so the engine can apply
   sea-swim substitution / running-only days instead of collapsing every
   holiday to a blanket rest block.
3. `preferences.longSessionDay` / `secondDisciplineDay` / `conditioningDay`
   stay as-is, layered on top of the per-discipline day picker (confirmed:
   picking days answers "which days train this discipline," these answer
   "which of those is the long/key one").
4. Availability (non-holiday), mindset, injury, and `pace_confirm` steps stay
   as-is.

### C. Deterministic scheduling engine (new)

1. New pure-function module (e.g. `utils/planEngine.js`) building the full
   day-by-day plan from the Stage 2/3 payload — same shape as
   `scheduleGeneration.js`/`raceTargets.js`: no I/O, fully Vitest-covered.
2. Encodes Steps 1–6 of `Triathlon_Plan_Generator_Prompt.md` as data tables
   and pure functions, not prose generation: taper length/volume-cut by race
   type, minimum/recommended weeks, phase-split percentages, peak volume
   targets, discipline-frequency-in-Foundation allocation, brick rules,
   recovery-week cadence, one-off-event handling (replace/recover/
   reschedule/absorb), holiday date mapping, and the 10%-rule/80-20-rule
   checks — computed as verifiable properties of the generated schedule, not
   a self-reported audit.
3. **Session-type content**: a library keyed by (discipline, weekly
   frequency, phase) → ordered session archetypes, with a rotation rule for
   week-to-week variety (e.g. 2 sessions/week = easy + one of
   long/interval/tempo, rotating; 3 sessions/week = easy + long + interval,
   alternating). Static data, same pattern as `SPLITS`/`EX_LIB` in
   `GymPlanScreens.jsx` — not generated per-user. Concrete pace/duration
   numbers come from the athlete's confirmed target split
   (`intake.targetPaces`) and the volume-progression formulas, not the
   library itself.
4. **Glossary** becomes a static dictionary (new `data/planGlossary.js`),
   filtered to terms actually present in the generated plan.
5. **Overview narrative** (phase breakdown, warm-up/cool-down reference,
   holiday/event summary, health note, compression warning) becomes
   sentence templates with computed values interpolated in.
6. Output shape matches the existing `{ meta, phases, sessions }` contract
   `normalizePlan` already produces (`utils/planGeneration.js`), so
   `handleUploadTrainingPlan`, Weekly Overview, and everything downstream of
   an applied plan need no changes.

### D. AI path — kept and updated, not removed

1. The existing Claude/edge-function path (`utils/planPrompt.js`,
   `utils/planGeneration.js`, `supabase/functions/generate-training-plan`)
   **stays in the codebase and stays deployed**, as a manual secondary
   option next to the new engine's output, so the two can be compared
   directly before any decision to remove it.
2. `buildAnswersBlock` in `planPrompt.js` **must** be updated to read the
   restructured Stage 2/3 payload (moved baselines, per-discipline days
   instead of frequency+generic-days, removed pool fields, per-discipline
   cutoffs) — required by this spec, not optional, since otherwise the AI
   path silently breaks the moment Stage 2/3 changes shape.
3. **Removing the AI path is explicitly out of scope for this spec** — a
   follow-up change once the new engine's output has been validated by hand
   against real plans. When that happens: keep the removal as its own
   reviewable PR (or tag the pre-removal commit) so the implementation stays
   recoverable, and add a pointer in `docs/PROJECT_CONTEXT.md` §7.4 noting
   where/why it was removed.

## Data model implications

- `user_goals` (Supabase): gains per-discipline day selections and
  per-discipline cutoff times; `pool_access`/`pool_days` columns stop being
  written (decide at implementation time whether to drop them via migration
  or leave them unused — dropping needs a migration ending in
  `select pg_notify('pgrst', 'reload schema');` per
  `docs/PROJECT_CONTEXT.md` §9).
- `user_intake` (Supabase): loses run/swim/bike baseline fields (moved to
  `user_goals`), gains structured per-day holiday data.
- No new Supabase tables required for this spec.

## Edge cases handled

- A user with an already-saved goals/intake payload from before this change
  (old shape: generic `trainingDays`, `poolDays`, Stage-3 baselines) —
  needs a read-time migration/fallback so existing users aren't blocked from
  re-entering onboarding or regenerating a plan. Concrete shape TBD at
  implementation time, but must be handled, not assumed away.
- Athlete selects zero days for a discipline that's part of their race (e.g.
  triathlon with no swim days picked) — block advancing with a clear message,
  same pattern as today's `canAdvance` gating.

## Explicitly out of scope

- Removing the AI generation path (see D.3).
- Extending generated-plan coverage to 5K / Cycling Sportive / Open Water
  Swim / Other.
- Any change to how an *uploaded* `.xlsx` plan is parsed
  (`utils/trainingPlanImport.js`) — unaffected, separate code path.
- Rebuilding `HomeScreen.jsx`'s demo dashboard.
- The feedback entry point — see `features/specs/feedback-entry-point.md`.

## Files this touches

- `src/screens/GoalsSetupScreen.jsx` — restructured steps (A).
- `src/screens/DeepQuestionnaireScreen.jsx` — removed baseline steps,
  extended holiday capture (B).
- `src/utils/planEngine.js` (new) + `src/utils/planEngine.test.js` (new) —
  the deterministic engine (C).
- `src/data/planGlossary.js` (new) — static glossary content.
- `src/utils/planPrompt.js` — updated to the new payload shape (D.2).
- `src/utils/scheduleGeneration.js` — read the derived `trainingDays`/
  `unavailableDays` shape; confirm no behaviour change for non-race goals.
- `src/utils/supabase.js` — mappers for the changed `user_goals`/
  `user_intake` shapes.
- `supabase/migrations/` — new migration(s) for the column changes above.
- `tests/e2e/smoke.spec.js` — onboarding flow assertions updated for the
  restructured steps.
- `docs/PROJECT_CONTEXT.md` §6 and §7.4 — kept in sync with the new flow
  (required reading per `CLAUDE.md`, so it must stay accurate).
