create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant authenticated to postgres; grant service_role to postgres;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(), updated_at timestamptz default now(), user_agent text, ip inet, not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
create publication supabase_realtime;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
create schema cron; create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
create schema net; create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint language sql as $$ select 1::bigint $$;
create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
