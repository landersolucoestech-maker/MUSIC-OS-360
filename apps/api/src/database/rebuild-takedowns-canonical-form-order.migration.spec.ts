import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `takedowns` in the real form's order (TakedownFormModal) — titulo is the
 * first real field, plataforma (original NOT NULL) is visually the
 * second section, not the first.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000016_RebuildTakedownsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildTakedownsInCanonicalFormOrder20260719000016', () => {
  it('titulo/tipo/obra_afetada/artista come before plataforma (2nd visual section)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const tituloIdx = block.indexOf('titulo ');
    const platformIdx = block.indexOf('plataforma ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(tituloIdx).toBeGreaterThan(tenantIdx);
    expect(platformIdx).toBeGreaterThan(tituloIdx);
  });

  it('drops url/resposta/obra_id/artista_id (proven orphans, the migration\'s historical names) with fail-fast validation', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).not.toMatch(/\bresposta\b/);
    expect(block).not.toMatch(/\bobra_id\b/);
    expect(block).not.toMatch(/\bartista_id\b/);
    expect(block).not.toMatch(/\burl\s+text/);
    expect(migrationSrc).toMatch(/count\(url\)::int \+ count\(resposta\)::int/);
    expect(migrationSrc).toMatch(/columns presumed orphaned, but real data exists/);
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

  it('recreates RLS + policies and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
