import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HrService } from './hr.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreatePayrollEntryDto } from './dto/create-payroll-entry.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CONTRACT_TYPES, LEAVE_TYPES, LEGACY_CONTRACT_TYPES, LEGACY_LEAVE_TYPES, canonicalContractType } from './hr-legacy-fields';

/**
 * CZ-030: the HR request contract is English. Before it, the web payroll and
 * leave forms sent field names the DTOs did not declare (funcionario_id,
 * mes_referencia, observacoes, ...) and every submit was rejected with 400 by
 * the whitelist pipe. These payloads are the ones the pre-CZ-030 web build
 * really sends; they must now validate and persist canonically.
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), { whitelist: true, forbidNonWhitelisted: true })
    .map((e) => e.property);

const EMPLOYEE_ID = '223e4567-e89b-12d3-a456-426614174000';

const LEGACY_WEB_PAYROLL = {
  funcionario_id: EMPLOYEE_ID,
  mes_referencia: '2026-09',
  salario_bruto: 5000,
  descontos: 500,
  bonus: 200,
  salario_liquido: 4700,
  data_pagamento: '2026-10-05',
  status: 'pending',
  observacoes: 'setembro',
};

const LEGACY_WEB_LEAVE = {
  funcionario_id: EMPLOYEE_ID,
  type: 'férias',
  start_date: '2026-10-01',
  end_date: '2026-10-10',
  dias_totais: 10,
  status: 'pending',
  aprovado_por: 'Ana',
  observacoes: 'descanso',
};

function makeService() {
  const connection = { query: jest.fn(async () => [{ exists: 1 }]) };
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'row-1', ...(v as object) })),
    manager: { connection },
  };
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = { encryptNullable: jest.fn((v: unknown) => (v == null ? null : `enc(${String(v)})`)), decryptNullable: jest.fn(() => null) };
  return { service: new HrService(ds as never, enc as never), repo };
}

describe('HR request contract (CZ-030)', () => {
  it('maps every legacy contract/leave type to a canonical value', () => {
    for (const v of Object.values(LEGACY_CONTRACT_TYPES)) expect(CONTRACT_TYPES).toContain(v);
    for (const v of Object.values(LEGACY_LEAVE_TYPES)) expect(LEAVE_TYPES).toContain(v);
  });

  it('the payroll payload of the pre-CZ-030 web form validates (it used to be rejected)', () => {
    expect(errorsFor(CreatePayrollEntryDto, LEGACY_WEB_PAYROLL)).toEqual([]);
  });

  it('the canonical payroll payload validates and requires its fields', () => {
    expect(errorsFor(CreatePayrollEntryDto, {
      employee_id: EMPLOYEE_ID, reference_month: '2026-09', gross_salary: '5000', net_salary: '4700',
    })).toEqual([]);
    expect(errorsFor(CreatePayrollEntryDto, { employee_id: EMPLOYEE_ID })).toEqual(
      expect.arrayContaining(['reference_month', 'gross_salary', 'net_salary']),
    );
  });

  it('the leave payload of the pre-CZ-030 web form validates (it used to be rejected)', () => {
    expect(errorsFor(CreateLeaveRequestDto, LEGACY_WEB_LEAVE)).toEqual([]);
  });

  it('employee DTO accepts canonical and deprecated names', () => {
    expect(errorsFor(CreateEmployeeDto, { name: 'A', job_title: 'Dev', contract_type: 'clt', phone: '1', hired_at: '2026-01-01', notes: 'n' })).toEqual([]);
    expect(errorsFor(CreateEmployeeDto, { name: 'A', cargo: 'Dev', tipo_contrato: 'CLT', telefone: '1', data_admissao: '2026-01-01' })).toEqual([]);
  });

  it('persists a legacy payroll payload with canonical columns only', async () => {
    const { service, repo } = makeService();
    await service.createPayroll('tenant-1', LEGACY_WEB_PAYROLL as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      employee_id: EMPLOYEE_ID, reference_month: '2026-09', gross_salary: '5000', deductions: '500',
      bonus: '200', net_salary: '4700', payment_date: '2026-10-05', notes: 'setembro',
    });
    for (const legacy of Object.keys(LEGACY_WEB_PAYROLL)) {
      if (!['status', 'bonus'].includes(legacy)) expect(row).not.toHaveProperty(legacy);
    }
  });

  it('persists a legacy leave payload with canonical columns and type value', async () => {
    const { service, repo } = makeService();
    await service.createLeaveRequest('tenant-1', 'user-1', LEGACY_WEB_LEAVE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ employee_id: EMPLOYEE_ID, type: 'vacation', total_days: 10, approved_by: 'Ana', notes: 'descanso' });
    for (const legacy of ['funcionario_id', 'dias_totais', 'aprovado_por', 'observacoes']) expect(row).not.toHaveProperty(legacy);
  });

  it('persists a legacy employee payload with canonical columns and contract type', async () => {
    const { service, repo } = makeService();
    await service.createEmployee('tenant-1', 'user-1', {
      name: 'A', cargo: 'Dev', departamento: 'TI', tipo_contrato: 'Estágio', telefone: '11', salario: '3000', data_admissao: '2026-01-01',
    } as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ job_title: 'Dev', department: 'TI', contract_type: 'internship', salary: '3000', phone_encrypted: 'enc(11)' });
    expect(row['hired_at']).toBeInstanceOf(Date);
  });

  it.each(Object.entries(LEGACY_CONTRACT_TYPES))('createEmployee maps the deprecated contract type %j to %j before persistence', async (legacy, canonical) => {
    const { service, repo } = makeService();
    await service.createEmployee('tenant-1', 'user-1', { name: 'A', tipo_contrato: legacy } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)['contract_type']).toBe(canonical);
  });

  it('the legacy contract types CLT and autonomo are mapped explicitly (clt, freelancer); a canonical value passes through', () => {
    expect(LEGACY_CONTRACT_TYPES['CLT']).toBe('clt');
    expect(LEGACY_CONTRACT_TYPES['autonomo']).toBe('freelancer');
    expect(canonicalContractType('CLT')).toBe('clt');
    expect(canonicalContractType('autonomo')).toBe('freelancer');
    expect(canonicalContractType('clt')).toBe('clt');
    expect(canonicalContractType('unknown-regime')).toBe('unknown-regime');
  });

  it('payroll: the deprecated arquivo_url is persisted as file_url; the canonical file_url wins when both are sent', async () => {
    const legacyOnly = makeService();
    await legacyOnly.service.createPayroll('tenant-1', { ...LEGACY_WEB_PAYROLL, arquivo_url: 'https://a.com/legacy.pdf' } as never);
    const row = legacyOnly.repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row['file_url']).toBe('https://a.com/legacy.pdf');
    expect(row).not.toHaveProperty('arquivo_url');

    const both = makeService();
    await both.service.createPayroll('tenant-1', {
      ...LEGACY_WEB_PAYROLL, file_url: 'https://a.com/canonical.pdf', arquivo_url: 'https://a.com/legacy.pdf',
    } as never);
    const bothRow = both.repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(bothRow['file_url']).toBe('https://a.com/canonical.pdf');
    expect(bothRow).not.toHaveProperty('arquivo_url');
  });
});
