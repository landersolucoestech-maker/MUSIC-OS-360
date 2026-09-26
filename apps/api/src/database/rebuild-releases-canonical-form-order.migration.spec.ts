import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `releases` na ordem do formulário real (LancamentoFormModal) — Metadata
 * (titulo/tipo/artista/genero/idioma) é a primeira seção real.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000004_RebuildReleasesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildReleasesInCanonicalFormOrder20260719000004', () => {
  it('titulo é o primeiro campo funcional após id/tenant_id (seção Metadata)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const tituloIdx = block.indexOf('titulo ');
    const gravadoraIdx = block.indexOf('gravadora ');
    const statusIdx = block.indexOf('status ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(tituloIdx).toBeGreaterThan(tenantIdx);
    expect(gravadoraIdx).toBeGreaterThan(tituloIdx);
    expect(statusIdx).toBeGreaterThan(gravadoraIdx);
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

  it('trata a policy cross-table de release_works (drop + recreate) como em works', () => {
    expect(migrationSrc.match(/DROP POLICY tenant_isolation ON release_works/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/releaseWorksPolicySql/);
    expect(migrationSrc.match(/this\.releaseWorksPolicySql\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recria as 3 FKs dependentes (release_works, transaction_allocations, performance_metric_entries)', () => {
    for (const table of ['release_works', 'transaction_allocations', 'performance_metric_entries']) {
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recria RLS + FORCE RLS + policies e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
