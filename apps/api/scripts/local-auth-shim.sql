-- Supabase compatibility shim for local development
CREATE SCHEMA IF NOT EXISTS auth;

-- Extensions the migration chain relies on (Supabase has these by default).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create roles that Supabase normally provides
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  -- NOBYPASSRLS application role; the RLS-hardening migrations GRANT to it
  -- explicitly for RBAC catalog tables, but for the general tenant tables it
  -- reads/writes at runtime it relies on inheriting `authenticated`'s
  -- platform-default grants (see GRANT authenticated TO musicos_app below) —
  -- confirmed by test:e2e's RLS suite, which opens a genuinely separate
  -- connection as this role and does real CRUD against tables (e.g.
  -- workflow_executions) that have no grant of their own to musicos_app.
  -- Must be INHERIT (the Postgres default) for that membership grant to
  -- actually confer privileges, and LOGIN with a throwaway, local/CI-only
  -- password (never a real secret, never reused outside an ephemeral
  -- container) so APP_DATABASE_URL can open that separate connection,
  -- matching how it already works against real Supabase.
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'musicos_app') THEN
    CREATE ROLE musicos_app LOGIN INHERIT NOBYPASSRLS PASSWORD 'local_only_ephemeral_musicos_app_pw';
  END IF;
  -- Migration-runner/table-owner role. In real Supabase-hosted environments
  -- this is the connection role migrations already run as, so it "just
  -- exists" there; local/CI Postgres connects as musicos360 instead, so 27
  -- migrations' `ALTER TABLE ... OWNER TO musicos_migrator` / admin-only RLS
  -- policies (e.g. migrator_admin_all) had never been exercised against a
  -- fresh database until this fix — confirmed by reproducing db:migrate
  -- locally end-to-end.
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'musicos_migrator') THEN
    CREATE ROLE musicos_migrator NOLOGIN NOINHERIT;
  END IF;
END $$;

-- `DROP SCHEMA public CASCADE; CREATE SCHEMA public` (used by the segmented
-- migration CI) recreates `public` without the provider-level USAGE grants.
-- Without this explicit baseline, musicos_app silently loses `public` from its
-- effective search_path and unqualified tables/functions appear nonexistent.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, musicos_app, musicos_migrator;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, musicos_app;
GRANT anon, authenticated, service_role, musicos_app, musicos_migrator TO musicos360;
-- App role inherits the `authenticated`-scoped RLS policies (Supabase convention).
GRANT authenticated TO musicos_app;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt()->>'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt()->>'role', 'anon');
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role() TO anon, authenticated, service_role;

-- Real Supabase projects grant SELECT/INSERT/UPDATE/DELETE on every
-- public-schema table to anon/authenticated/service_role as a platform-level
-- default (RLS policies alone don't grant access — Postgres still requires
-- the base table privilege). This project's migrations never issue that
-- grant themselves because they assume that platform baseline exists
-- already.
--
-- This used to be replicated via `ALTER DEFAULT PRIVILEGES`, but that rule
-- is just another default-privileges entry — indistinguishable from any
-- other migration's own `ALTER DEFAULT PRIVILEGES ... REVOKE` (e.g.
-- HardenRbacAclDefaults20260613000017, which intentionally revokes the
-- default-privileges rule for musicos360/musicos_migrator as part of
-- least-privilege hardening for RBAC tables). Once that revoke runs, every
-- table created afterwards — including the 2026-07-19 "canonical form
-- order" rebuilds (artists, works, phonograms, clients, contracts,
-- employees, ...), which DROP+CREATE the table and only explicitly
-- re-grant musicos_migrator — silently loses the emulated platform grant
-- locally. Real Supabase never has this problem: its auto-grant is an
-- internal platform mechanism, not a `pg_default_acl` entry a project's own
-- migrations can revoke. An event trigger reproduces that independence:
-- it fires on every CREATE TABLE regardless of what any migration did to
-- default privileges, so a later explicit REVOKE (e.g. this project's own
-- RLS-hardening migrations) still wins, exactly like on real Supabase.
CREATE OR REPLACE FUNCTION supabase_shim_grant_new_relations() RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF obj.schema_name = 'public' AND obj.command_tag = 'CREATE TABLE' THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO anon, authenticated, service_role', obj.object_identity);
    ELSIF obj.schema_name = 'public' AND obj.command_tag = 'CREATE SEQUENCE' THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated, service_role', obj.object_identity);
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS supabase_shim_grant_new_relations_trigger;
CREATE EVENT TRIGGER supabase_shim_grant_new_relations_trigger
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE SEQUENCE')
  EXECUTE FUNCTION supabase_shim_grant_new_relations();

-- Realtime Authorization shim (Part 66 — WS→Supabase Realtime migration).
-- Real Supabase's Realtime server validates channel access by inserting a
-- row into realtime.messages and rolling back the transaction, checking the
-- RLS policies along the way; realtime.topic() returns the channel topic
-- being validated. This shim reproduces just enough of that surface —
-- schema, minimal messages table, and topic() reading a session-local GUC —
-- for 20260801000001_RealtimeBroadcastAuthorization's migration and its
-- spec to run against local/CI Postgres. It is not a functional Realtime
-- server; actual broadcast delivery is only ever exercised against real
-- Supabase (DEV/STAGING).
CREATE SCHEMA IF NOT EXISTS realtime;

CREATE TABLE IF NOT EXISTS realtime.messages (
  id          bigserial PRIMARY KEY,
  topic       text NOT NULL,
  extension   text NOT NULL,
  event       text,
  payload     jsonb,
  private     boolean DEFAULT true,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('realtime.topic', true), '')::text;
$$;

GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION realtime.topic() TO anon, authenticated, service_role;
-- Real Supabase grants SELECT on realtime.messages to anon/authenticated by
-- default at the platform level — RLS (20260801000001_RealtimeBroadcastAuthorization)
-- is the actual gate, not this grant. Without it here, every SELECT would
-- fail with "permission denied for table messages" before RLS is even
-- evaluated, which would mask real policy bugs behind a grant error instead.
GRANT SELECT ON realtime.messages TO anon, authenticated;
GRANT ALL ON realtime.messages TO service_role;
