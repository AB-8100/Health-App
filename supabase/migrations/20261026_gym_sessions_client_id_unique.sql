-- One row per logged session: gym_sessions is saved delete-then-write on every
-- save, and racing saves used to stack a full copy of the history per save.
-- `client_id` holds the app's own session id (also in raw->>'id'), and the
-- unique constraint lets saveUserData upsert on it instead of inserting.
-- Already applied by hand in production on 2026-10-26; written to be safe to re-run.

alter table public.gym_sessions add column if not exists client_id text;

update public.gym_sessions set client_id = raw->>'id' where client_id is null;

delete from public.gym_sessions a using public.gym_sessions b
where a.user_id = b.user_id and a.client_id = b.client_id and a.id > b.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gym_sessions_user_client_uniq'
  ) then
    alter table public.gym_sessions
      add constraint gym_sessions_user_client_uniq unique (user_id, client_id);
  end if;
end $$;
