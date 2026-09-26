-- dashboard-only-realtime-dev-fix.sql  (Part 69 — Block 11/12)
--
-- Usage: Supabase DEV (rypnevnfipygyhysqpdo) → Dashboard → SQL Editor → New query.
-- Paste this entire file and run it exactly once.
--
-- Why this script exists outside the normal migration pipeline:
-- the migration runner (npm run db:migrate) already registers and tries to apply
-- 20260801000001_RealtimeBroadcastAuthorization automatically — but the
-- automation did not have, in that session, a valid owner connection
-- (DATABASE_URL) against the DEV project (authentication failure — stale
-- credential, not a Postgres ownership block as such) nor a Supabase CLI/MCP
-- available to apply it from the command line. This SQL is byte-for-byte the
-- same `up()` as migration 20260801000001, so running it here and then running
-- `npm run db:migrate` (once the credential is fixed) is safe: the migration
-- runner will find the effect already applied, write the row to
-- musicos360_migrations and move on — no SQL diverging from what is versioned in
-- apps/api/src/database/migrations/20260801000001_RealtimeBroadcastAuthorization.ts.
--
-- This script ONLY changes `realtime.messages` (schema managed by the Supabase
-- Realtime extension). It touches no application table, deletes no data and
-- grants no public access.

BEGIN;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE EXCEPTION 'realtime.messages does not exist in this project — aborting. Confirm you are connected to the DEV project (rypnevnfipygyhysqpdo), not MAIN or STAGING.';
  END IF;
END $$;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_can_receive_broadcast" ON realtime.messages;
CREATE POLICY "tenant_can_receive_broadcast" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() = 'tenant:' || (auth.jwt()->'app_metadata'->>'org_id')
);

DROP POLICY IF EXISTS "user_can_receive_own_broadcast" ON realtime.messages;
CREATE POLICY "user_can_receive_own_broadcast" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() = 'user:' || (auth.jwt()->>'sub')
);

-- Post-apply validations — any failure here rolls back the whole transaction.
DO $$
DECLARE
  rls_enabled boolean;
  policy_count integer;
  public_policy_count integer;
BEGIN
  SELECT relrowsecurity INTO rls_enabled FROM pg_class WHERE oid = 'realtime.messages'::regclass;
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS did not end up enabled on realtime.messages — aborting.';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'realtime' AND tablename = 'messages'
    AND policyname IN ('tenant_can_receive_broadcast', 'user_can_receive_own_broadcast');
  IF policy_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 canonical policies on realtime.messages, found %. Aborting.', policy_count;
  END IF;

  SELECT count(*) INTO public_policy_count
  FROM pg_policies
  WHERE schemaname = 'realtime' AND tablename = 'messages'
    AND qual = 'true';
  IF public_policy_count > 0 THEN
    RAISE EXCEPTION 'Found a policy with USING (true) on realtime.messages — that would be public access. Aborting.';
  END IF;
END $$;

-- Do NOT write musicos360_migrations here manually — let the next
-- `npm run db:migrate` (run with a valid owner connection) register the
-- migration normally, so there is never tracking without a proven physical
-- effect, nor duplicate tracking written through two different paths.

COMMIT;

-- Remaining manual step, with no SQL/Management API equivalent:
-- Dashboard → Project Settings → Realtime → disable "Allow public access".
-- Without it, "private" channels still degrade to public and the policies
-- above have no practical effect (see the docstring of migration 20260801000001).
