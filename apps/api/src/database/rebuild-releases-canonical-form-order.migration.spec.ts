import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `releases` in the real form's order (LancamentoFormModal) — Metadata
 * (titulo/tipo/artista/genero/idioma) is the first real section.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000004_RebuildReleasesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildReleasesInCanonicalFormOrder20260719000004', () => {
  it('titulo is the first functional field after id/tenant_id (metadata section)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const titleIdx = block.indexOf('titulo ');
    const labelIdx = block.indexOf('gravadora ');
    const statusIdx = block.indexOf('status ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(titleIdx).toBeGreaterThan(tenantIdx);
    expect(labelIdx).toBeGreaterThan(titleIdx);
    expect(statusIdx).toBeGreaterThan(labelIdx);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at ');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('handles the release_works cross-table policy (drop + recreate) as in works', () => {
    expect(migrationSrc.match(/DROP POLICY tenant_isolation ON release_works/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/releaseWorksPolicySql/);
    expect(migrationSrc.match(/this\.releaseWorksPolicySql\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recreates the 3 dependent FKs (release_works, transaction_allocations, performance_metric_entries)', () => {
    for (const table of ['release_works', 'transaction_allocations', 'performance_metric_entries']) {
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recreates RLS + FORCE RLS + policies and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
