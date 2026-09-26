import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `payroll_entries` — segue FolhaPagamentoFormModal.tsx. Pares mirrorados
 * funcionario_id/employee_id e mes_referencia/competencia; arquivo_url/
 * pago_em mantidos como zona legada (DTO-aceitos, sem campo visual atual).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000019_RebuildPayrollEntriesInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildPayrollEntriesInCanonicalFormOrder20260719000019', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('funcionario_id/employee_id and mes_referencia/competencia sit in adjacent pairs (real field first)', () => {
    const b = block();
    const funcionarioIdx = b.indexOf('funcionario_id');
    const employeeIdx = b.indexOf('employee_id');
    const mesRefIdx = b.indexOf('mes_referencia');
    const competenciaIdx = b.indexOf('competencia');
    expect(employeeIdx).toBeGreaterThan(funcionarioIdx);
    expect(competenciaIdx).toBeGreaterThan(mesRefIdx);
    expect(mesRefIdx).toBeGreaterThan(employeeIdx);
  });

  it('bonus/data_pagamento/observacoes follow the form\'s visual order, before arquivo_url/pago_em (legacy)', () => {
    const b = block();
    const bonusIdx = b.indexOf('bonus');
    const salarioLiquidoIdx = b.indexOf('salario_liquido');
    const dataPagamentoIdx = b.indexOf('data_pagamento');
    const arquivoUrlIdx = b.indexOf('arquivo_url');
    const pagoEmIdx = b.indexOf('pago_em');
    expect(salarioLiquidoIdx).toBeGreaterThan(bonusIdx);
    expect(dataPagamentoIdx).toBeGreaterThan(salarioLiquidoIdx);
    expect(arquivoUrlIdx).toBeGreaterThan(dataPagamentoIdx);
    expect(pagoEmIdx).toBeGreaterThan(arquivoUrlIdx);
  });

  it('the audit block is created_at -> updated_at -> deleted_at (no created_by/updated_by, pre-existing gap)', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const deletedAtIdx = b.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(deletedAtIdx).toBeGreaterThan(updatedAtIdx);
    expect(b).not.toMatch(/created_by|updated_by/);
    expect(migrationSrc.split('originalColumns = `')[1].split('`;')[0]).not.toMatch(/created_by|updated_by/);
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

  it('recreates FK fk_payroll_entries_employee_id (ON DELETE RESTRICT) and RLS + policies, with an honest down()', () => {
    expect(migrationSrc.match(/FOREIGN KEY \(employee_id\) REFERENCES employees\(id\) ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/CREATE POLICY super_admin_full_access/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
