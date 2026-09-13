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
      email:              this.enc.decryptNullable(e.email_encrypted),
      telefone:           this.enc.decryptNullable(e.telefone_encrypted),
      cpf:                this.enc.decryptNullable(e.cpf_encrypted),
      email_encrypted:    undefined,
      telefone_encrypted: undefined,
      cpf_encrypted:      undefined,
    };
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async listEmployees(
    tenantId: string,
    query: { status?: string; setor?: string; search?: string; offset?: number; limit?: number } = {},
  ) {
    const qb = this.empRepo!
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId AND e.deleted_at IS NULL', { tenantId });

    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    // Frontend usa "setor"; a coluna física é `departamento` (mesmo campo, nome legado).
    if (query.setor)  qb.andWhere('e.departamento = :setor', { setor: query.setor });
    if (query.search) qb.andWhere('(e.nome ILIKE :search OR e.cargo ILIKE :search)', { search: `%${query.search}%` });

    qb.orderBy('e.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(e => this.mapEmployee(e)), meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  /** Contagem exata de funcionários por status, tenant inteiro (KPIs da página de RH). */
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

  async createEmployee(tenantId: string, userId: string, dto: CreateEmployeeDto) {
    const entity = this.empRepo!.create({
      tenant_id:          tenantId,
      nome:               dto.nome,
      cargo:              dto.cargo         ?? null,
      departamento:       dto.departamento  ?? null,
      tipo_contrato:      dto.tipo_contrato ?? 'clt',
      status:             dto.status ?? EmployeeStatus.ACTIVE,
      email_encrypted:    this.enc.encryptNullable((dto as any).email),
      telefone_encrypted: this.enc.encryptNullable((dto as any).telefone),
      cpf_encrypted:      this.enc.encryptNullable((dto as any).cpf),
      salario:            (dto as any).salario       ?? null,
      data_admissao:      (dto as any).data_admissao ? new Date((dto as any).data_admissao) : null,
      data_demissao:      (dto as any).data_demissao ? new Date((dto as any).data_demissao) : null,
      documents:         (dto as any).documents    ?? [],
      metadata:           (dto as any).metadata      ?? {},
      created_by:         userId,
    });
    return this.mapEmployee((await this.empRepo!.save(entity)) as EmployeeEntity);
  }

  async updateEmployee(tenantId: string, userId: string, id: string, dto: UpdateEmployeeDto) {
    await this._findRaw(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (dto.nome          != null) updates.nome          = dto.nome;
    if (dto.cargo         != null) updates.cargo         = dto.cargo;
    if (dto.departamento  != null) updates.departamento  = dto.departamento;
    if (dto.tipo_contrato != null) updates.tipo_contrato = dto.tipo_contrato;
    if (dto.status        != null) updates.status        = dto.status;
    if ((dto as any).salario       != null) updates.salario       = (dto as any).salario;
    if ((dto as any).documents    != null) updates.documents    = (dto as any).documents;
    if ((dto as any).metadata      != null) updates.metadata      = (dto as any).metadata;
    if ((dto as any).data_admissao != null) updates.data_admissao = new Date((dto as any).data_admissao);
    if ((dto as any).data_demissao != null) updates.data_demissao = new Date((dto as any).data_demissao);
    if ((dto as any).email    !== undefined) updates.email_encrypted    = this.enc.encryptNullable((dto as any).email);
    if ((dto as any).telefone !== undefined) updates.telefone_encrypted = this.enc.encryptNullable((dto as any).telefone);
    if ((dto as any).cpf      !== undefined) updates.cpf_encrypted      = this.enc.encryptNullable((dto as any).cpf);

    const expectedUpdatedAt = (dto as any).expectedUpdatedAt as string | undefined;
    delete updates['expectedUpdatedAt'];
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
    query: { employee_id?: string; competencia?: string; status?: string; offset?: number; limit?: number } = {},
  ) {
    const qb = this.payrollRepo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId AND p.deleted_at IS NULL', { tenantId });

    if (query.employee_id) qb.andWhere('p.employee_id = :employeeId', { employeeId: query.employee_id });
    if (query.competencia) qb.andWhere('p.competencia = :competencia', { competencia: query.competencia });
    if (query.status)      qb.andWhere('p.status = :status', { status: query.status });

    qb.orderBy('p.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async createPayroll(tenantId: string, dto: CreatePayrollEntryDto): Promise<PayrollEntryEntity> {
    // find-88311b49: employee_id had no cross-tenant ownership check — a
    // payroll entry could silently reference another tenant's employee.
    await assertSameTenantFk(this.payrollRepo!.manager.connection, 'employees', dto.employee_id, tenantId, 'Funcionário');
    const entity = this.payrollRepo!.create({
      tenant_id:       tenantId,
      employee_id:     dto.employee_id,
      competencia:     dto.competencia,
      salario_bruto:   dto.salario_bruto,
      descontos:       (dto as any).descontos    ?? '0',
      salario_liquido: dto.salario_liquido,
      status:          (dto as any).status       ?? PayrollStatus.PENDING,
      arquivo_url:     (dto as any).arquivo_url  ?? null,
      pago_em:         (dto as any).pago_em      ? new Date((dto as any).pago_em) : null,
      metadata:        (dto as any).metadata     ?? {},
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

  async createLeaveRequest(tenantId: string, userId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequestEntity> {
    // find-88311b49: employee_id had no cross-tenant ownership check — a
    // leave request could silently reference another tenant's employee.
    await assertSameTenantFk(this.leaveRepo!.manager.connection, 'employees', dto.employee_id, tenantId, 'Funcionário');
    const entity = this.leaveRepo!.create({
      tenant_id:    tenantId,
      employee_id:  dto.employee_id,
      type:         dto.type,
      start_date:  new Date(dto.start_date),
      end_date:     new Date(dto.end_date),
      status:       (dto as any).status       ?? LeaveRequestStatus.PENDING,
      motivo:       (dto as any).motivo       ?? null,
      aprovado_por: (dto as any).aprovado_por ?? null,
      documento_url: (dto as any).documento_url ?? null,
      metadata:     (dto as any).metadata     ?? {},
      created_by:   userId,
    });
    return this.leaveRepo!.save(entity);
  }

  async approveLeaveRequest(tenantId: string, id: string, userId: string): Promise<LeaveRequestEntity> {
    // find-c83fdb94: guard the single valid transition (pending -> approved)
    // so an already-approved/rejected request can't be re-approved or have
    // its aprovado_por/updated_at silently overwritten by a repeat call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.leaveRepo!.update(
      { id, tenant_id: tenantId, status: LeaveRequestStatus.PENDING } as any,
      { status: LeaveRequestStatus.APPROVED, aprovado_por: userId, updated_at: new Date() } as any,
    );
    if (!result.affected) {
      const current = await this.leaveRepo!
        .createQueryBuilder('l')
        .where('l.id = :id AND l.tenant_id = :tenantId AND l.deleted_at IS NULL', { id, tenantId })
        .getOne();
      if (!current) throw new NotFoundException('Afastamento não encontrado');
      throw new BadRequestException(`Afastamento não está pendente (status atual: ${current.status})`);
    }
    const updated = await this.leaveRepo!
      .createQueryBuilder('l')
      .where('l.id = :id AND l.tenant_id = :tenantId AND l.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!updated) throw new NotFoundException('Afastamento não encontrado');
    return updated;
  }
}
