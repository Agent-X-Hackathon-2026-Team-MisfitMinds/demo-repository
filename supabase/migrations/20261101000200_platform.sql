-- Fixie Hub — Supabase platform wiring: auth trigger, own-session functions, Realtime, Storage, scheduled jobs.
-- Requires the Supabase extensions pg_cron and pg_net (enable them in Dashboard → Database → Extensions first)
-- and two Vault secrets created once per project:
--   select vault.create_secret('https://fixie-hub.vercel.app', 'fixie_hub_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'fixie_cron_secret');

begin;

-- ------------------------------------------------------------
-- Profiles are created when a GitHub user first signs in
-- ------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'provider_id', '') = '' then
    return new;  -- not a GitHub identity; nothing to mirror
  end if;
  insert into public.profiles (id, github_user_id, login, name, avatar_url, email)
  values (new.id,
          (new.raw_user_meta_data->>'provider_id')::bigint,
          coalesce(new.raw_user_meta_data->>'user_name',
                   new.raw_user_meta_data->>'preferred_username',
                   'user-' || left(new.id::text, 8)),
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url',
          new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Own sessions (P1, SCR-13)
-- ------------------------------------------------------------
create function public.list_my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text, not_after timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip), s.not_after
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last
$$;

create function public.revoke_my_session(p_session_id uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  with d as (delete from auth.sessions s where s.id = p_session_id and s.user_id = auth.uid() returning 1)
  select exists (select 1 from d)
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.list_my_sessions(), public.revoke_my_session(uuid) from public, anon;
grant execute on function public.list_my_sessions(), public.revoke_my_session(uuid) to authenticated;

-- ------------------------------------------------------------
-- Realtime: run detail and runs list subscribe to these (RLS applies per subscriber)
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.run_events, public.runs;

-- ------------------------------------------------------------
-- Storage: private buckets; all access through server-issued signed URLs
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('run-logs', 'run-logs', false), ('run-artifacts', 'run-artifacts', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Scheduled jobs
-- ------------------------------------------------------------
create function public.call_hub_cron(p_job text) returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fixie_hub_url') || '/api/cron/' || p_job,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fixie_cron_secret'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000)
$$;
revoke execute on function public.call_hub_cron(text) from public, anon, authenticated;

select cron.schedule('fixie-stale-runs',  '*/5 * * * *', $$ select public.call_hub_cron('stale-runs') $$);
select cron.schedule('fixie-protection',  '7 * * * *',   $$ select public.call_hub_cron('protection') $$);
select cron.schedule('fixie-retention',   '17 3 * * *',  $$ select public.call_hub_cron('retention') $$);
select cron.schedule('fixie-purge',       '27 3 * * *',  $$ select public.purge_expired_data() $$);

commit;
