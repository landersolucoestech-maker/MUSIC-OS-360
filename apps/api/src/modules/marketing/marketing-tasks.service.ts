import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DATA_SOURCE } from '../../database/database.tokens';
import { MarketingProjectEntity, MarketingTaskEntity } from '../../database/entities';
import type {
  CreateMarketingTaskDto,
  QueryMarketingTaskDto,
  UpdateMarketingTaskDto,
} from './dto/marketing-tasks.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

@Injectable()
export class MarketingTasksService {
  private readonly tasks: Repository<MarketingTaskEntity> | null;
  private readonly projects: Repository<MarketingProjectEntity> | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.tasks = ds?.getRepository(MarketingTaskEntity) ?? null;
    this.projects = ds?.getRepository(MarketingProjectEntity) ?? null;
  }

  private get repo(): Repository<MarketingTaskEntity> {
    if (!this.tasks || !this.projects) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
    return this.tasks;
  }

  async list(tenantId: string, query: QueryMarketingTaskDto) {
    const qb = this.repo.createQueryBuilder('task')
      .where('task.tenant_id = :tenantId', { tenantId })
      .andWhere('task.deleted_at IS NULL');
    if (query.search) {
      qb.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.marketingProjectId) {
      qb.andWhere('task.marketing_project_id = :marketingProjectId', {
        marketingProjectId: query.marketingProjectId,
      });
    }
    if (query.status) qb.andWhere('task.status = :status', { status: query.status });
    if (query.assignedTo) {
      qb.andWhere('task.assigned_to = :assignedTo', { assignedTo: query.assignedTo });
    }
    qb.orderBy('task.updated_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 100);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string) {
    const task = await this.repo.findOne({
      where: { id, tenant_id: tenantId, deleted_at: null } as never,
    });
    if (!task) throw new NotFoundException('Tarefa de marketing não encontrada.');
    return task;
  }

  async create(tenantId: string, userId: string, dto: CreateMarketingTaskDto) {
    await this.assertProject(tenantId, dto.marketingProjectId);
    const task = this.repo.create({
      tenant_id: tenantId,
      marketing_project_id: dto.marketingProjectId,
      task_key: `manual:${randomUUID()}`,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? 'pending',
      priority: dto.priority ?? 'normal',
      kind: dto.kind ?? null,
      assigned_to: dto.assignedTo ?? null,
      due_date: dto.dueDate ? new Date(dto.dueDate) : null,
      dependencies: dto.dependencies ?? [],
      metrics: dto.metrics ?? {},
      metadata: dto.metadata ?? {},
      created_by: userId,
      updated_by: userId,
    } as Partial<MarketingTaskEntity>);
    return this.repo.save(task as MarketingTaskEntity);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateMarketingTaskDto) {
    const current = await this.findById(tenantId, id);
    if (dto.marketingProjectId && dto.marketingProjectId !== current.marketing_project_id) {
      await this.assertProject(tenantId, dto.marketingProjectId);
    }
    await casUpdate(
      this.repo,
      { id, tenant_id: tenantId } as never,
      {
        marketing_project_id: dto.marketingProjectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        kind: dto.kind,
        assigned_to: dto.assignedTo,
        due_date: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        dependencies: dto.dependencies,
        metrics: dto.metrics,
        metadata: dto.metadata,
        completed_at: dto.status === 'completed' || dto.status === 'concluida'
          ? current.completed_at ?? new Date()
          : undefined,
        updated_by: userId,
        updated_at: new Date(),
      } as never,
      dto.expectedUpdatedAt,
      'Esta tarefa de marketing foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo.update({ id, tenant_id: tenantId } as never, {
      deleted_at: new Date(),
      updated_by: userId,
    } as never);
    return { deleted: true };
  }

  private async assertProject(tenantId: string, projectId: string): Promise<void> {
    void this.repo;
    const project = await this.projects!.findOne({
      where: { id: projectId, tenant_id: tenantId, deleted_at: null } as never,
    });
    if (!project) throw new NotFoundException('Projeto de marketing não encontrado.');
  }
}
