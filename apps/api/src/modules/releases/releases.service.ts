import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ReleaseEntity, ArtistEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateReleaseDto, UpdateReleaseDto, QueryReleaseDto } from './dto/releases.dto';
import { ReleaseStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { canonicalizeReleaseInput } from './release-legacy-fields';

@Injectable()
export class ReleasesService {
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<ReleaseEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
    @Optional() private readonly activityLogs?: ActivityLogsService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(ReleaseEntity);
    }
  }

  private baseQb(tenantId: string, q: QueryReleaseDto) {
    const qb = this.repo!
      .createQueryBuilder('r')
      .leftJoinAndMapOne(
        'r.artistas',
        ArtistEntity,
        'artistas',
        'artistas.id = r.artist_id AND artistas.tenant_id = r.tenant_id AND artistas.deleted_at IS NULL',
      )
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.deleted_at IS NULL');

    if (q.status)      qb.andWhere('r.status = :status',               { status:      q.status });
    if (q.type)        qb.andWhere('r.type = :type',                   { type:        q.type });
    if (q.artistId)    qb.andWhere('r.artist_id = :artistId',        { artistId:   q.artistId });
    if (q.distributor) qb.andWhere('r.distributor = :distributor',   { distributor: q.distributor });
    if (q.search)      qb.andWhere('r.title ILIKE :search',           { search:      `%${q.search}%` });

    return qb;
  }

  async list(tenantId: string, q: QueryReleaseDto) {
    const qb = this.baseQb(tenantId, q);

    qb.orderBy('r.created_at', q.ascending ? 'ASC' : 'DESC')
      .skip(q.offset ?? 0)
      .take(q.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  /**
   * Exact distribution by `status` (+ whether the mandatory submission fields
   * are filled, the only other factor the display classification
   * depends on — see resolveStatusFromRawStatus() in the frontend). Whole tenant,
   * never only the loaded page.
   */
  async stats(tenantId: string, q: QueryReleaseDto): Promise<Array<{ status: string; has_required: boolean; cnt: number }>> {
    const qb = this.baseQb(tenantId, q);
    qb.select('r.status', 'status')
      .addSelect(
        `CASE WHEN r.title IS NOT NULL AND r.title <> '' AND r.artist_id IS NOT NULL
              AND r.music_genre IS NOT NULL AND r.music_genre <> '' AND r.type IS NOT NULL AND r.type <> ''
         THEN true ELSE false END`,
        'has_required',
      )
      .addSelect('COUNT(*)::int', 'cnt')
      .groupBy('r.status')
      .addGroupBy('has_required');
    const rows = await qb.getRawMany<{ status: string; has_required: boolean; cnt: string }>();
    return rows.map((r) => ({ status: r.status, has_required: r.has_required, cnt: parseInt(r.cnt, 10) || 0 }));
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<ReleaseEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('r')
      .leftJoinAndMapOne(
        'r.artistas',
        ArtistEntity,
        'artistas',
        'artistas.id = r.artist_id AND artistas.tenant_id = r.tenant_id AND artistas.deleted_at IS NULL',
      )
      .where('r.id = :id AND r.tenant_id = :tenantId AND r.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Lançamento não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('release', result.status, actorRole);
    return { ...result, allowed_transitions };
  }

  async create(tenantId: string, userId: string, input: CreateReleaseDto): Promise<ReleaseEntity> {
    const dto = canonicalizeReleaseInput(input);
    const entity = this.repo!.create({
      tenant_id:       tenantId,
      title:          dto.title,
      type:            dto.type,
      artist_id:      dto.artistId    ?? null,
      upc:             dto.upc         ?? null,
      distributor:     dto.distributor ?? null,
      release_date:    dto.releasedAt  ? new Date(dto.releasedAt) : null,
      platforms:       dto.platforms   ?? [],
      cover_url:       dto.coverUrl    ?? null,
      status:          ReleaseStatus.DRAFT,
      metadata:        dto.metadata    ?? {},
      isrc_global:     dto.isrc_global    ?? null,
      internal_notes:  dto.internal_notes ?? null,
      notes:           dto.notes          ?? null,
      record_label:    dto.record_label   ?? null,
      copyright:       dto.copyright      ?? null,
      music_genre:     dto.music_genre    ?? null,
      language:        dto.language       ?? null,
      assets:          dto.assets         ?? null,
      schedule:        dto.schedule       ?? null,
      created_by:      userId,
      updated_by:      userId,
    });
    const saved = await this.repo!.save(entity);
    await this.recordActivity(tenantId, userId, saved.id, 'created', `Lançamento "${saved.title}" criado`, {
      title: saved.title,
      type: saved.type,
      artistId: saved.artist_id,
    });

    // Triggers internal native automations (e.g. release-checklist). The handlers are
    // asynchronous and failure-proof — they never revert the release creation.
    this.events.emitTyped(DOMAIN_EVENTS.RELEASE_CREATED, {
      tenantId,
      userId,
      aggregateType: 'release',
      aggregateId:   saved.id,
      payload: {
        releaseId: saved.id,
        tenantId,
        title:    saved.title,
        type:      saved.type,
        artistId:  saved.artist_id,
        createdBy: userId,
        createdAt: (saved.created_at ?? new Date()).toISOString(),
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    input: UpdateReleaseDto,
    actorRole?: string,
  ): Promise<ReleaseEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const dto = canonicalizeReleaseInput(input);
    const current = await this.findById(tenantId, id, actorRole);
    const statusChanging = dto.status != null && dto.status !== current.status;
    const expectedUpdatedAt = dto.expectedUpdatedAt;
    const conflictMessage = 'Este lançamento foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const nonStatusUpdates: Record<string, unknown> = { updated_at: new Date(), updated_by: userId };
    if (dto.title       != null) nonStatusUpdates.title          = dto.title;
    if (dto.type        != null) nonStatusUpdates.type            = dto.type;
    if (dto.artistId    != null) nonStatusUpdates.artist_id      = dto.artistId;
    if (dto.upc         != null) nonStatusUpdates.upc             = dto.upc;
    if (dto.distributor != null) nonStatusUpdates.distributor     = dto.distributor;
    if (dto.releasedAt  != null) nonStatusUpdates.release_date    = new Date(dto.releasedAt);
    if (dto.platforms   != null) nonStatusUpdates.platforms       = dto.platforms;
    if (dto.coverUrl    != null) nonStatusUpdates.cover_url       = dto.coverUrl;
    if (dto.metadata    != null) nonStatusUpdates.metadata        = dto.metadata;
    if (dto.isrc_global    != null) nonStatusUpdates.isrc_global    = dto.isrc_global;
    if (dto.internal_notes != null) nonStatusUpdates.internal_notes = dto.internal_notes;
    if (dto.notes          != null) nonStatusUpdates.notes          = dto.notes;
    if (dto.record_label   != null) nonStatusUpdates.record_label   = dto.record_label;
    if (dto.copyright      != null) nonStatusUpdates.copyright      = dto.copyright;
    if (dto.music_genre    != null) nonStatusUpdates.music_genre    = dto.music_genre;
    if (dto.language       != null) nonStatusUpdates.language       = dto.language;
    if (dto.assets         != null) nonStatusUpdates.assets         = dto.assets;
    if (dto.schedule       != null) nonStatusUpdates.schedule       = dto.schedule;

    if (statusChanging) {
      const req = {
        entityType: 'release' as const,
        entityId:   id,
        tenantId,
        actorId:    userId,
        actorRole,
        fromStatus: current.status,
        toStatus:   dto.status as string,
        entity:     current as unknown as Record<string, unknown>,
      };
      await this.ds!.transaction(async (em) => {
        await this.workflowService.transitionInTx(req, em);
        // CAS in the same transaction as the status change — if the release was
        // edited by someone else since `current` was read, the whole
        // transaction (including the history already written by transitionInTx) rolls
        // back; it never applies a transition validated against a stale status.
        await casUpdate(
          em.getRepository(ReleaseEntity),
          { id, tenant_id: tenantId },
          { ...nonStatusUpdates, status: dto.status },
          expectedUpdatedAt,
          conflictMessage,
        );
      });

      // Emit WORKFLOW_TRANSITIONED for all status changes
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId,
        aggregateType: 'release',
        aggregateId:   id,
        payload: {
          entityType:     'release',
          entityId:       id,
          tenantId,
          fromStatus:     current.status,
          toStatus:       dto.status as string,
          actorId:        userId,
          actorRole,
          reason:         null,
          transitionedAt: new Date().toISOString(),
        },
      });

      // Emit specialised events per target status
      const nowIso = new Date().toISOString();
      if (dto.status === ReleaseStatus.APPROVED) {
        this.events.emitTyped(DOMAIN_EVENTS.RELEASE_APPROVED, {
          tenantId,
          userId,
          aggregateType: 'release',
          aggregateId:   id,
          payload: {
            releaseId:  id,
            tenantId,
            title:     current.title,
            artistId:   current.artist_id,
            approvedBy: userId,
            approvedAt: nowIso,
          },
        });
      } else if (dto.status === ReleaseStatus.DISTRIBUTED) {
        this.events.emitTyped(DOMAIN_EVENTS.RELEASE_DISTRIBUTED, {
          tenantId,
          userId,
          aggregateType: 'release',
          aggregateId:   id,
          payload: {
            releaseId:     id,
            tenantId,
            title:        current.title,
            artistId:      current.artist_id,
            distributor:   current.distributor,
            platforms:     current.platforms as unknown[],
            distributedAt: nowIso,
          },
        });
      } else if (dto.status === ReleaseStatus.RELEASED) {
        this.events.emitTyped(DOMAIN_EVENTS.RELEASE_PUBLISHED, {
          tenantId,
          userId,
          aggregateType: 'release',
          aggregateId:   id,
          payload: {
            releaseId:   id,
            tenantId,
            title:      current.title,
            artistId:    current.artist_id,
            publishedAt: nowIso,
          },
        });
      }
    } else {
      await casUpdate(
        this.repo!,
        { id, tenant_id: tenantId } as FindOptionsWhere<ReleaseEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<ReleaseEntity>,
        expectedUpdatedAt,
        conflictMessage,
      );
    }

    return this.findById(tenantId, id, actorRole);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as FindOptionsWhere<ReleaseEntity>,
      { deleted_at: new Date() } as QueryDeepPartialEntity<ReleaseEntity>,
    );
    return { deleted: true };
  }

  private async recordActivity(
    tenantId: string,
    userId: string,
    entityId: string,
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ) {
    if (!this.activityLogs) return;
    try {
      await this.activityLogs.create(tenantId, userId || 'system', {
        entity_type: 'release',
        entity_id:   entityId,
        action,
        description,
        metadata,
      });
    } catch {
      // Activity feed must not break the CRUD response; failures still surface via audit/runtime checks.
    }
  }
}
