import * as fs from 'fs';
import * as path from 'path';
import { isApplicationMigration } from './migration-classification';

/**
 * grant-musicos-app-on-all-tables.migration.spec.ts
 *
 * Permanent guard (Part 77): the "RebuildXInCanonicalFormOrder" series
 * (2026-07-19) recreated dozens of tables granting only to
 * `musicos_migrator`, never re-granting to `musicos_app` — result: 114
 * of the ~120 tables in `public` became "permission denied" for the role
 * used by all normal application traffic (APP_DATABASE_URL). That
 * brought down /auth/context (500) and any real domain page.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260802000001_GrantMusicosAppOnAllTables.ts'),
  'utf8',
);

describe('GrantMusicosAppOnAllTables20260802000001', () => {
  it('is classified as APPLICATION (not EXTERNAL_MANAGED) — must run via db:migrate:application', () => {
    expect(isApplicationMigration('GrantMusicosAppOnAllTables20260802000001')).toBe(true);
  });

  it('grants SELECT/INSERT/UPDATE/DELETE on the regular read-write tables', () => {
    expect(migrationSrc).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\."\$\{table\}" TO musicos_app/);
  });

  it('grants only SELECT/INSERT on audit/log tables (never updated or deleted by the app)', () => {
    expect(migrationSrc).toMatch(/GRANT SELECT, INSERT ON TABLE public\."\$\{table\}" TO musicos_app/);
    for (const auditTable of ['audit_logs', 'domain_event_log', 'rbac_decision_logs', 'webhook_events']) {
      expect(migrationSrc).toMatch(new RegExp(`'${auditTable}'`));
    }
  });

  it('iterates over table lists (not unrolled SQL) and covers ~114 tables in total, each GRANT conditioned on IF EXISTS', () => {
    // Parameterized via arrays + a loop, not 114 literal SQL blocks — the
    // "only runs if the table exists" protection comes from the reused template.
    expect(migrationSrc).toMatch(/IF EXISTS \(SELECT 1 FROM pg_tables/);
    const readWriteBlock = migrationSrc.split('const READ_WRITE_TABLES = [')[1].split('] as const;')[0];
    const appendOnlyBlock = migrationSrc.split('const APPEND_ONLY_TABLES = [')[1].split('] as const;')[0];
    const totalTables = [...readWriteBlock.matchAll(/'[a-z0-9_]+'/g), ...appendOnlyBlock.matchAll(/'[a-z0-9_]+'/g)].length;
    expect(totalTables).toBeGreaterThan(100);
  });

  it('sets ALTER DEFAULT PRIVILEGES for musicos_migrator — FUTURE tables are created with the right grant', () => {
    expect(migrationSrc).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator IN SCHEMA public/);
    expect(migrationSrc).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO musicos_app/);
    expect(migrationSrc).toMatch(/GRANT USAGE, SELECT ON SEQUENCES TO musicos_app/);
  });

  it('down() reverts both the per-table grants and the default privileges', () => {
    expect(migrationSrc).toMatch(/async down/);
    const downBlock = migrationSrc.split('async down')[1];
    expect(downBlock).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM musicos_app/);
    expect(downBlock).toMatch(/REVOKE ALL ON TABLE public/);
  });

  it('never uses DROP TABLE or any destructive DDL — only GRANT/REVOKE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+TABLE/i);
    expect(migrationSrc).not.toMatch(/TRUNCATE/i);
  });

  it('is registered in the migrations index.ts', () => {
    const indexSrc = fs.readFileSync(path.resolve(__dirname, 'migrations/index.ts'), 'utf8');
    expect(indexSrc).toMatch(/GrantMusicosAppOnAllTables20260802000001/);
  });
});
