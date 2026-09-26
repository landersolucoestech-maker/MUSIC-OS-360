import * as fs from 'fs';
import * as path from 'path';
import { isApplicationMigration } from './migration-classification';

/**
 * fix-default-privileges-creator-role.migration.spec.ts  (Part 80)
 *
 * Permanent guard: 20260802000001_GrantMusicosAppOnAllTables (Part 78)
 * configured `ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator`, assuming
 * that would protect every future tenant-scoped table. It protected nothing —
 * confirmed live in this Part: `client_attachments` (created by the
 * immediately preceding migration, following the RLS + OWNER TO musicos_migrator pattern)
 * ended up with NO grant at all for musicos_app. Postgres applies default privileges
 * to the role that runs CREATE TABLE (here, always `postgres`, confirmed via
 * SELECT current_user), not to the final owner set by a later ALTER.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260803000002_FixDefaultPrivilegesCreatorRole.ts'),
  'utf8',
);

describe('FixDefaultPrivilegesCreatorRole20260803000002', () => {
  it('is classified as APPLICATION — must run via db:migrate:application', () => {
    expect(isApplicationMigration('FixDefaultPrivilegesCreatorRole20260803000002')).toBe(true);
  });

  it('reads the real creator role via SELECT current_user, does not hardcode "musicos_migrator" in executable code', () => {
    const codeOnly = migrationSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/SELECT current_user/);
    expect(codeOnly).not.toMatch(/FOR ROLE musicos_migrator/);
    expect(codeOnly).toMatch(/FOR ROLE "\$\{creatorRole\}"/);
  });

  it('grants SELECT/INSERT/UPDATE/DELETE on TABLES and USAGE/SELECT on SEQUENCES to the real creator role', () => {
    expect(migrationSrc).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE "\$\{creatorRole\}" IN SCHEMA public/);
    expect(migrationSrc).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO musicos_app/);
    expect(migrationSrc).toMatch(/GRANT USAGE, SELECT ON SEQUENCES TO musicos_app/);
  });

  it('retroactively fixes client_attachments (created before this fix existed)', () => {
    expect(migrationSrc).toMatch(/client_attachments/);
    expect(migrationSrc).toMatch(/IF EXISTS \(SELECT 1 FROM pg_tables/);
  });

  it('down() reverts via a symmetric REVOKE', () => {
    const downBlock = migrationSrc.split('async down')[1];
    expect(downBlock).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM musicos_app/);
    expect(downBlock).toMatch(/REVOKE USAGE, SELECT ON SEQUENCES FROM musicos_app/);
  });

  it('is registered in the migrations index.ts', () => {
    const indexSrc = fs.readFileSync(path.resolve(__dirname, 'migrations/index.ts'), 'utf8');
    expect(indexSrc).toMatch(/FixDefaultPrivilegesCreatorRole20260803000002/);
  });
});
