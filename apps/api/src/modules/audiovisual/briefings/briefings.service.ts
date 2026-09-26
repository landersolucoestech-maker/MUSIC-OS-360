import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualBriefingEntity, AudiovisualProjectEntity } from '../../../database/entities';
import type { UpsertBriefingDto } from '../dto/audiovisual.dto';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

@Injectable()
export class AudiovisualBriefingsService {
  private readonly repo: Repository<AudiovisualBriefingEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualBriefingEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualBriefingEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async getByProject(tenantId: string, projectId: string) {
    await this.assertProject(tenantId, projectId);
    return this.r.findOne({ where: { tenant_id: tenantId, audiovisual_project_id: projectId } as never });
  }

  async upsert(tenantId: string, userId: string, projectId: string, dto: UpsertBriefingDto) {
    await this.assertProject(tenantId, projectId);
    const existing = await this.r.findOne({ where: { tenant_id: tenantId, audiovisual_project_id: projectId } as never });
    if (existing) {
      const { expectedUpdatedAt, ...rest } = dto as UpsertBriefingDto & { expectedUpdatedAt?: string };
      await casUpdate(
        this.r,
        { id: existing.id, tenant_id: tenantId } as never,
        { ...rest, updated_by: userId, updated_at: new Date() } as never,
        expectedUpdatedAt,
        'Este briefing foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
      );
      return this.r.findOne({ where: { id: existing.id, tenant_id: tenantId } as never });
    }
    const entity = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      ...dto,
      references_list:    dto.references_list  ?? [],
      platforms:          dto.platforms        ?? [],
      aspect_ratios:      dto.aspect_ratios    ?? [],
      color_palette:      dto.color_palette    ?? [],
      moodboard_links:    dto.moodboard_links  ?? [],
      metadata:           dto.metadata         ?? {},
      created_by: userId,
      updated_by: userId,
    } as Partial<AudiovisualBriefingEntity>);
    return this.r.save(entity as AudiovisualBriefingEntity);
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto audiovisual não encontrado');
  }
}
