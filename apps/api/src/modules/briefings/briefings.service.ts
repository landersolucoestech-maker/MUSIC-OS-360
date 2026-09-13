import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { BriefingEntity } from '../../database/entities';
import type { CreateBriefingDto, UpdateBriefingDto, QueryBriefingDto } from './dto/briefings.dto';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class BriefingsService {
  private readonly repo: Repository<BriefingEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(BriefingEntity);
  }

  async list(tenantId: string, query: QueryBriefingDto) {
    const qb = this.repo!
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.deleted_at IS NULL');

    if ((query as any).status)     qb.andWhere('b.status = :status',       { status:     (query as any).status });
    if ((query as any).artist_id) qb.andWhere('b.artist_id = :artistId', { artistId: (query as any).artist_id });
    if ((query as any).search)     qb.andWhere('b.title ILIKE :search',   { search: `%${(query as any).search}%` });

    qb.orderBy('b.created_at', (query as any).ascending ? 'ASC' : 'DESC')
      .skip((query as any).offset ?? 0)
      .take((query as any).limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: (query as any).offset ?? 0, limit: (query as any).limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<BriefingEntity> {
    const result = await this.repo!
      .createQueryBuilder('b')
      .where('b.id = :id AND b.tenant_id = :tenantId AND b.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Briefing não encontrado');
    return result;
  }

  // O DTO usa nomes em inglês (title/content/campaignId/dueAt) mas as colunas
  // físicas da entidade são em português (title/descricao/campaign_id/prazo)
  // — sem este mapeamento explícito, um spread bruto do DTO nunca populava as
  // colunas reais (TypeORM só persiste propriedades decoradas com @Column).
  private toEntityFields(dto: CreateBriefingDto | UpdateBriefingDto): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (dto.title !== undefined) out.title = dto.title;
    if (dto.content !== undefined) out.descricao = dto.content;
    if (dto.campaignId !== undefined) out.campaign_id = dto.campaignId;
    if (dto.dueAt !== undefined) out.prazo = dto.dueAt;
    if (dto.metadata !== undefined) out.metadata = dto.metadata;
    if ('status' in dto && dto.status !== undefined) out.status = dto.status;
    return out;
  }

  async create(tenantId: string, userId: string, dto: CreateBriefingDto): Promise<BriefingEntity> {
    const mapped = this.toEntityFields(dto);
    // find-50dd3726: campaign_id had no cross-tenant ownership check — a
    // briefing could silently reference another tenant's campaign.
    await assertSameTenantFk(this.ds!, 'campaigns', mapped.campaign_id as string | undefined, tenantId, 'Campanha');
    const entity = this.repo!.create({ tenant_id: tenantId, ...mapped, created_by: userId });
    return this.repo!.save(entity as any) as any;
  }

  async update(tenantId: string, id: string, dto: UpdateBriefingDto): Promise<BriefingEntity> {
    await this.findById(tenantId, id);
    const mapped = this.toEntityFields(dto);
    // find-50dd3726: only validate when the patch actually sets campaign_id —
    // omitted means "unchanged", already validated at its own create time.
    if (mapped.campaign_id !== undefined) {
      await assertSameTenantFk(this.ds!, 'campaigns', mapped.campaign_id as string | undefined, tenantId, 'Campanha');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { ...mapped, updated_at: new Date() } as any);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
