import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { EmployeeEntity, PayrollEntryEntity, LeaveRequestEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import type { CreateEmployeeDto }     from './dto/create-employee.dto';
import type { UpdateEmployeeDto }     from './dto/update-employee.dto';
import type { CreatePayrollEntryDto } from './dto/create-payroll-entry.dto';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { EmployeeStatus, PayrollStatus, LeaveRequestStatus } from '@music-os-360/types';
import { groupCount, GroupStatsResult } from '../../common/stats/group-count.util';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import {
  EMPLOYEE_DEPRECATED_FIELDS,
  LEAVE_REQUEST_DEPRECATED_FIELDS,
  PAYROLL_DEPRECATED_FIELDS,
  canonicalContractType,
  canonicalLeaveType,
} from './hr-legacy-fields';

@Injectable()
export class HrService {
  private readonly empRepo:     Repository<EmployeeEntity>    | null = null;
  private readonly payrollRepo: Repository<PayrollEntryEntity> | null = null;
  private readonly leaveRepo:   Repository<LeaveRequestEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly enc: EncryptionService,
  ) {
    if (ds) {
      this.empRepo     = ds.getRepository(EmployeeEntity);
      this.payrollRepo = ds.getRepository(PayrollEntryEntity);
      this.leaveRepo   = ds.getRepository(LeaveRequestEntity);
    }
  }

  private mapEmployee(e: EmployeeEntity) {
    return {
      ...e,
      email:           this.enc.decryptNullable(e.email_encrypted),
      phone:           this.enc.decryptNullable(e.phone_encrypted),
      cpf:             this.enc.decryptNullable(e.cpf_encrypted),
      email_encrypted: undefined,
      phone_encrypted: undefined,
      cpf_encrypted:   undefined,
    };
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async listEmployees(
    tenantId: string,
    query: { status?: string; department?: string; search?: string; offset?: number; limit?: number } = {},
  ) {
    const qb = this.empRepo!
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId AND e.deleted_at IS NULL', { tenantId });

    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.department) qb.andWhere('e.department = :department', { department: query.department });
    if (query.search) qb.andWhere('(e.name ILIKE :search OR e.job_title ILIKE :search)', { search: `%${query.search}%` });

    qb.orderBy('e.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(e => this.mapEmployee(e)), meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  /** Exact employee count per status, whole tenant (HR page KPIs). */
  async employeeStats(tenantId: string): Promise<GroupStatsResult> {
    return groupCount(
      this.empRepo!.createQueryBuilder('e').where('e.tenant_id = :tenantId AND e.deleted_at IS NULL', { tenantId }),
      'e',
      'status',
    );
  }

  private async _findRaw(tenantId: string, id: string): Promise<EmployeeEntity> {
    const result = await this.empRepo!
      .createQueryBuilder('e')
      .where('e.id = :id AND e.tenant_id = :tenantId AND e.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Funcionário não encontrado');
    return result;
  }

  async findEmployee(tenantId: string, id: string) {
    return this.mapEmployee(await this._findRaw(tenantId, id));
  }

  async createEmployee(tenantId: string, userId: string, input: CreateEmployeeDto) {
    const dto = applyDeprecatedFieldAliases(input as unknown as Record<string, unknown>, EMPLOYEE_DEPRECATED_FIELDS);
    const entity = this.empRepo!.create({
      tenant_id:       tenantId,
      name:            dto['name'] as string,
      job_title:       (dto['job_title'] as string | undefined) ?? null,
      department:      (dto['department'] as string | undefined) ?? null,
      contract_type:   (canonicalContractType(dto['contract_type']) as string | undefined) ?? 'clt',
      status:          (dto['status'] as EmployeeStatus | undefined) ?? EmployeeStatus.ACTIVE,
      email_encrypted: this.enc.encryptNullable(dto['email'] as string | null | undefined),
      phone_encrypted: this.enc.encryptNullable(dto['phone'] as string | null | undefined),
      cpf_encrypted:   this.enc.encryptNullable(dto['cpf'] as string | null | undefined),
      salary:          (dto['salary'] as string | undefined) ?? null,
      hired_at:        dto['hired_at'] ? new Date(dto['hired_at'] as string) : null,
      terminated_at:   dto['terminated_at'] ? new Date(dto['terminated_at'] as string) : null,
      notes:           (dto['notes'] as string | undefined) ?? null,
      linked_user_id:  (dto['linked_user_id'] as string | undefined) ?? null,
      documents:       (dto['documents'] as unknown[] | undefined) ?? [],
      metadata:        (dto['metadata'] as Record<string, unknown> | undefined) ?? {},
      created_by:      userId,
    });
    return this.mapEmployee((await this.empRepo!.save(entity)) as EmployeeEntity);
  }

  async updateEmployee(tenantId: string, userId: string, id: string, input: UpdateEmployeeDto) {
    await this._findRaw(tenantId, id);
    const dto = applyDeprecatedFieldAliases(input as unknown as Record<string, unknown>, EMPLOYEE_DEPRECATED_FIELDS);
    const updates: Record<string, unknown> = { updated_at: new Date() };
    for (const field of ['name', 'job_title', 'department', 'status', 'salary', 'documents', 'metadata', 'notes', 'linked_user_id'] as const) {
      if (dto[field] != null) updates[field] = dto[field];
    }
    if (dto['contract_type'] != null) updates.contract_type = canonicalContractType(dto['contract_type']);
    if (dto['hired_at'] != null) updates.hired_at = new Date(dto['hired_at'] as string);
    if (dto['terminated_at'] != null) updates.terminated_at = new Date(dto['terminated_at'] as string);
    if (dto['email'] !== undefined) updates.email_encrypted = this.enc.encryptNullable(dto['email'] as string | null);
    if (dto['phone'] !== undefined) updates.phone_encrypted = this.enc.encryptNullable(dto['phone'] as string | null);
    if (dto['cpf']   !== undefined) updates.cpf_encrypted   = this.enc.encryptNullable(dto['cpf'] as string | null);

    const expectedUpdatedAt = dto['expectedUpdatedAt'] as string | undefined;
    await casUpdate(
      this.empRepo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt,
      'Este funcionário foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.mapEmployee(await this._findRaw(tenantId, id));
  }

  async softDeleteEmployee(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    await this._findRaw(tenantId, id);
    await this.empRepo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  async listPayroll(
    tenantId: string,
    query: { employee_id?: string; reference_month?: string; status?: string; offset?: number; limit?: number } = {},
  ) {
    const qb = this.payrollRepo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId AND p.deleted_at IS NULL', { tenantId });

    if (query.employee_id) qb.andWhere('p.employee_id = :employeeId', { employeeId: query.employee_id });
    if (query.reference_month) qb.andWhere('p.reference_month = :referenceMonth', { referenceMonth: query.reference_month });
    if (query.status)      qb.andWhere('p.status = :status', { status: query.status });

    qb.orderBy('p.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async createPayroll(tenantId: string, input: CreatePayrollEntryDto): Promise<PayrollEntryEntity> {
    const dto = applyDeprecatedFieldAliases(input as unknown as Record<string, unknown>, PAYROLL_DEPRECATED_FIELDS);
    const employeeId = dto['employee_id'] as string | undefined;
    const referenceMonth = dto['reference_month'] as string | undefined;
    if (!employeeId || !referenceMonth || dto['gross_salary'] == null || dto['net_salary'] == null) {
      throw new BadRequestException('Funcionário, competência, salário bruto e salário líquido são obrigatórios.');
    }
    // find-88311b49: employee_id had no cross-tenant ownership check — a
    // payroll entry could silently reference another tenant's employee.
    await assertSameTenantFk(this.payrollRepo!.manager.connection, 'employees', employeeId, tenantId, 'Funcionário');
    const entity = this.payrollRepo!.create({
      tenant_id:       tenantId,
      employee_id:     employeeId,
      reference_month: referenceMonth,
      gross_salary:    String(dto['gross_salary']),
      deductions:      dto['deductions'] != null ? String(dto['deductions']) : '0',
      bonus:           dto['bonus'] != null ? String(dto['bonus']) : null,
      net_salary:      String(dto['net_salary']),
      payment_date:    (dto['payment_date'] as string | undefined) ?? null,
      status:          (dto['status'] as PayrollStatus | undefined) ?? PayrollStatus.PENDING,
      notes:           (dto['notes'] as string | undefined) ?? null,
      file_url:        (dto['file_url'] as string | undefined) ?? null,
      paid_at:         dto['paid_at'] ? new Date(dto['paid_at'] as string) : null,
      metadata:        (dto['metadata'] as Record<string, unknown> | undefined) ?? {},
    });
    return this.payrollRepo!.save(entity);
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  async listLeaveRequests(
    tenantId: string,
    query: { employee_id?: string; status?: string; search?: string; offset?: number; limit?: number } = {},
  ) {
    const qb = this.leaveRepo!
      .createQueryBuilder('l')
      .where('l.tenant_id = :tenantId AND l.deleted_at IS NULL', { tenantId });

    if (query.employee_id) qb.andWhere('l.employee_id = :employeeId', { employeeId: query.employee_id });
    if (query.status)      qb.andWhere('l.status = :status', { status: query.status });
    if (query.search)      qb.andWhere('l.type ILIKE :search', { search: `%${query.search}%` });

    qb.orderBy('l.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async createLeaveRequest(tenantId: string, userId: string, input: CreateLeaveRequestDto): Promise<LeaveRequestEntity> {
    const dto = applyDeprecatedFieldAliases(input as unknown as Record<string, unknown>, LEAVE_REQUEST_DEPRECATED_FIELDS);
    const employeeId = dto['employee_id'] as string | undefined;
    if (!employeeId) throw new BadRequestException('Funcionário é obrigatório.');
    // find-88311b49: employee_id had no cross-tenant ownership check — a
    // leave request could silently reference another tenant's employee.
    await assertSameTenantFk(this.leaveRepo!.manager.connection, 'employees', employeeId, tenantId, 'Funcionário');
    const entity = this.leaveRepo!.create({
      tenant_id:    tenantId,
      employee_id:  employeeId,
      type:         canonicalLeaveType(dto['type']) as string,
      start_date:   new Date(dto['start_date'] as string),
      end_date:     new Date(dto['end_date'] as string),
      total_days:   (dto['total_days'] as number | undefined) ?? null,
      status:       (dto['status'] as LeaveRequestStatus | undefined) ?? LeaveRequestStatus.PENDING,
      reason:       (dto['reason'] as string | undefined) ?? null,
      notes:        (dto['notes'] as string | undefined) ?? null,
      approved_by:  (dto['approved_by'] as string | undefined) ?? null,
      document_url: (dto['document_url'] as string | undefined) ?? null,
      metadata:     (dto['metadata'] as Record<string, unknown> | undefined) ?? {},
      created_by:   userId,
    });
    return this.leaveRepo!.save(entity);
  }

  async approveLeaveRequest(tenantId: string, id: string, userId: string): Promise<LeaveRequestEntity> {
    // find-c83fdb94: guard the single valid transition (pending -> approved)
    // so an already-approved/rejected request can't be re-approved or have
    // its approved_by/updated_at silently overwritten by a repeat call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.leaveRepo!.update(
      { id, tenant_id: tenantId, status: LeaveRequestStatus.PENDING } as any,
      { status: LeaveRequestStatus.APPROVED, approved_by: userId, updated_at: new Date() } as any,
    );
    if (!result.affected) {
      const current = await this.leaveRepo!
        .createQueryBuilder('l')
        .where('l.id = :id AND l.tenant_id = :tenantId AND l.deleted_at IS NULL', { id, tenantId })
        .getOne();
      if (!current) throw new NotFoundException('Afastamento não encontrado');
      throw new BadRequestException('Este afastamento não está mais pendente.');
    }
    const updated = await this.leaveRepo!
      .createQueryBuilder('l')
      .where('l.id = :id AND l.tenant_id = :tenantId AND l.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!updated) throw new NotFoundException('Afastamento não encontrado');
    return updated;
  }
}
