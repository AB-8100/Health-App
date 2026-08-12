# Trail Running Support

Status: Draft — technical spec derived from `El Jefe`'s product spec
("Feature Spec: Trail Running Support in Forma", 2026-08-12) plus a read of
the current codebase. Kept to the same shape the project's other specs use
(`features/specs/deterministic-endurance-plan-generator.md`,
`features/specs/analytics-home-pace-reps.md`) so scope decisions are
explicit and reviewable, per `CLAUDE.md`'s "do not implement a feature whose
spec you have not read in full" rule. **This document is the spec an
implementing session should read in full before writing any code.**

This is a *translation*, not a re-scoping: the product spec's Goals/
Non-Goals/P0 requirements are authoritative. What follows maps each of them
onto specific files, functions, and data shapes that already exist in this
codebase, and flags every place a genuinely new decision had to be made to
do that mapping (marked **Decision:**).

## Context — how this fits what's already built

Forma already has a fully-built deterministic plan engine
(`src/utils/planEngine.js`, see
`features/specs/deterministic-endurance-plan-generator.md`) that builds
periodized plans for 10K / Half Marathon / Marathon / 4 triathlon distances
from a merged onboarding payload (`GoalsSetupScreen.jsx`), and a generic
session-logging layer (`ActivityTimerScreen` in `GymSessionScreen.jsx`) that
already lets a user optionally log distance on any non-gym session,
independent of what the plan prescribed. Most of what the product spec asks
for is a **new plan-generation code path plus onboarding steps that produce
its input**, not new logging or cross-sport-load infrastructure — that
infrastructure is type-driven and already generic. The single most important
implementation decision in this document is in §B.0: trail sessions reuse
`type: 'run'` so they fall through every existing `run`-aware code path
(display, load-engine matching, pace analytics, session completion) for
free, rather than introducing a new session `type` that would need each of
those touched individually.

## Scope for this pass

This spec covers **P0 only** (product spec's "Must-Have" items 1–5),
matching the product spec's own recommended phasing ("Phase 1: Trail Running
as a discipline, time-on-feet plan generation, optional km logging,
load-engine integration, strength/stability sessions"). P1 (manual session
controls parity, nutrition/hydration prompt, elevation field, onboarding
explainer copy) and P2 (GPX import, race-taper plans, terrain-aware effort,
Strava) are **explicitly out of scope** — see that section. Don't build them
in this pass; a future spec picks them up once P0 has shipped and been used.

## A. Onboarding — new goal type, not a toggle on an existing one

**Decision:** Trail Running is a new entry in `GOAL_TYPES`
(`src/screens/GoalsSetupScreen.jsx:43`), not a new `RACE_TYPES` entry
(`GoalsSetupScreen.jsx:55`, backed by `SUPPORTED_RACE_TYPES` in
`planEngine.js:37`). The product spec's user story is explicit about this
("select 'Trail Running' as a distinct discipline (not a toggle on road
running)"), and mechanically the two pickers mean different things: every
`RACE_TYPES` entry funnels into the same date-to-race arithmetic (taper
length, phase-split-by-race-date, a fixed race day). Trail running has no
race date in this spec (P0 is base-building only, no taper) — its "how long
is this plan" input is a direct 12–16 week choice, not a race-date
subtraction. Forcing it through the `RACE_TYPES`/`config_event_race` path
would mean threading a fake race date through taper logic that's explicitly
a Non-Goal.

1. **New goal type** in `GOAL_TYPES`:
   ```js
   { id: 'trail_running', label: 'Trail Running', sub: 'Time-on-feet base building for trail racing', icon: '⛰️' },
   ```
2. **New default config** in `DEFAULT_CONFIG`:
   ```js
   trail_running: { startDate: '', planWeeks: 12, fitnessLevel: '' },
   ```
   `planWeeks` is a direct integer in `[12, 16]` (P0 acceptance criterion:
   "Generated plan length is configurable within 12–16 weeks") — a row of 5
   selectable buttons (12/13/14/15/16), same visual pattern
   `FITNESS_LEVELS`/`RACE_TYPES` already use (`GoalsSetupScreen.jsx:595–630`
   for the existing button-row pattern to copy). No race date, no target
   time, no cutoff time — none of those apply to a base-building plan with
   no race attached.
3. **New config step** `config_trail_running`, added to `buildSteps()`
   (`GoalsSetupScreen.jsx:210`) automatically since it iterates
   `goals.forEach(g => steps.push(\`config_${g}\`))` — no change needed
   there. New render branch alongside the existing `config_event_race`
   block (`GoalsSetupScreen.jsx:588`): plan-length picker, start date
   (default `todayISO()`, same pattern as `config_event_race`'s start date),
   fitness-level picker (reuse `FITNESS_LEVELS` verbatim — "Beginner /
   Intermediate / Fit but new to this" applies just as well to trail).
4. **`canAdvance` gating** (`GoalsSetupScreen.jsx:287`): add
   ```js
   if (current === 'config_trail_running') return !!(goalConfigs['trail_running']?.startDate && goalConfigs['trail_running']?.planWeeks && goalConfigs['trail_running']?.fitnessLevel);
   ```
5. **Mutual exclusivity with `event_race`.** **Decision, flagging per
   `CLAUDE.md`:** both `event_race` and `trail_running` produce a full
   periodized plan written into the same `training_plans` row
   (`training_type: 'event'`, `unique(user_id, training_type)` — see
   `docs/PROJECT_CONTEXT.md` §9). The schema already only supports one
   active generated plan at a time; that's an existing constraint, not a
   new one, but this feature is the first time two *different* goal types
   would compete for that same slot. Rather than silently letting whichever
   goal's config completes last win (confusing — the athlete picked both,
   sees both configured, but only one becomes a real plan), block the
   combination at the picker: in `toggleGoal` (`GoalsSetupScreen.jsx:313`),
   if the user selects `trail_running` while `event_race` is already
   selected (or vice versa), don't add it — surface inline copy near the
   goal-select step ("Trail Running and Race/Event both build a full
   training plan — pick one for now, you can switch later.") This is a
   product/UX call worth a human sanity-check, not just an engineering
   default — flag it in the PR description explicitly, same as this spec
   flags it here.
6. **Day picker** (`GoalsSetupScreen.jsx:831`, currently gated by
   `isRaceGoal(selectedGoals)`): generalize the gate to
   `isRaceGoal(selectedGoals) || isTrailGoal(selectedGoals)` (new helper,
   same shape as `isRaceGoal`), and generalize `raceDisciplines`
   (`GoalsSetupScreen.jsx:250`) to resolve to `['trail']` when a trail goal
   is selected (add a `trail: { icon: '⛰️', label: 'Trail run' }` entry to
   `DISCIPLINE_META`, `GoalsSetupScreen.jsx:25`). This reuses the exact
   same 7-day multi-select UI already built for running/swim/bike — no new
   component.
   - **Day count validation is stricter than the existing "at least 1
     day" rule** (`GoalsSetupScreen.jsx:304`): P0 requires exactly 3–4
     running sessions/week (1 long + 1 hill + 1–2 easy). Add a
     trail-specific branch to `canAdvance`'s `day_picker` case:
     ```js
     if (isTrailGoal(selectedGoals)) {
       const n = (disciplineDays.trail || []).length;
       return n >= 3 && n <= 4;
     }
     ```
     with inline copy telling the athlete to pick 3 or 4 days (not "at
     least 1").
7. **Long-run and hill-workout day preference.** `preferences.longSessionDay`
   already exists and is exactly what's needed for the long run anchor
   (reuse verbatim — same field, same UI, `GoalsSetupScreen.jsx`'s
   preferences step). There is **no existing field for which of the
   selected days is the hill day** — add `preferences.hillDay` to
   `EMPTY_INTAKE.preferences` (`GoalsSetupScreen.jsx:121`) and to whatever
   step currently sets `longSessionDay`/`secondDisciplineDay`/
   `conditioningDay` (the "preferences" step later in the flow), shown only
   when a trail goal is selected. No migration — `user_intake.preferences`
   is already a jsonb column (`utils/supabase.js:339,364`), so a new key
   nests in for free.
8. **Baseline step.** P0 needs *some* fitness-ramp starting point, but the
   product spec's Non-Goals explicitly exclude pace-zone logic — asking for
   5K/10K times (the existing `run_baseline` step,
   `GoalsSetupScreen.jsx:115`) would be exactly the pace-shaped signal this
   feature is meant to avoid leaning on. **Decision:** new step
   `trail_baseline` (added to `buildSteps()` in place of `run_baseline` when
   the goal is `trail_running` — trail goals skip `run_baseline` entirely,
   they don't need a road pace baseline): a single field,
   *"Roughly how long is the longest continuous run or hike you've done
   recently? (minutes)"* — stored as `runBaseline.longestEffortMinutes`
   (new key nested inside the existing `user_intake.run_baseline` jsonb
   column — no migration, and deliberately kept separate from the existing
   `longestEffortKm` key so road-plan fitness-ratio logic in
   `buildTrainingPlan` is untouched). Mandatory but self-reported, same "no
   hard block on specific fields" treatment the existing baseline steps get
   (`GoalsSetupScreen.jsx:308`).
9. **Everything else in the merged flow reuses as-is, unchanged:**
   availability (holidays/one-off events), injury history, gym access
   toggle, standing commitments. None of these are running/triathlon-
   specific in their current implementation.

## B. Deterministic plan engine — `buildTrailPlan()`

New function in `src/utils/planEngine.js` (same file — reuses its private
date helpers `parseUTCDate`/`toDateKey`/`addDays`/`dayKeyOf`/`diffDays`/
`clamp`, `allocateWeeks`, `computeRecoveryWeeks`, `minutesDuration`,
`buildRestEntry`, `pickAnchorDay`, `pickConditioningDay`, `fitnessRatio`,
`buildWeeklySeries`, `buildConditioningEntry`, `selectConditioningExercises`
directly — no new file, no export surface needed for those helpers since
they're module-private and this lives in the same module). Exported
alongside `buildTrainingPlan`.

### B.0 Session `type` reuse (the key simplifying decision)

Every trail session entry uses `type: 'run'`, exactly like the existing
engine's running sessions — **not** a new `'trail'`/`'trail_run'` type. This
one choice is what makes §D/§E below "already works, no code needed"
instead of new integration work:

- `SESSION_DISPLAY` (`src/data/sessionDisplay.js`) already has a `run` entry
  (🏃, `#0090FF`) — trail sessions get it for free. Distinguish trail from
  road visually via `label`/`sessionType` text only (e.g. `label: 'Trail
  run'`, `sessionType: 'Trail long run'` / `'Trail hill repeats'` /
  `'Easy trail run'`), which every screen that renders a session card
  already reads (`SessionDetailScreen.jsx`, `WeeklyOverviewScreen.jsx`).
- `overtrain.js`/`sessionLoadEstimate.js`'s ref-activities matching
  (`findRef(s.name, ref) || findRef(s.type, ref)`) already resolves `'run'`
  sessions against `ref_activities` for load scoring — no new
  `ref_activities` row, no code change.
- `utils/analytics.js`'s pace chart (per
  `features/specs/analytics-home-pace-reps.md`) already buckets "everything
  with `type` other than swim/cycle/bike/gym/conditioning and a logged
  distance" into the mm:ss/km pace series — a trail session with a logged
  `distance` shows up there automatically, no new grouping rule.
- `ActivityTimerScreen` (§D) and session-completion matching
  (`utils/sessionCompletion.js`) are already type-agnostic for `kind:
  'activity'` sessions.

Do not special-case `type` anywhere in this feature. If a screen needs to
distinguish "this is a trail run" for copy/behaviour, key off `sessionType`
or a `flag`, not `type` — introducing a second type value would silently
break every one of the reuse points above for trail sessions specifically.

### B.1 No taper, no race day — phase structure

```js
export function buildTrailPlan(intake) {
  // intake: { startDate, planWeeks (12-16), fitnessLevel,
  //           disciplineDays: { trail: [...dayKeys] },
  //           preferences: { longSessionDay, hillDay, conditioningDay },
  //           baselines: { trail: { longestEffortMinutes } },
  //           holidays, oneOffEvents, injury }
```

- `totalWeeks = clamp(intake.planWeeks, 12, 16)`.
- Three phases only — **no Taper phase** (Non-Goal: race-specific
  taper/peak is out of scope; this is base-building end to end). Weights
  `[0.35, 0.35, 0.30]` (Foundation/Build/Peak) through the existing
  `allocateWeeks(totalWeeks, weights)` helper — same phase-color assignment
  pattern as `computePhases` (`colorForPhase`).
- Recovery weeks: reuse `computeRecoveryWeeks(phases)` unchanged (every 4th
  week, 30% volume cut) — the existing implementation already only excludes
  Taper, which doesn't exist here anyway, so it needs no modification.
- No `race` entry type is ever emitted (there's no race day in this plan) —
  the day-by-day loop simply never checks for one.

### B.2 Long run — time-on-feet, 10–15% weekly growth, not the road-running formula

Reuse `buildWeeklySeries` (`planEngine.js:255`) but it currently hardcodes a
10% (`×1.10`) week-over-week growth cap, inline at line 265. **Small,
additive change to a shared function** (flagging per `CLAUDE.md` — this
touches code outside this feature's own new code, even though it's a
one-line, backward-compatible addition): add an optional `growthCap`
parameter defaulting to `1.10` so every existing caller (`buildTrainingPlan`
for run/bike/swim series) is byte-for-byte unaffected; `buildTrailPlan`
passes `1.15`.

```js
function buildWeeklySeries({ ..., growthCap = 1.10 }) {
  // ...
  values.push(idx === 0 ? raw : Math.min(raw, values[idx - 1] * growthCap));
  // ...
}
```

- **Decision (no reference table given for this in the product spec):**
  peak long-run time-on-feet by fitness level — pick sensible defaults, flag
  as tunable:
  ```js
  const TRAIL_PEAK_LONG_RUN_MIN = { 'Beginner': 90, 'Intermediate': 150, 'Fit but new to this': 120 };
  ```
  `startValue = peak * trailFitness`, where `trailFitness` follows the same
  pattern `runFitness`/`bikeFitness`/`swimFitness` already use in
  `buildTrainingPlan` (`planEngine.js:352`): self-reported baseline
  overrides the generic `fitnessRatio(fitnessLevel)` when present —
  ```js
  const trailFitness = baselines.trail?.longestEffortMinutes
    ? clamp(baselines.trail.longestEffortMinutes / peak, 0.15, 0.75)
    : fitnessRatio(fitnessLevel);
  ```
- Long-run day: `pickAnchorDay(trailDays, preferences.longSessionDay,
  'sunday')` — reused verbatim.
- The generated `duration` field is always a `minutesDuration(...)` string
  ("`90min`"), never a distance — this is what makes the P0 acceptance
  criterion ("prescribed target remains a duration regardless of whether km
  is logged") true by construction, not by a separate guard.

### B.3 Hill workout — fixed structure, once a week

Not a rotation-table lookup like `RUN_LIBRARY`/`BIKE_LIBRARY` (no variety
needed — the product spec prescribes one specific structure). A single
builder function:

```js
const TRAIL_HILL_REPS = { Foundation: 6, Build: 7, Peak: 8 };

function buildTrailHillEntry(weekNum, phase) {
  const reps = TRAIL_HILL_REPS[phase.label] || 6;
  const duration = minutesDuration(15 + reps * 3); // 15min warm-up + ~3min per rep (60-90s effort + jog/walk recovery down)
  return {
    type: 'run', label: 'Trail run',
    sessionType: 'Trail hill repeats',
    duration, flag: '', intensity: 'High', week: weekNum, phase: phase.label,
  };
}
```

Satisfies the P0 acceptance criterion verbatim: 15-min warm-up, 6–8 reps of
60–90s moderate-hard uphill effort, easy jog/walk recovery down (the
recovery jog/walk *is* the between-rep gap the 3min/rep budget accounts
for — no separate cooldown line item, matching how the product spec
describes the workout as one continuous structure).

### B.4 Easy runs — conversational effort, no pace target

```js
const TRAIL_EASY_MIN = { Foundation: 30, Build: 35, Peak: 35 };

function buildTrailEasyEntry(weekNum, phase) {
  return {
    type: 'run', label: 'Trail run',
    sessionType: 'Easy trail run',
    duration: minutesDuration(TRAIL_EASY_MIN[phase.label] || 30),
    flag: '', intensity: 'Low', week: weekNum, phase: phase.label,
  };
}
```

No rotation, no progression series — flat duration per phase is enough to
satisfy the P0 requirement ("labeled with a 'conversational effort' cue
rather than a pace target"); the cue itself is the `sessionType` string
("Easy trail run") plus the glossary entry (§C) surfacing the "comfortable,
conversational-pace" description wherever the glossary info-icon pattern
already renders it (`SessionDetailScreen.jsx`, per
`deterministic-endurance-plan-generator.md` §C.3 — already built, nothing
new to wire up).

### B.5 Weekly day assignment

```js
function assignTrailDays(trailDays, preferences) {
  const longDay = pickAnchorDay(trailDays, preferences.longSessionDay, 'sunday');
  const remaining = trailDays.filter(d => d !== longDay);
  const hillDay = pickAnchorDay(remaining, preferences.hillDay, remaining[0]);
  const easyDays = remaining.filter(d => d !== hillDay);
  return { longDay, hillDay, easyDays }; // easyDays.length is 1 or 2
}
```

In the day-by-day loop: if `dayKey === longDay` → `buildTrailLongEntry`
(from the B.2 series); if `dayKey === hillDay` → `buildTrailHillEntry`; if
`dayKey` is in `easyDays` → `buildTrailEasyEntry`; else (including the
conditioning day and any non-selected day) → fall through to the
conditioning/rest logic below.

### B.6 Strength & stability — unconditional, not gated by `gymAccess`

**This is the detail most likely to get silently dropped by copying the
existing pattern too literally — call it out explicitly.** The existing
`conditioningDay` in `buildTrainingPlan` is only added `if (gymAccess)`
(`planEngine.js:387`), because that conditioning content assumes gym
equipment access is the reason to gate it. The product spec's strength/
stability requirement for trail is unconditional — squats, lunges,
step-ups, ankle work are all bodyweight, no equipment needed, and P0's
acceptance criterion has no "if gym access" clause ("Generated plans
include at least one strength/stability session per week"). `buildTrailPlan`
must **always** place a conditioning day, regardless of `gymAccess`:

```js
const conditioningDay = pickConditioningDay(preferences.conditioningDay, [longDay, hillDay, ...easyDays]);
```

(`pickConditioningDay` already defaults to a mid-week day avoiding a given
list when no explicit preference is set — reused verbatim, just without the
`gymAccess ? ... : null` guard `buildTrainingPlan` wraps it in.)

Reuses `buildConditioningEntry`/`selectConditioningExercises`
(`planEngine.js:309`, `data/conditioningLibrary.js`) unchanged — but the
exercise catalog needs one addition per the product spec's explicit list
("squats, lunges, step-ups; ankle-strengthening"). `squat`, `lunge`,
`calf_raise`, and `single_leg_balance` (ankle) already exist in
`CONDITIONING_EXERCISES`; **step-ups do not**. Add:

```js
{ id: 'step_up', name: 'Step-up', targetsAreas: ['Quad', 'Knee', 'Hip'] },
```

No other catalog change needed — `selectConditioningExercises` already
picks a mixed circuit and will include this now that it exists.

### B.7 Holidays / one-off events / injury

Reuse the existing holiday-day-lookup and one-off-event handling
(`holidayByDate`, `applyOneOffEvents`) unchanged — they operate on the
generic `sessions` map keyed by date, not on discipline-specific logic, so
they apply to a trail plan's single running discipline exactly as they do
to `buildTrainingPlan`'s. `applyOneOffEvents`'s recovery-day logic already
falls back to `realType = original.find(e => e.type !== 'rest')?.type ||
'run'` — for a trail plan this resolves to `'run'` naturally (§B.0), no
change needed.

### B.8 Output contract

Same `{ meta, phases, sessions }` shape `buildTrainingPlan` produces —
required so `mergeEventPlanFromCutoff`, Weekly Overview, and everything
else downstream of an applied plan need zero changes (per the precedent set
in `deterministic-endurance-plan-generator.md` §B.6).

- `meta.raceType`: `'Trail Running'` (used only for display/identification —
  nothing keys scheduling logic off it, unlike the event-plan engine, since
  there's exactly one trail "type").
- `meta.eventDistances`: omit (leave `undefined`/`null`) — every read site
  already treats it as optional (`eventPlan.meta?.eventDistances ? ... :
  ''`, `AboutScreen.jsx`) since a time-on-feet plan has no fixed distance by
  design (Non-Goal).
- `meta.sourceFileName: 'Generated by Forma'` and `meta.planHealth` — set
  exactly as `buildTrainingPlan` does, so the existing
  `existingPlanIsEngineGenerated` marker check in `App.jsx`'s
  `handleGoalsSetupComplete` (`App.jsx:550`) treats a trail plan as safe to
  regenerate on redo, same as an event-race plan.
- `meta.glossary`: `glossaryForTerms(usedTerms)` — reuse verbatim. Add one
  new glossary term to `data/planGlossary.js` (do **not** reuse the
  existing `'Hill repeats'` term — that one's `discipline: 'Bike'` and its
  description is bike-specific; reusing the same term string for trail
  would silently show the wrong description on a trail plan's glossary
  since `glossaryForTerms` matches by exact term string across one flat
  list):
  ```js
  { term: 'Trail hill repeats', discipline: 'Trail Run', description: 'Repeated hard uphill efforts (60–90s) with an easy jog or walk back down as recovery — builds the climbing strength and leg power trail terrain demands.' },
  ```
  `'Easy run'` and `'Long run'` (already in the glossary,
  `data/planGlossary.js:12,18`) are reused as-is — both descriptions are
  already terrain-agnostic ("pace matters far less than time on feet" is,
  if anything, more true for trail than for the road running it was
  originally written for).
- `meta.planHealth`: reuse `computePlanHealth` unchanged — it's a generic
  function over `sessions`/`phases`, no discipline-specific assumptions.
- `meta.overview`/`meta.planMix`: adapt `buildOverview`/`buildPlanMix`
  (`planEngine.js:698,729`) with trail-appropriate copy (no
  triathlon/warm-up-per-discipline branching needed — one discipline, one
  warm-up/cool-down reference line: "5min brisk walk/easy jog + leg swings,
  dynamic drills on flat ground before climbing onto trail; walk the last
  5min of any session to cool down, especially after the hill workout.").

## C. `App.jsx` wiring

Mirrors the existing `event_race` wiring in `handleGoalsSetupComplete`
(`App.jsx:503`) almost exactly:

```js
const trailGoalCfg = gp.goals?.find(g => g.type === 'trail_running')?.config;
if (!blockScheduleApply && !generatedPlan && trailGoalCfg?.startDate && trailGoalCfg?.planWeeks) {
  try {
    generatedPlan = buildTrailPlan({
      startDate: trailGoalCfg.startDate,
      planWeeks: trailGoalCfg.planWeeks,
      fitnessLevel: trailGoalCfg.fitnessLevel,
      disciplineDays: gp.disciplineDays,
      baselines: { trail: newIntake.runBaseline }, // longestEffortMinutes lives inside runBaseline, see §A.8
      preferences: newIntake.preferences,
      holidays: newIntake.availability?.holidays,
      oneOffEvents: newIntake.availability?.oneOffEvents,
      injury: newIntake.injury,
    });
  } catch (e) {
    console.warn('Forma: trail plan engine could not generate a plan from these answers', e);
  }
}
```

`!generatedPlan` guards against both goal types somehow both reaching this
point despite §A.5's picker-level block (defence in depth, not the primary
mechanism — event_race generation runs first in source order and simply
wins if the picker guard is ever bypassed). Everything after this
(`suppressGenericSchedule`, `mergeEventPlanFromCutoff`, cutoff-date pruning
of `eventOverrides`/`preselectedQueues`/`planSessionsDone`/
`sequencingDecisions`) is goal-type-agnostic already — no further change
needed in `App.jsx`.

`isTrailGoal`/`isTrailRace`-style discipline gating in
`generateActivitySchedule`/`getAutoSplitDays` (the generic non-plan
scheduler) doesn't need any change: `suppressGenericSchedule` is already
`blockScheduleApply || !!generatedPlan`, and a trail plan sets
`generatedPlan` exactly like an event-race plan does, so the generic
scheduler already skips scheduling anything on top of it.

## D. Session logging — optional km, already built

**No new code required for the P0 km-logging acceptance criteria.**
`ActivityTimerScreen` (`GymSessionScreen.jsx:777`) already:
- shows a plain elapsed-time timer (not a pace/distance target) for any
  `kind: 'activity'` session, which is what `startActivitySession`
  (`App.jsx:822`) launches for a scheduled plan session of type `'run'`
  (§B.0) — this already matches "prescribed target is a duration, not a
  distance."
- collects an **optional** `distance` field on finish
  (`GymSessionScreen.jsx:881,895`) — blank stays `null`, doesn't block
  finishing.
- stores `distance`/`distanceUnit` on the completed-session object, which
  is what `gym_sessions.raw` persists (`docs/PROJECT_CONTEXT.md` §9) and
  what `SessionDetailScreen.jsx` already renders back (`s.distance != null
  ? ... : ''`, confirmed at `SessionDetailScreen.jsx:192,517`).

Verify (don't build) during implementation: confirm a trail session started
via `startActivitySession` actually reaches `ActivityTimerScreen` and not
`GymSessionScreen`'s set/rep flow — it will, since `type: 'run'` sessions
already do this today for road-running plan sessions, and trail sessions
are indistinguishable from those at the `kind`/`type` level by design
(§B.0).

## E. Cross-sport load engine — already integrated, verify only

Per §B.0, trail sessions carry `type: 'run'`, so `overtrain.js`'s
`checkWeek`/`resolveExpectedLoad` (`sessionLoadEstimate.js`) already
resolves them against `ref_activities` and personal RPE history exactly
like any other run session — **no new code**. The P0 acceptance criteria
here ("Completed trail sessions (with RPE) feed the same load/RPE trend
tracker", "visible in the existing analytics UI") are satisfied by the
`type: 'run'` decision alone. Implementation should include a manual
smoke-check (start a trail session from a generated trail plan, complete it
with an RPE, confirm it appears in the Sequencing Advisor's next `checkWeek`
run and in the Analytics pace chart if a distance was logged) rather than
new integration code.

## Data model implications

**No new Supabase tables. No new columns. No migration.**

- `user_goals.goals` (jsonb array) — `trail_running` goal objects nest into
  the existing generic `{ type, config }` shape the array already holds for
  every other goal type; no schema change, since the column has no
  per-type constraint.
- `user_goals.discipline_days` (jsonb) — gains a `trail` key alongside the
  existing `run`/`swim`/`bike` keys. Already an open jsonb object.
- `user_intake.preferences` (jsonb) — gains a `hillDay` key. Already an
  open jsonb object (`utils/supabase.js:339,364`).
- `user_intake.run_baseline` (jsonb) — gains a `longestEffortMinutes` key,
  additive alongside the existing `longestEffortKm`/`time5k`/etc. keys.
- `training_plans` — no shape change; a trail plan is written into the
  existing `training_type: 'event'` row using the same `meta`/`phases`/
  `sessions` columns an event-race plan uses (see §B.8 on why mutual
  exclusivity at the picker, §A.5, matters given this shared slot).
- `gym_sessions` — no shape change; `distance`/`distanceUnit`/`rpe` on a
  completed trail session round-trip through the existing generic `raw`
  jsonb field exactly as they do for any other activity session.

## Edge cases handled

- Athlete picks 5+ or fewer than 3 trail days — blocked at `canAdvance`
  (§A.6), same "block advancing with a clear message" pattern the existing
  per-discipline day picker already uses for triathlon.
- Athlete selects both `event_race` and `trail_running` — blocked at goal
  selection (§A.5), not left to resolve silently at generation time.
- Athlete leaves `longestEffortMinutes` blank — falls back to
  `fitnessRatio(fitnessLevel)`, same "true beginner for ramp purposes"
  behaviour the existing engine already gives baseline-less athletes
  (`planEngine.js:352` for the precedent).
- Holiday/one-off event lands on a trail hill-workout day — handled
  identically to any other day by the existing generic holiday/one-off-event
  machinery (§B.7); no trail-specific holiday behaviour needed since
  there's only one discipline to substitute/absorb.
- Redoing onboarding with an already-active trail plan — same
  `existingPlanIsEngineGenerated` "safe to replace" path an event-race redo
  already gets (§B.8, §C); redoing with an active *uploaded* plan still
  leaves it untouched, same as today.
- A trail plan mid-flight when the athlete's `gymAccess` toggle is off —
  the strength/stability day still appears (§B.6) — this is the one place
  behaviour deliberately *diverges* from the existing conditioning pattern,
  and is the detail most worth double-checking in review.

## Explicitly out of scope (P1 / P2 — do not build in this pass)

- Manual session controls (move/swap/double-up/mark-rest) for trail
  sessions specifically — if these already work generically for any
  event-plan session type today, no action needed either way; if they
  don't, that's a P1 follow-up, not part of this spec.
- Nutrition/hydration practice prompt on long-run sessions.
- Optional elevation-gain field alongside km logging.
- Onboarding explainer copy for "why time, not pace/distance."
- GPX import, route/terrain mapping, Strava trail-segment matching.
- Pace-zone calculation or guidance for trail running, at all.
- Race-specific taper/peak phasing for trail ultras (this plan has no race
  day, no taper phase — see §B.1).
- Requiring elevation gain as an input.
- Any change to `utils/trainingPlanImport.js` (uploaded `.xlsx` plans) —
  unaffected, separate code path.
- Any change to `HomeScreen.jsx`'s dashboard.
- Success-metrics instrumentation (adoption/activation/km-logging-usage
  tracking, Supabase query definitions) — the product spec itself flags
  "measurement method... to be defined during implementation" as an open
  question; this pass ships the feature, not analytics event tracking for
  it, unless a human explicitly asks for that as a separate follow-up.

## Files this touches

- `src/screens/GoalsSetupScreen.jsx` — new goal type, config step, baseline
  step, day-picker generalization, mutual-exclusivity guard, `canAdvance`
  additions, `preferences.hillDay` field (§A).
- `src/utils/planEngine.js` — new `buildTrailPlan()` export, new local
  builder functions (`assignTrailDays`, `buildTrailLongEntry`,
  `buildTrailHillEntry`, `buildTrailEasyEntry`), `buildWeeklySeries`
  gains an optional `growthCap` param (§B).
- `src/utils/planEngine.test.js` — Vitest coverage for `buildTrailPlan`:
  phase structure has no Taper, long-run series grows ≤15%/week and hits
  the fitness-level peak, hill workout always has 6–8 reps depending on
  phase, easy-run count matches `trailDays.length - 2`, conditioning day is
  present regardless of `gymAccess`, output shape matches
  `buildTrainingPlan`'s contract (`meta`/`phases`/`sessions`).
- `src/data/conditioningLibrary.js` — add the `step_up` exercise (§B.6).
- `src/data/planGlossary.js` — add the `'Trail hill repeats'` term (§B.8).
- `src/App.jsx` — `handleGoalsSetupComplete` gains the `buildTrailPlan` call
  (§C). No other function in this file needs to change.
- `tests/e2e/smoke.spec.js` — one smoke assertion for selecting Trail
  Running as a goal and reaching a generated plan, per
  `tests/e2e/README.md`'s existing pattern for onboarding-flow assertions.
- `docs/PROJECT_CONTEXT.md` §6/§7.4 — brief mention that `trail_running` is
  a second goal type the deterministic engine supports, alongside
  `event_race`, once this ships (keeps the "read first" doc accurate, per
  `CLAUDE.md`).

## Open questions carried over from the product spec (unresolved here, by design)

These are called out in the product spec's own "Open Questions" section and
are genuinely product decisions, not engineering ones — this technical spec
does not resolve them:

- Should `trail_running` be available to brand-new users at signup, or
  gated behind having completed at least one existing plan?
- Should logged km ever feed back into future plan adjustments, or stay a
  pure personal record (per Non-Goals, current default: pure record, no
  feedback loop — `buildTrailPlan` never reads a previously-logged
  `distance` value for anything)?
