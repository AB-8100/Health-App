# Playwright smoke tests

Purpose: catch "silently broke a screen" regressions before merge — not full
coverage, not visual regression testing. Keep these fast and few; add one per
core screen, plus one per feature that changes a screen's core render path
or navigation, per `CLAUDE.md`.

## Required setup (one-time)

These tests hit a real Supabase-backed build, so they need a test account
that's already past onboarding (profile + goals + intake complete), so tests
land on `weekly` rather than getting routed into the onboarding flow.

1. Create a dedicated test user in Supabase (not your real account).
2. Add these as GitHub Actions secrets:
   - `TEST_USER_EMAIL`
   - `TEST_USER_PASSWORD`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same ones the app build needs)
3. Locally, put the same values in `.env.local` (already gitignored).

## Selector convention

The current codebase doesn't have `data-testid` attributes yet. Rather than
matching on CSS classes or exact copy (fragile — breaks on any wording or
style change), add a `data-testid` to the handful of elements these tests
touch as you go: nav targets, screen root containers, key action buttons.
This is a small, additive change — do it in the same PR as the feature
that needs it, not as a separate refactor.

Tests below use `getByTestId` where a feature has already added one, and
fall back to `getByRole`/`getByText` elsewhere — expect to harden these over
time rather than getting full coverage on day one.

## What these are NOT
- Not a replacement for Vitest unit tests on `utils/` logic — those still
  belong next to the code they test.
- Not full user-journey / e2e coverage. Five to six smoke checks across the
  core screens is the target size for this suite; resist letting it grow
  into a full regression suite that becomes slow and brittle.
