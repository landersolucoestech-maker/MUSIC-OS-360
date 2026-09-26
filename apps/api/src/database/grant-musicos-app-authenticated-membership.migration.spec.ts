import * as fs from 'fs';
import * as path from 'path';
import { isApplicationMigration } from './migration-classification';

/**
 * grant-musicos-app-authenticated-membership.migration.spec.ts
 *
 * Guarda permanente (Parte 78): toda tabela reconstruída pelas migrations
 * "RebuildXInCanonicalFormOrder" tem FORCE ROW LEVEL SECURITY com policies
 * `TO authenticated`. `musicos_app` (role de todo o tráfego normal via
 * APP_DATABASE_URL) nunca foi adicionado como membro de `authenticated`
 * neste projeto — SELECT devolvia 0 linhas sem erro (deny-all silencioso) e
 * INSERT/UPDATE/DELETE falhavam com "new row violates row-level security
 * policy". Reproduzido ao tentar criar um cliente sintético via API real.
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
