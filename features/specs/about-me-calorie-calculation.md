# About Me — Calorie Calculation (Priority 2)

## Status
Draft, ready to implement after `about-me-cosmetic-cleanup.md` (depends on
its `eventDays` fix, see Sequencing). Feeds `FoodScreen.jsx` — read the
consumption path below before changing the output shape.

## Context
`userSettings.dailyCaloriesBase` (default `1500`) and `gymDayBoost` (default
`250`) are pure hand-typed numbers today (`AboutScreen.jsx:504-509`,
defaults in `App.jsx:41-42`). Nothing in the codebase computes a calorie
target from the user's actual height/weight/age/sex/activity level —
`FoodScreen.jsx:227-228` reads the two settings values verbatim with no
adjustment. This spec adds a computed *suggestion* the user can accept or
ignore, without changing how `FoodScreen.jsx` consumes the result.

## Scope

### 1. Collect `sex` — onboarding + About screen
`profiles.sex` is an existing DB column, already fully wired end-to-end in
`utils/supabase.js` (`:167` load, `:179/182` save) — it's just never
populated because no screen collects it. Mifflin-St Jeor (the formula
below) needs it: the male/female offset differs by ~166 kcal, too large to
ignore.

- Add a sex field (**Male / Female / Prefer not to say**) to
  `ProfileSetupScreen.jsx`, alongside the existing age/height/weight step,
  following that screen's existing field patterns.
- Add the same field to `AboutScreen.jsx`'s Body Stats section (editable
  later, same as name/age/height/weight).
- "Prefer not to say" → formula falls back to a neutral average of the
  male/female offset (see #3).
- No schema change — `profile.sex` already round-trips.

### 2. Fix imperial-unit save bug in Body Stats (prerequisite)
`AboutScreen.jsx`'s `FieldRow` for Height/Weight (`:433-438`) writes
whatever the user types straight into `localProfile.height`/`weight` with
**no unit conversion**, even though the displayed unit label
(`localSettings.heightUnit`/`weightUnit`) can be `ft`/`lbs`. Contrast with
`ProfileSetupScreen.jsx`, which always converts and stores canonical
`height_cm`/`weight_kg` regardless of which unit the user is entering in
(`ftInToCm`/`lbsToKg`, `ProfileSetupScreen.jsx:7-17`).

Today, a user on imperial units who edits weight in the About screen has
their raw lbs number saved into the field everything else (BMI calc, and
now this calorie formula) treats as kg. This must be fixed as a
prerequisite — garbage in, garbage out for the new formula. Apply the same
`ftInToCm`/`lbsToKg` conversion in `AboutScreen.jsx`'s height/weight
`FieldRow` `onChange` handlers before calling `updateProfile`.

### 3. New pure function: `utils/calorieCalc.js`
```
computeSuggestedCalories({ heightCm, weightKg, age, sex, weeklyTrainingSessions })
  → { bmr, maintenanceCalories, suggestedDailyBase, suggestedGymDayBoost }
```
- **BMR**: Mifflin-St Jeor —
  `10*weightKg + 6.25*heightCm - 5*age + (sex === 'male' ? 5 : sex === 'female' ? -161 : -78)`
  (`-78` is the midpoint fallback for "prefer not to say").
- **Activity multiplier**: tiered off `weeklyTrainingSessions` (rest-day
  baseline vs. an active-day figure) — e.g. 0-1 sessions/wk → sedentary
  (1.2), 2-3 → light (1.375), 4-5 → moderate (1.55), 6+ → high (1.725).
  Exact tier boundaries are an implementation detail, not an acceptance
  criterion — pick reasonable standard TDEE multiplier bands and document
  them in the function's tests.
- **Output split**: `suggestedDailyBase` = BMR × rest-day multiplier (or
  the lowest tier, since "rest day" already implies no training that day);
  `suggestedGymDayBoost` = the delta between an active-day multiplier
  result and the rest-day figure, expressed as a flat kcal add — matching
  the existing base + boost model `FoodScreen.jsx` already consumes, so
  **no changes are needed in `FoodScreen.jsx`**.

### 4. Calorie targets section — show suggestion, never auto-apply
In `AboutScreen.jsx`'s "Calorie targets" section (`:500-516`), alongside
the existing editable `dailyCaloriesBase`/`gymDayBoost` fields, show the
computed suggestion (e.g. "Suggested: 1,850 kcal base · +320 gym day,
based on your stats and N sessions/week") with a **"Use suggestion"**
action that copies the values into the editable fields via the existing
`updateSettings` path. Recompute the suggestion whenever
height/weight/age/sex/weekly-session-count change, but **never silently
overwrite** a value the user has manually set — this mirrors the "don't
auto-clobber a manual setting" spirit of the existing hard gotchas around
`scheduleSave`.

### 5. Activity input — accuracy caveat
`weeklyTrainingSessions` uses the same `totalWeeklySessions`
(`gymDays + eventDays`) already computed in `AboutScreen.jsx:153-157`. This
is a coarse proxy (session count, not duration/intensity) and inherits
whatever `about-me-training-day-picker.md` changes about how weekly
sessions are counted. Acceptable for v1 — revisit if that spec changes
what "a training day" means.

## Sequencing / dependencies
- Depends on `about-me-cosmetic-cleanup.md`'s fix to the hardcoded
  `eventDays = 5` (item #5 there) — this spec's activity multiplier input
  is only as accurate as that count. If implemented out of order, carry
  that specific fix forward here instead of building on the known-wrong
  hardcoded value.

## Out of scope
- Changing `FoodScreen.jsx`'s consumption of `dailyCaloriesBase`/
  `gymDayBoost` — it already reads them correctly; this spec only changes
  how a *suggested* value for those same fields is produced.
- The training-day-picker rework (separate spec) — this spec uses whatever
  weekly session count is available today.

## Files touched
- `src/utils/calorieCalc.js` (new)
- `src/utils/calorieCalc.test.js` (new)
- `src/screens/ProfileSetupScreen.jsx` (add sex field)
- `src/screens/AboutScreen.jsx` (sex field in Body Stats; suggestion UI in
  Calorie targets; unit-conversion fix in Height/Weight `FieldRow`)

No changes to `utils/supabase.js` — `sex` mapping already exists.

## Testing
- Vitest tests for `computeSuggestedCalories` per `CLAUDE.md` item 2 (new
  pure logic in `utils/`): cover male/female/prefer-not-to-say, each
  activity tier boundary, and a known reference case checked against the
  Mifflin-St Jeor formula by hand.
- Playwright smoke assertion update: Body Stats includes a sex control,
  Calorie targets shows a suggestion affordance.

## PR description notes (per `CLAUDE.md`)
- Files touched: listed above.
- Outside original ask but necessary: the imperial-unit save bug fix
  (#2) and the `ProfileSetupScreen.jsx` sex field — both flagged above with
  rationale.
