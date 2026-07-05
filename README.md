# Forma — Personal Health Tracker

A personal health and training tracker that runs entirely in the browser. No backend, no subscription. Your data is stored locally in your browser.

---

## What is Forma?

Forma is a React app (built with Vite) that tracks:

- **Training** — workout planning, in-session set/rep logging, and post-session summaries
- **Activity** — non-gym sessions like runs, yoga, and hikes alongside your training calendar
- **Health metrics** — steps, protein intake, and sleep via ring visualisations
- **Coaching nudges** — context-aware daily focus cards (workout targets, nutrition, recovery)
- **Cycle-aware coaching** — optional cycle tracking that adjusts content for hormonal context

It is designed to feel like a native iPhone app and is deployed to Vercel.

---

## Live app

**[https://health-app-two-nu.vercel.app](https://health-app-two-nu.vercel.app)**

---

## Architecture

The app is a single-page React application with no router and no backend. All screens are React components swapped in and out via a `screen` state string in the top-level `App` component. Navigation is `setScreen('gym-hub')`.

Data is persisted to `localStorage` under the key `forma_data` as a JSON snapshot. A 1-second debounce (`scheduleSaveLocal`) prevents excessive writes.

```
src/
├── main.jsx                        ← React entry point
├── App.jsx                         ← Root component, all top-level state, navigation
├── index.css                       ← Global styles, phone frame, dark theme
├── data/
│   └── themes.js                   ← Light/dark colour token maps
├── utils/
│   └── storage.js                  ← localStorage helpers (load, save, debounced save)
├── components/
│   ├── SharedUI.jsx                ← Shared UI primitives (AnimatedNumber, StackedRings, PulseDot, BottomNav)
│   └── tweaks/
│       └── TweaksPanel.jsx         ← Dev-only floating panel for switching theme/screen
└── screens/
    ├── HomeScreen.jsx              ← Home dashboard: coach card, rings, session history
    ├── GymSessionScreen.jsx        ← Live workout tracker + post-session summary
    ├── GymPlanScreens.jsx          ← Gym Hub, Split picker, Session editor, Day activities
    ├── ExerciseScreens.jsx         ← Exercise library + ExerciseImage component
    ├── FoodScreen.jsx              ← Weekly macro tracker
    ├── OnboardingScreen.jsx        ← First-run setup wizard
    └── AboutScreen.jsx             ← Profile and settings editor
```

---

## Key state in `App`

| State | Purpose |
|---|---|
| `screen` | Which screen is visible (`'home'`, `'gym-hub'`, `'gym-session'`, etc.) |
| `profile` | User data: name, age, sex, goal, splitDays |
| `plan` | Training plan: split frequency, today's index, day-level overrides |
| `session` | Live workout: active/paused flag, elapsed seconds, exercise queue |
| `activities` | Per day-of-week non-gym activities (runs, yoga, hikes) |
| `foodLog` | Daily food entries keyed by date string |
| `completedSessions` | Array of finished workout sessions |

---

## Screens

### `HomeScreen` — Dashboard
The main screen. Shows a rotating coach card, activity rings (Steps / Protein / Sleep), sessions-this-week sparkline, and today's planned session. Tapping the session card starts a workout.

### `GymSessionScreen` — Live tracker
Manages the active workout. Set/rep inputs per exercise, a rest countdown after each logged set, pause/resume, and an end-session confirmation. After finishing, routes to `GymSummaryScreen`.

### `GymPlanScreens` — Training planning
Four screens in one file:
- **GymHubScreen** — 7-day training calendar, today's session card, active session banner
- **SplitPickerScreen** — Choose 1–5 training days/week
- **SessionEditorScreen** — Edit a day's exercise list (add, remove, reorder by section)
- **DayActivitiesScreen** — Log non-gym activities for a given day

Also owns the core data: `EX_LIB` (~40 exercises) and `SPLITS` (1–5 day templates).

### `ExerciseScreens` — Exercise library
Searchable reference of all exercises with type and muscle-group filters. `ExerciseImage` renders a colour-coded placeholder card (no real photos) used across all gym screens.

### `FoodScreen` — Macro tracker
Weekly food log with per-meal entries and daily macro totals (protein, carbs, fat). Targets are derived from user settings and whether today is a gym day.

### `OnboardingScreen` — First-run wizard
Multi-step wizard collecting name, age, sex, goal, and training frequency. Completes by writing the profile to `App` state and saving to localStorage.

### `AboutScreen` — Profile & settings
Edit profile fields and unit preferences (kg/lbs, cm/ft). Reset all data button.

---

## Shared components (`SharedUI.jsx`)

| Component | What it does |
|---|---|
| `AnimatedNumber` | Counts from 0 to a value on mount using eased `requestAnimationFrame` |
| `StackedRings` | Concentric SVG rings (Apple Watch style), each animated via `stroke-dashoffset` |
| `PulseDot` | Pulsing dot used to indicate live/active states |
| `BottomNav` | Four-tab navigation bar shared across all screens. Conditionally shows/hides the Cycle tab |

---

## Theme system

Two complete colour token maps (`light` and `dark`) are defined in `src/data/themes.js`. Every screen receives `theme='light'|'dark'` as a prop and runs `const t = themes[theme]` to get all colour tokens. No CSS variables or React context — tokens are threaded via props.

The active theme is toggled from the TweaksPanel (dev tool, bottom-right corner).

---

## Running locally

```bash
npm install
npm run dev
```

App is served at `http://localhost:5173/`.

---

## Deployment

The app is deployed to [Vercel](https://vercel.com/), which builds and hosts it from the root domain (`base: '/'` in `vite.config.js`). A `vercel.json` provides an SPA rewrite so all paths serve `index.html`.

To deploy your own copy:
1. Fork the repo
2. Import it into Vercel (**Add New → Project**) and select the repo
3. Configure the required environment variables in the Vercel project settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`, etc.)
4. Push to `main` — Vercel deploys automatically

If you use Supabase Auth (email confirmation, OAuth) or Google Identity Services, make sure your Vercel deployment domain is added to Supabase's Redirect URLs allow-list and Google Cloud Console's Authorized JavaScript origins, respectively.

---

## AI plan generation (Claude API)

The Stage 3 questionnaire (`DeepQuestionnaireScreen`) and the About Me screen can generate a full training plan by calling the Claude API — the questionnaire answers are assembled into a prompt (`src/utils/planPrompt.js`), sent to a Supabase Edge Function, and the JSON plan that comes back is stored in the `training_plans` table exactly like a manually-uploaded `.xlsx` plan is.

The Anthropic API key must never reach the browser, so the call is proxied through a Supabase Edge Function (`supabase/functions/generate-training-plan`). One-time setup:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link it to your project: `supabase link --project-ref <your-project-ref>`
2. Apply the new migration: `supabase db push` (or run `supabase/migrations/20260705_add_user_intake_preferences_mindset.sql` manually)
3. Deploy the function: `supabase functions deploy generate-training-plan`
4. Set your Anthropic API key as a secret (never as a `VITE_*` env var): `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically for edge functions — no need to set those. Optionally set `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5`) to pin a specific model.

Supported race types are Sprint/Olympic/Half Ironman (70.3)/Full Ironman triathlons and 10K/Half Marathon/Marathon runs — "Generate with AI" is hidden for other goal types (5K, Cycling Sportive, Open Water Swim, Other), which aren't covered by the plan-generation rules.
