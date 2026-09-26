#!/usr/bin/env ts-node
/**
 * scripts/verify-realtime-external.ts  (Part 72)
 *
 * Real I/O for the physical verifier of `realtime.messages` — the evaluation
 * logic (pure, testable) lives in src/database/realtime-external-verifier.ts.
 * It never trusts the `musicos360_migrations` tracking table: it queries
 * pg_class, pg_policy and the table's real owner directly.
 *
 * Usage:
 *   npm run verify:realtime-external
 *
 * Exit code:
 *   0 — APPLIED_AND_VERIFIED or PENDING_EXTERNAL_PRIVILEGE (a known external
 *       block, not an application regression)
 *   1 — DRIFT, INVALID_POLICY or UNSAFE_PUBLIC_ACCESS (real failures)
 */
import * as path from 'path';

try {
  // Never override an explicitly-provided process env with .env.development —
  // an explicit DATABASE_URL must always win over the file fallback.
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
} catch { /* opcional */ }

import { extractSupabaseRef, SUPABASE_PROD_REF, SUPABASE_REF_DENYLIST } from '../src/core/config/env.schema';
import { evaluateRealtimeState, type RealtimePolicyRow } from '../src/database/realtime-external-verifier';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  const ref = extractSupabaseRef(databaseUrl);

  if (ref === SUPABASE_PROD_REF) {
    console.error('::error::DATABASE_URL points to the Supabase MAIN branch — refused.');
    process.exitCode = 1;
    return;
  }
  if (ref && SUPABASE_REF_DENYLIST.includes(ref)) {
    console.error(`::error::DATABASE_URL points to a banned ref ("${ref}") — refused.`);
    process.exitCode = 1;
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl, ssl: process.env['DB_SSL'] === 'false' ? false : { rejectUnauthorized: false } });
  await client.connect();

  try {
    const existsResult = await client.query(`SELECT to_regclass('realtime.messages') IS NOT NULL AS exists`);
    const tableExists = existsResult.rows[0]?.exists === true;

    if (!tableExists) {
      console.error('::error::realtime.messages does not exist in this project (unexpected ref or project without the Realtime extension).');
      process.exitCode = 1;
      return;
    }

    const rlsResult = await client.query(
      `SELECT c.relrowsecurity AS rls_enabled, c.relowner::regrole::text AS owner, current_user AS current_user
       FROM pg_class c WHERE c.oid = 'realtime.messages'::regclass`,
    );
    const rlsEnabled: boolean = rlsResult.rows[0]?.rls_enabled === true;
    const owner: string = rlsResult.rows[0]?.owner;
    const currentUser: string = rlsResult.rows[0]?.current_user;

    const policiesResult = await client.query<RealtimePolicyRow>(
      `SELECT polname AS policyname,
              COALESCE(array_agg(pr.rolname) FILTER (WHERE pr.rolname IS NOT NULL), '{}') AS roles,
              CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE '*' END AS cmd,
              pg_get_expr(pol.polqual, pol.polrelid) AS qual,
              pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
       FROM pg_policy pol
       JOIN pg_class rel ON rel.oid = pol.polrelid
       LEFT JOIN unnest(pol.polroles) AS role_oid ON true
       LEFT JOIN pg_roles pr ON pr.oid = role_oid
       WHERE rel.oid = 'realtime.messages'::regclass
       GROUP BY polname, pol.polcmd, pol.polqual, pol.polrelid, pol.polwithcheck`,
    );

    const { state, reason } = evaluateRealtimeState({
      tableExists,
      rlsEnabled,
      owner,
      currentUser,
      policies: policiesResult.rows,
    });

    console.log(`[verify:realtime-external] state=${state}`);
    console.log(`[verify:realtime-external] reason: ${reason}`);

    if (state === 'DRIFT' || state === 'INVALID_POLICY' || state === 'UNSAFE_PUBLIC_ACCESS') {
      process.exitCode = 1;
    }
    // APPLIED_AND_VERIFIED and PENDING_EXTERNAL_PRIVILEGE: exit 0 — a known external
    // block is not an application regression.
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}
