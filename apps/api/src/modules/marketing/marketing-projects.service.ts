import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import {
  MarketingProjectEntity,
  MarketingTaskEntity,
  PhonogramEntity,
  UploadEntity,
  WorkEntity,
} from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { safeOrderBy } from '../../common/utils/safe-order-by';
import type {
  CoverArtTaskCreatedPayload,
  ProjectCompletedPayload,
} from '../../core/events/domain-events.types';
import type {
  CreateMarketingProjectDto,
  QueryMarketingProjectDto,
  UpdateMarketingProjectDto,
} from './dto/marketing-projects.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

@Injectable()
export class MarketingProjectsService {
  private readonly repo: Repository<MarketingProjectEntity> | null;
  private readonly taskRepo: Repository<MarketingTaskEntity> | null;
  private readonly workRepo: Repository<WorkEntity> | null;
  private readonly phonogramRepo: Repository<PhonogramEntity> | null;
  private readonly uploadRepo: Repository<UploadEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    this.repo = ds?.getRepository(MarketingProjectEntity) ?? null;
    this.taskRepo = ds?.getRepository(MarketingTaskEntity) ?? null;
    this.workRepo = ds?.getRepository(WorkEntity) ?? null;
    this.phonogramRepo = ds?.getRepository(PhonogramEntity) ?? null;
    this.uploadRepo = ds?.getRepository(UploadEntity) ?? null;
  }

  private get r(): Repository<MarketingProjectEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async list(tenantId: string, query: QueryMarketingProjectDto) {
    const qb = this.r.createQueryBuilder('mp')
      .where('mp.tenant_id = :tenantId', { tenantId })
      .andWhere('mp.deleted_at IS NULL');

    if (query.search) {
      qb.andWhere('(mp.title ILIKE :search OR mp.description ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.type) qb.andWhere('mp.type = :type', { type: query.type });
    if (query.status) qb.andWhere('mp.status = :status', { status: query.status });
    if (query.sourceProjectId) qb.andWhere('mp.source_project_id = :sourceProjectId', { sourceProjectId: query.sourceProjectId });
    if (query.artistId) qb.andWhere('mp.artist_id = :artistId', { artistId: query.artistId });
    if (query.campaignId) qb.andWhere('mp.campaign_id = :campaignId', { campaignId: query.campaignId });

    const orderBy = safeOrderBy(
      query.orderBy,
      ['created_at', 'updated_at', 'title', 'status', 'type', 'starts_at', 'ends_at'],
      'created_at',
    );
    qb.orderBy(`mp.${orderBy}`, query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<MarketingProjectEntity> {
    const entity = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!entity) throw new NotFoundException('Marketing Project not found');
    return entity;
  }

  async create(tenantId: string, userId: string, dto: CreateMarketingProjectDto): Promise<MarketingProjectEntity> {
    if (dto.sourceProjectId) {
      const existing = await this.findBySourceProject(tenantId, dto.sourceProjectId);
      if (existing) return existing;
    }

    const entity = this.r.create({
      tenant_id:         tenantId,
      type:              dto.type,
      title:             dto.title,
      description:       dto.description ?? null,
      status:            dto.status ?? 'draft',
      priority:          dto.priority ?? 'normal',
      source_project_id: dto.sourceProjectId ?? null,
      artist_id:         dto.artistId ?? null,
      company_id:        dto.companyId ?? null,
      label_id:          dto.labelId ?? null,
      publisher_id:      dto.publisherId ?? null,
      studio_id:         dto.studioId ?? null,
      event_id:          dto.eventId ?? null,
      campaign_id:       dto.campaignId ?? null,
      starts_at:         dto.startsAt ?? null,
      ends_at:           dto.endsAt ?? null,
      goals:             dto.goals ?? {},
      metrics:           dto.metrics ?? {},
      context:           dto.context ?? {},
      metadata:          dto.metadata ?? {},
      created_by:        userId,
      updated_by:        userId,
    } as Partial<MarketingProjectEntity>);

    const saved = await this.r.save(entity as MarketingProjectEntity);
    this.emitCreated(tenantId, userId, saved);
    return saved;
  }

  async createFromCompletedProject(payload: ProjectCompletedPayload): Promise<MarketingProjectEntity> {
    const project = await this.create(payload.tenantId, payload.completedBy, {
      type: 'MUSIC_PROJECT',
      title: payload.title,
      description: `Marketing strategy workspace for completed music project "${payload.title}".`,
      status: 'planning',
      priority: 'normal',
      sourceProjectId: payload.projectId,
      artistId: payload.artistId,
      context: {
        source: 'PROJECT_COMPLETED',
        completedProject: payload,
      },
      metadata: {
        automation: {
          sourceEvent: 'PROJECT_COMPLETED',
          sourceProjectId: payload.projectId,
          completedAt: payload.completedAt,
        },
      },
    });

    await this.refreshInitialContext(project, payload);
    await this.ensureCoverArtTask(project, payload);
    return this.findById(payload.tenantId, project.id);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateMarketingProjectDto): Promise<MarketingProjectEntity> {
    await this.findById(tenantId, id);
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      {
        ...this.toPatch(dto),
        updated_by: userId,
        updated_at: new Date(),
      } as never,
      dto.expectedUpdatedAt,
      'Este projeto de marketing foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, userId: string, id: string) {
    await this.findById(tenantId, id);
    await this.r.update(
      { id, tenant_id: tenantId } as never,
      { deleted_at: new Date(), updated_by: userId } as never,
    );
    return { deleted: true };
  }

  private async refreshInitialContext(
    marketingProject: MarketingProjectEntity,
    payload: ProjectCompletedPayload,
  ): Promise<void> {
    if (!this.workRepo || !this.phonogramRepo || !this.uploadRepo) return;

    const [works, phonograms, uploads] = await Promise.all([
      payload.artistId
        ? this.workRepo.find({
            where: { tenant_id: payload.tenantId, artist_id: payload.artistId, deleted_at: null } as never,
            take: 50,
          })
        : Promise.resolve([]),
      payload.artistId
        ? this.phonogramRepo.find({
            where: { tenant_id: payload.tenantId, artist_id: payload.artistId, deleted_at: null } as never,
            take: 50,
          })
        : Promise.resolve([]),
      this.uploadRepo.find({
        where: {
          tenant_id: payload.tenantId,
          entity: 'project',
          entity_id: payload.projectId,
          deleted_at: null,
        } as never,
        take: 50,
      }),
    ]);

    const context = {
      ...(marketingProject.context ?? {}),
      source: 'PROJECT_COMPLETED',
      completedProject: payload,
      linkedAssets: uploads.map((item) => ({
        id: item.id,
        fileId: item.file_id,
        originalName: item.original_name,
        mimeType: item.mime_type,
        category: item.category,
        status: item.status,
      })),
      linkedWorks: works.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        iswc: item.iswc,
        isrc: item.isrc,
      })),
      linkedPhonograms: phonograms.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        isrc: item.isrc,
        workId: item.work_id,
      })),
      refreshedAt: new Date().toISOString(),
    };

    await this.r.update(
      { id: marketingProject.id, tenant_id: payload.tenantId } as never,
      { context, updated_by: payload.completedBy, updated_at: new Date() } as never,
    );
  }

  private async ensureCoverArtTask(
    marketingProject: MarketingProjectEntity,
    payload: ProjectCompletedPayload,
  ): Promise<MarketingTaskEntity | null> {
    if (!this.taskRepo) return null;
    const taskKey = `cover_art:${payload.projectId}`;
    const existing = await this.taskRepo.findOne({
      where: {
        tenant_id: payload.tenantId,
        marketing_project_id: marketingProject.id,
        task_key: taskKey,
      } as never,
    });
    if (existing) return existing;

    const task = await this.taskRepo.save(this.taskRepo.create({
      tenant_id: payload.tenantId,
      marketing_project_id: marketingProject.id,
      task_key: taskKey,
      title: `Criar arte de capa - ${payload.title}`,
      description: 'Tarefa automatica gerada quando o projeto musical foi concluido. Preparar briefing, referencias, metadados e links internos para arte de capa.',
      status: 'pending',
      priority: 'high',
      kind: 'cover_art',
      dependencies: [],
      metrics: {},
      metadata: {
        event: 'COVER_ART_TASK_CREATED',
        sourceEvent: 'PROJECT_COMPLETED',
        sourceProjectId: payload.projectId,
        projectName: payload.title,
        artistId: payload.artistId,
        briefing: {
          projectName: payload.title,
          projectType: payload.type,
          artistId: payload.artistId,
          metadata: {
            completedAt: payload.completedAt,
          },
          references: [],
          observations: 'Gerado automaticamente pelo modulo Marketing. Nao cria Release.',
          internalLinks: {
            projectId: payload.projectId,
            marketingProjectId: marketingProject.id,
          },
        },
      },
      created_by: payload.completedBy,
      updated_by: payload.completedBy,
    } as Partial<MarketingTaskEntity>));

    this.emitCoverArtTaskCreated(payload.tenantId, payload.completedBy, marketingProject, task);
    return task;
  }

  private async findBySourceProject(tenantId: string, sourceProjectId: string): Promise<MarketingProjectEntity | null> {
    return this.r.findOne({
      where: {
        tenant_id: tenantId,
        source_project_id: sourceProjectId,
        deleted_at: null,
      } as never,
    });
  }

  private toPatch(dto: UpdateMarketingProjectDto): Partial<MarketingProjectEntity> {
    const patch: Partial<MarketingProjectEntity> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description ?? null;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.sourceProjectId !== undefined) patch.source_project_id = dto.sourceProjectId ?? null;
    if (dto.artistId !== undefined) patch.artist_id = dto.artistId ?? null;
    if (dto.companyId !== undefined) patch.company_id = dto.companyId ?? null;
    if (dto.labelId !== undefined) patch.label_id = dto.labelId ?? null;
    if (dto.publisherId !== undefined) patch.publisher_id = dto.publisherId ?? null;
    if (dto.studioId !== undefined) patch.studio_id = dto.studioId ?? null;
    if (dto.eventId !== undefined) patch.event_id = dto.eventId ?? null;
    if (dto.campaignId !== undefined) patch.campaign_id = dto.campaignId ?? null;
    if (dto.startsAt !== undefined) patch.starts_at = dto.startsAt ?? null;
    if (dto.endsAt !== undefined) patch.ends_at = dto.endsAt ?? null;
    if (dto.goals !== undefined) patch.goals = dto.goals;
    if (dto.metrics !== undefined) patch.metrics = dto.metrics;
    if (dto.context !== undefined) patch.context = dto.context;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;
    return patch;
  }

  private emitCreated(tenantId: string, userId: string, entity: MarketingProjectEntity): void {
    this.events.emitTyped(DOMAIN_EVENTS.MARKETING_PROJECT_CREATED, {
      tenantId,
      userId,
      aggregateType: 'marketing_project',
      aggregateId:   entity.id,
      payload: {
        marketingProjectId: entity.id,
        tenantId,
        type:              entity.type,
        title:             entity.title,
        sourceProjectId:   entity.source_project_id,
        artistId:          entity.artist_id,
        campaignId:        entity.campaign_id,
        createdBy:         userId,
        createdAt:         entity.created_at.toISOString(),
      },
    });
  }

  private emitCoverArtTaskCreated(
    tenantId: string,
    userId: string,
    marketingProject: MarketingProjectEntity,
    task: MarketingTaskEntity,
  ): void {
    const payload: CoverArtTaskCreatedPayload = {
      taskId: task.id,
      tenantId,
      marketingProjectId: marketingProject.id,
      sourceProjectId: marketingProject.source_project_id,
      title: task.title,
      createdBy: userId,
      createdAt: task.created_at.toISOString(),
    };
    this.events.emitTyped(DOMAIN_EVENTS.COVER_ART_TASK_CREATED, {
      tenantId,
      userId,
      aggregateType: 'marketing_task',
      aggregateId: task.id,
      payload,
    });
  }
}
