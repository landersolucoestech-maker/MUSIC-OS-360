import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import {
  SocietySubmissionEntity,
  SocietySubmissionEventEntity,
  SocietyPayloadSnapshotEntity,
} from '../../../database/entities';
import {
  RegistrableEntityType,
  SocietyDriver,
  SocietyName,
  SocietySubmissionEventType,
  SocietySubmissionStatus,
} from '@music-os-360/types';
import { allowedNext, canTransition, REQUIRES_SNAPSHOT } from './society-submission.state';
import type { QuerySubmissionDto, UpdateSubmissionStatusDto } from '../dto/society.dto';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

export interface CreateSubmissionInput {
  society: SocietyName;
  driver: SocietyDriver;
  entityType: RegistrableEntityType;
  entityId: string;
  accountId?: string | null;
}

/** Deterministic JSON so identical payloads always hash the same. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

@Injectable()
export class SocietySubmissionService {
  private readonly ds: DataSource | null = null;
  private readonly subs: Repository<SocietySubmissionEntity> | null = null;
  private readonly events: Repository<SocietySubmissionEventEntity> | null = null;
  private readonly snapshots: Repository<SocietyPayloadSnapshotEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) {
      this.ds = ds;
      this.subs = ds.getRepository(SocietySubmissionEntity);
      this.events = ds.getRepository(SocietySubmissionEventEntity);
      this.snapshots = ds.getRepository(SocietyPayloadSnapshotEntity);
    }
  }

  private get repo(): Repository<SocietySubmissionEntity> {
    if (!this.subs) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.subs;
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  async list(tenantId: string, q: QuerySubmissionDto) {
    const qb = this.repo.createQueryBuilder('s').where('s.tenant_id = :tenantId', { tenantId });
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.society) qb.andWhere('s.society = :society', { society: q.society });
    if (q.entity_id) qb.andWhere('s.entity_id = :eid', { eid: q.entity_id });
    qb.orderBy('s.created_at', 'DESC').skip(q.offset ?? 0).take(q.limit ?? 50);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<SocietySubmissionEntity> {
    const sub = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!sub) throw new NotFoundException('Submissão não encontrada');
    return sub;
  }

  async getWithAllowed(tenantId: string, id: string) {
    const submission = await this.findById(tenantId, id);
    return { ...submission, allowed_transitions: allowedNext(submission.status) };
  }

  /** Most recent submission for an entity, optionally filtered by status. */
  async findLatestForEntity(
    tenantId: string,
    entityType: RegistrableEntityType,
    entityId: string,
    statuses?: SocietySubmissionStatus[],
  ): Promise<SocietySubmissionEntity | null> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId AND s.entity_type = :et AND s.entity_id = :eid', { tenantId, et: entityType, eid: entityId });
    if (statuses && statuses.length > 0) qb.andWhere('s.status IN (:...statuses)', { statuses });
    return qb.orderBy('s.created_at', 'DESC').getOne();
  }

  async getEvents(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    if (!this.events) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    const data = await this.events.find({
      where: { tenant_id: tenantId, submission_id: id },
      order: { created_at: 'ASC' },
    });
    return { data, meta: { total: data.length } };
  }

  async getCurrentPayload(tenantId: string, id: string) {
    const sub = await this.findById(tenantId, id);
    if (!sub.current_payload_snapshot_id || !this.snapshots) return { snapshot: null };
    const snapshot = await this.snapshots.findOne({
      where: { id: sub.current_payload_snapshot_id, tenant_id: tenantId },
    });
    return { snapshot: snapshot ?? null };
  }

  // ── Commands ─────────────────────────────────────────────────────────────
  /** Create a submission in DRAFT and record the CREATED event. */
  async createSubmission(tenantId: string, userId: string, input: CreateSubmissionInput): Promise<SocietySubmissionEntity> {
    const submission = this.repo.create({
      tenant_id: tenantId,
      account_id: input.accountId ?? null,
      society: input.society,
      driver: input.driver,
      entity_type: input.entityType,
      entity_id: input.entityId,
      status: SocietySubmissionStatus.DRAFT,
    });
    const saved = await this.repo.save(submission);
    await this.recordEvent(tenantId, userId, saved.id, {
      eventType: SocietySubmissionEventType.CREATED,
      toStatus: SocietySubmissionStatus.DRAFT,
      message: 'Submissão criada',
    });
    return saved;
  }

  /** Apply a status transition (validated by the state machine) + event. */
  async transition(tenantId: string, userId: string, id: string, dto: UpdateSubmissionStatusDto): Promise<SocietySubmissionEntity> {
    const sub = await this.findById(tenantId, id);
    const from = sub.status;
    const to = dto.status;

    if (!canTransition(from, to)) {
      throw new BadRequestException('Mudança de status inválida para esta submissão.');
    }
    if (REQUIRES_SNAPSHOT.includes(to) && !sub.current_payload_snapshot_id) {
      throw new BadRequestException('Gere os dados da submissão antes de avançar para este status.');
    }
    // A protocol, once set, cannot be silently overwritten.
    if (dto.protocol && sub.protocol && dto.protocol !== sub.protocol) {
      throw new ConflictException('Protocolo já atribuído; não pode ser sobrescrito sem auditoria.');
    }

    const now = new Date();
    const updates: Record<string, unknown> = { status: to };
    if (dto.protocol) updates.protocol = dto.protocol;
    if (dto.external_id) updates.external_id = dto.external_id;
    if (to === SocietySubmissionStatus.SUBMITTED) {
      updates.submitted_at = now;
      updates.submitted_by = userId || null;
    }
    if (to === SocietySubmissionStatus.APPROVED) updates.approved_at = now;
    if (to === SocietySubmissionStatus.REJECTED) updates.rejected_at = now;
    if (to === SocietySubmissionStatus.FAILED && dto.failure_reason) updates.failure_reason = dto.failure_reason;

    // CAS: if the submission was changed by someone/some process since
    // `sub` was read (e.g. two concurrent transitions), rejects with 409
    // instead of applying a transition validated against an already obsolete status.
    await casUpdate(
      this.repo,
      { id, tenant_id: tenantId } as never,
      updates as never,
      dto.expectedUpdatedAt,
      'Esta submissão foi alterada por outro processo desde que você a carregou. Recarregue e tente novamente.',
    );
    const saved = await this.findById(tenantId, id);
    await this.recordEvent(tenantId, userId, id, {
      eventType: dto.protocol && !sub.protocol ? SocietySubmissionEventType.PROTOCOL_ASSIGNED : SocietySubmissionEventType.STATUS_CHANGED,
      fromStatus: from,
      toStatus: to,
      message: dto.message ?? `Status: ${from} → ${to}`,
      metadata: dto.protocol ? { protocol: dto.protocol } : {},
    });
    return saved;
  }

  /**
   * Create an IMMUTABLE, versioned, hashed payload snapshot and point the
   * submission at it. Snapshots are never updated — a new file = a new version.
   */
  async createSnapshot(tenantId: string, userId: string, submissionId: string, payload: Record<string, unknown>) {
    if (!this.ds || !this.snapshots) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    await this.findById(tenantId, submissionId);

    return this.ds.transaction(async (em) => {
      const count = await em.count(SocietyPayloadSnapshotEntity, { where: { submission_id: submissionId } });
      const snapshot = em.create(SocietyPayloadSnapshotEntity, {
        tenant_id: tenantId,
        submission_id: submissionId,
        version: count + 1,
        payload,
        payload_hash: hashPayload(payload),
        created_by: userId || null,
      });
      const savedSnap = await em.save(snapshot);
      await em.update(SocietySubmissionEntity, { id: submissionId, tenant_id: tenantId }, {
        current_payload_snapshot_id: savedSnap.id,
      });
      await this.recordEvent(tenantId, userId, submissionId, {
        eventType: SocietySubmissionEventType.PAYLOAD_GENERATED,
        message: `Snapshot v${savedSnap.version} gerado`,
        metadata: { version: savedSnap.version, payload_hash: savedSnap.payload_hash },
      }, em.getRepository(SocietySubmissionEventEntity));
      return savedSnap;
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────
  private async recordEvent(
    tenantId: string,
    userId: string,
    submissionId: string,
    e: {
      eventType: SocietySubmissionEventType;
      fromStatus?: string;
      toStatus?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    },
    repoOverride?: Repository<SocietySubmissionEventEntity>,
  ): Promise<void> {
    const repo = repoOverride ?? this.events;
    if (!repo) return;
    const event = repo.create({
      tenant_id: tenantId,
      submission_id: submissionId,
      from_status: e.fromStatus ?? null,
      to_status: e.toStatus ?? null,
      event_type: e.eventType,
      message: e.message ?? null,
      metadata: e.metadata ?? {},
      created_by: userId || null,
    });
    await repo.save(event);
  }
}
