# About Me — Cosmetic Cleanup (Priority 1)

## Status
Draft, ready to implement. No downstream impact expected — display/removal
only, no data model or Weekly Overview changes.

## Context
`AboutScreen.jsx` has accumulated section ordering that doesn't match actual
usage, one section that's pure UI stub, one section reading a goal system
that onboarding stopped writing to years ago, and one button gated behind a
condition it doesn't actually need. This spec fixes all four without
touching any shared state, Supabase schema, or other screens.

## Scope

### 1. Reorder sections
Move `Section title="Body stats"` (`AboutScreen.jsx:428`) and
`Section title="Calorie targets"` (`:500`) to immediately follow the
profile avatar/name header (`:288-309`), ahead of `Data sync`. New order:
Profile header → Body stats → Calorie targets → Training plan →
Training split → Data sync → (Training goal — see #3) → App info/sign out.

Reasoning: these are the two sections a user actually edits regularly;
`Data sync` and the (removed) `Connected apps` are set-once/rarely-touched
settings that don't need top billing.

### 2. Remove "Connected apps" section
Delete the `Section title="Connected apps"` block (`:898-936`), the
`CONNECTED_SERVICES` constant (`:7-14`), `toggleService`, and the
`connected`/`setConnected` local state (`:129-151`). Per
`docs/PROJECT_CONTEXT.md` §12, this list (Strava/Apple Health/Oura/MFP/
Garmin/Flo) has never been wired to a real integration — toggling
"Connect" only flips a local Set. Keeping it in the UI misrepresents what
the app does.

`profile.connected` (the jsonb array this wrote to) stays in the DB schema
untouched — it becomes an unused column, not a breaking change. No
migration needed. `utils/supabase.js`'s `connected` mapping
(`:174, :179, :186`) can stay as dead pass-through or be removed; either is
fine since nothing else reads it.

### 3. Retire the legacy "Training goal" picker
`AboutScreen.jsx:16-22` (`GOAL_LABELS`) and `:164, :467-497` (the
five-button `goals` picker: strength/muscle/fat-loss/active/flexibility)
write directly to `profile.goal`. This is stale: real goal data has lived
in Stage 2's `goals[]` (`event_race`/`strength_programme`/`sport_activity`/
`general_fitness`/`micro_target`, see `GoalsSetupScreen.jsx:44-48`) since
the 3-stage onboarding replaced the legacy single-screen wizard.
`profile.goal` is now only ever meant to be a *derived* read (`goals[0].type`,
per `CLAUDE.md`'s gotcha list) — this section is the only place in the app
that still writes to it directly, which risks it drifting out of sync with
the real goals array.

Replace the picker with a **read-only summary** of the real goal(s), sourced
from the `goalsPayload` prop already passed into `AboutScreen` (same prop
`onRedoGoals`/AI-plan generation already use — see `:112-115`). Show each
goal's label (map `event_race`/`strength_programme`/etc. to display names —
reuse or extract the label logic already present in `GoalsSetupScreen.jsx`)
and its rank if more than one. No edit affordance here — editing goals is
what "Redo my goals & questionnaire" (already in this file, see #4) is for.

Also update the profile header line (`:301-307`, currently
`GOAL_LABELS[localProfile.goal] || 'No goal set'`) to source from the same
real goals data instead of the legacy field.

This section stops writing `profile.goal` from `AboutScreen.jsx` entirely —
a net reduction in write paths, not an addition, so it does not create new
downstream risk for the `bootstrapUser`/onboarding-routing logic that reads
`profile.goal`.

### 4. Un-gate "Redo my goals & questionnaire"
`AboutScreen.jsx:767` currently gates the button on
`typeof onRedoGoals === 'function' && intakeCompleted`. `handleRedoGoals`
in `App.jsx:434-438` has no actual dependency on intake having been
completed — it just re-enters Stage 2 pre-filled with whatever
`pendingGoalsPayload`/profile data exists, same as a first-time run. The
`intakeCompleted` condition is an artificial restriction that hides the
button for any user who skipped or hasn't finished Stage 3 (draft status),
even though redoing goals works fine from that state.

**Fix:** change the condition to just `typeof onRedoGoals === 'function'`
— always show it whenever the prop is provided (which today is
unconditional on the `'about-me'` render path, `App.jsx:1116`).

### 5. Fix `eventDays` hardcoded to `5`
`AboutScreen.jsx:156`: `const eventDays = hasEventTraining ? 5 : 0;` — a
flat guess, not the plan's actual weekly session count. This number feeds
directly into the profile header summary (`totalWeeklySessions`, `:157`)
and the "Training split" section's session-count chips (`:849-871`), so
it's visibly wrong today for any uploaded plan that isn't exactly 5
sessions/week.

**Fix:** derive it from `eventPlan.sessions`/`eventPlan.meta` — count actual
sessions scheduled in the current plan week (or a simple weekly average if
that's cleaner) instead of hardcoding. Read-only display fix, no schema
change.

## Out of scope
- Calorie calculation logic (see `about-me-calorie-calculation.md`)
- Training split / day-picker rework (see `about-me-training-day-picker.md`)
- Any change to `WeeklyOverviewScreen.jsx`, `utils/supabase.js` mappers
  beyond the optional dead-code removal noted in #2, or any
  `supabase/migrations/` file

## Files touched
- `src/screens/AboutScreen.jsx` (only)

## Testing
- No new pure logic in `utils/` — no new Vitest needed, beyond confirming
  existing suites still pass.
- Update/add a Playwright smoke assertion per `CLAUDE.md` item 3 (this
  changes a screen's core render path): assert Body Stats renders above
  Data Sync, Connected Apps section is absent, and "Redo my goals &
  questionnaire" is present for a test account in draft/incomplete-intake
  state.

## PR description notes (per `CLAUDE.md`)
- Files touched: `AboutScreen.jsx` only.
- Nothing outside spec scope required — no schema change, no shared-state
  change, no new dependency.
