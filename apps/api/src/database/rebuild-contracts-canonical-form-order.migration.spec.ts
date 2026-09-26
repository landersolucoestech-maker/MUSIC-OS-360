import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `contracts` combinando os dois formulários reais (ContratoWizard.tsx —
 * fluxo principal; ContratoFormModal.tsx — fluxo em RegistroMusicas.tsx).
 * Reconstrução pura de ordem — nenhuma coluna removida (todas têm escritor
 * real comprovado, direta ou via DTO/automação).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000012_RebuildContractsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildContractsInCanonicalFormOrder20260719000012', () => {
  it('template_id (the wizard\'s first step) comes right after id/tenant_id, followed by titulo/tipo/status', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const templateIdx = block.indexOf('template_id ');
    const tituloIdx = block.indexOf('titulo ');
    const statusIdx = block.search(/\bstatus\s+varchar/);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(templateIdx).toBeGreaterThan(tenantIdx);
    expect(tituloIdx).toBeGreaterThan(templateIdx);
    expect(statusIdx).toBeGreaterThan(tituloIdx);
  });

  it('signers/template_id no longer sit after created_by/updated_by', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const signersIdx = block.indexOf('signers ');
    const createdByIdx = block.indexOf('created_by ');
    expect(signersIdx).toBeLessThan(createdByIdx);
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

  it('recreates its own FK (artista_id — the migration\'s historical name), the dependent FK (financial_transactions), RLS + policies and has an honest down()', () => {
    expect(migrationSrc).toMatch(/fk_contracts_artista_id/);
    expect(migrationSrc.match(/ALTER TABLE financial_transactions DROP CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc.match(/ALTER TABLE financial_transactions ADD CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
