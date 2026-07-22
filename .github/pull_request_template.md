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

## Needs human review?
Check the box and explain below if this PR touches any of the following
(per CLAUDE.md — these should not auto-merge):
- [ ] `utils/supabase.js`, `supabase/migrations/`, auth flow
      (`bootstrapUser`, `LoginScreen.jsx`), or Google OAuth/Sheets config
- [ ] Tests failed after 3 fix attempts
- [ ] The spec's acceptance criteria were ambiguous enough that two
      reasonable implementations would differ

<!-- If any box above is checked, add the `needs-human-review` label. -->
