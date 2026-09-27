import * as fs from 'fs';
import * as path from 'path';

/**
 * rebuild-artists-canonical-form-order.migration.spec.ts
 *
 * Permanent guard (2026-07-19 audit): physical rebuild of `artists`
 * in the real form's order (avatar/photo is the first functional field after
 * id/tenant_id). No CASCADE. Recreates all 8 FKs of dependent tables,
 * RLS, policies, indexes, owner and grants. Removes `org_slug` (proven
 * orphan).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000001_RebuildArtistsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildArtistsInCanonicalFormOrder20260719000001', () => {
  it('foto_url is the first functional column declared after id/tenant_id', () => {
    const afterHeader = migrationSrc.split('newColumns = `')[1];
    const idIdx = afterHeader.indexOf('id ');
    const tenantIdx = afterHeader.indexOf('tenant_id ');
    const fotoIdx = afterHeader.indexOf('foto_url ');
    const nomeArtisticoIdx = afterHeader.indexOf('nome_artistico ');
    expect(idIdx).toBeGreaterThanOrEqual(0);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(fotoIdx).toBeGreaterThan(tenantIdx);
    expect(nomeArtisticoIdx).toBeGreaterThan(fotoIdx);
  });

  it('does not recreate org_slug in the new table (orphan removed) but validates it holds no data first', () => {
    expect(migrationSrc).toMatch(/count\(org_slug\)/);
    expect(migrationSrc).toMatch(/throw new Error/);
    const newColumnsBlock = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(newColumnsBlock).not.toMatch(/\borg_slug\b/);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const newColumnsBlock = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const metadataIdx = newColumnsBlock.indexOf('metadata ');
    const createdAtIdx = newColumnsBlock.indexOf('created_at ');
    const deletedAtIdx = newColumnsBlock.indexOf('deleted_at ');
    expect(metadataIdx).toBeGreaterThan(0);
    expect(createdAtIdx).toBeGreaterThan(metadataIdx);
    expect(deletedAtIdx).toBeGreaterThan(createdAtIdx);
    // Nothing after deleted_at in the block.
    const afterDeletedAt = newColumnsBlock.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('uses DROP ... CASCADE in no step', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates the 8 FKs of dependent tables (artist_platform_profiles, works, phonograms, contracts, releases, counterparties, transaction_allocations, performance_metric_entries)', () => {
    for (const table of [
      'artist_platform_profiles', 'works', 'phonograms', 'contracts', 'releases',
      'counterparties', 'transaction_allocations', 'performance_metric_entries',
    ]) {
      const dropCount = (migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g')) ?? []).length;
      const addCount = (migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g')) ?? []).length;
      expect(dropCount).toBeGreaterThanOrEqual(1);
      expect(addCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('recreates RLS + FORCE RLS + the 2 original policies', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/super_admin_full_access/);
    expect(migrationSrc).toMatch(/tenant_isolation/);
  });

  it('validates row counts before swapping the table (up and down)', () => {
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('has an honest down() that reverts to the original structure (including org_slug)', () => {
    expect(migrationSrc).toMatch(/async down/);
    const originalColumnsBlock = migrationSrc.split('originalColumns = `')[1].split('`;')[0];
    expect(originalColumnsBlock).toMatch(/\borg_slug\b/);
  });
});
