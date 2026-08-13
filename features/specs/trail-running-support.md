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

## Revision note

This draft supersedes an earlier version of this document that modelled
Trail Running as an entirely new top-level goal type, separate from
`event_race`. Product feedback overrode that: **trail running is a race
type** — a trail runner is training toward a race, same as a 10K or
marathon runner, just with different session logic underneath. This
revision folds it into the *existing* `RACE_TYPES` picker/`event_race`
onboarding flow instead of building a parallel goal type. This turns out to
simplify the implementation considerably (§A), not just satisfy the product
direction — most of onboarding, `App.jsx` wiring, and the plan-preview logic
need **zero** changes, because they're already generic over "any engine-
supported race type." Three product decisions drive this revision:

1. **Trail Running belongs in `RACE_TYPES`**, alongside 10K/Half/Marathon/
   Triathlon — not a separate discipline picker. See §A.
2. **Activity labelling stays `type: 'run'`** — confirmed, unchanged from
   the original draft (§B.0). The differentiator is the *session content*
   the plan generates (hill repeats, time-on-feet long run), not a new
   activity type. A marathon runner and a trail runner are both doing
   "runs"; the plan logic behind those runs is what differs.
3. **Conditioning is unconditional in every generated plan**, not just
   trail's. Previously `buildTrainingPlan` only added a conditioning day
   `if (gymAccess)`; that gate is removed entirely. This is a scope
   expansion beyond trail running specifically — flagged prominently in §B.6
   since it changes generation behaviour for 10K/Half Marathon/Marathon/
   Triathlon plans too, not just the new race type.

This also resolves an open question the product spec itself flagged
("Should trail running be available to brand-new users at signup, or gated
behind having completed at least one existing plan?") **for free**: since
Trail Running is just another button in the same `RACE_TYPES` row every
other race type already renders in, from day one of `GoalsSetupScreen`,
there's no separate gating mechanism to build or decide on — any user
picking the "Race / Event" goal sees it immediately, same as 10K or
Marathon.

## Context — how this fits what's already built

Forma already has a fully-built deterministic plan engine
(`src/utils/planEngine.js`, see
`features/specs/deterministic-endurance-plan-generator.md`) that builds
periodized plans for 10K / Half Marathon / Marathon / 4 triathlon distances
from a merged onboarding payload (`GoalsSetupScreen.jsx`), keyed entirely by
a single `raceType` string flowing through `RACE_TYPES` →
`SUPPORTED_RACE_TYPES` → `buildTrainingPlan()`. Adding a new race type is
already a supported extension point; the work is almost entirely inside
`buildTrainingPlan()` itself — a new internal branch for how *session
content* gets generated for this one race type, not new onboarding
plumbing. The session-logging layer
(`ActivityTimerScreen` in `GymSessionScreen.jsx`) already lets a user
optionally log distance on any non-gym session, independent of what the
plan prescribed, so P0's km-logging requirement needs no new code either
(§D).

## Scope for this pass

This spec covers **P0 only** (product spec's "Must-Have" items 1–5),
matching the product spec's own recommended phasing ("Phase 1: Trail Running
as a discipline, time-on-feet plan generation, optional km logging,
load-engine integration, strength/stability sessions"). P1 (manual session
controls parity, nutrition/hydration prompt, elevation field, onboarding
explainer copy) and P2 (GPX import, race-taper plans, terrain-aware effort,
Strava) are **explicitly out of scope** — see that section. Don't build them
in this pass; a future spec picks them up once P0 has shipped and been used.

**One deliberate deviation from the product spec's own Non-Goals, per
product direction:** the original product spec listed "race-specific
taper/peak plans" as a Non-Goal and described this as a raceless
"base-building" plan. Now that trail running is a race type with a real
race date (same as every other `RACE_TYPES` entry), the plan naturally runs
up to that date — see §B.1 for exactly what is and isn't included (no
distinct Taper *phase*/volume-cut block, but the plan does end on the
athlete's chosen race day with a Race Day entry, same as any other race
type).

## A. Onboarding — a new `RACE_TYPES` entry, reusing the existing flow

**Decision, superseding the previous draft:** Trail Running is added to
`RACE_TYPES` (`src/screens/GoalsSetupScreen.jsx:55`) and
`SUPPORTED_RACE_TYPES` (`src/utils/planEngine.js:37`), exactly like any
other running race type. It is **not** a new `GOAL_TYPES` entry. Because
`App.jsx`'s `handleGoalsSetupComplete` already calls `buildTrainingPlan`
whenever `isEngineSupportedRaceType(eventGoalCfg.raceType)` is true
(`App.jsx:577`), and `GoalsSetupScreen.jsx`'s plan preview (`previewPlan`,
`GoalsSetupScreen.jsx:260`) already does the same, **adding the string to
these two arrays is what actually wires a new race type into both the real
generation path and the live onboarding preview — no new call sites, no new
`App.jsx` code at all.**

1. ```js
   // GoalsSetupScreen.jsx
   const RACE_TYPES = [
     '10K', 'Half Marathon', 'Marathon', 'Trail Running',
     'Triathlon (Sprint)', 'Triathlon (Olympic)', 'Triathlon (70.3 / Half)', 'Triathlon (Full / Ironman)',
   ];
   ```
   ```js
   // planEngine.js
   export const SUPPORTED_RACE_TYPES = [
     '10K', 'Half Marathon', 'Marathon', 'Trail Running',
     'Triathlon (Sprint)', 'Triathlon (Olympic)', 'Triathlon (70.3 / Half)', 'Triathlon (Full / Ironman)',
   ];
   export function isTrailRaceType(raceType) { return raceType === 'Trail Running'; }
   ```
2. **`config_event_race` step needs no new fields.** Race type, start date,
   race date, fitness level, target-time toggle, cutoff-time toggle are all
   already generic across every race type (`GoalsSetupScreen.jsx:588–730`).
   Trail runners answer the same questions; a target/cutoff time, if given,
   is simply never read by the trail-specific generation branch (§B.2) —
   consistent with the Non-Goal that trail pace isn't a reliable planning
   signal, it's just not wasted effort to hide the field, since some trail
   races do have real cutoffs worth recording for the athlete's own
   reference.
3. **Day picker** (`GoalsSetupScreen.jsx:831`, `disciplinesForRaceType`,
   `GoalsSetupScreen.jsx:38`): `disciplinesForRaceType('Trail Running')`
   already falls into the existing `return ['run']` default branch (only
   triathlon needs the triple-discipline branch) — **no change needed
   there.** Trail sessions are picked under the same `disciplineDays.run`
   key 10K/Half/Marathon already use; there is no separate `disciplineDays.
   trail` key.
   - **Day-count validation is stricter than the generic "≥1 day" rule**
     (`GoalsSetupScreen.jsx:304`) for this one race type specifically — P0
     requires exactly 3–4 running sessions/week (1 long + 1 hill + 1–2
     easy). Add a branch to `canAdvance`'s `day_picker` case:
     ```js
     if (current === 'day_picker') {
       if (isRaceGoal(selectedGoals)) {
         if (isTrailRaceType(eventCfg.raceType)) {
           const n = (disciplineDays.run || []).length;
           return n >= 3 && n <= 4;
         }
         return raceDisciplines.every(d => (disciplineDays[d] || []).length >= 1);
       }
       return trainingDays.length >= 1;
     }
     ```
     with inline copy telling the athlete to pick 3 or 4 days when
     `isTrailRaceType(eventCfg.raceType)`, instead of the generic "pick at
     least one day" copy.
4. **`run_baseline` step already shown for every `event_race` goal**
   (unchanged — trail is a running race type, same as today's "every
   remaining race type needs a run baseline" rule per
   `deterministic-endurance-plan-generator.md` §A.3). The existing
   5K/10K/half/marathon time fields render as-is (harmless if left blank or
   filled — trail's generation branch doesn't read them). Add one
   trail-only field to this step, shown when `isTrailRaceType(eventCfg.
   raceType)`:
   *"Roughly how long is the longest continuous run or hike you've done
   recently? (minutes)"* → stored as `runBaseline.longestEffortMinutes`
   (new key nested inside the existing `user_intake.run_baseline` jsonb
   column — no migration, deliberately separate from the existing
   `longestEffortKm` key so the road-running fitness-ratio logic in
   `buildTrainingPlan` is untouched).
5. **Preferences step** gains one new field, shown only when
   `isTrailRaceType(eventCfg.raceType)`: which of the selected days is the
   hill-workout day. Add `preferences.hillDay` to `EMPTY_INTAKE.preferences`
   (`GoalsSetupScreen.jsx:121`) alongside the existing `longSessionDay`/
   `secondDisciplineDay`/`conditioningDay`. No migration —
   `user_intake.preferences` is already a jsonb column
   (`utils/supabase.js:339,364`). The long-run day reuses
   `preferences.longSessionDay` verbatim — no new field needed for that
   one, it already means exactly the right thing for any single-discipline
   running race type.
6. **Triathlon-only steps** (`swim_baseline`, `bike_baseline`,
   `discipline_rank`) already skip for any non-triathlon race type via
   `isTriathlonGoal` (`GoalsSetupScreen.jsx:133`, driven by
   `isTriathlonRaceType`'s `/triathlon/i` regex, which correctly doesn't
   match `'Trail Running'`) — **no change needed.**
7. **Everything else in the merged flow reuses as-is, unchanged:**
   availability (holidays/one-off events), injury history, gym access
   toggle, standing commitments.

## B. Plan generation — a new branch inside `buildTrainingPlan()`, not a new function

**Decision, superseding the previous draft's standalone `buildTrailPlan()`:**
because Trail Running is now a race type flowing through the existing
`buildTrainingPlan(intake)` entry point (`planEngine.js:321`), the trail-
specific logic lives as an `if (trail) { … } else { … existing … }` branch
inside that function, not a separate exported function. This keeps the
single entry point / single output contract the rest of the app already
depends on (`isEngineSupportedRaceType`, `mergeEventPlanFromCutoff`, Weekly
Overview, `AboutScreen.jsx`'s plan-overview section) working for trail with
no changes anywhere outside `planEngine.js` and its data tables.

```js
const trail = raceType === 'Trail Running';
```

### B.0 Session `type` reuse — confirmed, unchanged

Every trail session entry uses `type: 'run'`, exactly like the engine's
other running sessions — **not** a new `'trail'`/`'trail_run'` type. This
one choice is what makes §D/§E "already works, no code needed" instead of
new integration work:

- `SESSION_DISPLAY` (`src/data/sessionDisplay.js`) already has a `run`
  entry (🏃, `#0090FF`) — trail sessions get it for free. Distinguish trail
  from road only via `label`/`sessionType` text (e.g. `label: 'Run'`,
  `sessionType: 'Trail hill repeats'` / `'Trail long run'` / `'Easy trail
  run'`), which every screen that renders a session card already reads
  (`SessionDetailScreen.jsx`, `WeeklyOverviewScreen.jsx`).
- `overtrain.js`/`sessionLoadEstimate.js`'s ref-activities matching
  (`findRef(s.name, ref) || findRef(s.type, ref)`) already resolves `'run'`
  sessions against `ref_activities` for load scoring — no new
  `ref_activities` row, no code change.
- `utils/analytics.js`'s pace chart (per
  `features/specs/analytics-home-pace-reps.md`) already buckets any session
  with a `type` other than swim/cycle/bike/gym/conditioning and a logged
  distance into the mm:ss/km pace series — a trail session with a logged
  `distance` shows up there automatically, no new grouping rule.
- `ActivityTimerScreen` (§D) and session-completion matching
  (`utils/sessionCompletion.js`) are already type-agnostic for `kind:
  'activity'` sessions.

Do not special-case `type` anywhere in this feature. The distinction
between a marathon runner's plan and a trail runner's plan is entirely in
which builder function generates that day's session content (§B.2–B.5),
never in the `type` field the session carries once generated.

### B.1 Phases — no distinct Taper *phase*, but the plan still ends on race day

The product spec's Non-Goal on taper is honoured at the level of "no
distinct volume-cut taper block" — trail sessions ramp per §B.2 straight
through to the athlete's chosen race date, where a normal `race`-type entry
is emitted exactly like every other race type already gets
(`planEngine.js`'s existing `if (dk === toDateKey(raceDate))` branch at the
top of the day-by-day loop — this is unconditional today and needs **no
change** for trail).

- `TAPER_TABLE` gains a `'Trail Running'` row for lookup safety (`taperInfo
  = TAPER_TABLE[raceType]` is read unconditionally near the top of
  `buildTrainingPlan`, regardless of race type):
  ```js
  'Trail Running': { days: 0, volumeCut: 0 },
  ```
- `WEEKS_TABLE` gains:
  ```js
  'Trail Running': { min: 10, recMin: 12, recMax: 16 },
  ```
  This is what actually delivers the product spec's "12–16 week,
  configurable" requirement — the athlete doesn't pick a week-count
  directly, they pick a race date the same way they do for every other race
  type, and `totalWeeks` falls out of the existing `startDate`/`raceDate`
  arithmetic (`planEngine.js:329-330`, unchanged). A race date outside the
  recommended 12–16 week window already gets the existing `noFoundation`/
  `compressed` warning copy (`determinePhaseMode`, `buildOverview`) for
  free — no new UI needed for "your plan is compressed."
- **`computePhases` needs a trail-specific branch** — the existing function
  always appends a `Taper` phase and subtracts `taperWeeks` from the
  non-taper allocation (`planEngine.js:159-175`). For trail, skip that
  entirely and allocate the full `totalWeeks` across Foundation/Build/Peak:
  ```js
  function computePhases(raceType, totalWeeks, phaseMode) {
    if (raceType === 'Trail Running') {
      const labels = phaseMode === 'full' ? ['Foundation', 'Build', 'Peak'] : ['Build', 'Peak'];
      const weights = phaseMode === 'full' ? [0.35, 0.35, 0.30] : [0.6, 0.4];
      const weeks = allocateWeeks(totalWeeks, weights);
      const phases = [];
      let cursor = 1;
      labels.forEach((label, i) => { phases.push({ label, weeks: [cursor, cursor + weeks[i] - 1] }); cursor += weeks[i]; });
      return phases.map((p, i) => ({ ...p, color: colorForPhase(p.label, i) }));
    }
    // ... existing body, unchanged ...
  }
  ```
  Because `nonTaperWeeks` (computed just after `computePhases` is called,
  `planEngine.js:334`) is derived from the phases actually returned (`max`
  of every non-Taper phase's end week), this naturally comes out equal to
  `totalWeeks` for trail with zero extra plumbing — the taper-curve portion
  of `buildWeeklySeries` (§B.2) simply never executes (`taperWeeksCount =
  totalWeeks - nonTaperWeeks = 0`).

### B.2 Long run — time-on-feet, 10–15% weekly growth, not the road-running formula

`buildWeeklySeries` (`planEngine.js:255`) currently hardcodes a 10%
(`×1.10`) week-over-week growth cap inline at line 265. **Small, additive
change to a shared function** (flagging per `CLAUDE.md` — this touches code
outside this feature's own new code, even though it's a one-line,
backward-compatible addition): add an optional `growthCap` parameter
defaulting to `1.10` so every existing caller (run/bike/swim series in the
non-trail branch) is byte-for-byte unaffected; the trail branch passes
`1.15`.

```js
function buildWeeklySeries({ ..., growthCap = 1.10 }) {
  // ...
  values.push(idx === 0 ? raw : Math.min(raw, values[idx - 1] * growthCap));
  // ...
}
```

- **Decision (no reference table given for this in the product spec):**
  peak long-run time-on-feet by fitness level. Add a new row shape to
  `PEAK_VOLUME_TABLE` — trail's row doesn't share the triathlon shape
  (`swimM`/`bikeMin`/`runMin`/...) or the plain-running shape
  (`longRunKm`/`weeklyKm`, both distance-based and wrong for a
  time-on-feet plan):
  ```js
  'Trail Running': { longRunMinByFitness: { 'Beginner': 90, 'Intermediate': 150, 'Fit but new to this': 120 } },
  ```
  ```js
  if (trail) {
    const peakMin = PEAK_VOLUME_TABLE['Trail Running'].longRunMinByFitness[fitnessLevel] ?? 90;
    const trailFitness = baselines.run?.longestEffortMinutes
      ? clamp(baselines.run.longestEffortMinutes / peakMin, 0.15, 0.75)
      : fitnessRatio(fitnessLevel);
    runLongSeries = runDays.length ? buildWeeklySeries({
      startValue: peakMin * trailFitness, peakValue: peakMin,
      totalWeeks, nonTaperWeeks: totalWeeks, recoveryWeeks, taperVolumeCut: 0, growthCap: 1.15,
    }) : [];
  } else {
    // existing pace-based runLongSeries logic, completely unchanged
  }
  ```
  `baselines.run.longestEffortMinutes` is exactly the field §A.4 adds —
  self-reported baseline overrides the generic `fitnessRatio(fitnessLevel)`
  when present, same pattern `runFitness`/`bikeFitness`/`swimFitness`
  already use elsewhere in this function.
- The generated `duration` field is always a `minutesDuration(...)` string
  (e.g. `"90min"`), never a distance — this is what makes the P0 acceptance
  criterion ("prescribed target remains a duration regardless of whether km
  is logged") true by construction, not by a separate guard.

### B.3 Hill workout — fixed structure, once a week

Not a rotation-table lookup like `RUN_LIBRARY`/`BIKE_LIBRARY` (no variety
needed — the product spec prescribes one specific structure). A single
builder function, local to `planEngine.js`:

```js
const TRAIL_HILL_REPS = { Foundation: 6, Build: 7, Peak: 8 };

function buildTrailHillEntry(weekNum, phase) {
  const reps = TRAIL_HILL_REPS[phase.label] || 6;
  const duration = minutesDuration(15 + reps * 3); // 15min warm-up + ~3min/rep (60-90s effort + jog/walk recovery down)
  return {
    type: 'run', label: 'Run', sessionType: 'Trail hill repeats',
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
    type: 'run', label: 'Run', sessionType: 'Easy trail run',
    duration: minutesDuration(TRAIL_EASY_MIN[phase.label] || 30),
    flag: '', intensity: 'Low', week: weekNum, phase: phase.label,
  };
}
```

No rotation, no progression series — a flat duration per phase satisfies
the P0 requirement ("labeled with a 'conversational effort' cue rather than
a pace target"). The cue itself is the existing `'Easy run'` glossary
term's description ("comfortable, conversational-pace running" —
`data/planGlossary.js:12`), which the plan-mix/glossary surface
(`deterministic-endurance-plan-generator.md` §C.3, already built) already
renders wherever a session's info icon is tapped — reused as-is, no new
glossary entry needed for this one.

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

Computed once outside the day-by-day loop (same place `runLongDay`/
`bikeLongDay` are computed today, `planEngine.js:385-386`). Inside the loop,
the existing `runAllowed && activeDaysForWeek('run', ...)` branch
(`planEngine.js:485-489`) gets an `if (trail) { … } else { … existing … }`
split:

```js
if (trail) {
  if (dayKey === trailAssignment.longDay) entries.push(buildTrailLongEntry(weekNum, phase, runLongSeries[weekNum - 1] || 0));
  else if (dayKey === trailAssignment.hillDay) entries.push(buildTrailHillEntry(weekNum, phase));
  else if (trailAssignment.easyDays.includes(dayKey)) entries.push(buildTrailEasyEntry(weekNum, phase));
} else {
  // existing runAllowed / activeDaysForWeek / buildRunEntry branch, unchanged
}
```

Trail does **not** use `activeDaysForWeek`'s Foundation-frequency ramp-down
(`foundationCapFor`, `planEngine.js:406-414`) — that ramp is triathlon-only
today (`if (!triathlon ...) return Infinity`) and stays that way; trail's
3–4 selected days run every week of the plan, at the durations §B.2–B.4
already ramp, with no separate day-count reduction in early Foundation.

`buildTrailLongEntry` mirrors `buildTrailHillEntry`'s shape:
```js
function buildTrailLongEntry(weekNum, phase, minutes) {
  return { type: 'run', label: 'Run', sessionType: 'Long run', duration: minutesDuration(minutes), flag: '', intensity: 'Low', week: weekNum, phase: phase.label };
}
```
(`sessionType: 'Long run'` deliberately reuses `RUN_LONG_TERM`'s exact
string, `planEngine.js:41`, so the existing `'Long run'` glossary term
(`data/planGlossary.js:18` — "pace matters far less than time on feet",
already terrain-agnostic) resolves for trail's long run with no new entry.)

### B.6 Strength & stability — unconditional in every generated plan, not just trail's

**This is the one change in this spec that isn't trail-specific — flagging
prominently per `CLAUDE.md`, since it changes existing behaviour for 10K,
Half Marathon, Marathon, and every triathlon distance, not just the new
race type.** Per product direction, conditioning must be included in *all*
generated plans. Today, `conditioningDay` in `buildTrainingPlan` is only
computed `if (gymAccess)` (`planEngine.js:387-389`):

```js
// current
const conditioningDay = gymAccess
  ? pickConditioningDay(preferences.conditioningDay, [runLongDay, bikeLongDay, preferences.secondDisciplineDay].filter(Boolean))
  : null;
```

Remove the `gymAccess` gate entirely — the exercise catalog
(`data/conditioningLibrary.js`) is already 100% bodyweight (squats,
lunges, glute bridges, balance work — nothing requires gym equipment), so
there was never a real dependency on `gymAccess` here, just an
over-cautious gate:

```js
// new — unconditional
const conditioningDay = pickConditioningDay(preferences.conditioningDay, [runLongDay, trailAssignment?.hillDay, bikeLongDay, preferences.secondDisciplineDay].filter(Boolean));
```

`gymAccess` itself is untouched everywhere else (gym-split generation,
`hasGym`, `generateActivitySchedule`) — this only removes its effect on
whether a *generated endurance plan* includes a conditioning day.
Downstream: `buildConditioningEntry`/`selectConditioningExercises`
(`planEngine.js:309`, `data/conditioningLibrary.js`) are otherwise
unchanged — but the catalog needs one addition per the product spec's
explicit list ("squats, lunges, step-ups; ankle-strengthening"). `squat`,
`lunge`, `calf_raise`, and `single_leg_balance` (ankle) already exist in
`CONDITIONING_EXERCISES`; **step-ups do not**. Add:

```js
{ id: 'step_up', name: 'Step-up', targetsAreas: ['Quad', 'Knee', 'Hip'] },
```

**Practical consequence worth calling out in the PR description:**
existing users' *already-generated* plans in `training_plans` are
unaffected (this is a generation-time change, no backfill) — but the next
time any user redoes onboarding for any race type, their regenerated plan
will now include a conditioning day even if `gymAccess` is off, which is a
visible behaviour change beyond trail running. This is exactly the kind of
change `CLAUDE.md` asks to flag explicitly rather than let ride silently
inside a feature that's nominally "just trail running."

### B.7 Holidays / one-off events / injury

Reuse the existing holiday-day-lookup and one-off-event handling
(`holidayByDate`, `applyOneOffEvents`) unchanged — they operate on the
generic `sessions` map keyed by date, not on discipline-specific logic, so
they apply to trail's single running discipline exactly as they do to every
other race type's. `applyOneOffEvents`'s recovery-day logic already falls
back to `realType = original.find(e => e.type !== 'rest')?.type || 'run'`
— for a trail plan this resolves to `'run'` naturally (§B.0), no change
needed.

### B.8 Output contract

Same `{ meta, phases, sessions }` shape every other race type already
produces — this is what makes "no App.jsx changes" (§A) true. One field
needs an explicit guard:

- `meta.eventDistances`: the existing line
  (`planEngine.js:512-514`) is `triathlon ? ... : \`${RUN_RACE_DISTANCES_KM[raceType]}km\``
  — `RUN_RACE_DISTANCES_KM['Trail Running']` is `undefined`, which would
  silently produce the string `"undefinedkm"` for every trail plan.
  **Edge case to fix, not just an omission:**
  ```js
  const eventDistances = trail ? null : (triathlon ? ... : `${RUN_RACE_DISTANCES_KM[raceType]}km`);
  ```
  Every read site already treats this as optional (`eventPlan.meta?.
  eventDistances ? ... : ''`, `AboutScreen.jsx`) since a time-on-feet plan
  has no fixed distance by design (Non-Goal) — `null` is safe.
- `meta.raceType`: `'Trail Running'`, same field every race type already
  sets — no special handling.
- `meta.sourceFileName`/`meta.planHealth`/`meta.glossary`: computed exactly
  as today, unchanged — `computePlanHealth`, `collectUsedTerms`,
  `glossaryForTerms` are all generic over `sessions`/`phases`, no
  discipline-specific assumptions to update.
- **One new glossary term** — do **not** reuse the existing `'Hill
  repeats'` term (`data/planGlossary.js:33`, `discipline: 'Bike'`, bike-
  specific description); `glossaryForTerms` matches by exact term string
  across one flat list, so reusing that string for trail would silently
  show the wrong (bike) description on a trail plan's glossary:
  ```js
  { term: 'Trail hill repeats', discipline: 'Trail', description: 'Repeated hard uphill efforts (60–90s) with an easy jog or walk back down as recovery — builds the climbing strength and leg power trail terrain demands.' },
  ```
- `buildOverview`/`buildPlanMix` (`planEngine.js:698,729`): add a trail
  branch with appropriate copy (one discipline, no triathlon warm-up-per-
  leg branching needed) — e.g. *"5min brisk walk/easy jog + leg swings and
  dynamic drills on flat ground before climbing onto trail; walk the last
  5min of any session to cool down, especially after the hill workout."*

## C. `App.jsx` — no changes required

Confirmed by construction (§A, §B.8): `handleGoalsSetupComplete`
(`App.jsx:503`) already calls `buildTrainingPlan` for any
`isEngineSupportedRaceType(eventGoalCfg.raceType)` with the exact same
argument shape trail needs (`disciplineDays`, `baselines.run`,
`preferences`, `holidays`, `oneOffEvents`, `injury`, ...) — every one of
those fields already flows through unchanged from §A's onboarding
additions. `existingPlanIsEngineGenerated`, `mergeEventPlanFromCutoff`,
`suppressGenericSchedule` are all generic over "is there a generated plan,"
never over which race type produced it. **Verify this during
implementation rather than assuming it — but no edit to `App.jsx` should be
needed for this feature.**

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

- `user_goals.discipline_days` (jsonb) — trail sessions use the existing
  `run` key, same as 10K/Half/Marathon. No new key.
- `user_intake.preferences` (jsonb) — gains a `hillDay` key. Already an
  open jsonb object (`utils/supabase.js:339,364`).
- `user_intake.run_baseline` (jsonb) — gains a `longestEffortMinutes` key,
  additive alongside the existing `longestEffortKm`/`time5k`/etc. keys.
- `training_plans` — no shape change; a trail plan is written into the
  existing `training_type: 'event'` row through the same `meta`/`phases`/
  `sessions` columns every other race type already uses. Because trail is
  a `raceType` value, not a competing goal type, there's no new "which
  plan wins" ambiguity to resolve — it's mutually exclusive with every
  *other* race type in exactly the same way 10K and Marathon already are
  (picking a new `raceType` replaces the previous plan on redo, unchanged
  existing behaviour).
- `gym_sessions` — no shape change; `distance`/`distanceUnit`/`rpe` on a
  completed trail session round-trip through the existing generic `raw`
  jsonb field exactly as they do for any other activity session.

## Edge cases handled

- Athlete picks 5+ or fewer than 3 days for a Trail Running race — blocked
  at `canAdvance` (§A.3), same "block advancing with a clear message"
  pattern the existing per-discipline day picker already uses for
  triathlon.
- `meta.eventDistances` for a trail plan — explicitly set to `null` (§B.8),
  not left to fall through to the `undefinedkm` bug the naive reuse of the
  existing ternary would produce.
- Athlete leaves `longestEffortMinutes` blank — falls back to
  `fitnessRatio(fitnessLevel)`, same "true beginner for ramp purposes"
  behaviour the existing engine already gives baseline-less athletes for
  every other discipline (`planEngine.js:352` for the precedent).
- Holiday/one-off event lands on the trail hill-workout day — handled
  identically to any other day by the existing generic holiday/one-off-event
  machinery (§B.7); no trail-specific holiday behaviour needed since
  there's only one discipline to substitute/absorb.
- Redoing onboarding with an already-active trail plan, or switching from
  Trail Running to a different race type (or vice versa) — same
  `existingPlanIsEngineGenerated` "safe to replace" path any race-type
  change already gets today (§B.8, §C); redoing with an active *uploaded*
  plan still leaves it untouched, same as today.
- A race date that yields fewer than ~10 or more than ~16 weeks — falls
  into the existing `compressed`/`noFoundation` `phaseMode` warning copy
  (`determinePhaseMode`, `buildOverview`), same UX every other race type
  already gets for an aggressive or generous timeline, no new UI needed.
- Every generated plan across every race type now includes a conditioning
  day regardless of `gymAccess` (§B.6) — worth a dedicated regression check
  that existing 10K/Half/Marathon/Triathlon plan generation still produces
  correct output with this gate removed, since it's the one change in this
  spec that isn't trail-specific.

## Explicitly out of scope (P1 / P2 — do not build in this pass)

- Manual session controls (move/swap/double-up/mark-rest) for trail
  sessions specifically — if these already work generically for any
  event-plan session type today, no action needed either way; if they
  don't, that's a P1 follow-up, not part of this spec.
- Nutrition/hydration practice prompt on long-run sessions.
- Optional elevation-gain field alongside km logging.
- Onboarding explainer copy for "why time, not pace/distance."
- GPX import, route/terrain mapping, Strava trail-segment matching.
- Pace-zone calculation or guidance for trail running, at all — a target/
  cutoff time may be captured (§A.2) but is never converted into pace
  guidance for trail, unlike the road-running race types.
- A distinct Taper *phase*/volume-cut block for trail (§B.1) — the plan
  still ends on race day, it just doesn't get a separate reduced-volume
  block beforehand in this pass.
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

- `src/screens/GoalsSetupScreen.jsx` — `RACE_TYPES` gains `'Trail Running'`,
  `canAdvance`'s `day_picker` case gains the 3–4-day rule, `run_baseline`
  step gains the trail-only time-on-feet field, preferences step gains
  `hillDay` (§A). No change to `buildSteps`, `disciplinesForRaceType`,
  `isTriathlonGoal`, or the `config_event_race`/`day_picker` rendering
  beyond the one new field noted above — the existing generic rendering
  already handles a new `RACE_TYPES` entry.
- `src/utils/planEngine.js` — `SUPPORTED_RACE_TYPES` gains `'Trail
  Running'`, new `isTrailRaceType()` export, `TAPER_TABLE`/`WEEKS_TABLE`/
  `PEAK_VOLUME_TABLE` gain a `'Trail Running'` row each, `computePhases`
  gains a trail branch, `buildWeeklySeries` gains an optional `growthCap`
  param, new local builders (`assignTrailDays`, `buildTrailLongEntry`,
  `buildTrailHillEntry`, `buildTrailEasyEntry`), `buildTrainingPlan`'s
  run-series and day-by-day-loop sections gain `if (trail)` branches,
  `eventDistances` gains the `null` guard, conditioning-day computation
  loses its `gymAccess` gate (§B — this last change affects every race
  type, not just trail).
- `src/utils/planEngine.test.js` — Vitest coverage: trail plan has no Taper
  phase and ends with a Race Day entry on the chosen race date; long-run
  series grows ≤15%/week and reaches the fitness-level peak; hill workout
  always has 6–8 reps depending on phase; easy-run count matches
  `trailDays.length - 2`; `meta.eventDistances` is `null` for trail;
  conditioning day is present regardless of `gymAccess`, for trail **and**
  for at least one existing race type (regression coverage for §B.6's
  cross-cutting change).
- `src/data/conditioningLibrary.js` — add the `step_up` exercise (§B.6).
- `src/data/planGlossary.js` — add the `'Trail hill repeats'` term (§B.8).
- `tests/e2e/smoke.spec.js` — one smoke assertion for selecting Trail
  Running as a race type and reaching a generated plan, per
  `tests/e2e/README.md`'s existing pattern for onboarding-flow assertions.
- `docs/PROJECT_CONTEXT.md` §7.4 — brief mention that `SUPPORTED_RACE_TYPES`
  now includes `'Trail Running'`, and that conditioning is no longer
  `gymAccess`-gated in generated plans (keeps the "read first" doc
  accurate, per `CLAUDE.md`).
- **`src/App.jsx` — confirmed no change needed** (§C); listed here so it
  isn't mistaken for an oversight.

## Open questions carried over from the product spec

One of the two open questions the product spec raised is resolved by this
revision (see "Revision note" above — brand-new users see Trail Running
immediately, no gating). The other remains a genuine product decision, not
an engineering one:

- Should logged km ever feed back into future plan adjustments, or stay a
  pure personal record (per Non-Goals, current default: pure record, no
  feedback loop — the trail-specific builders in §B never read a
  previously-logged `distance` value for anything)?
