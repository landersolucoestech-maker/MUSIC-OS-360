import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de `shares`
 * — reconstrução pura de ordem (nenhuma coluna removida). Combina o bloco
 * de titularidade/registro com o bloco "Registry Fields Phase 1" (técnico/
 * reservado, sem formulário visual) e o formulário financeiro real
 * (SharePendenteFormModal.tsx).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000014_RebuildSharesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildSharesInCanonicalFormOrder20260719000014', () => {
  it('obra_id/fonograma_id/titular_nome/papel vêm logo após id/tenant_id', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const obraIdx = block.indexOf('obra_id ');
    const papelIdx = block.search(/\bpapel\s+varchar/);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(obraIdx).toBeGreaterThan(tenantIdx);
    expect(papelIdx).toBeGreaterThan(obraIdx);
  });

  it('bloco Registry Fields Phase 1 (rights_holder_id..end_date) vem antes do formulário financeiro (share_type em diante)', () => {
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

  it('nenhum campo funcional aparece depois de metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recria a FK própria (fk_shares_obra_id), RLS + policies e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/fk_shares_obra_id/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
