# In-app feedback entry point

Status: authored inline for a direct user request (no prior `features/ideas.md` →
`backlog.md` pass). Kept to the same shape the automated spec pipeline produces
(see `features/PLANNING.md`) so scope decisions are explicit and reviewable,
per `CLAUDE.md`'s "do not implement a feature whose spec you have not read in
full" rule.

## Context / why

Companion to `features/specs/deterministic-endurance-plan-generator.md`,
which deliberately limits generated event plans to 7 race types and defers
extending coverage (5K, Cycling Sportive, Open Water Swim, Other) until
there's real signal that users want it. This gives users a low-friction way
to say so, and doubles as a general feedback channel.

## User story

As a user, I want a simple way to tell Forma what's missing or what I'd like
to see, so the team has real signal instead of guessing.

## Acceptance criteria

- A new "Feedback" row in `AboutScreen.jsx`'s settings list (same visual
  pattern as the existing settings rows).
- Opens a simple form: one free-text textarea + submit button. No structured
  fields (race-type multi-select explicitly not included — free text only,
  per decision).
- On submit: inserts one row into a new `user_feedback` Supabase table,
  shows a confirmation state, clears the field.
- Submit is disabled while the message is empty.

## Data model implications

New Supabase table `user_feedback`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | default `gen_random_uuid()` |
| `user_id` | uuid | `references auth.users(id) on delete cascade` |
| `message` | text | `not null` |
| `created_at` | timestamptz | `default now()` |

RLS: insert-only policy for the authenticated user
(`auth.uid() = user_id`, `with check` on insert). No client-facing
select/update/delete policy — feedback is reviewed directly via the Supabase
SQL editor or a service-role query, matching how other one-directional data
in this app is handled. New migration file under `supabase/migrations/`,
ending with `select pg_notify('pgrst', 'reload schema');` per
`docs/PROJECT_CONTEXT.md` §9.

## Edge cases handled

- Submit while offline or on a Supabase write failure: show an inline error
  and **do not** clear the textarea — this is exactly the fire-and-forget
  failure mode `docs/PROJECT_CONTEXT.md` §12 already warns about elsewhere in
  the app (`scheduleSave`), and feedback text is low-volume enough that it's
  worth actually confirming the write landed rather than silently losing
  what the user typed.
- Duplicate/repeated submissions are allowed (no dedupe) — a user might
  legitimately want to send feedback more than once.

## Explicitly out of scope

- Structured "which race types would you want" multi-select (free text
  only, per decision).
- Any admin-facing UI to read feedback inside the app — reviewed directly
  via Supabase.
- Email or push notification on new feedback.
- Post-plan-generation feedback prompt (settings entry point only, per
  decision).

## Files this touches

- `supabase/migrations/<date>_create_user_feedback.sql` (new).
- `src/utils/supabase.js` — add a `submitFeedback(message)` function.
- `src/screens/AboutScreen.jsx` — new settings row + inline form/modal.
- `tests/e2e/smoke.spec.js` — one smoke assertion for the new entry point,
  per `tests/e2e/README.md`.
