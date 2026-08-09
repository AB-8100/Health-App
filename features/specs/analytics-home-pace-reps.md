# Analytics screen — pace / reps over time

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass). Kept to the same shape the automated spec pipeline produces
(see `features/PLANNING.md`) so scope decisions are explicit and reviewable,
per `CLAUDE.md`'s "do not implement a feature whose spec you have not read in
full" rule.

## User story
As a user who has logged gym sessions and non-gym activities (runs, swims,
rides, conditioning sessions, etc.), I want a dedicated Analytics page where I
can pick one of the activities I've actually logged and see how it's trending
over time — pace for cardio/distance activities, reps for gym/conditioning
exercises — so I can tell if I'm improving.

## Acceptance criteria
- A new screen, reachable from `BottomNav`, shows:
  - A picker of distinct logged activities, built from `completedSessions`
    (not a hardcoded list — only activities the user has actually logged
    appear).
  - For a **pace-eligible** activity (has `distance` + `elapsed` > 0 logged),
    a line chart of pace over time, x-axis = session date, using:
    - `swim` → mm:ss / 100m
    - `cycle` / `bike` → km/h (speed reads more naturally than pace here)
    - everything else with distance logged (run, walk, row, hike, brick,
      sprint, race, etc.) → mm:ss / km
  - For a **reps-eligible** activity (a completed session with a `queue` of
    exercises — plain gym sessions, or a conditioning session such as
    "Football"/"Climbing"), a secondary exercise picker (only exercises
    actually logged under that activity), then a line chart of total reps
    per session over time for the selected exercise (sum of all sets;
    unilateral sets sum left + right).
  - Empty state (no qualifying sessions yet) instead of a broken/empty chart.
- Chart is hand-rolled inline SVG, matching the existing pattern
  (`Sparkline` in `components/SharedUI.jsx`, `BarSpark` in
  `screens/HomeScreen.jsx`) — no new charting dependency, per CLAUDE.md's
  stack list.
- Pure data-transform logic (grouping activities, computing pace/reps series)
  lives in `src/utils/analytics.js` with Vitest coverage, not inline in the
  screen component.

## Data model implications
None. Reads only from the existing in-memory `completedSessions` (already
loaded via `utils/supabase.js` → `raw` column, see `docs/PROJECT_CONTEXT.md`
§9). No new Supabase table/column, no new dependency.

## Edge cases handled
- Sessions with `distance` present but `elapsed` 0 (or vice versa) are
  excluded from pace series (can't divide by zero / meaningless pace).
- Gym-kind sessions (`type` unset, has `queue`) are grouped under a single
  "Gym" activity; conditioning sessions (`type: 'conditioning'`) are grouped
  by their `workout` label instead, since that label is the actual
  user-facing activity name (e.g. "Football"), not a generic bucket.
- `distance`/`distanceUnit` are trusted as already-normalized totals (the
  swim logging UI, `SwimDistanceFields` in `GymSessionScreen.jsx`, computes
  total distance from pool length × lengths before it's ever saved) — pace
  math does not re-derive distance from `poolLengthM`/`lengths`.
- Fewer than 2 data points for a series → chart still renders (single point
  or empty-state copy), doesn't throw.

## Explicitly out of scope
- No new charting dependency/library.
- No changes to how sessions are logged (`GymSessionScreen.jsx` finish flows)
  — this is a read-only analytics view over existing data.
- No weight/volume-over-time tracking (spec is pace + reps only, per the
  request).
- Not wiring this into `HomeScreen.jsx`'s existing (still-demo) rings/focus
  cards — this is a separate, additional screen, not a rework of the
  existing Home dashboard.
- No date-range filter/zoom controls — full history only, v1.

## Files this touches
- `src/utils/analytics.js` (new) — pure transforms, per file map §13
  ("change what shows on the weekly planner" pattern → new pure logic goes
  in `utils/`).
- `src/utils/analytics.test.js` (new) — Vitest.
- `src/screens/AnalyticsScreen.jsx` (new) — screen component.
- `src/App.jsx` — import + `renderScreen` branch for `screen === 'analytics'`.
- `src/components/SharedUI.jsx` — add an `analytics` entry to `BottomNav`'s
  `allItems`.
- `tests/e2e/smoke.spec.js` — one smoke assertion, per `tests/e2e/README.md`.
