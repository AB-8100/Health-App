# Forma — Claude Code Project Config

This file is read automatically by Claude Code (interactive and headless/CI
runs). Keep it in sync with `docs/PROJECT_CONTEXT.md` — that file is the
detailed source of truth; this file is the condensed operating manual for
agentic runs.

## Read first, every time
- `docs/PROJECT_CONTEXT.md` — architecture, file map, data model, known gotchas
- `docs/PRODUCT_STRATEGY.md` — persona, positioning, roadmap horizon (NOW/NEXT/LATER)
- `features/specs/<this-feature>.md` — the spec you're implementing (scope, acceptance criteria)

Do not implement a feature whose spec you have not read in full. Do not
expand scope beyond what the spec's acceptance criteria describe — if the
spec seems to need something it doesn't mention (e.g. a new Supabase table),
stop and flag it in the PR description rather than adding it silently.

## Stack (do not deviate without a spec explicitly asking for it)
- React 18 + Vite 5, no framework, no router — `screen` string state in `App.jsx`
- Supabase (Postgres + Auth + RLS) — source of truth for all user data
- No CSS framework — plain CSS + theme token objects (`data/themes.js`)
- No state library — `React.useState` in root `App`, threaded via props
- Vitest for logic/unit tests, Playwright for e2e/smoke tests

## Conventions
- Inline annotation tags on new/changed code blocks: `[UI]`, `[STATE]`, `[ACTION]`,
  `[DATA]`, `[LOGIC]`, `[COMPONENT]` — match the existing style in
  `screens/GymPlanScreens.jsx` and `App.jsx`.
- Never modify functional code outside the current feature's scope. If a spec
  requires touching shared state (`App.jsx` root state, `buildSnapshot()`),
  say so explicitly in the PR description.
- Follow existing file boundaries — see the file map in `docs/PROJECT_CONTEXT.md`
  §13 for where a given kind of change belongs.

## Hard gotchas (do not reintroduce these bugs)
- `scheduleSave`'s Supabase write is fire-and-forget in most call sites —
  don't assume a `setX(...)` guarantees the write landed.
- `gym_sessions`, `food_log`, `custom_foods` are delete-then-insert on every
  save. Never send a client-generated id as the DB primary key.
- Onboarding routing is stage-based (`onboardingStage`) and takes priority
  over `screen` in `renderScreen`.
- Event-plan dates are UTC-midnight-anchored; "today" is local. Don't mix these.
- `profile.goal` (legacy) vs `goals[]` (Stage 2) coexist — don't assume `profile.goal`
  can be `'event_race'` on its own.

## Every feature branch must
1. Implement only what's in the spec's acceptance criteria.
2. Add/update Vitest tests for any new pure logic in `utils/`.
3. Add/update a Playwright smoke assertion in `tests/e2e/` if the feature
   changes a screen's core render path or navigation (see `tests/e2e/README.md`).
4. Run `npm test` and `npx playwright test` locally (CI re-runs both regardless).
5. Note in the PR description: which files were touched, and whether anything
   outside the spec's stated scope was necessary (schema change, shared-state
   change, new dependency) — these get a human-review label automatically.

## Escalate to a human (add `needs-human-review` label) instead of auto-merging if:
- The change touches `utils/supabase.js`, any file in `supabase/migrations/`,
  auth flow (`bootstrapUser`, `LoginScreen.jsx`), or Google OAuth/Sheets config.
- Tests fail after 3 fix attempts.
- The spec's acceptance criteria are ambiguous enough that two reasonable
  implementations would behave differently.
