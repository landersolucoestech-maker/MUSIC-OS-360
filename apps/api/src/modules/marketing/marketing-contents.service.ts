import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { MarketingContentPostEntity } from '../../database/entities';
import { MarketingPublishingQueueService } from '../../queues/services/marketing-publishing-queue.service';
import type { CreateMarketingContentDto, QueryMarketingContentDto, UpdateMarketingContentDto } from './dto/marketing-contents.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { safeOrderBy } from '../../common/utils/safe-order-by';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';

@Injectable()
export class MarketingContentsService {
  private readonly repo: Repository<MarketingContentPostEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly publishingQueue: MarketingPublishingQueueService,
    private readonly events: EventsService,
  ) {
    this.repo = ds?.getRepository(MarketingContentPostEntity) ?? null;
  }

  private get r(): Repository<MarketingContentPostEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable');
    return this.repo;
  }

  async list(tenantId: string, query: QueryMarketingContentDto) {
    const qb = this.r.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (query.search) qb.andWhere('(c.title ILIKE :search OR c.copy ILIKE :search OR c.target_name ILIKE :search)', { search: `%${query.search}%` });
    if (query.channel) qb.andWhere('c.channel = :channel', { channel: query.channel });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.projectId) qb.andWhere('c.project_id = :projectId', { projectId: query.projectId });

    const orderBy = safeOrderBy(
      query.orderBy,
      ['created_at', 'updated_at', 'scheduled_for', 'title', 'status'],
      'scheduled_for',
    );

    qb.orderBy(`c.${orderBy}`, query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 100);

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map((row) => this.toDto(row)), meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string) {
    const row = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!row) throw new NotFoundException('Conteúdo não encontrado');
    return this.toDto(row);
  }

  async create(tenantId: string, userId: string, dto: CreateMarketingContentDto) {
    const scheduledFor = this.resolveScheduledFor(dto.publishDate, dto.publishTime);
    const row = await this.r.save(this.r.create({
      tenant_id: tenantId,
      title: dto.title,
      target_type: dto.targetType,
      target_name: dto.targetName,
      channel: dto.channel,
      content_type: dto.type,
      status: dto.status ?? 'agendado',
      publication_status: dto.status === 'rascunho' ? 'pending' : 'queued',
      publish_date: dto.publishDate,
      publish_time: dto.publishTime,
      scheduled_for: scheduledFor,
      copy: dto.copy,
      notes: dto.notes ?? null,
      owner: dto.owner ?? null,
      campaign_id: dto.campaignId ?? null,
      project_id: dto.releaseId ?? null,
      format: dto.format ?? null,
      files: this.normalizeFiles(dto.files),
      metadata: dto.metadata ?? {},
      created_by: userId,
      updated_by: userId,
    } as Partial<MarketingContentPostEntity>));

    await this.scheduleIfNeeded(row, userId);

    this.events.emitTyped(DOMAIN_EVENTS.MARKETING_CONTENT_CREATED, {
      tenantId,
      userId,
      aggregateType: 'marketing_content_post',
      aggregateId:   row.id,
      payload: {
        contentId: row.id,
        tenantId,
        title:     row.title,
        channel:   row.channel,
        createdBy: userId,
      },
    });

    return this.findById(tenantId, row.id);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateMarketingContentDto) {
    const current = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!current) throw new NotFoundException('Conteúdo não encontrado');

    const publishDate = dto.publishDate ?? current.publish_date;
    const publishTime = dto.publishTime ?? current.publish_time;
    const scheduledFor = this.resolveScheduledFor(publishDate, publishTime);
    const status = dto.status ?? current.status;
    const shouldRequeue = status === 'agendado' && (
      dto.publishDate !== undefined ||
      dto.publishTime !== undefined ||
      current.publication_status === 'failed' ||
      current.publication_status === 'pending'
    );

    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      {
        title: dto.title ?? current.title,
        target_type: dto.targetType ?? current.target_type,
        target_name: dto.targetName ?? current.target_name,
        channel: dto.channel ?? current.channel,
        content_type: dto.type ?? current.content_type,
        status,
        publication_status: shouldRequeue ? 'queued' : current.publication_status,
        publish_date: publishDate,
        publish_time: publishTime,
        scheduled_for: scheduledFor,
        copy: dto.copy ?? current.copy,
        notes: dto.notes !== undefined ? dto.notes : current.notes,
        owner: dto.owner !== undefined ? dto.owner : current.owner,
        campaign_id: dto.campaignId !== undefined ? dto.campaignId : current.campaign_id,
        project_id: dto.releaseId !== undefined ? dto.releaseId : current.project_id,
        format: dto.format !== undefined ? dto.format : current.format,
        files: dto.files !== undefined ? this.normalizeFiles(dto.files) : current.files,
        // Merge, never replace: metadata carries independent keys (e.g. the
        // creative-editor config) that a caller updating an unrelated field
        // must not silently wipe.
        metadata: dto.metadata !== undefined ? { ...current.metadata, ...dto.metadata } : current.metadata,
        publication_error: shouldRequeue ? null : current.publication_error,
        updated_by: userId,
      } as never,
      dto.expectedUpdatedAt,
      'Este conteúdo foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );

    const updated = await this.r.findOne({ where: { id, tenant_id: tenantId } as never });
    if (updated && shouldRequeue) await this.scheduleIfNeeded(updated, userId);
    return this.findById(tenantId, id);
  }

  async archive(tenantId: string, userId: string, id: string) {
    await this.r.update({ id, tenant_id: tenantId } as never, {
      status: 'cancelado',
      publication_status: 'cancelled',
      updated_by: userId,
      deleted_at: new Date(),
    } as never);
    return { deleted: true };
  }

  private async scheduleIfNeeded(row: MarketingContentPostEntity, userId: string) {
    if (row.status !== 'agendado') return;
    const jobId = await this.publishingQueue.enqueueContentPublish({
      tenantId: row.tenant_id,
      userId,
      contentId: row.id,
    }, row.scheduled_for);
    if (jobId) await this.r.update({ id: row.id, tenant_id: row.tenant_id } as never, { publish_job_id: jobId } as never);
  }

  private resolveScheduledFor(date: string, time: string): Date {
    const cleanTime = time?.trim();
    if (!date || !/^\d{2}:\d{2}$/.test(cleanTime)) throw new BadRequestException('Data e horário de publicação inválidos');
    const scheduledFor = new Date(`${date}T${cleanTime}:00`);
    if (Number.isNaN(scheduledFor.getTime())) throw new BadRequestException('Data e horário de publicação inválidos');
    return scheduledFor;
  }

  private normalizeFiles(files?: CreateMarketingContentDto['files']): Array<Record<string, unknown>> {
    return (files ?? []).map((file) => ({
      id: file.id,
      name: file.name,
      url: file.url,
      kind: file.kind ?? '',
    }));
  }

  private toDto(row: MarketingContentPostEntity) {
    return {
      id: row.id,
      title: row.title,
      targetType: row.target_type,
      targetName: row.target_name,
      channel: row.channel,
      type: row.content_type,
      status: row.status,
      publicationStatus: row.publication_status,
      publishDate: row.publish_date,
      publishTime: row.publish_time,
      scheduledFor: row.scheduled_for?.toISOString(),
      copy: row.copy,
      notes: row.notes ?? '',
      owner: row.owner ?? 'Marketing',
      campaignId: row.campaign_id ?? undefined,
      releaseId: row.project_id ?? undefined,
      projectId: row.project_id ?? undefined,
      format: row.format ?? undefined,
      files: row.files ?? [],
      metadata: row.metadata ?? {},
      publishedAt: row.published_at?.toISOString(),
      publicationError: row.publication_error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
