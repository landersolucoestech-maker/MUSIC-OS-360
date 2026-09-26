import * as fs from 'fs';
import * as path from 'path';
import { isApplicationMigration } from './migration-classification';

/**
 * grant-musicos-app-authenticated-membership.migration.spec.ts
 *
 * Permanent guard (Part 78): every table rebuilt by the
 * "RebuildXInCanonicalFormOrder" migrations has FORCE ROW LEVEL SECURITY with
 * `TO authenticated` policies. `musicos_app` (the role of all normal traffic via
 * APP_DATABASE_URL) was never added as a member of `authenticated`
 * in this project — SELECT returned 0 rows without an error (silent deny-all) and
 * INSERT/UPDATE/DELETE failed with "new row violates row-level security
 * policy". Reproduced while trying to create a synthetic client via the real API.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260802000002_GrantMusicosAppAuthenticatedMembership.ts'),
  'utf8',
);

describe('GrantMusicosAppAuthenticatedMembership20260802000002', () => {
  it('is classified as APPLICATION — must run via db:migrate:application', () => {
    expect(isApplicationMigration('GrantMusicosAppAuthenticatedMembership20260802000002')).toBe(true);
  });

  it('concede GRANT authenticated TO musicos_app de forma idempotente (verifica antes de conceder)', () => {
    expect(migrationSrc).toMatch(/GRANT authenticated TO musicos_app/);
    expect(migrationSrc).toMatch(/pg_auth_members/);
    expect(migrationSrc).toMatch(/alreadyMember/);
  });

  it('is defensive in environments without the Supabase convention (no authenticated role) or without musicos_app', () => {
    expect(migrationSrc).toMatch(/authenticatedExists/);
    expect(migrationSrc).toMatch(/appRoleExists/);
  });

  it('down() reverte via REVOKE authenticated FROM musicos_app', () => {
    const downBlock = migrationSrc.split('async down')[1];
    expect(downBlock).toMatch(/REVOKE authenticated FROM musicos_app/);
  });

  it('never grants BYPASSRLS or changes table ownership — only role membership', () => {
    expect(migrationSrc).not.toMatch(/BYPASSRLS/);
    expect(migrationSrc).not.toMatch(/OWNER TO/);
    expect(migrationSrc).not.toMatch(/DROP\s+TABLE/i);
  });

  it('is registered in the migrations index.ts', () => {
    const indexSrc = fs.readFileSync(path.resolve(__dirname, 'migrations/index.ts'), 'utf8');
    expect(indexSrc).toMatch(/GrantMusicosAppAuthenticatedMembership20260802000002/);
  });
});
