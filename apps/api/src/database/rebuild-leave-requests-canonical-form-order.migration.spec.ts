import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `leave_requests` — follows FeriasAusenciasFormModal.tsx. Mirrored pair
 * funcionario_id/employee_id; motivo/documento_url kept as a legacy
 * zone (DTO-accepted, no current visual field).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000025_RebuildLeaveRequestsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildLeaveRequestsInCanonicalFormOrder20260719000025', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('funcionario_id/employee_id sit next to each other (real field first) right after tenant_id', () => {
    const b = block();
    const tenantIdx = b.indexOf('tenant_id');
    const legacyEmployeeIdx = b.indexOf('funcionario_id');
    const employeeIdx = b.indexOf('employee_id');
    expect(legacyEmployeeIdx).toBeGreaterThan(tenantIdx);
    expect(employeeIdx).toBeGreaterThan(legacyEmployeeIdx);
  });

  it('segue a ordem visual do form: tipo -> data_inicio -> data_fim -> dias_totais -> status -> aprovado_por -> observacoes', () => {
    const b = block();
    const typeIdx = b.search(/\btipo\s+varchar/);
    const startIdx = b.indexOf('data_inicio');
    const endIdx = b.indexOf('data_fim');
    const daysIdx = b.indexOf('dias_totais');
    const statusIdx = b.search(/\bstatus\s+varchar/);
    const approvedIdx = b.indexOf('aprovado_por');
    const obsIdx = b.indexOf('observacoes');
    expect(startIdx).toBeGreaterThan(typeIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    expect(daysIdx).toBeGreaterThan(endIdx);
    expect(statusIdx).toBeGreaterThan(daysIdx);
    expect(approvedIdx).toBeGreaterThan(statusIdx);
    expect(obsIdx).toBeGreaterThan(approvedIdx);
  });

  it('motivo/documento_url (legacy zone, no visual field) come after observacoes and before metadata', () => {
    const b = block();
    const obsIdx = b.indexOf('observacoes');
    const reasonIdx = b.indexOf('motivo');
    const docIdx = b.indexOf('documento_url');
    const metadataIdx = b.indexOf('metadata');
    expect(reasonIdx).toBeGreaterThan(obsIdx);
    expect(docIdx).toBeGreaterThan(reasonIdx);
    expect(metadataIdx).toBeGreaterThan(docIdx);
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

  it('recreates FK fk_leave_requests_employee_id (ON DELETE RESTRICT) and RLS + both policies, with an honest down()', () => {
    expect(migrationSrc.match(/FOREIGN KEY \(employee_id\) REFERENCES employees\(id\) ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/CREATE POLICY super_admin_full_access/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
