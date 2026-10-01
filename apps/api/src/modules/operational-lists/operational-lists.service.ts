import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { OperationalListItemEntity } from '../../database/entities';
import { OPERATIONAL_LIST_DEFAULTS } from './operational-lists.defaults';
import { canonicalOperationalKind, operationalKindAliases, operationalStableKey } from './operational-list-vocabulary';
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
   * Idempotent bootstrap: a tenant with NO items at all (a new tenant, created
   * after migration 20260713000001) receives the default items on the first
   * read. `orIgnore()` does ON CONFLICT DO NOTHING — safe even under a
   * race between two simultaneous requests.
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
          origin: 'platform',
          stable_key: operationalStableKey(item.kind, item.slug),
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

    // A canonical kind also matches the legacy kind of rows not yet backfilled (compat window, AP3).
    if (query.kind !== undefined) {
      const kinds = operationalKindAliases(query.kind);
      if (kinds.length === 1) qb.andWhere('i.kind = :kind', { kind: kinds[0] });
      else qb.andWhere('i.kind IN (:...kinds)', { kinds });
    }
    if (query.active !== undefined) qb.andWhere('i.active = :active', { active: query.active });
    // A platform default renamed to its canonical English slug keeps the old slug
    // in legacy_slug: lookups by slug resolve either (compat window, OL1).
    if (query.slug !== undefined) qb.andWhere('(i.slug = :slug OR i.legacy_slug = :slug)', { slug: query.slug });

    qb.orderBy('i.kind', 'ASC').addOrderBy('i.order', 'ASC').addOrderBy('i.name', 'ASC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 200);

    const [rows, total] = await qb.getManyAndCount();
    const data = rows.map((row) => this.canonicalKind(row));
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 200 } };
  }

  async findById(tenantId: string, id: string): Promise<OperationalListItemEntity> {
    const result = await this.repo!
      .createQueryBuilder('i')
      .where('i.id = :id AND i.tenant_id = :tenantId AND i.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Item de lista operacional não encontrado');
    return this.canonicalKind(result);
  }

  /** Responses are canonical only: a row still holding a legacy kind is returned under the canonical kind. */
  private canonicalKind(row: OperationalListItemEntity): OperationalListItemEntity {
    const kind = canonicalOperationalKind(row.kind);
    return kind === row.kind ? row : Object.assign(row, { kind });
  }

  /** Live item of a list by slug OR legacy slug (the alias of a renamed platform default). The
   * unique indexes and the create/update clash checks keep at most one live row per value. */
  async findBySlug(tenantId: string, kind: string, slug: string): Promise<OperationalListItemEntity | null> {
    const kinds = operationalKindAliases(kind);
    const base = this.repo!.createQueryBuilder('i');
    const scoped = kinds.length === 1
      ? base.where('i.tenant_id = :tenantId AND i.kind = :kind AND i.deleted_at IS NULL', { tenantId, kind: kinds[0] })
      : base.where('i.tenant_id = :tenantId AND i.kind IN (:...kinds) AND i.deleted_at IS NULL', { tenantId, kinds });
    return scoped
      .andWhere('(i.slug = :slug OR i.legacy_slug = :slug)', { slug })
      .getOne()
      .then((row) => (row ? this.canonicalKind(row) : null));
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateOperationalListItemDto,
  ): Promise<OperationalListItemEntity> {
    const existing = await this.findBySlug(tenantId, dto.kind, dto.slug);
    if (existing) throw new ConflictException(`Já existe um item com o identificador "${dto.slug}" nesta lista.`);

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
      origin: 'tenant',
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
    const current = await this.findById(tenantId, id);
    const nextSlug = dto.slug ?? current.slug;
    const nextKind = dto.kind ?? current.kind;
    if (dto.slug !== undefined || dto.kind !== undefined) {
      const clash = await this.findBySlug(tenantId, nextKind, nextSlug);
      if (clash && clash.id !== id) {
        throw new ConflictException(`Já existe um item com o identificador "${nextSlug}" nesta lista.`);
      }
    }
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
