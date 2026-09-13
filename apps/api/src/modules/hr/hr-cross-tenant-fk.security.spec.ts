import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';
import type { CreatePayrollEntryDto } from './dto/create-payroll-entry.dto';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

/**
 * find-88311b49: payroll.employee_id and leave_requests.employee_id had no
 * cross-tenant ownership check — a payroll entry or leave request could
 * silently reference another tenant's employee.
 */
describe('HrService — cross-tenant FK ownership (find-88311b49)', () => {
  function makeService(queryImpl: jest.Mock) {
    const connection = { query: queryImpl };
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'row-1', ...(v as object) })),
      manager: { connection },
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const enc = { decryptNullable: jest.fn(() => null) };
    const service = new HrService(ds as never, enc as never);
    return { service, repo };
  }

  it('createPayroll: rejects an employee_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.createPayroll('tenant-1', {
        employee_id: '323e4567-e89b-12d3-a456-426614174000',
        competencia: '2026-01', salario_bruto: '1000', salario_liquido: '900',
      } as unknown as CreatePayrollEntryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createPayroll: allows an employee_id that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.createPayroll('tenant-1', {
        employee_id: '223e4567-e89b-12d3-a456-426614174000',
        competencia: '2026-01', salario_bruto: '1000', salario_liquido: '900',
      } as unknown as CreatePayrollEntryDto),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('createLeaveRequest: rejects an employee_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.createLeaveRequest('tenant-1', 'user-1', {
        employee_id: '323e4567-e89b-12d3-a456-426614174000',
        type: 'ferias', start_date: '2026-01-01', end_date: '2026-01-10',
      } as unknown as CreateLeaveRequestDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('HrService.approveLeaveRequest — pending-only transition guard (find-c83fdb94)', () => {
  function makeService(getOneValue: unknown, affected: number) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => getOneValue);
    const leaveRepo = {
      update: jest.fn().mockResolvedValue({ affected }),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = {
      getRepository: jest.fn((entity: { name?: string }) =>
        entity?.name === 'LeaveRequestEntity' ? leaveRepo : { manager: { connection: { query: jest.fn() } } },
      ),
    };
    const enc = { decryptNullable: jest.fn(() => null) };
    const service = new HrService(ds as never, enc as never);
    return { service, leaveRepo };
  }

  it('rejects approving a request that is not pending', async () => {
    const { service } = makeService({ id: 'leave-1', status: 'approved' }, 0);
    await expect(service.approveLeaveRequest('tenant-1', 'leave-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when the request does not exist at all', async () => {
    const { service } = makeService(null, 0);
    await expect(service.approveLeaveRequest('tenant-1', 'leave-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approves a genuinely pending request', async () => {
    const { service, leaveRepo } = makeService({ id: 'leave-1', status: 'approved' }, 1);
    await expect(service.approveLeaveRequest('tenant-1', 'leave-1', 'user-1')).resolves.toBeDefined();
    expect(leaveRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'leave-1', tenant_id: 'tenant-1', status: 'pending' }),
      expect.anything(),
    );
  });
});
