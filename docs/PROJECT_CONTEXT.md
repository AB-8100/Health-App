# Forma — Project Context

*Written 2026-07-17. This document is meant to be pasted into a Claude Project's
knowledge base so Claude has accurate, current context on this codebase. The
root `README.md` is stale (it describes an earlier "local-only, no backend"
version of the app) — this document reflects what's actually in the code today.*

---

## 1. What Forma is

Forma is a personal health & training tracker: workout planning and live
in-session logging, non-gym activity tracking (runs, swims, yoga, etc.),
structured "event" training plans (e.g. triathlon/marathon build imported from
a spreadsheet), a weekly macro/food tracker, and a multi-stage onboarding flow
that captures goals and a fitness intake. It's built to feel like a native
iPhone app (rendered inside a phone-frame chrome on desktop) and is a React SPA
with a real backend (Supabase) — it is **not** local-only despite what the
README says.

Product name in-app: **Forma**. Repo name: `Health-App`.

---

## 2. Tech stack

- **React 18** + **Vite 5** — no framework (no Next.js), no router (single
  `screen` state string drives which component renders)
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth + RLS, the source
  of truth for all user data
- **Google Sheets API + Google Identity Services** — optional secondary sync
  target, OAuth2 implicit-flow token client
- **JSZip** — used to hand-parse uploaded `.xlsx` training-plan files (see §8.4)
  without pulling in a full XLSX library (avoids known prototype-pollution/ReDoS
  advisories in the popular ones)
- **@hello-pangea/dnd** — drag-and-drop reordering (Weekly Overview schedule)
- **Vitest** (+ jsdom) — unit tests; **Playwright** is a devDependency but no
  e2e test files currently exist in the repo
- No CSS framework — plain CSS (`index.css`) + inline styles driven by JS theme
  token objects (no Tailwind, no styled-components, no CSS variables/context)
- No state library (Redux/Zustand/etc.) — everything is `React.useState` in
  the root `App` component, threaded down via props

Scripts (`package.json`): `npm run dev`, `npm run build`, `npm run preview`,
`npm test` (`vitest run`).

---

## 3. High-level architecture

Single-page app, no router. `src/App.jsx` owns all top-level state and a
`screen` string (`'gym-hub'`, `'weekly'`, `'gym-session'`, `'food'`,
`'about-me'`, etc.); `renderScreen(screen)` is a big if/else that returns the
matching screen component with the props it needs. Navigation = `setScreen(x)`
(exposed to children as the `onNav` prop / `navigate()` helper).

```
src/
├── main.jsx                    React entry point
├── App.jsx                     Root component: all state, auth bootstrap, navigation, save orchestration
├── index.css                   Global styles, phone-frame chrome, fonts
├── supabaseClient.js            (legacy/duplicate — see utils/supabase.js, the one actually imported by App.jsx)
├── data/
│   ├── themes.js                Light/dark colour token maps (no CSS vars — threaded via props)
│   ├── eventPlan.js              Pure date helpers for the "event training plan" feature (UTC-anchored)
│   ├── sessionDisplay.js         emoji/label/color lookup by session type, shared across screens
│   ├── formaGoals.js             Static demo goal data (legacy dashboard concept, largely superseded by Goals/Intake onboarding)
│   └── exerciseDbMap.js          Maps internal exercise ids → wger.de exercise DB ids (for images/lookups)
├── utils/
│   ├── storage.js                localStorage cache + debounced save orchestration (scheduleSaveAll)
│   ├── supabase.js               Supabase client + full load/save mapping for every table
│   ├── googleSheets.js           Google OAuth + Sheets read/write (optional secondary backup)
│   ├── overtrain.js               Training-load conflict checker (uses ref_activities table)
│   ├── trainingPlanImport.js      Hand-rolled .xlsx parser (JSZip + DOMParser) for uploaded event plans
│   ├── eventDaySessions.js        Resolves which sessions apply to a date (override vs. uploaded plan)
│   └── sessionCompletion.js       Matches completed sessions to scheduled ones for a given day
├── components/
│   ├── SharedUI.jsx               AnimatedNumber, StackedRings, PulseDot, BottomNav, DraftPlanBanner
│   └── tweaks/TweaksPanel.jsx     Dev-only floating panel (theme toggle, screen jump, reset data)
└── screens/
    ├── LoginScreen.jsx            Supabase email/password sign-in + sign-up
    ├── ProfileSetupScreen.jsx     Onboarding Stage 1 — name/DOB/height/weight, unit toggle
    ├── GoalsSetupScreen.jsx       Onboarding Stage 2 — goal picking, ranking, per-goal config, schedule, facilities, sports
    ├── DeepQuestionnaireScreen.jsx Onboarding Stage 3 (optional/skippable) — fitness baselines, availability, injury history
    ├── OnboardingScreen.jsx        Legacy single-screen onboarding wizard (still reachable via TweaksPanel, mostly superseded by the 3-stage flow)
    ├── HomeScreen.jsx              `RefinedHome` — dashboard: rotating focus card, activity rings, sparkline (largely still demo data, see §9)
    ├── WeeklyOverviewScreen.jsx    7-day planner: gym + event-plan + user activities merged per day, drag-to-reorder, phase bar
    ├── SessionDetailScreen.jsx     Drill-down for a single day from Weekly Overview: start/log/edit/delete sessions
    ├── GymPlanScreens.jsx          GymHubScreen, SplitPickerScreen, SessionEditorScreen, DayActivitiesScreen + EX_LIB/SPLITS data (largest file, ~3500 lines)
    ├── GymSessionScreen.jsx        Live set/rep logging, rest timer, ActivityTimerScreen (plain elapsed-time), GymSummaryScreen, PlaceholderScreen
    ├── ExerciseScreens.jsx         Searchable exercise library + ExerciseImage (colour-coded placeholder, no real photos)
    ├── FoodScreen.jsx              Weekly macro tracker, built-in ~100-item food DB, custom foods
    └── AboutScreen.jsx             Profile/settings editor, connected-services list (mostly stubs), training-plan upload, Sheets connect/disconnect
```

---

## 4. Data & persistence model

Three layers, in priority order when the app loads:

1. **Supabase Postgres** — source of truth. One row per user per table (see
   §9 for schema), RLS-scoped to `auth.uid() = user_id`.
2. **`localStorage`** cache (`forma_data_<userId>`) — read first for instant
   paint on load, then reconciled/overwritten by whichever of Supabase or the
   cache has the newer `savedAt` timestamp. Falls back to cache-only if the
   Supabase fetch throws (keeps the app usable offline/on network errors).
3. **Google Sheets** (optional, opt-in from About screen) — a personal backup
   copy in the user's own Google Drive. A `Backup` tab stores the full JSON
   snapshot (source for re-hydration); other tabs (`Profile`, `Sessions`,
   `Food Log`, `Custom Foods`, `Settings`) are human-readable exports. Token
   stored in `localStorage`, expires after 55 min, "needs-reconnect" state
   surfaces in the UI when stale.

**Save flow**: any state setter in `App.jsx` (e.g. `setProfile`, `setPlan`)
calls `scheduleSave({...overrides})` in a `setTimeout(…, 0)` right after the
React state update. `scheduleSave` builds a full snapshot object and calls
`scheduleSaveAll`, which:
- debounces a `localStorage` write by 1s,
- fires an **immediate**, fire-and-forget `saveUserData()` to Supabase
  (failures only `console.warn`, not surfaced to the user — see §12 gotchas),
- optionally debounces a Sheets write by 2.5s if connected.

`buildSnapshot()` in `App.jsx` is the canonical shape of a full snapshot:
`{ profile, plan, userSettings, completedSessions, foodLog, activities,
customFoods, eventOverrides, preselectedQueues, planSessionsDone, eventPlan,
savedAt }`.

---

## 5. Auth & user lifecycle

Supabase Auth (email/password only in the UI — no OAuth wired up despite
`user_metadata.full_name` handling suggesting it was considered). Flow in
`App.jsx`:

- `authState`: `'loading' → 'login' | 'app'`. A 6s timeout forces `'login'` if
  Supabase never responds.
- `bootstrapUser(session)` — on sign-in: hydrate from cache immediately, then
  race Supabase vs. cache by `savedAt`, decide if the user is "new" (no
  Supabase data at all → wipe state and start onboarding, even if a stale
  local cache exists — handles the "account reset but old browser cache"
  case).
- Routing after login: no profile → Stage 1 (profile) onboarding; profile
  but no `goal` → Stage 2 (goals); otherwise → `'weekly'` screen.
- `handleSignOut` clears all in-memory state and disconnects Sheets.

---

## 6. Onboarding — 3-stage flow

This is the main "new user" path and it's more elaborate than the README's
description of a single wizard:

1. **Stage 1 — `ProfileSetupScreen`**: name, DOB (age derived), height/weight
   with metric↔imperial toggle. On complete → Stage 2.
2. **Stage 2 — `GoalsSetupScreen`**: multi-select goal types (`event_race`,
   `strength_programme`, `sport_activity`, `general_fitness`, `micro_target`),
   ranks them (Primary/Secondary/Supporting) if >1 selected, per-goal-type
   config screens, weekly training-day picker, gym/pool facility access,
   regular sports list. Saved to Supabase `user_goals` table. On complete →
   Stage 3.
3. **Stage 3 — `DeepQuestionnaireScreen`** (skippable, "draft" status if
   skipped): conditionally shows run/swim/bike baseline steps depending on
   goal types (e.g. triathlon-flavoured `event_race` shows all three),
   availability (holidays, one-off events, standing commitments), injury
   history. Saved to Supabase `user_intake` table.

After Stage 3, `handleIntakeComplete` computes an **auto-generated weekly
activity schedule** from the goals payload (`generateActivitySchedule` /
`getAutoSplitDays` in `App.jsx`): spreads chosen activities across the
selected training days, decides `plan.splitDays` (1–5) from however many of
those days are gym days, and non-gym days become `activities` entries.

Stage 3 can also be **re-entered later** from within the app (About screen or
a banner) via `handleStartQuestionnaire` — in that case completing it patches
the existing plan/activities in place rather than running full onboarding.

There is also a **legacy single-screen `OnboardingScreen.jsx`** still present
and reachable via the dev TweaksPanel, but the 3-stage flow above is what new
users actually go through.

---

## 7. Core domain concepts

### 7.1 Gym training (`GymPlanScreens.jsx`)
- `EX_LIB` — ~40 hardcoded exercises with muscle group + type
  (`compound`/`accessory`/`core`/`mobility`).
- `SPLITS` — templates keyed by days/week (1–5): Full Body, Upper/Lower,
  Push/Pull/Legs, etc., each with a `schedule` (which day of week maps to
  which split day) and per-day exercise lists by section.
- `GymHubScreen` — 7-day calendar, today's session card, active-session
  resume banner.
- `SplitPickerScreen` / `SessionEditorScreen` / `DayActivitiesScreen` — change
  split, edit a day's exercises (reorder via drag-and-drop), and manage
  non-gym activities for a given weekday.
- `plan.overrides` — per-split-day-id customizations layered over the
  template; `plan.scheduleOverride` — per-weekday overrides of which split
  day (or `'—'` for rest) runs that day.

### 7.2 Live session tracking (`GymSessionScreen.jsx`)
- **Gym session** (`kind: 'gym'`): exercise queue with set/rep (and weight)
  logging, rest-countdown timer after each set, pause/resume, unilateral
  exercises log left/right independently.
- **Activity session** (`ActivityTimerScreen`, `kind: 'activity'`): plain
  elapsed-time start/pause/stop for runs, swims, etc. Finishing collects
  distance/pool-length/lengths/RPE depending on activity type.
- **Conditioning session** (`kind: 'conditioning'`): logs like a gym session
  (pick exercises, log sets/reps) but under a non-gym activity label — added
  so "gym-style" logging isn't gym-exclusive.
- All three converge into `completedSessions` (flat array, one entry per
  finished/manually-marked session) which is what Weekly Overview,
  session-completion matching, and Supabase `gym_sessions` are built from.

### 7.3 Weekly Overview (`WeeklyOverviewScreen.jsx`)
Merges three independent sources into one 7-day view per `buildWeekData()`:
1. the active gym split's schedule (`plan.splitDays`/`scheduleOverride`),
2. event-plan sessions for that date (`eventOverrides` takes precedence over
   the uploaded plan's own `sessions`, via `getEventSessionsForDate`),
3. user-added non-gym `activities` keyed by weekday index.

Each day's sessions are cross-checked against `completedSessions` for that
calendar date (`sessionCompletion.js`) to show solid/complete chips vs.
pending ones. Drag-and-drop (`@hello-pangea/dnd`) lets a user reorder which
split day lands on which weekday. A `PhaseBar` shows Foundation/Build/
Peak/Taper phase context when an event plan is active.

### 7.4 Event training plans (`eventPlan.js`, `trainingPlanImport.js`)
A user can upload a **`.xlsx` training plan** (e.g. an 18-week triathlon plan)
from the About screen. It's parsed **without a full XLSX library** — a
hand-rolled reader pulls just `workbook.xml`, `sharedStrings.xml`, and the
matching worksheet XML out of the zip via JSZip + `DOMParser`, looking for a
header row containing `date`, `wk`, `phase`, `discipline` columns. Produces
`{ meta, phases, sessions }`, stored in Supabase `training_plans`
(`training_type='event'`). Replacing a plan wipes gym split, activities, and
all per-day overrides so the Weekly Overview shows *only* the freshly
uploaded plan (`handleUploadTrainingPlan` in `App.jsx`). Plan dates are
UTC-midnight-anchored throughout so a plan's "Monday" doesn't shift for users
in different timezones; "today", by contrast, is computed from the local
clock.

### 7.5 Food tracking (`FoodScreen.jsx`)
Weekly view, 4 meal buckets (breakfast/lunch/dinner/snacks), a built-in
~100-entry per-100g food database (protein/dairy/carbs/etc. sources) plus
user-defined `customFoods`. Daily macro targets are derived from
`userSettings` (`dailyCaloriesBase`, `gymDayBoost` applied on gym days).

### 7.6 Training-load / overtraining checks (`utils/overtrain.js`)
Scores each planned day's leg/upper/cardio load (high/medium/low/none →
3/2/1/0) using the Supabase `ref_activities` reference table (with a
hardcoded fallback table if that fetch fails), and flags conflicts (e.g. two
high-leg-load days back to back). Used by the Weekly Overview's drag handler
and day-detail panel.

---

## 8. Reference data (Supabase-seeded, read-only)

`supabase/migrations/20260623_create_reference_tables.sql` defines
`ref_activities`, `ref_exercises`, `ref_muscle_groups` — public read-only
(RLS `using (true)`, no client writes). Seeded from
`supabase/seeds/forma_seed_data.json` via `scripts/seed-reference-data.js`,
a one-time idempotent upsert script run manually with a service-role key
(`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` env vars) — not part of the app
runtime or CI.

---

## 9. Database schema (Supabase Postgres)

All tables: `user_id uuid references auth.users(id) on delete cascade`, RLS
enabled, one policy per CRUD op scoped to `auth.uid() = user_id`.

| Table | Shape | Notes |
|---|---|---|
| `profiles` | name, age, sex, height_cm, weight_kg, bmi (derived), goal, location, timezone, has_gym, has_event_training, tracks_cycle, split_days, connected (jsonb), extra (jsonb) | one row per user (`unique(user_id)`) |
| `user_settings` | weight_unit, height_unit, daily_calories_base, gym_day_boost | one row per user |
| `gym_plans` | split_days, today_idx, overrides (jsonb), schedule_override (jsonb) | one row per user |
| `gym_sessions` | session_date, workout_name, elapsed_seconds, exercises (jsonb), raw (jsonb — full client object) | **fully replaced** on every save (delete-then-insert); `raw` is what's read back, DB `id` is never round-tripped |
| `food_log` | log_date, food_name, calories, protein_g, carbs_g, fat_g, sugar_g, meal, extra (jsonb) | fully replaced on every save |
| `custom_foods` | name, calories, protein_g, carbs_g, fat_g, sugar_g, extra (jsonb) | fully replaced on every save |
| `day_activities` | day_idx, items (jsonb) | `unique(user_id, day_idx)`, one row per weekday |
| `training_plans` | training_type ('event'), overrides (jsonb), done (jsonb), meta/phases/sessions (jsonb, added later), preselected_queues (jsonb, added later) | `unique(user_id, training_type)` — designed to support future non-event training types |
| `user_goals` | goals (jsonb array), primary_goal_type, training_days_per_week, unavailable_days (text[]), gym_access, pool_access, pool_days (text[]), regular_sports (jsonb) | Stage 2 onboarding output |
| `user_intake` | status ('draft'\|'complete'), run/swim/bike_baseline (jsonb), availability (jsonb), injury (jsonb), completed_at | Stage 3 onboarding output |
| `ref_activities` / `ref_exercises` / `ref_muscle_groups` | public read-only reference/seed data | no `user_id` column |

A Postgres RPC `get_user_local_date(p_user_id)` returns "today" as a
`YYYY-MM-DD` string in the user's stored `timezone`.

Migrations are plain numbered `.sql` files under `supabase/migrations/`, run
manually via the Supabase SQL editor (no CLI/migration-runner wired into CI).

---

## 10. Testing

Vitest + jsdom. Test files live next to what they test:
- `WeeklyOverviewScreen.test.js`
- `utils/trainingPlanImport.test.js` (xlsx parsing correctness)
- `utils/sessionCompletion.test.js`, `utils/eventDaySessions.test.js`,
  `utils/dayActivitiesRemoval.test.js`, `utils/supabase.test.js`

No component/UI test rendering framework is wired up (no `@testing-library/react`
in devDependencies) — tests target pure logic functions extracted into
`utils/`, not rendered screens. Playwright is installed but has no e2e specs
in the repo yet.

---

## 11. Deployment

Two deployment paths currently coexist in the repo:
- **Vercel** (per README, and `vercel.json` SPA rewrite) — the actual
  documented/live deployment target: `https://health-app-two-nu.vercel.app`.
- **GitHub Pages** (`.github/workflows/deploy.yml`) — builds on every push to
  `main` and deploys to `https://ab-8100.github.io/Health-App/` via GitHub
  Actions, injecting `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_GOOGLE_CLIENT_ID`, `VITE_APP_URL` from repo secrets.

Required env vars (`.env.example`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (required), `VITE_GOOGLE_CLIENT_ID` (optional, for
Sheets sync). Whichever domain(s) are live need to be in Supabase's Auth
Redirect URL allow-list and Google Cloud Console's Authorized JS origins.

---

## 12. Known gotchas / things to keep in mind when changing this code

- **`scheduleSave`'s Supabase write is fire-and-forget** — most call sites
  only `console.warn` on failure, so a save can silently fail while local
  cache and UI look fine (one path, `handleUploadTrainingPlan`, was
  deliberately changed to `await` and surface errors — see the comment in
  `App.jsx` around `handleUploadTrainingPlan`). Don't assume a `setX(...)`
  call guarantees the write reached Supabase.
- **`gym_sessions`, `food_log`, `custom_foods` are delete-then-insert on every
  save**, not upserted by row — client-generated ids (`Date.now().toString()`,
  `custom_${Date.now()}`) are never sent as the DB primary key (would break
  the uuid column); the DB assigns its own id and the client's own id lives
  in a `raw`/spread field instead.
- **Onboarding routing is stage-based, not screen-based** — `onboardingStage`
  (`'profile' | 'goals' | 'intake' | null`) takes priority over `screen` in
  `renderScreen`. Re-entering Stage 3 later in the app (`handleStartQuestionnaire`)
  reconstructs a `goalsPayload` from the current `profile` rather than reading
  back the original Stage 2 payload — watch for drift if you add new
  goal-dependent fields to Stage 3.
- **Event-plan dates are UTC-midnight-anchored; "today" is local** — mixing
  these up reintroduces off-by-one-day bugs across timezones (see comments
  in `data/eventPlan.js` and `WeeklyOverviewScreen.jsx`'s `toDateKey`).
- **`profile.goal` (legacy single-select) vs. `goals[]` (Stage 2 array)
  coexist** — `profile.goal` is derived as `goals[0].type` and can never be
  `'event_race'` on its own; `hasEventTraining` is tracked as a separate
  boolean specifically because of this.
- The dashboard (`HomeScreen.jsx`'s activity rings, coach nudges,
  `SharedUI.jsx`'s `RINGS_DATA`/`COACH_NUDGES`) is still substantially
  **demo/placeholder data** — steps/protein/sleep rings and rotating focus
  cards are not yet wired to real logged data.
- `AboutScreen.jsx`'s `CONNECTED_SERVICES` list (Strava, Apple Health, Oura,
  MyFitnessPal, Garmin, Flo) is **UI only** — no real integrations exist
  beyond Supabase auth + optional Google Sheets sync.
- There's a duplicate/legacy `src/supabaseClient.js` alongside the actual
  `src/utils/supabase.js` that the app imports from — don't assume the former
  is wired up to anything.
- Exercise "images" (`ExerciseImage` in `ExerciseScreens.jsx`) are
  colour-coded placeholder cards, not real photos; `data/exerciseDbMap.js`
  maps to wger.de ids but isn't currently used to fetch real images.

---

## 13. Quick file map for common tasks

| I want to... | Look at |
|---|---|
| Change what happens on sign-up/sign-in | `App.jsx` (`bootstrapUser`, `handleLogin`, `handleSignUp`), `screens/LoginScreen.jsx` |
| Add a new onboarding question | `screens/GoalsSetupScreen.jsx` or `screens/DeepQuestionnaireScreen.jsx` + matching Supabase migration + `utils/supabase.js` mappers |
| Change a workout split template or exercise | `screens/GymPlanScreens.jsx` (`EX_LIB`, `SPLITS`) |
| Change how a live workout is logged | `screens/GymSessionScreen.jsx` |
| Change what shows on the weekly planner | `screens/WeeklyOverviewScreen.jsx` (`buildWeekData`), `utils/eventDaySessions.js`, `utils/sessionCompletion.js` |
| Add/adjust a food item or macro target | `screens/FoodScreen.jsx` (`FOOD_DB`, `MEALS`) |
| Change what gets saved/loaded from Supabase | `utils/supabase.js` (mappers + `loadUserData`/`saveUserData`), matching migration under `supabase/migrations/` |
| Change the Google Sheets backup format | `utils/googleSheets.js` |
| Change training-plan spreadsheet parsing | `utils/trainingPlanImport.js` |
| Change colours/theme | `data/themes.js` |
