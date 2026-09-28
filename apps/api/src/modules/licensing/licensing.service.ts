import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { LicenseEntity } from '../../database/entities';
import { groupCount, type GroupStatsResult } from '../../common/stats/group-count.util';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import type { CreateLicenseDto, UpdateLicenseDto, QueryLicenseDto } from './dto/licensing.dto';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import {
  LICENSE_DEPRECATED_FIELDS,
  LICENSE_QUERY_DEPRECATED_FIELDS,
  canonicalLicenseStatusFilter,
  canonicalLicenseValue,
} from './license-vocabulary';

@Injectable()
export class LicensingService {
  private readonly repo: Repository<LicenseEntity> | null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo = ds?.getRepository(LicenseEntity) ?? null;
    this.ds = ds;
  }

  private get repository(): Repository<LicenseEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  /**
   * Deprecated field names and values -> canonical (CZ-035). `amount`,
   * `currency` and `percentage` are physical columns; the mapping is explicit
   * and symmetric for creating, editing and re-reading the modal.
   */
  private normalizePayload(
    dto: CreateLicenseDto | UpdateLicenseDto,
  ): Record<string, unknown> {
    const out = applyDeprecatedFieldAliases(dto as Record<string, unknown>, LICENSE_DEPRECATED_FIELDS);
    for (const field of ['status', 'type', 'target_media', 'territory']) {
      if (out[field] !== undefined) out[field] = canonicalLicenseValue(field, out[field]);
    }
    return out;
  }

  private mapLicense(entity: LicenseEntity): Record<string, unknown> {
    const raw = entity as unknown as Record<string, unknown>;
    return {
      ...raw,
      amount: raw['amount'] == null ? null : Number(raw['amount']),
      currency: raw['currency'] ?? 'BRL',
      percentage: raw['percentage'] == null ? null : Number(raw['percentage']),
    };
  }

  async list(tenantId: string, input: QueryLicenseDto) {
    const query = applyDeprecatedFieldAliases(input, LICENSE_QUERY_DEPRECATED_FIELDS);
    const qb = this.repository.createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.deleted_at IS NULL');

    if (query.status) {
      // The proposals tab of Licensing.tsx spans negotiation+proposal —
      // accepts comma-separated statuses and uses IN when there is more than one.
      const statuses = canonicalLicenseStatusFilter(query.status);
      if (statuses.length > 1) qb.andWhere('l.status IN (:...statuses)', { statuses });
      else if (statuses.length === 1) qb.andWhere('l.status = :status', { status: statuses[0] });
    }
    if (query.type) qb.andWhere('l.type = :type', { type: query.type });
    if (query.work_id) qb.andWhere('l.work_id = :workId', { workId: query.work_id });
    if (query.client_id) qb.andWhere('l.client_id = :clientId', { clientId: query.client_id });
    if (query.target_media) qb.andWhere('l.target_media ILIKE :media', { media: `%${query.target_media}%` });
    if (query.search) {
      qb.andWhere(
        '(l.title ILIKE :search OR l.project_name ILIKE :search OR l.artist_name ILIKE :search OR l.client_name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('l.created_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((row) => this.mapLicense(row)),
      meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 },
    };
  }

  /**
   * Count + sum of `amount` per status, over the whole tenant (not the
   * current page) — Task H: exact KPIs without downloading the whole table. The 3
   * tabs (catalog/proposals/active) and the "Valor Total" card (sum only
   * of status=active) of Licensing.tsx now read this map instead of the
   * full license list.
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const qb = this.repository
      .createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.deleted_at IS NULL');
    return groupCount(qb, 'l', 'status', 'amount');
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown>> {
    const item = await this.repository.findOne({
      where: { id, tenant_id: tenantId, deleted_at: null } as never,
    });
    if (!item) throw new NotFoundException('Licença não encontrada');
    return this.mapLicense(item);
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateLicenseDto,
  ): Promise<Record<string, unknown>> {
    const payload = this.normalizePayload(dto);
    await assertSameTenantFk(this.ds!, 'works',   payload['work_id']    as string | undefined, tenantId, 'Obra');
    await assertSameTenantFk(this.ds!, 'artists', payload['artist_id'] as string | undefined, tenantId, 'Artista');
    await assertSameTenantFk(this.ds!, 'clients', payload['client_id'] as string | undefined, tenantId, 'Cliente');

    const item = this.repository.create({
      tenant_id: tenantId,
      ...payload,
      created_by: userId,
      updated_by: userId,
    } as Partial<LicenseEntity>);
    const saved = await this.repository.save(item as LicenseEntity);
    return this.mapLicense(saved);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateLicenseDto,
  ): Promise<Record<string, unknown>> {
    const current = await this.repository.findOne({
      where: { id, tenant_id: tenantId, deleted_at: null } as never,
    });
    if (!current) throw new NotFoundException('Licença não encontrada');

    const { expectedUpdatedAt, ...normalized } = this.normalizePayload(dto) as Record<string, unknown> & { expectedUpdatedAt?: string };
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as never,
      {
        ...normalized,
        updated_at: new Date(),
        updated_by: userId,
      } as never,
      expectedUpdatedAt,
      'Esta licença foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repository.update(
      { id, tenant_id: tenantId } as never,
      { deleted_at: new Date(), updated_at: new Date() } as never,
    );
    return { deleted: true };
  }
}
