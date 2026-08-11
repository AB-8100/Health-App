-- In-app feedback entry point (features/specs/feedback-entry-point.md).
-- Insert-only from the client — feedback is reviewed directly via the
-- Supabase SQL editor or a service-role query, not read back by the app.

create table if not exists public.user_feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  message     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);

-- ── Row-level security ────────────────────────────────────────────────────────
-- Insert-only for the authenticated user — no select/update/delete policy, so
-- the client can never read feedback back (matches how other one-directional
-- data in this app is handled, per docs/PROJECT_CONTEXT.md).

alter table public.user_feedback enable row level security;

create policy "Users can insert own feedback"
  on public.user_feedback for insert
  with check (auth.uid() = user_id);

select pg_notify('pgrst', 'reload schema');
