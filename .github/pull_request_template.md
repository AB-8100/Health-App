## Summary
<!-- 1-3 sentences: what changed and why. -->

## Spec / issue
<!-- Link the feature spec (features/specs/<name>.md) or issue this implements. -->

## Files touched
<!-- List files changed. Flag anything touched outside the spec's stated scope
     (per CLAUDE.md: schema change, shared-state change, new dependency). -->

## Testing
- [ ] `npm test` passes
- [ ] `npx playwright test` passes (if this PR changes a screen's core render
      path or navigation)

## User testing
Check the box and explain below if this PR touches any of the following
(per CLAUDE.md — these should not auto-merge without a human running
through the checklist below):
- [ ] `utils/supabase.js`, `supabase/migrations/`, auth flow
      (`bootstrapUser`, `LoginScreen.jsx`), or Google OAuth/Sheets config
- [ ] Tests failed after 3 fix attempts
- [ ] The spec's acceptance criteria were ambiguous enough that two
      reasonable implementations would differ

<!-- If any box above is checked, add the `needs-human-review` label. -->

Manual pass across the app (tick what you ran; add rows if the feature
touches something not listed here):
- [ ] Sign up as a brand-new user and complete all 3 onboarding stages
      (Profile → Goals → Deep Questionnaire, including skipping Stage 3)
- [ ] Log in as an existing user, lands on Weekly Overview with no console
      errors
- [ ] Weekly Overview: sessions/activities show on the correct days,
      drag-to-reorder works, navigating to a day's Session Detail works
- [ ] Gym Hub: start a session, log a set, pause/exit, and finish a session
      end-to-end
- [ ] Food: log a meal item, add a custom food, macros/totals update
      correctly
- [ ] Home: dashboard renders with no `undefined`/`NaN` and no console
      errors
- [ ] About: edit a profile field (e.g. weight, training days) and confirm
      it persists after a full page reload
- [ ] If touched: Google Sheets connect/disconnect from About screen
- [ ] Reload mid-session (or hard refresh) and confirm state restores
      correctly from Supabase/local cache, not just from memory
