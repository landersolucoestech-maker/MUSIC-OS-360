import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { ADMIN_DATA_SOURCE, DATA_SOURCE } from '../../database/database.module';
import {
  ActivityLogEntity,
  ArtistEntity,
  ExternalDataSubmissionEntity,
  PhonogramEntity,
  ReleaseEntity,
  ShareEntity,
  WebhookEventEntity,
  WorkEntity,
} from '../../database/entities';
import { isRegistryEligibleShare } from '../../modules/shares/share-eligibility.util';
import { EventsService, DOMAIN_EVENTS } from '../events/events.service';
import { ExternalDataProviderRegistry } from './external-data-provider-registry.service';
import { TenantBootstrapResolver } from '../../database/tenant-bootstrap.resolver';
import { CapabilityUnavailableError } from './capability-unavailable.error';
import { ExternalCapabilityReadinessService } from './external-capability-readiness.service';
import {
  DistributorSubmissionPayload,
  ExternalCapability,
  ExternalDataSubmissionStatus,
  isAllowedSubmissionTransition,
  isExternalDataSubmissionStatus,
  ExternalDataExchangeKind,
  ExternalDataRequestContext,
  ExternalDataSubmissionResult,
  ExternalDataWebhookPayload,
  SocietyDataSubmissionPayload,
} from './external-data.types';
import { WebhookEventStatus, classifyFailureCode } from '@music-os-360/types';
import { redactDiagnosticText } from '../filters/redact-diagnostic';

/** Typed rejection for a webhook status that the submission lifecycle does not allow. */
export class InvalidSubmissionTransitionError extends BadRequestException {
  constructor(readonly from: ExternalDataSubmissionStatus | null, readonly to: string) {
    super({ error: 'VALIDATION_FAILED', reason: 'INVALID_SUBMISSION_TRANSITION', from, to, message: 'VALIDATION_FAILED: invalid submission status transition' });
  }
}

type EntityType = 'artist' | 'release' | 'work' | 'phonogram';

interface SubmitDistributorInput {
  tenantId: string;
  userId: string;
  providerId?: string;
  artistId: string;
  releaseId?: string | null;
  phonogramIds?: string[];
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

interface SubmitSocietyInput {
  tenantId: string;
  userId: string;
  providerId?: string;
  artistId?: string | null;
  workIds?: string[];
  phonogramIds?: string[];
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

interface StatusCheckInput {
  tenantId: string;
  userId: string;
  providerId?: string;
  submissionId: string;
  entityType?: EntityType;
  entityId?: string;
  idempotencyKey?: string;
}

@Injectable()
export class ExternalDataExchangeService {
  private readonly logger = new Logger(ExternalDataExchangeService.name);

  private readonly artists: Repository<ArtistEntity> | null = null;
  private readonly releases: Repository<ReleaseEntity> | null = null;
  private readonly works: Repository<WorkEntity> | null = null;
  private readonly phonograms: Repository<PhonogramEntity> | null = null;
  private readonly shares: Repository<ShareEntity> | null = null;
  private readonly activityLogs: Repository<ActivityLogEntity> | null = null;
  private readonly webhookEvents: Repository<WebhookEventEntity> | null = null;
  private readonly submissions: Repository<ExternalDataSubmissionEntity> | null = null;
  // find-bc7c20a6: resolving (provider, submission_id) -> tenant_id must run
  // BEFORE tenant context exists on the connection (that's the point of the
  // lookup), so it needs an RLS-bypassing connection — same reasoning as
  // AutentiqueService/DocuSignService's adminContractRepo.
  private readonly adminSubmissions: Repository<ExternalDataSubmissionEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly registry: ExternalDataProviderRegistry,
    private readonly events: EventsService,
    private readonly tenantResolver: TenantBootstrapResolver,
    @Inject(ADMIN_DATA_SOURCE) @Optional() adminDs?: DataSource | null,
  ) {
    if (ds) {
      this.artists = ds.getRepository(ArtistEntity);
      this.releases = ds.getRepository(ReleaseEntity);
      this.works = ds.getRepository(WorkEntity);
      this.phonograms = ds.getRepository(PhonogramEntity);
      this.shares = ds.getRepository(ShareEntity);
      this.activityLogs = ds.getRepository(ActivityLogEntity);
      this.webhookEvents = ds.getRepository(WebhookEventEntity);
      this.submissions = ds.getRepository(ExternalDataSubmissionEntity);
    }
    if (adminDs) {
      this.adminSubmissions = adminDs.getRepository(ExternalDataSubmissionEntity);
    }
  }

  private readiness: ExternalCapabilityReadinessService | null = null;

  private get capabilityReadiness(): ExternalCapabilityReadinessService {
    if (!this.readiness) this.readiness = new ExternalCapabilityReadinessService(this.registry);
    return this.readiness;
  }

  /** Read-only capability map; never calls a provider. */
  getCapabilities(tenantId?: string) {
    return this.capabilityReadiness.checkAll(tenantId);
  }

  listProviders(kind?: ExternalDataExchangeKind) {
    return this.registry.list(kind);
  }

  async requestExternalSync(params: {
    tenantId: string;
    userId: string;
    artistId: string;
    workIds?: string[];
    societyHint?: string | null;
  }) {
    this.assertDb();
    await this.assertArtist(params.tenantId, params.artistId);

    this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_REQUESTED, {
      tenantId: params.tenantId,
      userId: params.userId,
      aggregateType: 'artist',
      aggregateId: params.artistId,
      payload: {
        tenantId: params.tenantId,
        artistId: params.artistId,
        workIds: params.workIds ?? [],
        societyHint: params.societyHint ?? null,
        requestedAt: new Date().toISOString(),
      },
    });

    await this.logActivity(params.tenantId, params.userId, 'artist', params.artistId, 'external_data.sync_requested', {
      workIds: params.workIds ?? [],
      societyHint: params.societyHint ?? null,
    });

    return {
      tenantId: params.tenantId,
      artistId: params.artistId,
      workIds: params.workIds ?? [],
      societyHint: params.societyHint ?? null,
      requestedAt: new Date().toISOString(),
    };
  }

  async submitDistributor(input: SubmitDistributorInput): Promise<ExternalDataSubmissionResult> {
    this.assertDb();
    if (!input.providerId) throw new BadRequestException('Selecione o distribuidor para enviar.');
    const providerId = input.providerId;
    const blockedContext = this.context(input.tenantId, input.userId, providerId, input.idempotencyKey);
    await this.assertCapability('distributor_submission', input.tenantId, input.userId, 'artist', input.artistId, providerId, blockedContext.idempotencyKey);
    const provider = this.registry.getDistributor(providerId);
    const payload = await this.buildDistributorPayload(input, providerId);
    const context = blockedContext;

    this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_STARTED, {
      tenantId: input.tenantId,
      userId: input.userId,
      aggregateType: 'artist',
      aggregateId: input.artistId,
      payload: {
        tenantId: input.tenantId,
        artistId: input.artistId,
        jobId: context.idempotencyKey,
        society: providerId,
        workIds: [],
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await provider.submit(payload, context);
      await this.persistResult(input.tenantId, input.userId, 'artist', input.artistId, result);
      if (input.releaseId) await this.persistResult(input.tenantId, input.userId, 'release', input.releaseId, result);
      for (const phonogramId of input.phonogramIds ?? []) {
        await this.persistResult(input.tenantId, input.userId, 'phonogram', phonogramId, result);
      }

      this.events.emitTyped(DOMAIN_EVENTS.DISTRIBUTOR_SUBMISSION_CREATED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: 'artist',
        aggregateId: input.artistId,
        payload: {
          tenantId: input.tenantId,
          artistId: input.artistId,
          distributor: providerId,
          submissionId: result.submissionId,
          externalId: result.externalReleaseId ?? result.externalArtistId ?? null,
          createdAt: result.lastSyncedAt,
        },
      });

      this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_COMPLETED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: 'artist',
        aggregateId: input.artistId,
        payload: {
          tenantId: input.tenantId,
          artistId: input.artistId,
          jobId: context.idempotencyKey,
          society: providerId,
          completedAt: result.lastSyncedAt,
        },
      });

      return result;
    } catch (err) {
      this.emitFailed(input.tenantId, input.userId, input.artistId, context.idempotencyKey, providerId, err);
      if (err instanceof CapabilityUnavailableError) {
        await this.auditBlocked(input.tenantId, input.userId, 'artist', input.artistId, err.capability, providerId);
      }
      throw err;
    }
  }

  async submitSociety(input: SubmitSocietyInput): Promise<ExternalDataSubmissionResult> {
    this.assertDb();
    if (!input.providerId) throw new BadRequestException('Selecione a sociedade de gestão coletiva para enviar.');
    const providerId = input.providerId;
    const provider = this.registry.getSociety(providerId);
    const payload = await this.buildSocietyPayload(input, providerId);
    const entityId = input.artistId ?? input.workIds?.[0] ?? input.phonogramIds?.[0];
    if (!entityId) throw new BadRequestException('Selecione ao menos um artista, obra ou fonograma.');
    const context = this.context(input.tenantId, input.userId, providerId, input.idempotencyKey);

    this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_STARTED, {
      tenantId: input.tenantId,
      userId: input.userId,
      aggregateType: 'artist',
      aggregateId: entityId,
      payload: {
        tenantId: input.tenantId,
        artistId: input.artistId ?? entityId,
        jobId: context.idempotencyKey,
        society: providerId,
        workIds: input.workIds ?? [],
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await provider.submit(payload, context);
      if (input.artistId) await this.persistResult(input.tenantId, input.userId, 'artist', input.artistId, result);
      for (const workId of input.workIds ?? []) await this.persistResult(input.tenantId, input.userId, 'work', workId, result);
      for (const phonogramId of input.phonogramIds ?? []) {
        await this.persistResult(input.tenantId, input.userId, 'phonogram', phonogramId, result);
      }

      this.events.emitTyped(DOMAIN_EVENTS.SOCIETY_SUBMISSION_CREATED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: 'work',
        aggregateId: input.workIds?.[0] ?? entityId,
        payload: {
          tenantId: input.tenantId,
          artistId: input.artistId ?? entityId,
          society: providerId,
          submissionId: result.submissionId,
          externalId: result.externalWorkId ?? result.externalPhonogramId ?? null,
          createdAt: result.lastSyncedAt,
        },
      });

      this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_COMPLETED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: 'work',
        aggregateId: input.workIds?.[0] ?? entityId,
        payload: {
          tenantId: input.tenantId,
          artistId: input.artistId ?? entityId,
          jobId: context.idempotencyKey,
          society: providerId,
          completedAt: result.lastSyncedAt,
        },
      });

      return result;
    } catch (err) {
      this.emitFailed(input.tenantId, input.userId, input.artistId ?? entityId, context.idempotencyKey, providerId, err);
      throw err;
    }
  }

  async checkDistributorStatus(input: StatusCheckInput): Promise<ExternalDataSubmissionResult> {
    this.assertDb();
    if (!input.providerId) throw new BadRequestException('Selecione o distribuidor para consultar o status.');
    const providerId = input.providerId;
    const context = this.context(input.tenantId, input.userId, providerId, input.idempotencyKey);
    const entityType = input.entityType ?? 'artist';
    // Audit/event anchor: the real entity when supplied, otherwise the submission id (event contract
    // requires a string artistId; see DistributorStatusUpdatedPayload).
    const anchorId = input.entityId ?? input.submissionId;
    try {
      this.assertCapabilityReady('distributor_status', input.tenantId);
      await this.assertSubmissionOwned(input.tenantId, providerId, input.submissionId);
      const result = await this.registry.getDistributor(providerId).checkStatus(input.submissionId, context);
      if (input.entityType && input.entityId) await this.persistResult(input.tenantId, input.userId, input.entityType, input.entityId, result);
      this.events.emitTyped(DOMAIN_EVENTS.DISTRIBUTOR_STATUS_UPDATED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: entityType,
        aggregateId: anchorId,
        payload: {
          tenantId: input.tenantId,
          artistId: anchorId,
          distributor: providerId,
          submissionId: input.submissionId,
          status: result.status,
          externalId: result.externalReleaseId ?? result.externalArtistId ?? null,
          updatedAt: result.lastSyncedAt,
        },
      });
      return result;
    } catch (err) {
      this.emitFailed(input.tenantId, input.userId, anchorId, context.idempotencyKey, providerId, err);
      if (err instanceof CapabilityUnavailableError) {
        await this.auditBlocked(input.tenantId, input.userId, input.entityId ? entityType : 'artist', input.entityId ?? input.tenantId, err.capability, providerId);
      }
      throw err;
    }
  }

  async checkSocietyStatus(input: StatusCheckInput): Promise<ExternalDataSubmissionResult> {
    this.assertDb();
    if (!input.providerId) throw new BadRequestException('Selecione a sociedade de gestão coletiva para consultar o status.');
    const providerId = input.providerId;
    const context = this.context(input.tenantId, input.userId, providerId, input.idempotencyKey);
    const entityType = input.entityType ?? 'work';
    const anchorId = input.entityId ?? input.submissionId;
    try {
      this.assertSocietyStatusReady(providerId);
      await this.assertSubmissionOwned(input.tenantId, providerId, input.submissionId);
      const result = await this.registry.getSociety(providerId).checkStatus(input.submissionId, context);
      if (input.entityType && input.entityId) await this.persistResult(input.tenantId, input.userId, input.entityType, input.entityId, result);
      this.events.emitTyped(DOMAIN_EVENTS.SOCIETY_STATUS_UPDATED, {
        tenantId: input.tenantId,
        userId: input.userId,
        aggregateType: entityType,
        aggregateId: anchorId,
        payload: {
          tenantId: input.tenantId,
          artistId: anchorId,
          society: providerId,
          submissionId: input.submissionId,
          status: result.status,
          externalId: result.externalWorkId ?? result.externalPhonogramId ?? null,
          updatedAt: result.lastSyncedAt,
        },
      });
      return result;
    } catch (err) {
      this.emitFailed(input.tenantId, input.userId, anchorId, context.idempotencyKey, providerId, err);
      if (err instanceof CapabilityUnavailableError) {
        await this.auditBlocked(input.tenantId, input.userId, input.entityId ? entityType : 'artist', input.entityId ?? input.tenantId, err.capability, providerId);
      }
      throw err;
    }
  }

  /**
   * Status checks may only reference a submission THIS tenant recorded for THIS provider
   * (recordSubmission). Unknown and foreign ids are indistinguishable (same 404, no provider call).
   */
  private async assertSubmissionOwned(tenantId: string, provider: string, submissionId: string): Promise<void> {
    const row = this.submissions
      ? await this.submissions.findOne({ where: { tenant_id: tenantId, provider, submission_id: submissionId } as any })
      : null;
    if (!row) throw new NotFoundException('Submissão não encontrada.');
  }

  /** Society status readiness from provider metadata only (no society entry in the readiness map). */
  private assertSocietyStatusReady(providerId: string): void {
    const meta = this.registry.getSociety(providerId).metadata;
    if (meta.unconfigured) throw new CapabilityUnavailableError('society_submission', 'NO_PROVIDER_CONFIGURED');
    if (meta.mock) throw new CapabilityUnavailableError('society_submission', 'PROVIDER_DISABLED');
    if (!meta.supportsStatusCheck) throw new CapabilityUnavailableError('society_submission', 'PROVIDER_LACKS_CAPABILITY');
  }

  async ingestWebhook(params: {
    providerId: string;
    kind: ExternalDataExchangeKind;
    payload: Record<string, unknown>;
    signature?: string | null;
    secret?: string | null;
  }) {
    this.assertDb();
    this.assertSignature(params.payload, params.signature, params.secret);
    const provider = this.registry.get(params.providerId);
    const normalized = provider.normalizeWebhook(params.payload);

    // find-bc7c20a6: tenant is resolved server-side from a submission WE
    // recorded at submit time (recordSubmission), never from caller input.
    // The HMAC check above only proves the payload was signed with the
    // shared per-provider secret — it proves nothing about which tenant the
    // webhook belongs to. A webhook that can't be tied to a known
    // submission is rejected rather than attributed by guesswork.
    const tenantId = await this.resolveWebhookTenant(params.providerId, normalized.submissionId);
    if (!tenantId) {
      throw new BadRequestException('Webhook does not reference a known submission');
    }
    await this.assertTenantActive(tenantId);

    // external_id carries the tenant: webhook_events.external_id is globally unique, so a
    // provider event id that collides across tenants must never resolve to (or re-apply) another
    // tenant's row. Lookups are additionally scoped by tenant_id. The legacy un-prefixed key is
    // honored only for this tenant's own rows (rows written before the tenant-qualified key).
    const externalId = `${tenantId}:${params.providerId}:${normalized.providerEventId}`;
    const legacyExternalId = `${params.providerId}:${normalized.providerEventId}`;

    // A prior row for this external_id is only a true duplicate once it reached the terminal
    // PROCESSED status. A row stuck PENDING/FAILED is the same event legitimately being
    // retried (matches WebhookService.ingest's identical reasoning) — reuse that row instead
    // of permanently blocking reprocessing or violating the external_id unique constraint.
    const existing = (await this.webhookEvents!.findOne({ where: { external_id: externalId, tenant_id: tenantId } as any }))
      ?? (await this.webhookEvents!.findOne({ where: { external_id: legacyExternalId, tenant_id: tenantId } as any }));
    if (existing) {
      if (existing.status === WebhookEventStatus.PROCESSED) {
        return { duplicate: true, eventId: existing.id };
      }
      await this.webhookEvents!.update({ id: existing.id } as any, {
        status: WebhookEventStatus.PENDING,
        retry_count: (existing.retry_count ?? 0) + 1,
      } as any);
    }

    const saved = existing ?? await this.webhookEvents!.save(this.webhookEvents!.create({
      tenant_id: tenantId,
      provider: params.providerId,
      event_type: `${params.kind}.status`,
      external_id: externalId,
      payload: this.redactSecrets(params.payload),
      status: WebhookEventStatus.PENDING,
      retry_count: 0,
    }));

    try {
      await this.applyWebhook(tenantId, normalized);
      await this.webhookEvents!.update({ id: saved.id } as any, {
        status: WebhookEventStatus.PROCESSED,
        processed_at: new Date(),
      } as any);
      return { duplicate: false, eventId: saved.id, normalized };
    } catch (err) {
      await this.webhookEvents!.update({ id: saved.id } as any, {
        status: WebhookEventStatus.FAILED,
        // Internal column only: redacted raw text, never returned or emitted.
        error: redactDiagnosticText((err as Error).message).substring(0, 2000),
        retry_count: 1,
      } as any);
      throw err;
    }
  }

  /**
   * find-bc7c20a6: looks up the tenant that owns a submission via the
   * RLS-bypassing admin connection — at this point in the flow no tenant
   * context exists yet on the regular connection (resolving it IS the
   * point of this lookup), so it cannot go through the RLS-scoped repo.
   */
  private async resolveWebhookTenant(provider: string, submissionId?: string | null): Promise<string | null> {
    if (!submissionId) return null;
    const repo = this.adminSubmissions ?? this.submissions;
    if (!repo) return null;
    const row = await repo.findOne({ where: { provider, submission_id: submissionId } });
    return row?.tenant_id ?? null;
  }

  private async buildDistributorPayload(input: SubmitDistributorInput, providerId: string): Promise<DistributorSubmissionPayload> {
    const artist = await this.assertArtist(input.tenantId, input.artistId);
    const release = input.releaseId
      ? await this.releases!.findOne({ where: { id: input.releaseId, tenant_id: input.tenantId, deleted_at: null } as any })
      : null;
    const phonograms = input.phonogramIds?.length
      ? await this.phonograms!.createQueryBuilder('p')
        .where('p.tenant_id = :tenantId AND p.id IN (:...ids) AND p.deleted_at IS NULL', { tenantId: input.tenantId, ids: input.phonogramIds })
        .getMany()
      : [];

    return {
      tenantId: input.tenantId,
      providerId,
      artistId: input.artistId,
      releaseId: input.releaseId ?? null,
      phonogramIds: phonograms.map((item) => item.id),
      metadata: {
        ...(input.metadata ?? {}),
        artist: {
          id: artist.id,
          name: artist.stage_name,
          genre: artist.music_genre,
          spotify_url: artist.spotify_url,
          youtube_url: artist.youtube_url,
        },
        release: release ? {
          id: release.id,
          title: release.title,
          type: release.type,
          status: release.status,
          distributor: release.distributor,
          upc: release.upc,
          release_date: release.release_date?.toISOString() ?? null,
          artwork_url: release.cover_url,
          platforms: release.platforms,
        } : null,
        phonograms: phonograms.map((p) => ({
          id: p.id,
          title: p.title,
          isrc: p.isrc,
          duration: p.duration_text,
        })),
        files: {
          artwork_url: release?.cover_url ?? null,
        },
      },
    };
  }

  private async buildSocietyPayload(input: SubmitSocietyInput, providerId: string): Promise<SocietyDataSubmissionPayload> {
    if (input.artistId) await this.assertArtist(input.tenantId, input.artistId);
    const works = input.workIds?.length
      ? await this.works!.createQueryBuilder('w')
        .where('w.tenant_id = :tenantId AND w.id IN (:...ids) AND w.deleted_at IS NULL', { tenantId: input.tenantId, ids: input.workIds })
        .getMany()
      : [];
    const phonograms = input.phonogramIds?.length
      ? await this.phonograms!.createQueryBuilder('p')
        .where('p.tenant_id = :tenantId AND p.id IN (:...ids) AND p.deleted_at IS NULL', { tenantId: input.tenantId, ids: input.phonogramIds })
        .getMany()
      : [];
    // share_type IS NULL = transitional registration eligibility (see share-eligibility.util.ts) —
    // excludes financial/pending shares (Phase 5 / C6) from the submission to the external society.
    const shares = works.length
      ? (await this.shares!.createQueryBuilder('s')
        .where('s.tenant_id = :tenantId AND s.work_id IN (:...ids) AND s.deleted_at IS NULL AND s.share_type IS NULL', { tenantId: input.tenantId, ids: works.map((w) => w.id) })
        .getMany()).filter(isRegistryEligibleShare)
      : [];

    return {
      tenantId: input.tenantId,
      providerId,
      artistId: input.artistId ?? null,
      workIds: works.map((item) => item.id),
      phonogramIds: phonograms.map((item) => item.id),
      metadata: {
        ...(input.metadata ?? {}),
        works: works.map((w) => ({
          id: w.id,
          title: w.title,
          isrc: w.isrc,
          iswc: w.iswc,
          composers: w.composer_names ?? w.composer_name,
          publisher: w.publisher_name,
          genre: w.music_genre,
        })),
        phonograms: phonograms.map((p) => ({
          id: p.id,
          title: p.title,
          isrc: p.isrc,
          label: p.record_label_name,
        })),
        contributors: shares.map((s) => ({
          name: s.holder_name,
          role: s.party_role,
          declared_percentage: s.percentage,
          status: s.status,
        })),
        rightHolders: shares.map((s) => ({
          name: s.holder_name,
          document: s.holder_document,
          role: s.party_role,
          declared_percentage: s.percentage,
        })),
      },
    };
  }

  private async applyWebhook(tenantId: string, payload: ExternalDataWebhookPayload): Promise<void> {
    if (!payload.entityType || !payload.entityId) {
      await this.logActivity(tenantId, 'system:webhook', 'artist', tenantId, 'external_data.webhook_received', payload.raw);
      return;
    }

    const nextStatus = (payload.status ?? 'processing') as string;
    if (!isExternalDataSubmissionStatus(nextStatus)) {
      throw new InvalidSubmissionTransitionError(null, nextStatus);
    }
    const previous = await this.currentStatus(tenantId, payload.entityType, payload.entityId, payload.providerId);
    if (previous && !isAllowedSubmissionTransition(previous, nextStatus)) {
      throw new InvalidSubmissionTransitionError(previous, nextStatus);
    }

    const result: ExternalDataSubmissionResult = {
      providerId: payload.providerId,
      kind: payload.kind,
      submissionId: payload.submissionId ?? payload.providerEventId,
      externalArtistId: payload.externalIds?.['external_artist_id'] ?? null,
      externalReleaseId: payload.externalIds?.['external_release_id'] ?? null,
      externalWorkId: payload.externalIds?.['external_work_id'] ?? null,
      externalPhonogramId: payload.externalIds?.['external_phonogram_id'] ?? null,
      protocol: payload.externalIds?.['protocol'] ?? null,
      status: nextStatus,
      deliveryStatus: payload.deliveryStatus ?? null,
      registrationStatus: payload.registrationStatus ?? null,
      validationErrors: payload.validationErrors ?? [],
      pendingRequirements: payload.pendingRequirements ?? [],
      providerNotes: payload.providerNotes ?? [],
      providerEventId: payload.providerEventId,
      lastSyncedAt: new Date().toISOString(),
      raw: payload.raw,
    };
    await this.persistResult(tenantId, 'system:webhook', payload.entityType, payload.entityId, result);
  }

  /** Last status this platform recorded for (entity, provider); tenant-scoped. */
  private async currentStatus(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    providerId: string,
  ): Promise<ExternalDataSubmissionStatus | null> {
    const row = await this.repoFor(entityType).findOne({ where: { id: entityId, tenant_id: tenantId, deleted_at: null } as any });
    const recorded = (row as any)?.metadata?.external_data_exchange?.[providerId]?.status;
    return isExternalDataSubmissionStatus(recorded) ? recorded : null;
  }

  private async persistResult(
    tenantId: string,
    userId: string,
    entityType: EntityType,
    entityId: string,
    result: ExternalDataSubmissionResult,
  ): Promise<void> {
    const repo = this.repoFor(entityType);
    const row = await repo.findOne({ where: { id: entityId, tenant_id: tenantId, deleted_at: null } as any });
    if (!row) throw new BadRequestException('Registro não encontrado.');
    const metadata = { ...((row as any).metadata ?? {}) };
    const exchange = { ...(metadata['external_data_exchange'] as Record<string, unknown> | undefined ?? {}) };
    exchange[result.providerId] = {
      kind: result.kind,
      submission_id: result.submissionId,
      external_artist_id: result.externalArtistId ?? null,
      external_release_id: result.externalReleaseId ?? null,
      external_work_id: result.externalWorkId ?? null,
      external_phonogram_id: result.externalPhonogramId ?? null,
      protocol: result.protocol ?? null,
      status: result.status,
      delivery_status: result.deliveryStatus ?? null,
      registration_status: result.registrationStatus ?? null,
      validation_errors: result.validationErrors,
      pending_requirements: result.pendingRequirements,
      provider_notes: result.providerNotes,
      provider_event_id: result.providerEventId ?? null,
      last_synced_at: result.lastSyncedAt,
    };
    metadata['external_data_exchange'] = exchange;
    await repo.update({ id: entityId, tenant_id: tenantId } as any, { metadata, updated_at: new Date() } as any);
    await this.recordSubmission(tenantId, result.providerId, entityType, entityId, result.submissionId);

    await this.logActivity(tenantId, userId, entityType, entityId, `${result.kind}.status_updated`, {
      providerId: result.providerId,
      status: result.status,
      validationErrors: result.validationErrors,
      pendingRequirements: result.pendingRequirements,
    });
  }

  /**
   * find-bc7c20a6: one row per (provider, submission_id, entity_type,
   * entity_id) — the reverse-lookup index `ingestWebhook` uses to resolve
   * tenant server-side instead of trusting a caller-supplied header.
   */
  private async recordSubmission(
    tenantId: string,
    provider: string,
    entityType: EntityType,
    entityId: string,
    submissionId: string,
  ): Promise<void> {
    if (!this.submissions) return;
    await this.submissions.upsert(
      { tenant_id: tenantId, provider, entity_type: entityType, entity_id: entityId, submission_id: submissionId },
      { conflictPaths: ['provider', 'submission_id', 'entity_type', 'entity_id'] },
    );
  }

  private repoFor(entityType: EntityType): Repository<any> {
    if (entityType === 'artist') return this.artists!;
    if (entityType === 'release') return this.releases!;
    if (entityType === 'work') return this.works!;
    return this.phonograms!;
  }

  private async assertArtist(tenantId: string, artistId: string): Promise<ArtistEntity> {
    const artist = await this.artists!.findOne({ where: { id: artistId, tenant_id: tenantId, deleted_at: null } as any });
    if (!artist) throw new BadRequestException('Artista não encontrado.');
    return artist;
  }

  private context(tenantId: string, userId: string, providerId: string, idempotencyKey?: string): ExternalDataRequestContext {
    return {
      tenantId,
      userId,
      providerId,
      idempotencyKey: idempotencyKey || randomUUID(),
    };
  }

  private assertCapabilityReady(capability: ExternalCapability, tenantId: string): void {
    const readiness = this.capabilityReadiness.check(capability, tenantId);
    if (!readiness.available) throw new CapabilityUnavailableError(readiness.capability, readiness.reason);
  }

  /** Readiness gate for submit: fails closed BEFORE any read/write, emitting the failure event and the blocked audit. */
  private async assertCapability(
    capability: ExternalCapability,
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    providerId: string,
    jobId: string,
  ): Promise<void> {
    try {
      this.assertCapabilityReady(capability, tenantId);
    } catch (err) {
      this.emitFailed(tenantId, userId, entityId, jobId, providerId, err);
      if (err instanceof CapabilityUnavailableError) {
        await this.auditBlocked(tenantId, userId, entityType, entityId, err.capability, providerId);
      }
      throw err;
    }
  }

  /** Audit entry with capability, provider and code only: never the payload. Audit failure never masks the block. */
  private async auditBlocked(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    capability: string,
    providerId: string,
  ): Promise<void> {
    try {
      await this.logActivity(tenantId, userId, entityType, entityId, 'external_data.blocked', {
        capability,
        provider: providerId,
        code: 'CAPABILITY_UNAVAILABLE',
      });
    } catch (auditErr) {
      this.logger.warn(`blocked-audit write failed: ${classifyFailureCode((auditErr as Error).message, 'SYNC_FAILED')}`);
    }
  }

  private emitFailed(tenantId: string, userId: string, artistId: string, jobId: string, providerId: string, err: unknown): void {
    this.events.emitTyped(DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_FAILED, {
      tenantId,
      userId,
      aggregateType: 'artist',
      aggregateId: artistId,
      payload: {
        tenantId,
        artistId,
        jobId,
        society: providerId,
        errorCode: classifyFailureCode((err as Error).message, 'SYNC_FAILED'),
        retryCount: 0,
        failedAt: new Date().toISOString(),
      },
    });
  }

  private async logActivity(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.activityLogs) return;
    await this.activityLogs.save(this.activityLogs.create({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description: `External data exchange: ${action}`,
      metadata: this.redactSecrets(metadata),
      user_id: userId,
      user_name: null,
      user_avatar_url: null,
    }));
  }

  private assertSignature(payload: Record<string, unknown>, signature?: string | null, secret?: string | null): void {
    // find-e5ca49de: fail CLOSED on a missing secret. The controller already
    // rejects before calling in here when no secret is configured, but this
    // primitive must be safe by default regardless of caller discipline.
    if (!secret) throw new ServiceUnavailableException('External data webhook secret unavailable');
    if (!signature) throw new BadRequestException('Webhook signature missing');
    const raw = JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    const left = Buffer.from(expected, 'hex');
    const right = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private redactSecrets(input: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(input, (key, value) => {
      if (/secret|token|password|authorization|signature/i.test(key)) return '[REDACTED]';
      return value;
    })) as Record<string, unknown>;
  }

  private assertDb(): void {
    if (!this.ds) throw new ServiceUnavailableException('External data exchange persistence unavailable');
  }

  /**
   * This endpoint is @Public() — it never traverses TenantGuard, which is
   * the only other place `tenants.active` gets checked. Without this, a
   * suspended/deactivated tenant's external-data webhooks keep being
   * ingested and applied indefinitely (not just for TenantGuard's 60s
   * cache window — forever, since this path never reaches that guard at
   * all). Runs after signature verification (so an attacker can't probe
   * tenant-active status without a valid signature) and before any DB
   * write (webhookEvents insert, applyWebhook).
   */
  private async assertTenantActive(tenantId: string): Promise<void> {
    const tenant = await this.tenantResolver.resolveTenant(tenantId);
    if (!tenant || !tenant.active) {
      throw new ForbiddenException('Tenant not found or inactive');
    }
    // P0-A: deliberately NO billing-status gate here. This endpoint
    // reconciles external-data events (distributor/society) that already
    // happened on the external side — same Type-B reasoning as the
    // DocuSign/Autentique webhooks. Only the lifecycle check above applies.
    // See the P0-A Public Boundary Policy Matrix.
  }
}
