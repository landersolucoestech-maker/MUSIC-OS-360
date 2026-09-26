import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException, ConflictException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualShotEntity, AudiovisualProjectEntity } from '../../../database/entities';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateShotInput {
  scene_title?: string;
  description?: string;
  location?: string;
  actors?: unknown[];
  props?: unknown[];
  wardrobe?: unknown[];
  equipment?: unknown[];
  estimated_duration_sec?: number;
  notes?: string;
  ordering?: number;
}

export interface UpdateShotInput extends Partial<CreateShotInput> {
  shooting_status?: string;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
}

@Injectable()
export class AudiovisualShotsService {
  private readonly ds: DataSource | null;
  private readonly repo: Repository<AudiovisualShotEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.ds        = ds;
    this.repo     = ds?.getRepository(AudiovisualShotEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualShotEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async listByProject(tenantId: string, projectId: string) {
    await this.assertProject(tenantId, projectId);
    return this.r.createQueryBuilder('s')
      .where('s.tenant_id = :tenantId AND s.audiovisual_project_id = :pid AND s.deleted_at IS NULL', { tenantId, pid: projectId })
      .orderBy('s.ordering', 'ASC').getMany();
  }

  async create(tenantId: string, projectId: string, input: CreateShotInput) {
    await this.assertProject(tenantId, projectId);
    const max = input.ordering ?? await this.nextOrdering(tenantId, projectId);
    const e = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      ordering: max,
      scene_title:            input.scene_title ?? null,
      description:            input.description ?? null,
      location:               input.location ?? null,
      actors:                 input.actors    ?? [],
      props:                  input.props     ?? [],
      wardrobe:               input.wardrobe  ?? [],
      equipment:              input.equipment ?? [],
      estimated_duration_sec: input.estimated_duration_sec ?? null,
      notes:                  input.notes ?? null,
      shooting_status:        'pending',
      metadata:               {},
    } as Partial<AudiovisualShotEntity>);
    return this.r.save(e as AudiovisualShotEntity);
  }

  async update(tenantId: string, id: string, input: UpdateShotInput) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!cur) throw new NotFoundException('Shot não encontrado');
    const { expectedUpdatedAt, ...rest } = input;
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      { ...rest, updated_at: new Date() } as never,
      expectedUpdatedAt,
      'Este shot foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.r.findOne({ where: { id, tenant_id: tenantId } as never });
  }

  async remove(tenantId: string, id: string) {
    await this.r.update({ id, tenant_id: tenantId } as never, { deleted_at: new Date() } as never);
    return { deleted: true };
  }

  /**
   * Task M — concurrency audit: reorder() made N sequential updates
   * without a transaction (a failure midway left the ordering partially applied) and
   * without checking whether the id list still matched the current state (two
   * users reordering at the same time, or a shot created/removed between the
   * read and the submit, silently produced a corrupted ordering). Fixed
   * with a real transaction (all or nothing) + a "same set of ids" check
   * as a staleness guard — no new version column required.
   */
  async reorder(tenantId: string, projectId: string, ids: string[]) {
    await this.assertProject(tenantId, projectId);
    if (!this.ds) throw new ServiceUnavailableException('Database unavailable');
    // ids comes from the request body: materializes a validated local list
    // (strings only) before iterating, avoiding iteration over a
    // user-controlled object (CWE-915).
    const safeIds = (Array.isArray(ids) ? ids : []).filter(
      (id): id is string => typeof id === 'string',
    );
    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(AudiovisualShotEntity);
      const current = await repo.find({
        where: { tenant_id: tenantId, audiovisual_project_id: projectId, deleted_at: null } as never,
        select: ['id'] as never,
      });
      const currentIds = new Set(current.map((s) => s.id));
      const sameSet = currentIds.size === safeIds.length && safeIds.every((id) => currentIds.has(id));
      if (!sameSet) {
        throw new ConflictException(
          'A lista de shots foi alterada por outro usuário (adição/remoção) desde que você a carregou. Recarregue e tente novamente.',
        );
      }
      for (let i = 0; i < safeIds.length; i++) {
        await repo.update(
          { id: safeIds[i], tenant_id: tenantId, audiovisual_project_id: projectId } as never,
          { ordering: i, updated_at: new Date() } as never,
        );
      }
      return { reordered: safeIds.length };
    });
  }

  private async nextOrdering(tenantId: string, projectId: string): Promise<number> {
    const row = await this.r
      .createQueryBuilder('s')
      .select('MAX(s.ordering)', 'max')
      .where('s.tenant_id = :tenantId AND s.audiovisual_project_id = :pid', { tenantId, pid: projectId })
      .getRawOne<{ max: number | null }>();
    return (row?.max ?? -1) + 1;
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Database unavailable');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto não encontrado');
  }
}
