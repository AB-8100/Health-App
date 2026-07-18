# Forma agentic build pipeline

Drop this into the `Health-App` repo root. Three stages, two mandatory
human checkpoints (spec review + risk-flagged PRs), everything else runs
unattended.

```
features/ideas.md  →  [plan.yml]  →  features/backlog.md (PR)
                                          │ you: edit/merge
                                          ▼
                    [spec.yml]  →  features/specs/*.md (PR)
                                          │ you: review — mandatory checkpoint
                                          ▼
                    [build.yml]  →  feature branch, Vitest + Playwright,
                                     auto-merge if green + not risk-flagged,
                                     needs-human-review label otherwise
                                          ▼
                    existing deploy.yml (unchanged) → GitHub Pages
```

## One-time setup

1. Copy `docs/PROJECT_CONTEXT.md` and `docs/PRODUCT_STRATEGY.md` into the
   repo at those exact paths — the agents read them directly, they aren't
   passed in as prompt text.
2. Copy `CLAUDE.md` to the repo root.
3. Copy `features/`, `.github/workflows/`, `playwright.config.js`, and
   `tests/e2e/` in as-is.
4. Add repo secrets: `ANTHROPIC_API_KEY`, `TEST_USER_EMAIL`,
   `TEST_USER_PASSWORD` (see `tests/e2e/README.md` for what the test user
   needs).
5. Add to `package.json`:
   ```json
   "devDependencies": {
     "@playwright/test": "^1.48.0"
   },
   "scripts": {
     "test:e2e": "playwright test"
   }
   ```
6. Run `npx playwright install --with-deps chromium` once locally to confirm
   the smoke suite passes against your current build before wiring it into CI.

## Using it day to day

- Add ideas to `features/ideas.md`, push. Review the resulting backlog PR —
  this is where you catch things like "streaks and badges" quietly not
  fitting the strategy doc before any code gets written.
- Merge the backlog PR. Review the resulting spec PR — this is the one
  checkpoint that matters most, since every downstream stage inherits from
  what's written here.
- Merge the spec PR. Each spec builds on its own branch; PRs land labeled
  either `auto-merge-eligible` (merges itself once checks pass) or
  `needs-human-review` (touches auth/Supabase schema, or tests didn't pass
  after 3 attempts).
- Deploy is unchanged — your existing `deploy.yml` still fires on push to
  `main` exactly as it does today.

## Caveats worth keeping in mind

- The planning and spec stages produce **probabilistic recommendations**,
  not verdicts — treat "build now" / "needs your call" tags as a starting
  point to edit, not an approval.
- A green Playwright + Vitest run means the known, checked cases pass — it's
  not a correctness guarantee, especially early on when the smoke suite is
  only 5-6 tests deep.
- Because most Forma features touch the same handful of large files
  (`App.jsx`, `GymPlanScreens.jsx`), true parallel builds across features are
  limited — expect the `max-parallel: 2` in `build.yml` to still produce
  occasional merge conflicts on adjacent PRs. Increase this only once you've
  seen it behave.
