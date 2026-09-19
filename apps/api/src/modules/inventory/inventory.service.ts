import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { InventoryItemEntity } from '../../database/entities';
import type { GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateInventoryItemDto, UpdateInventoryItemDto, QueryInventoryDto } from './dto/inventory.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

@Injectable()
export class InventoryService {
  private readonly repo: Repository<InventoryItemEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo = ds?.getRepository(InventoryItemEntity) ?? null;
  }

  private get repository(): Repository<InventoryItemEntity> {
    if (!this.repo) {
      throw new ServiceUnavailableException('Database unavailable for inventory');
    }
    return this.repo;
  }

  async list(tenantId: string, query: QueryInventoryDto) {
    const qb = this.repository.createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL');

    if (query.status)   qb.andWhere('i.status = :status',       { status: query.status });
    // ILIKE sem wildcard = igualdade case-insensitive — preserva o filtro
    // de category case-insensitive que existia no client (Inventario.tsx).
    if (query.category) qb.andWhere('i.category ILIKE :category', { category: query.category });
    if (query.localizacao) qb.andWhere('i.localizacao = :localizacao', { localizacao: query.localizacao });
    if (query.search)   qb.andWhere('i.nome ILIKE :search',     { search: `%${query.search}%` });

    qb.orderBy('i.created_at', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  /**
   * Contagem por status + soma de valor patrimonial, sobre o tenant inteiro
   * (não a página atual) — Task H: GET /inventory/stats.
   *
   * Não reusa groupCount() (common/stats/group-count.util.ts): seu parâmetro
   * `valueColumn` assume uma única coluna (`${alias}.${valueColumn}`), mas o
   * valor patrimonial do item é `quantidade * valor_unitario` — um produto de
   * duas colunas. Replica aqui a mesma agregação, com a expressão SQL
   * correta. Mantém a regra de negócio existente no client (ver
   * Inventario.tsx pré-migração): quantidade 0/nula conta como 1 no cálculo
   * do valor (COALESCE(NULLIF(quantidade,0), 1)).
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const rows = await this.repository
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL')
      .select('i.status', 'grp')
      .addSelect('COUNT(*)::int', 'cnt')
      .addSelect(
        'COALESCE(SUM(COALESCE(NULLIF(i.quantidade, 0), 1) * COALESCE(i.valor_unitario::numeric, 0)), 0)',
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

  async create(tenantId: string, userId: string, dto: CreateInventoryItemDto): Promise<InventoryItemEntity> {
    const item = this.repository.create({ tenant_id: tenantId, ...dto, created_by: userId, updated_by: userId } as any);
    return this.repository.save(item as any) as any;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemEntity> {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = dto as UpdateInventoryItemDto & { expectedUpdatedAt?: string };
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
