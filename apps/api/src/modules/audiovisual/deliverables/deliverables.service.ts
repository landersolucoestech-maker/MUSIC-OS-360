import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualDeliverableEntity, AudiovisualProjectEntity } from '../../../database/entities';
import type {
  CreateDeliverableDto, UpdateDeliverableDto, QueryDeliverableDto,
} from '../dto/audiovisual.dto';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

@Injectable()
export class AudiovisualDeliverablesService {
  private readonly repo: Repository<AudiovisualDeliverableEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualDeliverableEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualDeliverableEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string, q: QueryDeliverableDto) {
    const qb = this.r.createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.deleted_at IS NULL');
    if (q.audiovisual_project_id) qb.andWhere('d.audiovisual_project_id = :pid', { pid: q.audiovisual_project_id });
    if (q.status) qb.andWhere('d.status = :st', { st: q.status });
    qb.orderBy('d.created_at', 'DESC').skip(q.offset ?? 0).take(q.limit ?? 100);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string) {
    const d = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!d) throw new NotFoundException('Entregável não encontrado');
    return d;
  }

  async create(tenantId: string, projectId: string, dto: CreateDeliverableDto) {
    await this.assertProject(tenantId, projectId);
    const entity = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      ...dto,
      metadata: dto.metadata ?? {},
    } as Partial<AudiovisualDeliverableEntity>);
    return this.r.save(entity as AudiovisualDeliverableEntity);
  }

  async update(tenantId: string, id: string, dto: UpdateDeliverableDto) {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = dto as UpdateDeliverableDto & { expectedUpdatedAt?: string };
    const patch: Record<string, unknown> = { ...rest, updated_at: new Date() };
    if (dto.published === true) patch.published_at = new Date();
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      expectedUpdatedAt,
      'Este entregável foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.r.update({ id, tenant_id: tenantId } as never, { deleted_at: new Date() } as never);
    return { deleted: true };
  }

  /**
   * Creates the default deliverables for the project type.
   * Only called when explicitly requested.
   */
  async seedDefaults(tenantId: string, projectId: string, projectType: string) {
    await this.assertProject(tenantId, projectId);
    const presets: Record<string, Array<Partial<CreateDeliverableDto>>> = {
      music_video: [
        { title: 'YouTube Master', type: 'youtube_master', format: 'mp4', resolution: '4K' },
        { title: 'Teaser 15s',     type: 'teaser',         format: 'mp4', duration_sec: 15 },
        { title: 'Reels Vertical', type: 'vertical_reels', format: 'mp4', resolution: '1080x1920' },
        { title: 'Thumbnail',      type: 'thumbnail',      format: 'jpg' },
        { title: 'Short Clip',     type: 'short_clip',     format: 'mp4', duration_sec: 60 },
      ],
      visualizer: [
        { title: 'YouTube Master', type: 'youtube_master', format: 'mp4' },
        { title: 'Thumbnail',      type: 'thumbnail',      format: 'jpg' },
      ],
      teaser: [
        { title: 'Teaser principal', type: 'teaser',         format: 'mp4', duration_sec: 15 },
        { title: 'Stories',          type: 'stories',        format: 'mp4', resolution: '1080x1920' },
      ],
    };
    const list = presets[projectType] ?? [{ title: 'Entregável principal', type: 'other' as const }];
    const out: AudiovisualDeliverableEntity[] = [];
    for (const p of list) {
      const e = await this.create(tenantId, projectId, p as CreateDeliverableDto);
      out.push(e);
    }
    return out;
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto audiovisual não encontrado');
  }
}
