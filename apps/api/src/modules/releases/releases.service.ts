import { Injectable, Inject, NotFoundException, Optional, ConflictException } from '@nestjs/common';
import { jsonDeepEqual } from '../../common/stable-equal';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ReleaseEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateReleaseDto, UpdateReleaseDto, QueryReleaseDto } from './dto/releases.dto';
import { ReleaseStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { canonicalReleaseType, canonicalizeReleaseInput } from './release-legacy-fields';
import { DISTRIBUTION_CONFIRMATION_KEY, buildDistributionConfirmation } from './release-distribution-confirmation';
import { joinReleaseArtistRef, toReleaseResponse, type ReleaseResponse } from './release-artist-ref';

/** Statuses after distribution: the distribution data is a historical record and is requested from the distributor, not edited here. */
const DISTRIBUTION_FROZEN_STATUSES: ReadonlySet<string> = new Set([
  ReleaseStatus.DISTRIBUTED,
  ReleaseStatus.RELEASED,
  ReleaseStatus.ARCHIVED,
]);

const dayKey = (value: unknown): string => {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
};
const textKey = (value: unknown): string => (value == null ? '' : String(value));
/**
 * Keys of the merged `assets` and `schedule` objects that carry what the distributor already holds. The other keys
 * (press release, EPK, music video, recording and mix dates) are production and marketing data and stay editable.
 */
const FROZEN_ASSET_KEYS = ['audio_master_url', 'cover_url', 'lyrics', 'credits'] as const;
const FROZEN_SCHEDULE_KEYS = ['distributor_delivery_date'] as const;
const trimmedTextKey = (value: unknown): string => textKey(value).trim();
/**
 * `fallback` holds the column value a key falls back to when the stored object has none: the web form loads the
 * cover from `assets.cover_url` and, when that is missing, from the `cover_url` column, then posts it back.
 */
const changedFrozenKeys = (
  sent: Record<string, unknown> | null | undefined,
  stored: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  keyOf: (value: unknown) => string,
  fallback: Record<string, unknown> = {},
): string[] => keys.filter((key) => {
  if (sent == null || !Object.prototype.hasOwnProperty.call(sent, key)) return false;
  const storedValue = keyOf(stored?.[key]) !== '' ? stored?.[key] : fallback[key];
  return keyOf(sent[key]) !== keyOf(storedValue);
});

/** A track the form adds on its own to an empty tracklist: it carries defaults but no content. */
const TRACK_IDENTITY_KEYS = new Set(['id', 'language']);
const TRACK_FLAG_KEYS = new Set(['explicit', 'isAlternateVersion', 'instrumental']);
const isBlankValue = (value: unknown): boolean => {
  if (value == null || value === '' || value === false) return true;
  if (Array.isArray(value)) return value.every(isBlankValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isBlankValue);
  return false;
};
const isPlaceholderTrack = (track: unknown): boolean =>
  track != null && typeof track === 'object' && !Array.isArray(track)
  && Object.entries(track as Record<string, unknown>).every(([key, value]) =>
    TRACK_IDENTITY_KEYS.has(key) || isBlankValue(value) || (TRACK_FLAG_KEYS.has(key) && (value === false || value === 'no')));
/** The posted tracklist is the stored one, or (when none is stored) only the untouched placeholder the form shows. */
const tracksUnchanged = (sent: unknown, stored: unknown): boolean => {
  const storedEmpty = stored == null || (Array.isArray(stored) && stored.length === 0);
  // The form shows one untouched placeholder; any more would add tracks to a frozen release.
  if (storedEmpty) return sent == null || (Array.isArray(sent) && sent.length <= 1 && sent.every(isPlaceholderTrack));
  return jsonDeepEqual(sent, stored);
};

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
    const qb = joinReleaseArtistRef(this.repo!.createQueryBuilder('r'))
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.deleted_at IS NULL');

    if (q.status)      qb.andWhere('r.status IN (:...statuses)',      { statuses:    q.status.split(',') });
    if (q.type)        qb.andWhere('r.type = :type',                   { type:        canonicalReleaseType(q.type) });
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

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toReleaseResponse), meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
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
  ): Promise<ReleaseResponse & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await joinReleaseArtistRef(this.repo!.createQueryBuilder('r'))
      .where('r.id = :id AND r.tenant_id = :tenantId AND r.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Lançamento não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('release', result.status, actorRole);
    return { ...toReleaseResponse(result), allowed_transitions };
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

  /**
   * After distribution the release carries the data that was sent to the distributor. Changing it here
   * would diverge from what the distributor holds, and the product rule is that such a change is requested
   * from the distributor (its platform or a ticket). Fields sent with the value already stored are accepted
   * so a form that posts the whole release keeps working; notes and unrelated metadata stay editable.
   */
  private assertDistributionDataUnchanged(
    current: ReleaseResponse,
    dto: UpdateReleaseDto,
  ): void {
    if (!DISTRIBUTION_FROZEN_STATUSES.has(current.status)) return;
    const row = current as unknown as Record<string, unknown>;
    const checks: Array<[string, unknown, boolean]> = [
      ['title',        dto.title,        dto.title != null && textKey(dto.title) !== textKey(row['title'])],
      ['type',         dto.type,         dto.type != null && textKey(dto.type) !== textKey(row['type'])],
      ['artist_id',    dto.artistId,     dto.artistId != null && textKey(dto.artistId) !== textKey(row['artist_id'])],
      ['upc',          dto.upc,          dto.upc != null && textKey(dto.upc) !== textKey(row['upc'])],
      ['distributor',  dto.distributor,  dto.distributor != null && textKey(dto.distributor) !== textKey(row['distributor'])],
      ['release_date', dto.releasedAt,   dto.releasedAt != null && dayKey(dto.releasedAt) !== dayKey(row['release_date'])],
      ['cover_url',    dto.coverUrl,     dto.coverUrl != null && textKey(dto.coverUrl) !== textKey(row['cover_url'])],
      ['isrc_global',  dto.isrc_global,  dto.isrc_global != null && textKey(dto.isrc_global) !== textKey(row['isrc_global'])],
      ['record_label', dto.record_label, dto.record_label != null && textKey(dto.record_label) !== textKey(row['record_label'])],
      ['copyright',    dto.copyright,    dto.copyright != null && textKey(dto.copyright) !== textKey(row['copyright'])],
      ['music_genre',  dto.music_genre,  dto.music_genre != null && textKey(dto.music_genre) !== textKey(row['music_genre'])],
      ['language',     dto.language,     dto.language != null && textKey(dto.language) !== textKey(row['language'])],
      ['platforms',    dto.platforms,    dto.platforms != null && !jsonDeepEqual(dto.platforms, row['platforms'] ?? [])],
    ];
    const sentTracks = dto.metadata != null && Object.prototype.hasOwnProperty.call(dto.metadata, 'tracks');
    const storedTracks = (current.metadata as Record<string, unknown> | null | undefined)?.['tracks'];
    if (sentTracks && !tracksUnchanged((dto.metadata as Record<string, unknown>)['tracks'], storedTracks)) {
      checks.push(['metadata.tracks', null, true]);
    }
    const changed = checks.filter(([, , differs]) => differs).map(([field]) => field);
    changed.push(
      ...changedFrozenKeys(dto.assets, current.assets as Record<string, unknown> | null, FROZEN_ASSET_KEYS, trimmedTextKey, { cover_url: row['cover_url'] }).map((key) => `assets.${key}`),
      ...changedFrozenKeys(dto.schedule, current.schedule as Record<string, unknown> | null, FROZEN_SCHEDULE_KEYS, dayKey).map((key) => `schedule.${key}`),
    );
    if (changed.length === 0) return;
    throw new ConflictException({
      code: 'RELEASE_DISTRIBUTED_IMMUTABLE',
      message: 'Lançamento já distribuído: os dados de distribuição não podem ser alterados aqui. Solicite a alteração à distribuidora (na plataforma ou por ticket).',
      fields: changed,
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    input: UpdateReleaseDto,
    actorRole?: string,
  ): Promise<ReleaseResponse & { allowed_transitions: { to: string; label?: string }[] }> {
    const dto = canonicalizeReleaseInput(input);
    const current = await this.findById(tenantId, id, actorRole);
    this.assertDistributionDataUnchanged(current, dto);
    const statusChanging = dto.status != null && dto.status !== current.status;
    // Distributed is a real confirmation (from the distributor or a registered manual conclusion with its evidence),
    // never a plain status edit. The record is built from what the person supplied and stamped by the server; a
    // confirmation sent outside this transition is ignored, so it cannot be forged by an ordinary edit.
    const sentMetadata = { ...((dto.metadata ?? {}) as Record<string, unknown>) };
    const sentConfirmation = sentMetadata[DISTRIBUTION_CONFIRMATION_KEY];
    delete sentMetadata[DISTRIBUTION_CONFIRMATION_KEY];
    const distributionConfirmation = statusChanging && dto.status === ReleaseStatus.DISTRIBUTED
      ? buildDistributionConfirmation(sentConfirmation, userId)
      : null;
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
    // metadata is merged over the stored object: automations (checklist, launch
    // strategy, ...) write their own keys there and the form only sends its own —
    // a wholesale replace erased the automation outputs on every save.
    if (dto.metadata != null || distributionConfirmation) {
      nonStatusUpdates.metadata = {
        ...(current.metadata ?? {}),
        ...sentMetadata,
        ...(distributionConfirmation ? { [DISTRIBUTION_CONFIRMATION_KEY]: distributionConfirmation } : {}),
      };
    }
    if (dto.isrc_global    != null) nonStatusUpdates.isrc_global    = dto.isrc_global;
    if (dto.internal_notes != null) nonStatusUpdates.internal_notes = dto.internal_notes;
    if (dto.notes          != null) nonStatusUpdates.notes          = dto.notes;
    if (dto.record_label   != null) nonStatusUpdates.record_label   = dto.record_label;
    if (dto.copyright      != null) nonStatusUpdates.copyright      = dto.copyright;
    if (dto.music_genre    != null) nonStatusUpdates.music_genre    = dto.music_genre;
    if (dto.language       != null) nonStatusUpdates.language       = dto.language;
    // assets/schedule are merged over the stored object: the current form sends
    // every key (null to clear), while an edit from a pre-CZ-038 build omits the
    // keys it read as blank (their empty legacy values are dropped) — a
    // wholesale replace would silently erase them.
    if (dto.assets         != null) nonStatusUpdates.assets         = { ...(current.assets ?? {}), ...dto.assets };
    if (dto.schedule       != null) nonStatusUpdates.schedule       = { ...(current.schedule ?? {}), ...dto.schedule };

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
