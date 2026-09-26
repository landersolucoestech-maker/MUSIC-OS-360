import {
  Injectable, Inject, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualTaskEntity, AudiovisualProjectEntity } from '../../../database/entities';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  due_date?: string;
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  completed_at?: string | null;
  /** Optimistic concurrency (Task L) — see optimistic-update.util.ts. Optional. */
  expectedUpdatedAt?: string;
};

/**
 * Templates of tasks auto-generated per status transition.
 * Mapping: target_status → array of tasks to create.
 */
const AUTO_TASK_TEMPLATES: Record<string, Array<{ title: string; priority?: string; due_days_from_now?: number }>> = {
  briefing: [
    { title: 'Definir conceito criativo',                priority: 'high', due_days_from_now: 3 },
    { title: 'Aprovar referências visuais',              priority: 'medium', due_days_from_now: 5 },
    { title: 'Alinhar com manager do artista',           priority: 'medium', due_days_from_now: 5 },
  ],
  pre_production: [
    { title: 'Fechar locações',                          priority: 'high', due_days_from_now: 7 },
    { title: 'Confirmar equipe (direção/câmera/etc.)',   priority: 'high', due_days_from_now: 7 },
    { title: 'Fechar shotlist',                          priority: 'medium', due_days_from_now: 10 },
    { title: 'Alugar/preparar equipamentos',             priority: 'medium', due_days_from_now: 12 },
  ],
  production: [
    { title: 'Confirmar call sheet do dia',              priority: 'urgent' },
    { title: 'Backup de mídias durante a gravação',      priority: 'urgent' },
  ],
  post_production: [
    { title: 'Editar corte 1',                           priority: 'high', due_days_from_now: 10 },
    { title: 'Color grading',                            priority: 'medium', due_days_from_now: 14 },
    { title: 'Sound design / mixagem',                   priority: 'medium', due_days_from_now: 14 },
    { title: 'Preparar entregáveis padrão',              priority: 'medium', due_days_from_now: 17 },
  ],
  approval: [
    { title: 'Enviar cuts para aprovação do artista',    priority: 'urgent', due_days_from_now: 2 },
    { title: 'Coletar feedback e abrir revisões',        priority: 'high',   due_days_from_now: 5 },
  ],
  delivered: [
    { title: 'Subir master no YouTube (privado)',        priority: 'high', due_days_from_now: 1 },
    { title: 'Distribuir cortes para social',            priority: 'medium', due_days_from_now: 2 },
  ],
  published: [
    { title: 'Anunciar publicação para campanha',        priority: 'high' },
    { title: 'Coletar métricas D+7',                     priority: 'low', due_days_from_now: 7 },
  ],
};

@Injectable()
export class AudiovisualTasksService {
  private readonly repo: Repository<AudiovisualTaskEntity> | null;
  private readonly projects: Repository<AudiovisualProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.repo     = ds?.getRepository(AudiovisualTaskEntity) ?? null;
    this.projects = ds?.getRepository(AudiovisualProjectEntity) ?? null;
  }

  private get r(): Repository<AudiovisualTaskEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async listByProject(tenantId: string, projectId: string) {
    await this.assertProject(tenantId, projectId);
    return this.r.find({
      where: { tenant_id: tenantId, audiovisual_project_id: projectId, deleted_at: null } as never,
      order: { created_at: 'ASC' as never },
    });
  }

  async create(tenantId: string, userId: string, projectId: string, input: CreateTaskInput) {
    await this.assertProject(tenantId, projectId);
    const entity = this.r.create({
      tenant_id: tenantId,
      audiovisual_project_id: projectId,
      title:       input.title,
      description: input.description ?? null,
      status:      input.status ?? 'pending',
      priority:    input.priority ?? 'medium',
      assigned_to: input.assigned_to ?? null,
      due_date:    input.due_date ? new Date(input.due_date) : null,
      auto_generated: false,
      metadata: {},
      created_by: userId,
      updated_by: userId,
    } as Partial<AudiovisualTaskEntity>);
    return this.r.save(entity as AudiovisualTaskEntity);
  }

  async update(tenantId: string, userId: string, id: string, input: UpdateTaskInput) {
    const cur = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!cur) throw new NotFoundException('Tarefa não encontrada');
    const { expectedUpdatedAt, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest, updated_by: userId, updated_at: new Date() };
    if (input.due_date)      patch.due_date = new Date(input.due_date);
    if (input.completed_at)  patch.completed_at = new Date(input.completed_at);
    if (input.status === 'done' && !cur.completed_at) patch.completed_at = new Date();
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      expectedUpdatedAt,
      'Esta tarefa foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.r.findOne({ where: { id, tenant_id: tenantId } as never });
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.r.update(
      { id, tenant_id: tenantId } as never,
      { deleted_at: new Date(), updated_by: userId } as never,
    );
    return { deleted: true };
  }

  /**
   * Generates automatic tasks for the target status. Used by ProjectsService
   * inside the transition. Does not create duplicates: if a task with the same
   * `auto_stage` + `title` already exists for the project, it is skipped.
   */
  async generateForStage(tenantId: string, userId: string, projectId: string, stage: string) {
    const tpl = AUTO_TASK_TEMPLATES[stage];
    if (!tpl || tpl.length === 0) return [];
    if (!this.repo) return [];

    const existing = await this.r.find({
      where: { tenant_id: tenantId, audiovisual_project_id: projectId, auto_stage: stage, deleted_at: null } as never,
    });
    const existingTitles = new Set(existing.map((t) => t.title));

    const created: AudiovisualTaskEntity[] = [];
    for (const t of tpl) {
      if (existingTitles.has(t.title)) continue;
      const dueDate = t.due_days_from_now != null
        ? new Date(Date.now() + t.due_days_from_now * 24 * 60 * 60 * 1000)
        : null;
      const entity = this.r.create({
        tenant_id: tenantId,
        audiovisual_project_id: projectId,
        title:       t.title,
        priority:    t.priority ?? 'medium',
        status:      'pending',
        due_date:    dueDate,
        auto_generated: true,
        auto_stage:  stage,
        metadata: { source: 'auto_status_transition' },
        created_by: userId,
        updated_by: userId,
      } as Partial<AudiovisualTaskEntity>);
      const saved = await this.r.save(entity as AudiovisualTaskEntity);
      created.push(saved);
    }
    return created;
  }

  private async assertProject(tenantId: string, projectId: string) {
    if (!this.projects) throw new ServiceUnavailableException('Database unavailable');
    const p = await this.projects.findOne({ where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto não encontrado');
  }
}
