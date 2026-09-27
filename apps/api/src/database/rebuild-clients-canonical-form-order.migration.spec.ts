import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `clients` in the real form's order (ContatoFormModal — "Contact =
 * Client"). The contact classification (tipo_pessoa/categoria/perfil) is the
 * first real section.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildClientsInCanonicalFormOrder20260719000010', () => {
  it('tipo_pessoa/categoria/perfil come right after id/tenant_id, followed by nome (derived)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const typeIdx = block.indexOf('tipo_pessoa ');
    const categoryIdx = block.indexOf('categoria ');
    const profileIdx = block.indexOf('perfil ');
    const nameIdx = block.search(/\bnome\s+varchar/);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(typeIdx).toBeGreaterThan(tenantIdx);
    expect(categoryIdx).toBeGreaterThan(typeIdx);
    expect(profileIdx).toBeGreaterThan(categoryIdx);
    expect(nameIdx).toBeGreaterThan(profileIdx);
  });

  it('drops segmento/endereco/responsavel/prioridade/cpf/cnpj (proven orphans) with fail-fast validation', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).not.toMatch(/\bsegmento\b/);
    expect(block).not.toMatch(/\bendereco\s+varchar/);
    expect(block).not.toMatch(/\bresponsavel\s+varchar/);
    expect(block).not.toMatch(/\bprioridade\s+varchar/);
    expect(block).not.toMatch(/\bcpf\s+varchar/);
    expect(block).not.toMatch(/\bcnpj\s+varchar/);
    expect(migrationSrc).toMatch(/count\(segmento\)::int \+ count\(endereco\)::int/);
    expect(migrationSrc).toMatch(/columns presumed orphaned, but real data exists/);
  });

  it('fixes categoria/perfil to NOT NULL with fail-fast validation of existing data', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).toMatch(/categoria\s+varchar\(100\) NOT NULL/);
    expect(block).toMatch(/perfil\s+varchar\(100\) NOT NULL/);
    expect(migrationSrc).toMatch(/categoria IS NULL OR perfil IS NULL/);
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

  it('recreates the dependent FK (counterparties), RLS + policies and has an honest down()', () => {
    expect(migrationSrc.match(/ALTER TABLE counterparties DROP CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc.match(/ALTER TABLE counterparties ADD CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
