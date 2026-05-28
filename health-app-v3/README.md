# Forma — Personal Health Tracker

A personal health and training tracker that runs entirely in the browser. No backend, no subscription. Your data lives in your Google Drive.

---

## What is Forma?

Forma is a PWA (Progressive Web App) built with React. It tracks:

- **Training** — workout planning, in-session set/rep logging, and post-session summaries
- **Activity** — non-gym sessions like runs, yoga, and hikes alongside your training calendar
- **Health metrics** — steps, protein intake, sleep, and hydration via ring visualisations
- **Coaching nudges** — context-aware daily focus cards (workout targets, nutrition, recovery)
- **Cycle-aware coaching** — optional cycle tracking that adjusts all content for hormonal context

It is designed to feel like a native iPhone app and can be installed on your home screen via Safari's "Add to Home Screen". Once installed, it works offline.

---

## Architecture overview

The app is a single-page React application with no router, no build step, and no backend. All screens are React components that get swapped in and out via a `screen` state string held in the top-level `App()` component. Navigation is just `setScreen('gym-hub')`.

Files are loaded as Babel-transpiled JSX scripts in the browser. They share state by attaching components and data to `window.*` — the global scope acts as the module system. In a production build you would replace this with ES module imports and a bundler like Vite.

Data storage is handled via Google Drive (see Setup below). All health data is saved to a private `forma-data.json` file in the user's Google Drive App Data folder, invisible to normal Drive browsing. `localStorage` is used as an offline cache so the app works without a network connection.

```
Health_App_v2.html   ← entry point, phone frame, App() component, router
├── tweaks-panel.jsx ← dev-only floating panel for switching theme/screen/profile
├── shared.jsx       ← demo data + reusable UI primitives (Ring, Bar, BottomNav, etc.)
├── home-refined.jsx ← Home screen: coach card, rings, sessions, quick log
├── screen-gym.jsx   ← In-session workout tracker + post-session summary
├── screen-gym-plan.jsx ← Gym planning: Hub, Split picker, Session editor, Day activities
├── screen-library.jsx  ← Exercise library screen + ExerciseImage placeholder component
├── screen-onboarding.jsx ← Multi-step onboarding wizard
├── manifest.json    ← PWA metadata (name, icons, theme colour, display mode)
└── sw.js            ← Service worker: offline caching, stale-while-revalidate
```

---

## File-by-file guide

### `Health_App_v2.html` — Entry point and app shell

This is the only HTML file. It does three things:

1. **Loads dependencies** — React 18 and Babel Standalone from CDN via `<script>` tags. Babel transpiles JSX in the browser so no build step is needed.
2. **Defines the phone frame** — pure CSS that constrains the app to a `390×820px` rounded frame. Remove this CSS and the app fills the full viewport. The React app has no knowledge of the frame.
3. **Defines `App()`** — the root React component, written inline in a final `<script type="text/babel">` block. `App()` owns all top-level state (`screen`, `profile`, `plan`, `session`, `activities`) and renders the correct screen via `renderScreen()`, which is a big if/else acting as the client-side router.

Key state held in `App()`:

| State | Purpose |
|---|---|
| `screen` | Which screen is currently visible (`'home'`, `'gym-hub'`, `'gym-session'`, etc.) |
| `profile` | User data: name, age, sex, goal, splitDays, connected services |
| `plan` | Training plan: split frequency, today's index, any day-level overrides |
| `session` | Live workout: active/paused flag, elapsed seconds, exercise queue |
| `activities` | Per day-of-week array of non-gym activities (runs, yoga, hikes) |

The `TWEAK_DEFAULTS` block and `TweaksPanel` component are **development-only** tools for switching themes, profiles, and screens without touching code. Remove them in production.

---

### `tweaks-panel.jsx` — Developer control panel

A floating panel (bottom-right corner) for design review and prototyping. Not shown to end users — remove before shipping.

- **`useTweaks(defaults)`** — React hook that manages a key/value store of dev settings. Returns `[values, setTweak]`. Accepts `setTweak('key', value)` or `setTweak({ key: value })`.
- **`TweaksPanel`** — the floating container component. Draggable.
- **Control components** — `TweakRadio`, `TweakSelect`, `TweakSlider`, `TweakToggle`, `TweakColor`, `TweakNumber`, `TweakText`, `TweakButton`. Each maps to a styled form control.

All components are attached to `window.*` so other files can use them without imports.

---

### `shared.jsx` — Demo data and shared UI primitives

Two responsibilities in one file: demo data (hardcoded stand-ins for what would come from a real API or Google Drive) and a library of reusable UI components used across all screens.

**Demo data** (top of file):

| Constant | What it represents |
|---|---|
| `COACH_NUDGES` | Three rotating coach cards: workout focus, nutrition nudge, hydration |
| `RINGS_DATA` | Today's values and goals for Move / Protein / Water / Sleep rings |
| `TODAY_SESSION` | The planned workout: name, focus, exercises with targets and PR flags |
| `WEEK_NUDGES` | Weekly health suggestions shown on the home screen |
| `QUICK_LOG` | Data for the quick-log row (weight, sleep, mood, water) |

**UI primitives** (exported to `window.*`):

| Component | What it does |
|---|---|
| `AnimatedNumber` | Counts from 0 to a value on mount using `requestAnimationFrame` with ease-out |
| `Ring` | SVG circle that animates its fill via `stroke-dashoffset` transition |
| `StackedRings` | Renders multiple `Ring` components concentrically (Apple Watch style) |
| `Bar` | Animated horizontal progress bar |
| `BottomNav` | Four-tab navigation bar shared across all screens. Conditionally shows/hides the Cycle tab based on the user's `tracksCycle` setting |
| `PulseDot` | Pulsing green dot used to indicate live/active states |
| `Sparkline` | Minimal inline SVG line chart (polyline + endpoint dot) |

Everything is exported at the bottom via `Object.assign(window, { ... })`.

---

### `home-refined.jsx` — Home screen

The main dashboard the user sees on opening the app.

**Theme system**: a `themes` object at the top of the file defines two complete token maps — `light` and `dark`. The `RefinedHome` component receives `theme='light'|'dark'` as a prop and runs `const t = themes[theme]` to get every colour token. All styles derive from `t.*`. No CSS variables or React context — the token object is threaded via props.

**What `RefinedHome` renders (top to bottom)**:

1. **Status bar** — fake iOS time and icons (9:41, signal, battery)
2. **Active session banner** — conditionally shown if `activeSession` prop is truthy. Tapping it calls `onResumeSession()` and routes back to the in-session screen
3. **Header row** — date, greeting with user's first name from `profile` prop, and a cycle phase pill (if `tracksCycle`) or training block pill (if not)
4. **Today's focus card** — dark-background card showing a rotating coach message. Cycles through `FOCUS_CARDS` via local `focusIdx` state. Three dot indicators let the user switch cards manually. If the user doesn't track their cycle, hormonal copy is replaced with neutral alternatives
5. **Rings card** — `StackedRings` component (Steps / Protein / Sleep) plus `AnimatedNumber`-driven progress rows
6. **Sessions this week card** — count, 8-week bar sparkline (`BarSpark`, local to this file), and session pills for completed workouts. A dashed pill shows today's planned session
7. **Today's session preview** — first 3 exercises from `TODAY_SESSION`. Tapping the card calls `onStartSession()`
8. **Quick log row** — three buttons for Sleep / Mood / Water. Currently UI-only (no write logic)

Local components (not exported): `BarSpark` (bar chart sparkline), `ActivityIcon` (inline SVG sport glyphs).

Exports: `window.RefinedHome`, `window.themes` (themes object used by all other screen files).

---

### `screen-gym.jsx` — In-session workout tracker and summary

Everything that happens *during* and *after* a workout.

**`GymSessionScreen`** — the live tracking UI:

- On mount, seeds `session.queue` from `GYM_QUEUE` (the demo Push day exercise list) if no queue exists yet. Session state lives in `App()` — not locally — so navigating away and back preserves the workout.
- **Set tracker**: renders each exercise's sets as an editable grid of weight/reps inputs. `updateSet(i, field, value)` handles field edits. `logSet()` marks the current set done, starts a 90-second rest countdown, and auto-advances to the next exercise when all sets are complete.
- **Progress bar**: `totalDone / totalSets` drives a thin fill bar at the top.
- **Pause/resume**: `togglePause()` flips `session.paused`, which pauses the elapsed-time interval in `App()`.
- **End session**: shows a confirmation overlay, then calls `onComplete({ queue, elapsed })` which routes to the summary screen.

**`GymSummaryScreen`** — post-workout summary:

- Receives the completed session object and computes: duration, total volume (kg lifted), sets completed vs planned, and PR hits.
- Shows a breakdown table of every exercise with best set and skipped state.
- Free-text notes textarea.
- "Save & back to home" button calls `onDone()` which clears session state in `App()`.

Also contains **`PlaceholderScreen`** — a minimal stub rendered for any screen that isn't built yet (Food, Cycle).

Exports: `window.GymSessionScreen`, `window.GymSummaryScreen`, `window.PlaceholderScreen`.

---

### `screen-gym-plan.jsx` — Gym planning screens

Everything related to planning training *before* a workout starts.

**Core data** (used by multiple files):

| Constant | What it holds |
|---|---|
| `EX_LIB` | ~40 exercises keyed by ID (e.g. `'bench'`, `'squat'`). Each has name, muscle group, and type (compound/accessory/core/mobility) |
| `SPLITS` | Templates for 1–5 training days per week. Each has a name, description, 7-day `schedule` array, and a `days` array defining which muscle groups train each day |
| `SECTION_META` | Display metadata for each section type (label, hint, colour) |

**Screens in this file**:

| Screen | Purpose |
|---|---|
| `GymHubScreen` | Gym tab landing: shows the 7-day training calendar, today's session card with exercise preview, and an active session banner if one is in progress. Tapping a day opens `DayActivitiesScreen`. |
| `SplitPickerScreen` | Lets the user choose 1–5 training days/week. Each option shows the split name, description, and which muscles train on which day of the week. |
| `SessionEditorScreen` | Edit a specific day's exercise list. Exercises are grouped into Compound / Accessory / Core / Mobility sections. Supports reorder (↑↓), remove (×), and add (bottom-sheet search picker pulling from `EX_LIB`). |
| `DayActivitiesScreen` | Log non-gym activities for a given day of the week: runs, yoga, hikes, swims. Each activity has type, duration, time, and source (Strava or Manual). |

**Shared within file**: `ScreenHeader` — a consistent top app bar with back button, centred serif title, and optional right-side action.

Exports: `window.GymHubScreen`, `window.SplitPickerScreen`, `window.SessionEditorScreen`, `window.SPLITS`, `window.EX_LIB`, `window.SECTION_META`, `window.SECTION_ORDER`.

---

### `screen-library.jsx` — Exercise library and image component

Two things in one file:

**`ExerciseImage`** — a shared component used across all gym screens as an exercise "thumbnail":

- There are no real exercise photos. Instead this renders a colour-gradient card with the exercise's initial letter.
- The colour palette is derived from exercise type (compound = rust, accessory = amber, core = violet, mobility = moss), with a deterministic hash of the exercise ID picking the exact variant — so the same exercise always gets the same card.
- A `DEMO` label in the corner signals it's a placeholder. In a real product, replace with a stock photo or looping demo video.
- Exported to `window.ExerciseImage` so `screen-gym.jsx` and `screen-gym-plan.jsx` can use it.

**`ExerciseLibraryScreen`** — a full searchable exercise reference:

- Pulls all exercises from `window.EX_LIB` (defined in `screen-gym-plan.jsx`).
- Two filter rows: type chips (All / Compound / Accessory / Core / Mobility) and muscle group chips (Chest / Back / Shoulders / Arms / Legs / Core / Mobility).
- Text search across exercise name and muscle group.
- All filtering is done client-side with `React.useMemo`.
- Tapping an exercise shows a detail modal (bottom sheet) with name, muscle, type badge, and the `ExerciseImage` card.

Exports: `window.ExerciseImage`, `window.ExerciseLibraryScreen`.

---

### `screen-onboarding.jsx` — First-run setup wizard

A multi-step wizard that collects a user's profile on first launch. The completed profile is passed up to `App()` via `onComplete(profile)`.

**How the flow works**:

- `steps` is an array of step IDs: `['welcome', 'basics', 'cycle', 'goal', 'imports', 'split', 'done']`.
- The `'cycle'` step is conditionally removed if the user selects male sex or opts out of cycle tracking during the `'basics'` step.
- `step` is simply an integer index into `steps`. A progress bar shows `(step + 1) / steps.length`.
- Each step writes into a shared `profile` object via `setProfile(p => ({ ...p, key: value }))`. Profile state accumulates as the user moves forward.
- The final `'done'` step calls `onComplete(profile)`, which App() receives to update global state and set `onboardingActive = false`.

**Steps**:

| Step | What it collects |
|---|---|
| `welcome` | Brand intro, single CTA to start |
| `basics` | Name, age, biological sex, height, weight |
| `cycle` | Whether the user wants cycle-aware coaching. Hidden for male users |
| `goal` | One of: build strength, build muscle, lose fat, stay active, mobility & flow |
| `imports` | Connect data sources: Strava, MyFitnessPal, Apple Health, Oura, Garmin, Flo/Clue |
| `split` | Training frequency (1–5 days/week) with a live preview of the resulting plan |
| `done` | Confirmation screen, calls `onComplete()` |

Exports: `window.OnboardingScreen`.

---

### `manifest.json` — PWA metadata

Tells the browser this is an installable app:

- **Name**: Forma — Health Tracker
- **Theme colour**: `#BE5A38` (terracotta — matches the app accent)
- **Display**: `standalone` — opens full-screen with no browser UI when installed to the home screen
- **Icons**: three sizes — 192px (Android), 512px (high-res), maskable (for adaptive icon shapes on Android)
- **Start URL**: `./index.html`

Browsers surface an "Add to Home Screen" prompt based on this file.

---

### `sw.js` — Service worker (offline support)

Handles caching so the app works without a network connection:

- **Install**: caches the app shell (`index.html`, `manifest.json`, root path) on first load.
- **Activate**: cleans up any caches from previous versions when a new service worker takes over.
- **Fetch — stale-while-revalidate**: for all requests (CDN scripts, fonts, local files), returns the cached version immediately and updates it in the background. Google API calls (Drive, OAuth) are explicitly bypassed — they always go to the network.

The `CACHE_NAME` constant (`'forma-v1'`) acts as the cache version. Bump it to force all clients to re-cache after a significant update.

---

## Setup

### What you'll need

- A Google account (for OAuth + Drive storage)
- Free hosting: GitHub Pages, Netlify, or Vercel
- ~10 minutes

### Step 1 — Generate the icons

Open `generate-icons.html` in your browser (just double-click it).
Download all 3 PNGs and save them in the same folder as `index.html`:
- `icon-192.png`
- `icon-512.png`
- `icon-maskable.png`

Also duplicate `icon-192.png` and rename the copy to `icon-180.png` (used for the iPhone home screen icon).

### Step 2 — Get a Google OAuth Client ID (free, ~5 mins)

#### 2a. Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Click the project dropdown at the top → **New Project**
3. Name it "Forma" → Create

#### 2b. Enable the Drive API
1. Go to **APIs & Services → Library**
2. Search "Google Drive API" → click it → **Enable**

#### 2c. Configure OAuth consent screen
1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** → Create
3. Fill in: App name, user support email, developer contact
4. Click **Save and Continue** through the rest (no need to add scopes here)
5. On the "Test users" page, add your own Gmail address
6. Click **Save and Continue** → **Back to Dashboard**

#### 2d. Create credentials
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Under **Authorised JavaScript origins**, add your hosting URL
5. Click **Create** and copy the Client ID

### Step 3 — Add your Client ID

Open `index.html` and find:
```javascript
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```
Replace with your actual Client ID.

### Step 4 — Host the files

Upload all files to GitHub Pages or Netlify (both free). HTTPS hosting is required for PWAs.

**GitHub Pages**: create a repo, upload files, enable Pages under Settings → Pages.

**Netlify**: go to app.netlify.com → Add new site → Deploy manually → drag your folder.

### Step 5 — Add to iPhone home screen

1. Open the app URL in **Safari** (must be Safari, not Chrome)
2. Tap the Share button → **Add to Home Screen** → **Add**

---

## Data storage

- All data is saved as `forma-data.json` in your Google Drive **App Data folder** (private to Forma, not visible in normal Drive)
- Also cached in `localStorage` for offline access
- Syncs ~2.5 seconds after any change
- The ↑ / cloud icon in the top-right shows sync status

---

## Troubleshooting

**"Setup required" banner** → Replace `YOUR_GOOGLE_CLIENT_ID` in `index.html` (Step 3)

**"Sign in" button does nothing** → Wait 5 seconds for the Google script to load, then try again

**Sign-in opens then immediately closes** → Your hosting URL isn't in Authorised JavaScript origins. Add it exactly (no trailing slash)

**"Sync failed" error** → Go to Google Cloud Console → APIs & Library → Google Drive API → Enable

**After adding to home screen, sign-in doesn't work** → Known iOS PWA limitation with OAuth popups. Sign in from Safari first, then the home screen version will inherit the session.

**Wants me to sign in again after a while** → Google tokens expire after 1 hour. Tap "Continue with Google" — it's instant since you're already signed in.

---

## Local development

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```

Open http://localhost:8080. Add `http://localhost:8080` to Authorised JavaScript origins in Google Cloud Console.

---

## Files reference

| File | Purpose |
|---|---|
| `Health_App_v2.html` | Entry point — phone frame, dependency loading, `App()` component, client-side router |
| `tweaks-panel.jsx` | Dev-only control panel for switching theme/screen/profile. Remove in production |
| `shared.jsx` | Demo data constants + reusable UI primitives (Ring, Bar, BottomNav, Sparkline, etc.) |
| `home-refined.jsx` | Home screen — coach card, activity rings, sessions card, quick log |
| `screen-gym.jsx` | In-session workout tracker and post-session summary |
| `screen-gym-plan.jsx` | Gym planning screens — Hub, Split picker, Session editor, Day activities |
| `screen-library.jsx` | Exercise library screen + ExerciseImage placeholder component |
| `screen-onboarding.jsx` | Multi-step first-run setup wizard |
| `manifest.json` | PWA metadata — name, icons, theme colour, display mode |
| `sw.js` | Service worker — offline caching, stale-while-revalidate strategy |
| `generate-icons.html` | Open in browser to download app icons |
| `icon-*.png` | App icons (generated from generate-icons.html) |
