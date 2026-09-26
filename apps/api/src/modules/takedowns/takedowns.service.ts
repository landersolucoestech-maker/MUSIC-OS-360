import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { TakedownEntity } from '../../database/entities';
import { groupCount, type GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateTakedownDto, UpdateTakedownDto, QueryTakedownDto } from './dto/takedowns.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class TakedownsService {
  private readonly repo: Repository<TakedownEntity> | null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo = ds?.getRepository(TakedownEntity) ?? null;
    this.ds = ds;
  }

  private get repository(): Repository<TakedownEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string, query: QueryTakedownDto) {
    const qb = this.repository
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.plataforma) qb.andWhere('t.plataforma = :plataforma', { plataforma: query.plataforma });
    if (query.artist_id) qb.andWhere('t.artist_id = :artistId', { artistId: query.artist_id });
    if (query.search) {
      qb.andWhere(
        '(t.title ILIKE :search OR t.obra_afetada ILIKE :search OR t.artista ILIKE :search OR t.motivo ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('t.created_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  /**
   * Count per status, over the whole tenant (not the current page) —
   * Task H: exact KPIs without downloading the whole table. The bucket mapping
   * (`pendente`/`em_andamento`/`concluído`) remains in the frontend (Takedowns.tsx),
   * which now iterates over this small {status: count} map instead of the full
   * takedown list.
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const qb = this.repository
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');
    return groupCount(qb, 't', 'status');
  }

  async findById(tenantId: string, id: string): Promise<TakedownEntity> {
    const result = await this.repository
      .createQueryBuilder('t')
      .where('t.id = :id AND t.tenant_id = :tenantId AND t.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Takedown não encontrado');
    return result;
  }

  async create(tenantId: string, userId: string, dto: CreateTakedownDto): Promise<TakedownEntity> {
    await assertSameTenantFk(this.ds!, 'works',   dto.work_id,    tenantId, 'Obra');
    await assertSameTenantFk(this.ds!, 'artists', dto.artist_id, tenantId, 'Artista');

    const entity = this.repository.create({
      tenant_id: tenantId,
      ...dto,
      url: dto.url_infracao ?? null,
      created_by: userId,
    } as Partial<TakedownEntity>);
    return this.repository.save(entity as TakedownEntity);
  }

  async update(tenantId: string, _userId: string, id: string, dto: UpdateTakedownDto): Promise<TakedownEntity> {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = dto as UpdateTakedownDto & { expectedUpdatedAt?: string };
    const updates: Record<string, unknown> = {
      ...rest,
      updated_at: new Date(),
    };
    if (dto.url_infracao !== undefined) updates['url'] = dto.url_infracao ?? null;

    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as never,
      updates as never,
      expectedUpdatedAt,
      'Este takedown foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, _userId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repository.update(
      { id, tenant_id: tenantId } as never,
      { deleted_at: new Date(), updated_at: new Date() } as never,
    );
    return { deleted: true };
  }
}
