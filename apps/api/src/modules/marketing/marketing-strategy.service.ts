import { Injectable, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository, type ObjectLiteral } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import {
  MarketingStrategyActionEntity,
  MarketingStrategyEntity,
  MarketingStrategyInitiativeEntity,
  MarketingStrategyObjectiveEntity,
  MarketingTaskEntity,
} from '../../database/entities';
import { DOMAIN_EVENTS, EventsService } from '../../core/events/events.service';
import type {
  CreateMarketingActionDto,
  CreateMarketingInitiativeDto,
  CreateMarketingObjectiveDto,
  CreateMarketingStrategyDto,
  MarketingPlanNodeDto,
} from './dto/marketing-strategy.dto';

@Injectable()
export class MarketingStrategyService {
  private readonly strategies: Repository<MarketingStrategyEntity> | null;
  private readonly objectives: Repository<MarketingStrategyObjectiveEntity> | null;
  private readonly initiatives: Repository<MarketingStrategyInitiativeEntity> | null;
  private readonly actions: Repository<MarketingStrategyActionEntity> | null;
  private readonly tasks: Repository<MarketingTaskEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    this.strategies = ds?.getRepository(MarketingStrategyEntity) ?? null;
    this.objectives = ds?.getRepository(MarketingStrategyObjectiveEntity) ?? null;
    this.initiatives = ds?.getRepository(MarketingStrategyInitiativeEntity) ?? null;
    this.actions = ds?.getRepository(MarketingStrategyActionEntity) ?? null;
    this.tasks = ds?.getRepository(MarketingTaskEntity) ?? null;
  }

  private ensure<T extends ObjectLiteral>(repo: Repository<T> | null): Repository<T> {
    if (!repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return repo;
  }

  async getPlan(tenantId: string, marketingProjectId: string) {
    const [strategies, objectives, initiatives, actions] = await Promise.all([
      this.ensure(this.strategies).find({ where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, deleted_at: null } as never }),
      this.ensure(this.objectives).find({ where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, deleted_at: null } as never }),
      this.ensure(this.initiatives).find({ where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, deleted_at: null } as never }),
      this.ensure(this.actions).find({ where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, deleted_at: null } as never }),
    ]);
    return { strategies, objectives, initiatives, actions };
  }

  async createStrategy(tenantId: string, userId: string, dto: CreateMarketingStrategyDto) {
    const repo = this.ensure(this.strategies);
    return repo.save(repo.create({
      ...this.baseFields(tenantId, userId, dto),
      marketing_project_id: dto.marketingProjectId,
    } as Partial<MarketingStrategyEntity>));
  }

  async createObjective(tenantId: string, userId: string, dto: CreateMarketingObjectiveDto) {
    const repo = this.ensure(this.objectives);
    return repo.save(repo.create({
      ...this.baseFields(tenantId, userId, dto),
      marketing_project_id: dto.marketingProjectId,
      strategy_id: dto.strategyId,
    } as Partial<MarketingStrategyObjectiveEntity>));
  }

  async createInitiative(tenantId: string, userId: string, dto: CreateMarketingInitiativeDto) {
    const repo = this.ensure(this.initiatives);
    return repo.save(repo.create({
      ...this.baseFields(tenantId, userId, dto),
      marketing_project_id: dto.marketingProjectId,
      objective_id: dto.objectiveId,
    } as Partial<MarketingStrategyInitiativeEntity>));
  }

  async createAction(tenantId: string, userId: string, dto: CreateMarketingActionDto) {
    const repo = this.ensure(this.actions);
    return repo.save(repo.create({
      ...this.baseFields(tenantId, userId, dto),
      marketing_project_id: dto.marketingProjectId,
      initiative_id: dto.initiativeId,
    } as Partial<MarketingStrategyActionEntity>));
  }

  async completePlanAndGenerateTasks(tenantId: string, userId: string, marketingProjectId: string) {
    const actionRepo = this.ensure(this.actions);
    const taskRepo = this.ensure(this.tasks);
    const actions = await actionRepo.find({
      where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, deleted_at: null } as never,
    });
    const generatedTaskIds: string[] = [];
    const skippedActionIds: string[] = [];

    for (const action of actions) {
      const taskKey = `strategy_action:${action.id}`;
      const existing = await taskRepo.findOne({
        where: { tenant_id: tenantId, marketing_project_id: marketingProjectId, task_key: taskKey } as never,
      });
      if (existing) {
        skippedActionIds.push(action.id);
        continue;
      }

      const task = await taskRepo.save(taskRepo.create({
        tenant_id: tenantId,
        marketing_project_id: marketingProjectId,
        task_key: taskKey,
        title: action.title,
        description: action.description,
        status: 'pending',
        priority: action.priority,
        kind: 'strategy_action',
        assigned_to: action.responsible_id,
        due_date: action.due_date,
        dependencies: action.dependencies ?? [],
        metrics: action.metrics ?? {},
        metadata: {
          ...(action.metadata ?? {}),
          sourceActionId: action.id,
          sourceInitiativeId: action.initiative_id,
          generatedFrom: 'MARKETING_PLAN_COMPLETED',
        },
        created_by: userId,
        updated_by: userId,
      } as Partial<MarketingTaskEntity>));
      generatedTaskIds.push(task.id);
    }

    const completedAt = new Date().toISOString();
    this.events.emitTyped(DOMAIN_EVENTS.MARKETING_PLAN_COMPLETED, {
      tenantId,
      userId,
      aggregateType: 'marketing_project',
      aggregateId: marketingProjectId,
      payload: {
        marketingProjectId,
        tenantId,
        completedBy: userId,
        completedAt,
      },
    });

    this.events.emitTyped(DOMAIN_EVENTS.MARKETING_TASKS_GENERATED, {
      tenantId,
      userId,
      aggregateType: 'marketing_project',
      aggregateId: marketingProjectId,
      payload: {
        marketingProjectId,
        tenantId,
        generatedTaskIds,
        skippedActionIds,
        generatedBy: userId,
        generatedAt: completedAt,
      },
    });

    return {
      marketingProjectId,
      generatedTaskIds,
      skippedActionIds,
      totalActions: actions.length,
    };
  }

  private baseFields(tenantId: string, userId: string, dto: MarketingPlanNodeDto) {
    return {
      tenant_id: tenantId,
      title: dto.title,
      description: dto.description ?? null,
      responsible_id: dto.responsibleId ?? null,
      priority: dto.priority ?? 'normal',
      due_date: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status ?? 'planned',
      dependencies: dto.dependencies ?? [],
      metrics: dto.metrics ?? {},
      metadata: dto.metadata ?? {},
      created_by: userId,
      updated_by: userId,
    };
  }
}
