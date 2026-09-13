import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ArtistGoalEntity } from '../../database/entities';
import type { CreateArtistGoalDto } from './dto/create-artist-goal.dto';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class ArtistGoalsService {
  private readonly repo: Repository<ArtistGoalEntity> | null = null;
  private readonly ds: DataSource | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(ArtistGoalEntity);
  }

  async list(tenantId: string, query: any) {
    const qb = this.repo!
      .createQueryBuilder('g')
      .where('g.tenant_id = :tenantId', { tenantId })
      .andWhere('g.deleted_at IS NULL');

    if (query.artist_id) qb.andWhere('g.artist_id = :artistId', { artistId: query.artist_id });
    if (query.status)     qb.andWhere('g.status = :status',        { status:    query.status });
    if (query.type)       qb.andWhere('g.type = :type',            { type:      query.type });

    qb.orderBy('g.created_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<ArtistGoalEntity> {
    const result = await this.repo!
      .createQueryBuilder('g')
      .where('g.id = :id AND g.tenant_id = :tenantId AND g.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Meta não encontrada');
    return result;
  }

  async create(tenantId: string, userId: string, dto: CreateArtistGoalDto): Promise<ArtistGoalEntity> {
    await assertSameTenantFk(this.ds!, 'artists', (dto as { artist_id?: string }).artist_id, tenantId, 'Artista');
    const entity = this.repo!.create({ tenant_id: tenantId, ...(dto as any), created_by: userId });
    return this.repo!.save(entity as any) as any;
  }

  async update(tenantId: string, id: string, dto: any): Promise<ArtistGoalEntity> {
    await this.findById(tenantId, id);
    if (dto.artist_id !== undefined) {
      await assertSameTenantFk(this.ds!, 'artists', dto.artist_id, tenantId, 'Artista');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { ...dto, updated_at: new Date() } as any);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
