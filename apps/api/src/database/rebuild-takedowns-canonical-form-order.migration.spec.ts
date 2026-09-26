import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `takedowns` na ordem do formulário real (TakedownFormModal) — titulo é o
 * primeiro campo real, plataforma (NOT NULL original) é visualmente a
 * segunda seção, não a primeira.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000016_RebuildTakedownsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildTakedownsInCanonicalFormOrder20260719000016', () => {
  it('titulo/tipo/obra_afetada/artista vêm antes de plataforma (2ª seção visual)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const tituloIdx = block.indexOf('titulo ');
    const plataformaIdx = block.indexOf('plataforma ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(tituloIdx).toBeGreaterThan(tenantIdx);
    expect(plataformaIdx).toBeGreaterThan(tituloIdx);
  });

  it('remove url/resposta/obra_id/artista_id (órfãs comprovadas, nomes históricos da migration) com validação fail-fast', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).not.toMatch(/\bresposta\b/);
    expect(block).not.toMatch(/\bobra_id\b/);
    expect(block).not.toMatch(/\bartista_id\b/);
    expect(block).not.toMatch(/\burl\s+text/);
    expect(migrationSrc).toMatch(/count\(url\)::int \+ count\(resposta\)::int/);
    expect(migrationSrc).toMatch(/presumidas órfãs, mas há dado real/);
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

  it('recria RLS + policies e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
