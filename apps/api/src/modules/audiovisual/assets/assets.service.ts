import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualAssetEntity, AudiovisualProjectEntity } from '../../../database/entities';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateAssetInput {
  name: string;
  kind?: string;
  file_url: string;
  thumbnail_url?: string;
  mime_type?: string;
  size_bytes?: number;
  description?: string;
  tags?: string[];
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
}

@Injectable()
export class AudiovisualAssetsService {
  private readonly repo: Repository<AudiovisualAssetEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualAssetEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualAssetEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async listByProject(tenantId: string, projectId: string, kind?: string) {
    await this.assertProject(tenantId, projectId);
    const qb = this.r.createQueryBuilder('a')
      .where('a.tenant_id = :tenantId AND a.audiovisual_project_id = :pid AND a.deleted_at IS NULL', { tenantId, pid: projectId });
    if (kind) qb.andWhere('a.kind = :k', { k: kind });
    qb.orderBy('a.created_at', 'DESC');
    return qb.getMany();
  }

  async create(tenantId: string, userId: string, projectId: string, input: CreateAssetInput) {
    await this.assertProject(tenantId, projectId);
    const entity = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      name:           input.name,
      kind:           input.kind ?? 'other',
      file_url:       input.file_url,
      thumbnail_url:  input.thumbnail_url ?? null,
      mime_type:      input.mime_type ?? null,
      size_bytes:     input.size_bytes != null ? String(input.size_bytes) : null,
      description:    input.description ?? null,
      tags:           input.tags ?? [],
      metadata:       {},
      uploaded_by:    userId,
    } as Partial<AudiovisualAssetEntity>);
    return this.r.save(entity as AudiovisualAssetEntity);
  }

  async update(tenantId: string, id: string, input: Partial<CreateAssetInput>) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!cur) throw new NotFoundException('Asset não encontrado');
    const { expectedUpdatedAt, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest, updated_at: new Date() };
    if (input.size_bytes != null) patch.size_bytes = String(input.size_bytes);
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      expectedUpdatedAt,
      'Este asset foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.r.findOne({ where: { id, tenant_id: tenantId } as never });
  }

  async remove(tenantId: string, id: string) {
    await this.r.update({ id, tenant_id: tenantId } as never, { deleted_at: new Date() } as never);
    return { deleted: true };
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Database unavailable');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto não encontrado');
  }
}
