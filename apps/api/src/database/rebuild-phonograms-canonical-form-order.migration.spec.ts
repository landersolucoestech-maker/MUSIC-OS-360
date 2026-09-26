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
  it('obra_id é o primeiro campo funcional após id/tenant_id', () => {
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

  it('participacao e arquivo_audio (seções reais e visíveis) vêm antes dos campos legados', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const participacaoIdx = block.indexOf('participacao ');
    const compositoresIdx = block.indexOf('compositores ');
    expect(compositoresIdx).toBeGreaterThan(participacaoIdx);
  });

  it('nenhum campo funcional aparece depois de metadata/created_at/updated_at/deleted_at', () => {
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

  it('recria as próprias FKs (artista_id, obra_id — nomes históricos da migration), o CHECK de registry_status e RLS + policies', () => {
    expect(migrationSrc).toMatch(/fk_phonograms_artista_id/);
    expect(migrationSrc).toMatch(/fk_phonograms_obra_id/);
    expect(migrationSrc).toMatch(/chk_phonograms_registry_status/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
  });

  it('valida contagem antes de trocar (up e down) e possui down() honesto', () => {
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
