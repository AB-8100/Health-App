# About Me — Training Day Picker → Weekly Overview (Priority 3)

## Status
Draft — **highest risk of the three specs, likely needs
`needs-human-review`** per `CLAUDE.md` regardless of test results, because
the recommended design changes shared state semantics
(`plan.scheduleOverride`) that `App.jsx`, `WeeklyOverviewScreen.jsx`, and
`GymPlanScreens.jsx` all depend on. Flagging that up front rather than
after the fact.

## Context
Today, "which days do I train" and "which gym split template runs" are the
same choice, and that choice can only be made through
`SplitPickerScreen.jsx` (`GymPlanScreens.jsx:2662`):

- `plan.splitDays` (1–5) selects a hardcoded template from `SPLITS`
  (`GymPlanScreens.jsx:62` — Full Body, Upper/Lower, Push/Pull/Legs, etc.),
  each with its own fixed `schedule` array assigning specific split-day
  content to specific weekdays.
- `plan.scheduleOverride` (`WeeklyOverviewScreen.jsx:23-30`) can reassign
  which weekday a split-day lands on, but only among weekdays and split-day
  ids that already belong to the *currently selected* template — swapping
  which split-day-id sits in which of the 7 slots. Picking a different day
  count in `SplitPickerScreen` **resets** the schedule to that template's
  default (`GymPlanScreens.jsx:2680-2683`, the `useEffect` on `selected`).

There is no way today to say "I train Mon/Wed/Fri" independent of picking
a specific gym split template — the day selection is baked into the
template's `schedule` array. This spec decouples them: a **training-day
picker** (which weekdays have a session at all) becomes the thing the
About screen exposes and the user can freely re-toggle, and it feeds
`WeeklyOverviewScreen.jsx` directly, whether or not gym content is
involved.

**Separately, and more subtly:** Stage 2 onboarding already collects a
"which days do I train" answer (`trainingDays` in `GoalsSetupScreen.jsx:136`,
saved to `user_goals.training_days_per_week`/`unavailable_days`), but
`utils/supabase.js`'s `loadUserData` (`:22-87`) **never fetches the
`user_goals` table at all** — there is no `dbToGoalsPayload` mapping, and
`goalsPayload` (`App.jsx:142`) only ever gets populated in-memory during
the same session's onboarding flow. On a fresh page load, `goalsPayload`
is `null` until the user redoes onboarding. This is why
`handleStartQuestionnaire`'s existing comment (`App.jsx`, per
`docs/PROJECT_CONTEXT.md` §12) says it "reconstructs a goalsPayload from
the current profile rather than reading back the original Stage 2
payload" — there's no read path to reconstruct it from. This spec does
**not** need to fix that gap (see Recommended Design below, which avoids
depending on `user_goals` reload entirely) but it's worth knowing about
since it's adjacent territory.

## Recommended design
Store the day selection on the existing `gym_plans` row (already loaded
and saved every session — `plan.scheduleOverride`), **not** as a new
column and **not** by reading back `user_goals`. This avoids two of
`CLAUDE.md`'s explicit escalation triggers (a new `supabase/migrations/`
file, and a `utils/supabase.js` load/save change) — though the *logic*
changes below still need careful review since they change what
`scheduleOverride` is allowed to hold and how it's validated.

- **Decouple "which days" from "which split-day-id runs that day".**
  `plan.scheduleOverride` keeps its shape (a 7-slot array, one per
  weekday, each `'—'` or a split-day-id) but its *validity check* changes:
  today `WeeklyOverviewScreen.jsx:29` and `:670` require every non-`'—'`
  slot to be a split-day-id belonging to the *currently selected*
  `SPLITS[plan.splitDays]` template. Instead, a slot being non-`'—'` means
  "this is a training day" — if the specific split-day-id it holds doesn't
  belong to the current template (e.g. the user changed split content
  separately, or picked more/fewer training days than the template has
  split-day ids for), reconcile by cycling the current template's
  `SPLITS[plan.splitDays].days` ids round-robin across whichever slots are
  marked as training days, in weekday order. This reconciliation is a
  small pure function — extract it (e.g.
  `utils/scheduleReconciliation.js`) so it's testable independent of the
  two screens that need it (`SplitPickerScreen` is being replaced by the
  new picker — see below — and `WeeklyOverviewScreen.jsx`'s existing
  drag-and-drop path at `:666-671`, which needs the same reconciliation
  logic when a session is dragged onto a `'—'` day).

- **New "Training days" UI in `AboutScreen.jsx`**, replacing the current
  "Training split" section's day-*count* picker (`:812-895`): 7 toggle
  buttons (Mon–Sun), no split-count/template concept shown here at all.
  Tapping a day on toggles it into a training day (assigned a split-day-id
  via the reconciliation function above, or a default non-gym activity if
  `!hasGym`); tapping it off sets that slot to `'—'` and clears any
  `activities` entry for that weekday. Matches your ask: "should just show
  the days the user has picked... user can re-select which days."
  - `plan.splitDays` (the count/template picker) either moves to a
    secondary "customize split" affordance reachable from this section
    (for `hasGym` users who want to change *what* runs on their training
    days, not *which* days those are), or stays as `SplitPickerScreen` but
    with its day-count-changes-the-days behavior removed — it only picks
    which template's exercise content is assigned, not which weekdays.
    **Recommend confirming this UI split (one section vs. two) before
    implementation** — it's a real product decision, not just a technical
    one.
  - Keep the existing behavior of disabling/hiding this section while
    `hasEventTraining` is true (same rationale as today,
    `AboutScreen.jsx:809-817` — an uploaded event plan already owns the
    schedule for those dates).

- **`WeeklyOverviewScreen.jsx`'s `buildWeekData()`** (`:23-30`) already
  reads `gymSched` from `scheduleOverride`/`split.schedule` and merges it
  with event-plan sessions and user `activities` per §7.3 of
  `docs/PROJECT_CONTEXT.md`. With the validity-check change above, no
  change should be needed to how it *merges* the three sources — only to
  how `gymSched` itself is computed being newly sourced from a freely
  user-edited `scheduleOverride` instead of one seeded from a fixed
  template. Confirm this holds once implementation starts; if
  `buildWeekData` turns out to need direct changes beyond the shared
  reconciliation helper, that's still in scope for this spec (it's the
  explicit "knock-on impact to Weekly Overview" this priority calls out) —
  just note it in the PR description per `CLAUDE.md`.

- **Backward compatibility for existing users:** no migration needed since
  no column changes — existing `plan.scheduleOverride`/`split.schedule`
  values already encode "which days have a session" (any non-`'—'` slot),
  so the new picker's initial state is simply read from whatever's already
  there. No one-time backfill required.

## Acceptance criteria
1. About screen shows a 7-day toggle reflecting the user's actual current
   training days (derived from `scheduleOverride`/`split.schedule` as
   above), independent of any split-template language.
2. Toggling a day on/off updates `plan.scheduleOverride` and is reflected
   in Weekly Overview on next render — no separate "apply" step beyond the
   existing save flow (`scheduleSave`).
3. Toggling days does not silently discard a user's per-day exercise
   customizations on days that remain selected (only newly-added or
   newly-removed days are affected).
4. Existing event-plan-active behavior (section disabled) is preserved.
5. Dragging a session onto a previously-rest (`'—'`) day in
   `WeeklyOverviewScreen.jsx` (existing drag-and-drop, `:666-671`) uses the
   same reconciliation logic, not a separate code path.

## Out of scope
- Fixing `loadUserData`'s missing `user_goals` fetch (noted above as
  adjacent context, not required by this spec's recommended design). If a
  future spec wants `goalsPayload` to survive reload, that's a separate,
  `utils/supabase.js`-touching piece of work requiring its own sign-off.
- Calorie calculation (separate spec) — this spec's changes to what
  counts as a "training day" may shift `totalWeeklySessions"' accuracy;
  revisit that spec's activity-tier input if so, as noted there.
- Retiring `SplitPickerScreen.jsx` entirely — only its day-count-resets-
  the-schedule behavior is in scope for removal; the underlying template/
  exercise-content picker can stay, per the "confirm UI split" note above.

## Files touched (expected)
- `src/screens/AboutScreen.jsx` (new Training Days section, replacing
  current Training Split day-count picker)
- `src/screens/GymPlanScreens.jsx` (`SplitPickerScreen` — remove
  day-count-resets-schedule behavior; behavior scope per the UI-split
  decision above)
- `src/screens/WeeklyOverviewScreen.jsx` (`buildWeekData`, drag-and-drop
  handler — use shared reconciliation helper)
- `src/utils/scheduleReconciliation.js` (new — pure logic, shared between
  the two screens above)
- `src/utils/scheduleReconciliation.test.js` (new)
- `App.jsx` — likely no change if `plan.scheduleOverride` save path is
  reused as-is; confirm during implementation and flag if it needs to
  change (touches root state per `CLAUDE.md`, say so explicitly if so)

## Testing
- Vitest for `utils/scheduleReconciliation.js` per `CLAUDE.md` item 2:
  cover adding a day (assigns next split-day-id in rotation), removing a
  day (clears slot, preserves others), and the drag-and-drop reconciliation
  case.
- Playwright smoke assertion update (`tests/e2e/README.md` convention):
  toggle a training day in About screen, confirm Weekly Overview reflects
  it — this is exactly the "changes a screen's core render path or
  navigation" case the existing e2e suite is meant to catch.

## Escalation flag (per `CLAUDE.md`)
Even if no `utils/supabase.js` or migration change ends up being needed
under the recommended design, this spec changes shared state semantics
(`plan.scheduleOverride`'s meaning) that `WeeklyOverviewScreen.jsx` and
`GymPlanScreens.jsx` both depend on — **recommend routing this one through
human review before merge regardless of test results**, per the spirit of
`CLAUDE.md`'s "touches shared state" and "two reasonable implementations
would behave differently" escalation criteria (the UI-split decision
flagged above is a real fork).

## PR description notes (per `CLAUDE.md`)
- Files touched: listed above.
- Flag explicitly: this changes `plan.scheduleOverride`'s semantics
  (previously template-constrained, now freely user-set) — call this out
  even though it doesn't touch `utils/supabase.js` directly, since the
  *meaning* of already-persisted data changes.
