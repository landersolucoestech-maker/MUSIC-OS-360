import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `phonograms` na ordem do formulário real (FonogramaFormModal) — obra_id é
 * o primeiro campo funcional ("Título da Obra Vinculada" é a 1ª seção).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000003_RebuildPhonogramsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildPhonogramsInCanonicalFormOrder20260719000003', () => {
  it('obra_id is the first functional field after id/tenant_id', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const obraIdx = block.indexOf('obra_id ');
    const tituloIdx = block.indexOf('titulo ');
    const codEntidadeIdx = block.indexOf('cod_entidade ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(obraIdx).toBeGreaterThan(tenantIdx);
    expect(tituloIdx).toBeGreaterThan(obraIdx);
    expect(codEntidadeIdx).toBeGreaterThan(tituloIdx);
  });

  it('participacao and arquivo_audio (real, visible sections) come before the legacy fields', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const participacaoIdx = block.indexOf('participacao ');
    const compositoresIdx = block.indexOf('compositores ');
    expect(compositoresIdx).toBeGreaterThan(participacaoIdx);
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

  it('recria as 2 FKs compostas dependentes (transaction_allocations, performance_metric_entries)', () => {
    for (const table of ['transaction_allocations', 'performance_metric_entries']) {
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recreates its own FKs (artista_id, obra_id — the migration\'s historical names), the registry_status CHECK and RLS + policies', () => {
    expect(migrationSrc).toMatch(/fk_phonograms_artista_id/);
    expect(migrationSrc).toMatch(/fk_phonograms_obra_id/);
    expect(migrationSrc).toMatch(/chk_phonograms_registry_status/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
  });

  it('validates counts before swapping (up and down) and has an honest down()', () => {
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
