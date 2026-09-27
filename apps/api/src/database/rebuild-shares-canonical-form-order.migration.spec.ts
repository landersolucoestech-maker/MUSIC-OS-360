import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of `shares`
 * — a pure order rebuild (no column removed). Combines the ownership/
 * registration block with the "Registry Fields Phase 1" block (technical/
 * reserved, no visual form) and the real financial form
 * (SharePendenteFormModal.tsx).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000014_RebuildSharesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildSharesInCanonicalFormOrder20260719000014', () => {
  it('obra_id/fonograma_id/titular_nome/papel come right after id/tenant_id', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const workIdx = block.indexOf('obra_id ');
    const papelIdx = block.search(/\bpapel\s+varchar/);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(workIdx).toBeGreaterThan(tenantIdx);
    expect(papelIdx).toBeGreaterThan(workIdx);
  });

  it('the Registry Fields Phase 1 block (rights_holder_id..end_date) comes before the financial form (share_type onward)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const rightsHolderIdx = block.indexOf('rights_holder_id');
    const endDateIdx = block.indexOf('end_date');
    const shareTypeIdx = block.indexOf('share_type');
    expect(endDateIdx).toBeGreaterThan(rightsHolderIdx);
    expect(shareTypeIdx).toBeGreaterThan(endDateIdx);
  });

  it('removes no column (pure order rebuild)', () => {
    const newBlock = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const origBlock = migrationSrc.split('originalColumns = `')[1].split('`;')[0];
    const extractCols = (block: string) => [...block.matchAll(/^\s*(\w+)\s+/gm)].map((m) => m[1]);
    const newCols = new Set(extractCols(newBlock));
    const origCols = new Set(extractCols(origBlock));
    expect(newCols.size).toBe(origCols.size);
    for (const col of origCols) expect(newCols.has(col)).toBe(true);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates its own FK (fk_shares_obra_id), RLS + policies and has an honest down()', () => {
    expect(migrationSrc).toMatch(/fk_shares_obra_id/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
