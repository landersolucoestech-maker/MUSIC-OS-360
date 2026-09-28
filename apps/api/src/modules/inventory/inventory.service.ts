import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { InventoryItemEntity } from '../../database/entities';
import type { GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateInventoryItemDto, UpdateInventoryItemDto, QueryInventoryDto } from './dto/inventory.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import {
  INVENTORY_DEPRECATED_FIELDS,
  INVENTORY_QUERY_DEPRECATED_FIELDS,
  canonicalInventoryStatus,
} from './inventory-legacy-fields';

@Injectable()
export class InventoryService {
  private readonly repo: Repository<InventoryItemEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo = ds?.getRepository(InventoryItemEntity) ?? null;
  }

  private get repository(): Repository<InventoryItemEntity> {
    if (!this.repo) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
    return this.repo;
  }

  async list(tenantId: string, input: QueryInventoryDto) {
    const query = applyDeprecatedFieldAliases(input, INVENTORY_QUERY_DEPRECATED_FIELDS);
    const status = canonicalInventoryStatus(query.status);
    const qb = this.repository.createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL');

    if (status)         qb.andWhere('i.status = :status',       { status });
    // ILIKE without a wildcard = case-insensitive equality — preserves the
    // case-insensitive category filter that existed in the client (Inventario.tsx).
    if (query.category) qb.andWhere('i.category ILIKE :category', { category: query.category });
    if (query.storage_location) qb.andWhere('i.storage_location = :storageLocation', { storageLocation: query.storage_location });
    if (query.search)   qb.andWhere('i.name ILIKE :search',     { search: `%${query.search}%` });

    qb.orderBy('i.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  /**
   * Count per status + sum of asset value, over the whole tenant
   * (not the current page) — Task H: GET /inventory/stats.
   *
   * Does not reuse groupCount() (common/stats/group-count.util.ts): its
   * `valueColumn` parameter assumes a single column (`${alias}.${valueColumn}`), but the
   * item's asset value is `quantity * unit_price` — a product of
   * two columns. Replicates the same aggregation here, with the correct SQL
   * expression. Keeps the business rule that existed in the client (see
   * pre-migration Inventory.tsx): a 0/null quantity counts as 1 in the
   * value computation (COALESCE(NULLIF(quantity,0), 1)).
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const rows = await this.repository
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL')
      .select('i.status', 'grp')
      .addSelect('COUNT(*)::int', 'cnt')
      .addSelect(
        'COALESCE(SUM(COALESCE(NULLIF(i.quantity, 0), 1) * COALESCE(i.unit_price::numeric, 0)), 0)',
        'sum',
      )
      .groupBy('i.status')
      .getRawMany<{ grp: string | null; cnt: string; sum?: string }>();

    const byGroup: Record<string, number> = {};
    const sumByGroup: Record<string, number> = {};
    let total = 0;
    let totalSum = 0;
    for (const r of rows) {
      const key = r.grp ?? '—';
      const cnt = parseInt(r.cnt, 10) || 0;
      byGroup[key] = cnt;
      total += cnt;
      const sum = parseFloat(r.sum ?? '0') || 0;
      sumByGroup[key] = sum;
      totalSum += sum;
    }
    return { total, byGroup, sumByGroup, totalSum };
  }

  async findById(tenantId: string, id: string): Promise<InventoryItemEntity> {
    const item = await this.repository.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as any });
    if (!item) throw new NotFoundException('Item de inventário não encontrado');
    return item;
  }

  /** Deprecated field names and status slugs -> canonical (CZ-032). */
  private canonicalPayload<T extends object>(input: T): T {
    const dto = applyDeprecatedFieldAliases(input, INVENTORY_DEPRECATED_FIELDS) as T & { status?: string };
    if (dto.status !== undefined) dto.status = canonicalInventoryStatus(dto.status);
    return dto;
  }

  async create(tenantId: string, userId: string, input: CreateInventoryItemDto): Promise<InventoryItemEntity> {
    const dto = this.canonicalPayload(input);
    const item = this.repository.create({ tenant_id: tenantId, ...dto, created_by: userId, updated_by: userId } as any);
    return this.repository.save(item as any) as any;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemEntity> {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = this.canonicalPayload(dto) as UpdateInventoryItemDto & { expectedUpdatedAt?: string };
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as any,
      { ...rest, updated_at: new Date(), updated_by: userId } as any,
      expectedUpdatedAt,
      'Este item de inventário foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repository.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
