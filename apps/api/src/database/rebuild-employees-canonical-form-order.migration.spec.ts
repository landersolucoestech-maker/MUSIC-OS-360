import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `employees` — follows FuncionarioFormModal.tsx (personal data →
 * professional tabs). nome/nome_completo mirrored; departamento/salario/
 * data_demissao/documentos kept as a legacy zone (DTO-accepted, no
 * current visual field).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000018_RebuildEmployeesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildEmployeesInCanonicalFormOrder20260719000018', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('nome_completo/nome come right after id/tenant_id (mirrored pair, real field first)', () => {
    const b = block();
    const idIdx = b.indexOf('id ');
    const tenantIdx = b.indexOf('tenant_id ');
    const nomeCompletoIdx = b.indexOf('nome_completo');
    const nomeIdx = b.search(/\bnome\s+varchar/);
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(nomeCompletoIdx).toBeGreaterThan(tenantIdx);
    expect(nomeIdx).toBeGreaterThan(nomeCompletoIdx);
  });

  it('legacy fields (departamento/salario/data_demissao) sit next to their matching real field', () => {
    const b = block();
    const setorIdx = b.indexOf('setor ');
    const departamentoIdx = b.indexOf('departamento');
    const admissaoIdx = b.indexOf('data_admissao');
    const demissaoIdx = b.indexOf('data_demissao');
    const salarioBaseIdx = b.indexOf('salario_base');
    const salarioIdx = b.search(/\bsalario\s+numeric/);
    expect(departamentoIdx).toBeGreaterThan(setorIdx);
    expect(demissaoIdx).toBeGreaterThan(admissaoIdx);
    expect(salarioIdx).toBeGreaterThan(salarioBaseIdx);
  });

  it('documentos (no visual field) comes before metadata and after the functional fields', () => {
    const b = block();
    const vinculoIdx = b.indexOf('vinculo_usuario_id');
    const documentosIdx = b.indexOf('documentos');
    const metadataIdx = b.indexOf('metadata');
    expect(documentosIdx).toBeGreaterThan(vinculoIdx);
    expect(metadataIdx).toBeGreaterThan(documentosIdx);
  });

  it('the audit block is created_at -> updated_at -> created_by -> deleted_at (no updated_by, pre-existing gap)', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const createdByIdx = b.indexOf('created_by');
    const deletedAtIdx = b.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
    expect(deletedAtIdx).toBeGreaterThan(createdByIdx);
    expect(b).not.toMatch(/updated_by/);
    expect(migrationSrc.split('originalColumns = `')[1].split('`;')[0]).not.toMatch(/updated_by/);
  });

  it('removes no column (pure order rebuild)', () => {
    const newBlock = block();
    const origBlock = migrationSrc.split('originalColumns = `')[1].split('`;')[0];
    const extractCols = (b: string) => [...b.matchAll(/^\s*(\w+)\s+/gm)].map((m) => m[1]);
    const newCols = new Set(extractCols(newBlock));
    const origCols = new Set(extractCols(origBlock));
    expect(newCols.size).toBe(origCols.size);
    for (const col of origCols) expect(newCols.has(col)).toBe(true);
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('derruba e recria FKs dependentes (payroll_entries, leave_requests)', () => {
    expect(migrationSrc).toMatch(/ALTER TABLE payroll_entries DROP CONSTRAINT fk_payroll_entries_employee_id/);
    expect(migrationSrc).toMatch(/ALTER TABLE leave_requests DROP CONSTRAINT fk_leave_requests_employee_id/);
    expect(migrationSrc.match(/ADD CONSTRAINT fk_payroll_entries_employee_id FOREIGN KEY/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/ADD CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recria RLS + as duas policies (tenant_isolation, super_admin_full_access) e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/CREATE POLICY super_admin_full_access/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
