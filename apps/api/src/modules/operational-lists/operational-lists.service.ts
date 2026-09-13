import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { OperationalListItemEntity } from '../../database/entities';
import { OPERATIONAL_LIST_DEFAULTS } from './operational-lists.defaults';
import type {
  CreateOperationalListItemDto,
  UpdateOperationalListItemDto,
  QueryOperationalListItemDto,
} from './dto/operational-lists.dto';

@Injectable()
export class OperationalListsService {
  private readonly repo: Repository<OperationalListItemEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(OperationalListItemEntity);
  }

  /**
   * Bootstrap idempotente: um tenant sem NENHUM item (tenant novo, criado
   * após a migration 20260713000001) recebe os itens padrão na primeira
   * leitura. `orIgnore()` faz ON CONFLICT DO NOTHING — seguro mesmo sob
   * corrida de duas requisições simultâneas.
   */
  private async bootstrapIfEmpty(tenantId: string): Promise<void> {
    const count = await this.repo!.count({ where: { tenant_id: tenantId } });
    if (count > 0) return;

    await this.repo!
      .createQueryBuilder()
      .insert()
      .into(OperationalListItemEntity)
      .values(
        OPERATIONAL_LIST_DEFAULTS.map((item) => ({
          tenant_id: tenantId,
          kind: item.kind,
          name: item.name,
          slug: item.slug,
          description: item.description ?? null,
          active: item.active,
          order: item.order,
          group: item.group ?? null,
          metadata: item.metadata ?? {},
        })) as any,
      )
      .orIgnore()
      .execute();
  }

  async list(tenantId: string, query: QueryOperationalListItemDto) {
    await this.bootstrapIfEmpty(tenantId);

    const qb = this.repo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL');

    if (query.kind !== undefined) qb.andWhere('i.kind = :kind', { kind: query.kind });
    if (query.active !== undefined) qb.andWhere('i.active = :active', { active: query.active });

    qb.orderBy('i.kind', 'ASC').addOrderBy('i.order', 'ASC').addOrderBy('i.name', 'ASC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 200);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 200 } };
  }

  async findById(tenantId: string, id: string): Promise<OperationalListItemEntity> {
    const result = await this.repo!
      .createQueryBuilder('i')
      .where('i.id = :id AND i.tenant_id = :tenantId AND i.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Item de lista operacional não encontrado');
    return result;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateOperationalListItemDto,
  ): Promise<OperationalListItemEntity> {
    const existing = await this.repo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.kind = :kind AND i.slug = :slug AND i.deleted_at IS NULL', {
        tenantId,
        kind: dto.kind,
        slug: dto.slug,
      })
      .getOne();
    if (existing) throw new ConflictException(`Já existe um item "${dto.slug}" para o tipo "${dto.kind}"`);

    const entity = this.repo!.create({
      tenant_id: tenantId,
      kind: dto.kind,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      active: dto.active ?? true,
      order: dto.order ?? 0,
      group: dto.group ?? null,
      metadata: dto.metadata ?? {},
      created_by: userId,
      updated_by: userId,
    });
    return this.repo!.save(entity);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateOperationalListItemDto,
  ): Promise<OperationalListItemEntity> {
    await this.findById(tenantId, id);
    const updates: Record<string, unknown> = { updated_by: userId, updated_at: new Date() };
    for (const key of ['kind', 'name', 'slug', 'description', 'active', 'order', 'group', 'metadata'] as const) {
      if (dto[key] !== undefined) updates[key] = dto[key];
    }
    await this.repo!.update({ id, tenant_id: tenantId } as any, updates as any);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    await this.findById(tenantId, id);
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
