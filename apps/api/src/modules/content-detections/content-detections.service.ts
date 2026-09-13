import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ContentDetectionEntity } from '../../database/entities';
import type { CreateContentDetectionDto } from './dto/create-content-detection.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class ContentDetectionsService {
  private readonly repo: Repository<ContentDetectionEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(ContentDetectionEntity);
  }

  async list(tenantId: string, query: any) {
    const qb = this.repo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (query.status)     qb.andWhere('c.status = :status',       { status:     query.status });
    if (query.plataforma) qb.andWhere('c.plataforma = :plataforma', { plataforma: query.plataforma });
    if (query.artist_id) qb.andWhere('c.artist_id = :artistId', { artistId: query.artist_id });
    if (query.work_id)    qb.andWhere('c.work_id = :workId',      { workId:     query.work_id });

    qb.orderBy('c.detectado_em', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<ContentDetectionEntity> {
    const result = await this.repo!
      .createQueryBuilder('c')
      .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Detecção não encontrada');
    return result;
  }

  async create(tenantId: string, dto: CreateContentDetectionDto): Promise<ContentDetectionEntity> {
    // find-20d3d9bd: work_id/artist_id had no cross-tenant ownership check —
    // a content detection could silently reference another tenant's work/artist.
    await assertSameTenantFk(this.ds!, 'works', dto.work_id, tenantId, 'Obra');
    await assertSameTenantFk(this.ds!, 'artists', dto.artist_id, tenantId, 'Artista');
    const entity = this.repo!.create({ tenant_id: tenantId, ...(dto as any) });
    return this.repo!.save(entity as any) as any;
  }

  async update(tenantId: string, id: string, dto: any): Promise<ContentDetectionEntity> {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = dto ?? {};
    // find-20d3d9bd: only validate when the patch actually sets work_id/artist_id
    // — omitted means "unchanged", already validated at its own create time.
    if (rest.work_id !== undefined) await assertSameTenantFk(this.ds!, 'works', rest.work_id, tenantId, 'Obra');
    if (rest.artist_id !== undefined) await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      { ...rest, updated_at: new Date() } as any,
      expectedUpdatedAt,
      'Esta detecção foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<ContentDetectionEntity> {
    return this.update(tenantId, id, { status });
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
