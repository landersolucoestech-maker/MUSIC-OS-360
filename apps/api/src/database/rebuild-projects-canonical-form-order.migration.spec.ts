import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `projects` in the real form's order (ProjetoFormModal) —
 * "Tipo de Lançamento" is the first real section, followed by "Nome do EP/Álbum".
 * `data_inicio`/`data_fim` are removed as proven orphans.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000005_RebuildProjectsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildProjectsInCanonicalFormOrder20260719000005', () => {
  it('tipo is the first functional field after id/tenant_id, followed by titulo', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const tipoIdx = block.indexOf('tipo ');
    const tituloIdx = block.indexOf('titulo ');
    const statusIdx = block.indexOf('status ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(tipoIdx).toBeGreaterThan(tenantIdx);
    expect(tituloIdx).toBeGreaterThan(tipoIdx);
    expect(statusIdx).toBeGreaterThan(tituloIdx);
  });

  it('artista_id (technical relation, written only by bulk import) comes after status', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const statusIdx = block.indexOf('status ');
    const artistaIdx = block.indexOf('artista_id ');
    expect(artistaIdx).toBeGreaterThan(statusIdx);
  });

  it('drops data_inicio/data_fim (proven orphans) with fail-fast validation', () => {
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*data_inicio/);
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*data_fim/);
    expect(migrationSrc).toMatch(/count\(data_inicio\)::int \+ count\(data_fim\)::int/);
    expect(migrationSrc).toMatch(/presumidas órfãs, mas há dado real/);
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

  it('recria as 6 FKs dependentes (transaction_allocations, budgets, performance_metric_entries, marketing_projects, audiovisual_projects, project_tracks)', () => {
    for (const table of [
      'transaction_allocations', 'budgets', 'performance_metric_entries',
      'marketing_projects', 'audiovisual_projects', 'project_tracks',
    ]) {
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} DROP CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
      expect(migrationSrc.match(new RegExp(`ALTER TABLE ${table} ADD CONSTRAINT`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('recreates RLS + FORCE RLS + policies, validates counts before swapping and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
