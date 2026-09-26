import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260802000002_GrantMusicosAppAuthenticatedMembership
 *
 * Part 78 — systemic root cause discovered while reproducing "create client"
 * via the real API (not only the reported export): every table rebuilt
 * by the "RebuildXInCanonicalFormOrder" migrations (2026-07-19) has
 * `FORCE ROW LEVEL SECURITY` with `tenant_isolation`/
 * `super_admin_full_access` policies scoped `TO authenticated` (Supabase
 * convention). `musicos_app` — the role used by ALL normal API traffic
 * via APP_DATABASE_URL — was never added as a MEMBER of the
 * `authenticated` role in this Supabase project (confirmed via
 * pg_auth_members: only postgres/authenticator/musicos_migrator are
 * members).
 *
 * Practical, silent effect before this migration: with FORCE RLS and
 * no policy applicable to the connected role, Postgres denies by default —
 * SELECT returns 0 rows WITHOUT AN ERROR (it looked like an "empty table") and INSERT/UPDATE/
 * DELETE fail with "new row violates row-level security policy". This
 * affects ALL ~40+ tables rebuilt with this pattern (artists,
 * clients, works, contracts, leads, releases, events, projects, etc.), not
 * only `clients` — the clients export only exposed the symptom because it was
 * the first business write/read flow tested via the real API in this
 * session (earlier sessions validated login/auth/context, which do not go
 * through these tables).
 *
 * The role's own documented provisioning (scripts/create-app-db-user.sql,
 * step 3b) already foresaw exactly this GRANT — it just was not applied (or was
 * lost) in this DEV Supabase project. This migration only completes that
 * provisioning in an idempotent, versioned way.
 */
export class GrantMusicosAppAuthenticatedMembership20260802000002 implements MigrationInterface {
  name = 'GrantMusicosAppAuthenticatedMembership20260802000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ exists: authenticatedExists }] = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS exists
    `);
    if (!authenticatedExists) return; // Vanilla Postgres (no Supabase convention) — nothing to do.

    const [{ exists: appRoleExists }] = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') AS exists
    `);
    if (!appRoleExists) return; // environment without the dedicated app role (e.g. some specs) — nothing to do.

    const [{ is_member: alreadyMember }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_auth_members m
        JOIN pg_roles r ON r.oid = m.member
        JOIN pg_roles g ON g.oid = m.roleid
        WHERE r.rolname = 'musicos_app' AND g.rolname = 'authenticated'
      ) AS is_member
    `);
    if (!alreadyMember) {
      await queryRunner.query(`GRANT authenticated TO musicos_app`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ exists: authenticatedExists }] = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS exists
    `);
    if (!authenticatedExists) return;
    const [{ exists: appRoleExists }] = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') AS exists
    `);
    if (!appRoleExists) return;

    await queryRunner.query(`REVOKE authenticated FROM musicos_app`);
  }
}
