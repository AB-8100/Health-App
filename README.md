# Forma — Personal Health & Training Tracker

A personal health and training tracker with a Supabase backend. Sign in with
email/password and your data syncs across devices; an optional Google Sheets
connection gives you a personal, human-readable backup copy.

---

## What is Forma?

Forma is a React app (built with Vite) that tracks:

- **Training** — workout planning, in-session set/rep logging, and post-session summaries
- **Activity** — non-gym sessions like runs, swims, and yoga alongside your training calendar
- **Structured event plans** — upload a `.xlsx` training plan (e.g. an 18-week triathlon build) and Forma turns it into a phased weekly planner
- **Food** — a weekly macro tracker with a built-in food database and custom entries
- **Onboarding** — a 3-stage flow (profile → goals → optional deep fitness intake) that sets up your training split and weekly schedule automatically

It is designed to feel like a native iPhone app and is deployed to Vercel.

---

## Live app

**[https://health-app-two-nu.vercel.app](https://health-app-two-nu.vercel.app)**

---

## Architecture

The app is a single-page React application with no router and no backend
framework — it's a plain SPA that talks directly to Supabase. All screens are
React components swapped in and out via a `screen` state string in the
top-level `App` component. Navigation is `setScreen('gym-hub')`.

**Data flow**: Supabase Postgres is the source of truth. On load, cached data
from `localStorage` (keyed `forma_data_<userId>`) paints instantly while the
real data loads from Supabase; whichever has the newer `savedAt` wins. Every
state change schedules a debounced local cache write (1s) and an immediate,
best-effort Supabase save. If a Google Sheets connection is active (optional,
via the About screen), a debounced backup write (2.5s) goes there too.

```
src/
├── main.jsx                        ← React entry point
├── App.jsx                         ← Root component, all top-level state, auth bootstrap, navigation, save orchestration
├── index.css                       ← Global styles, phone frame, dark theme
├── data/
│   ├── themes.js                   ← Light/dark colour token maps
│   ├── eventPlan.js                ← Date helpers for event training plans (UTC-anchored)
│   ├── sessionDisplay.js           ← emoji/label/colour lookup by session type
│   ├── formaGoals.js               ← Static demo goal data (legacy)
│   └── exerciseDbMap.js            ← Internal exercise id → wger.de exercise id map
├── utils/
│   ├── storage.js                  ← localStorage helpers + debounced save orchestration
│   ├── supabase.js                 ← Supabase client + full load/save mapping for every table
│   ├── googleSheets.js             ← Google OAuth + Sheets read/write (optional backup)
│   ├── overtrain.js                ← Training-load conflict checker
│   ├── trainingPlanImport.js       ← Hand-rolled .xlsx parser for uploaded event plans
│   ├── eventDaySessions.js         ← Resolves which sessions apply to a given date
│   └── sessionCompletion.js        ← Matches completed sessions to scheduled ones
├── components/
│   ├── SharedUI.jsx                 ← Shared UI primitives (AnimatedNumber, StackedRings, PulseDot, BottomNav)
│   └── tweaks/
│       └── TweaksPanel.jsx         ← Dev-only floating panel for switching theme/screen
└── screens/
    ├── LoginScreen.jsx             ← Email/password sign-in and sign-up
    ├── ProfileSetupScreen.jsx      ← Onboarding Stage 1: name, DOB, height/weight
    ├── GoalsSetupScreen.jsx        ← Onboarding Stage 2: goals, schedule, facilities, sports
    ├── DeepQuestionnaireScreen.jsx ← Onboarding Stage 3 (optional): fitness baselines, availability, injury history
    ├── OnboardingScreen.jsx        ← Legacy single-screen onboarding wizard (superseded by the 3-stage flow above)
    ├── HomeScreen.jsx              ← Home dashboard: coach card, rings, session history
    ├── WeeklyOverviewScreen.jsx    ← 7-day planner merging gym split, event plan, and user activities
    ├── SessionDetailScreen.jsx     ← Drill-down for a single day from the Weekly Overview
    ├── GymPlanScreens.jsx          ← Gym Hub, Split picker, Session editor, Day activities
    ├── GymSessionScreen.jsx        ← Live workout tracker + activity timer + post-session summary
    ├── ExerciseScreens.jsx         ← Exercise library + ExerciseImage component
    ├── FoodScreen.jsx              ← Weekly macro tracker
    └── AboutScreen.jsx             ← Profile/settings editor, training-plan upload, Sheets connect
```

---

## Onboarding

New users go through a 3-stage flow rather than a single wizard:

1. **Profile** — name, date of birth, height/weight (metric or imperial).
2. **Goals** — pick and rank one or more goal types (race/event, strength
   programme, sport, general fitness, micro target), set your weekly training
   days, gym/pool access, and any regular sports.
3. **Deep intake** *(optional, skippable)* — fitness baselines (run/swim/bike),
   upcoming availability disruptions, and injury history. Skipping saves a
   draft you can finish later from the About screen.

Completing Goals auto-generates your weekly split and activity schedule from
your answers — you don't manually configure a split unless you want to
change it afterwards.

---

## Key state in `App`

| State | Purpose |
|---|---|
| `screen` | Which screen is visible (`'home'`, `'gym-hub'`, `'gym-session'`, `'weekly'`, etc.) |
| `onboardingStage` | `'profile'` \| `'goals'` \| `'intake'` \| `null` (main app) |
| `profile` | User data: name, age, sex, goal, splitDays, hasGym, hasEventTraining |
| `plan` | Training plan: split frequency, today's index, day-level overrides |
| `session` | Live workout/activity: active/paused flag, elapsed seconds, exercise queue, kind (`gym`/`activity`/`conditioning`) |
| `activities` | Per day-of-week non-gym activities (runs, yoga, swims) |
| `eventPlan` / `eventOverrides` / `planSessionsDone` | Uploaded event training plan and per-day overrides |
| `foodLog` / `customFoods` | Daily food entries keyed by date string, plus user-defined foods |
| `completedSessions` | Array of finished/logged workout and activity sessions |

---

## Screens

### `LoginScreen` — Auth
Email/password sign-in and sign-up via Supabase Auth.

### `HomeScreen` — Dashboard
Shows a rotating coach card, activity rings (Steps / Protein / Sleep), and
today's planned session. Note: the rings and coach nudges are still largely
demo data, not yet wired to real logged history.

### `WeeklyOverviewScreen` — Weekly planner
Merges three sources into one 7-day view: the active gym split's schedule,
any uploaded event training plan's sessions (or per-day overrides), and
user-added activities. Drag-and-drop to reorder which split day lands on
which weekday. Shows a phase bar (Foundation/Build/Peak/Taper) when an event
plan is active.

### `GymSessionScreen` — Live tracker
Manages the active workout. Set/rep inputs per exercise, a rest countdown
after each logged set, pause/resume, and an end-session confirmation. Also
hosts `ActivityTimerScreen` (plain elapsed-time tracking for runs/swims/etc.)
and `GymSummaryScreen`.

### `GymPlanScreens` — Training planning
Four screens in one file:
- **GymHubScreen** — 7-day training calendar, today's session card, active session banner
- **SplitPickerScreen** — Choose 1–5 training days/week
- **SessionEditorScreen** — Edit a day's exercise list (add, remove, reorder by section)
- **DayActivitiesScreen** — Log non-gym activities for a given day

Also owns the core data: `EX_LIB` (~40 exercises) and `SPLITS` (1–5 day templates).

### `ExerciseScreens` — Exercise library
Searchable reference of all exercises with type and muscle-group filters.
`ExerciseImage` renders a colour-coded placeholder card (no real photos) used
across all gym screens.

### `FoodScreen` — Macro tracker
Weekly food log with per-meal entries and daily macro totals (protein, carbs,
fat), plus a built-in ~100-item food database and custom food entries.
Targets are derived from user settings and whether today is a gym day.

### `AboutScreen` — Profile & settings
Edit profile fields and unit preferences (kg/lbs, cm/ft), upload/replace an
event training plan spreadsheet, connect/disconnect Google Sheets backup, and
reset all data.

---

## Shared components (`SharedUI.jsx`)

| Component | What it does |
|---|---|
| `AnimatedNumber` | Counts from 0 to a value on mount using eased `requestAnimationFrame` |
| `StackedRings` | Concentric SVG rings (Apple Watch style), each animated via `stroke-dashoffset` |
| `PulseDot` | Pulsing dot used to indicate live/active states |
| `BottomNav` | Four-tab navigation bar shared across all screens |
| `DraftPlanBanner` | Prompts to finish a skipped/draft deep intake questionnaire |

---

## Theme system

Two complete colour token maps (`light` and `dark`) are defined in
`src/data/themes.js`. Every screen receives `theme='light'|'dark'` as a prop
and runs `const t = themes[theme]` to get all colour tokens. No CSS variables
or React context — tokens are threaded via props.

The active theme is toggled from the TweaksPanel (dev tool, bottom-right corner).

---

## Backend

Supabase (Postgres + Auth + Row Level Security) backs the app. Every table is
scoped to `auth.uid() = user_id`. Migrations live under
`supabase/migrations/` as plain numbered `.sql` files, run manually via the
Supabase SQL editor — there's no CLI/migration-runner wired into CI.

Tables: `profiles`, `user_settings`, `gym_plans`, `gym_sessions`, `food_log`,
`custom_foods`, `day_activities`, `training_plans` (event training plans),
`user_goals` (onboarding Stage 2), `user_intake` (onboarding Stage 3), plus
read-only reference tables `ref_activities`, `ref_exercises`,
`ref_muscle_groups` seeded via `scripts/seed-reference-data.js` from
`supabase/seeds/forma_seed_data.json`.

A Postgres RPC, `get_user_local_date`, returns "today" as a `YYYY-MM-DD`
string in the user's stored timezone.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project credentials
npm run dev
```

App is served at `http://localhost:5173/`.

---

## Testing

```bash
npm test
```

Runs Vitest (jsdom environment) over the pure logic in `src/utils/` and a
couple of screen-logic tests (e.g. `WeeklyOverviewScreen.test.js`). Playwright
is installed but there are no end-to-end specs yet.

---

## Deployment

The documented/live deployment is [Vercel](https://vercel.com/), which builds
and hosts the app from the root domain (`base: '/'` in `vite.config.js`). A
`vercel.json` provides an SPA rewrite so all paths serve `index.html`.

To deploy your own copy:
1. Fork the repo
2. Import it into Vercel (**Add New → Project**) and select the repo
3. Configure the required environment variables in the Vercel project settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`, etc.)
4. Push to `main` — Vercel deploys automatically

If you use Supabase Auth (email confirmation, OAuth) or Google Identity
Services, make sure your deployment domain is added to Supabase's Redirect
URLs allow-list and Google Cloud Console's Authorized JavaScript origins,
respectively.

A GitHub Actions workflow (`.github/workflows/deploy.yml`) also builds and
deploys to GitHub Pages on every push to `main`, as a secondary target.
