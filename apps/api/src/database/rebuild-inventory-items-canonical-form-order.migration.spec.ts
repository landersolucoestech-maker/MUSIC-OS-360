import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `inventory_items` — a pure order rebuild, following
 * CreateInventoryItemDto.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000017_RebuildInventoryItemsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildInventoryItemsInCanonicalFormOrder20260719000017', () => {
  it('nome/categoria come right after id/tenant_id (DTO order)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const nameIdx = block.search(/\bnome\s+varchar/);
    const categoryIdx = block.indexOf('categoria ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(nameIdx).toBeGreaterThan(tenantIdx);
    expect(categoryIdx).toBeGreaterThan(nameIdx);
  });

  it('the audit block is created_at -> updated_at -> created_by -> updated_by -> deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const createdAtIdx = block.indexOf('created_at');
    const updatedAtIdx = block.indexOf('updated_at');
    const createdByIdx = block.indexOf('created_by');
    const updatedByIdx = block.indexOf('updated_by');
    const deletedAtIdx = block.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
    expect(updatedByIdx).toBeGreaterThan(createdByIdx);
    expect(deletedAtIdx).toBeGreaterThan(updatedByIdx);
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamptz,?/, '').trim()).toBe('');
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

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates RLS + policy (tenant_isolation) and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
