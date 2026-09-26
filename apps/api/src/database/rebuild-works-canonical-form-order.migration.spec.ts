import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de `works`
 * na ordem do formulário real (ObraFormModal) — projeto_id é o primeiro
 * campo funcional (vínculo de projeto aparece antes de "Dados Principais da
 * Obra" na árvore de renderização real).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000002_RebuildWorksInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildWorksInCanonicalFormOrder20260719000002', () => {
  it('projeto_id is the first functional field after id/tenant_id (the project link is the form\'s 1st section)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const projetoIdx = block.indexOf('projeto_id ');
    const codEntidadeIdx = block.indexOf('cod_entidade ');
    const tituloIdx = block.indexOf('titulo ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(projetoIdx).toBeGreaterThan(tenantIdx);
    expect(codEntidadeIdx).toBeGreaterThan(projetoIdx);
    expect(tituloIdx).toBeGreaterThan(codEntidadeIdx);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const metadataIdx = block.indexOf('metadata ');
    const deletedAtIdx = block.indexOf('deleted_at ');
    expect(deletedAtIdx).toBeGreaterThan(metadataIdx);
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recria as 4 FKs dependentes (release_works, phonograms, shares, work_participants)', () => {
    for (const table of ['release_works', 'phonograms', 'shares', 'work_participants']) {
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recreates the registry_status CHECK and RLS + policies', () => {
    expect(migrationSrc).toMatch(/chk_works_registry_status/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/tenant_isolation/);
  });

  it('validates counts before swapping (up and down) and has an honest down()', () => {
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
