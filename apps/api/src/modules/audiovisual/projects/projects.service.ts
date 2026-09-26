import {
  Injectable, Inject, NotFoundException, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.tokens';
import {
  AudiovisualProjectEntity,
  AudiovisualDeliverableEntity,
  AudiovisualApprovalEntity,
} from '../../../database/entities';
import { AudiovisualTasksService } from '../tasks/tasks.service';
import type {
  CreateAudiovisualProjectDto, UpdateAudiovisualProjectDto,
  QueryAudiovisualProjectDto, TransitionProjectStatusDto, QueryDashboardDto,
} from '../dto/audiovisual.dto';
import { casUpdate } from '../../../common/persistence/optimistic-update.util';

/**
 * AudiovisualProjectsService — CRUD + status lifecycle + dashboard.
 *
 * Status order:
 *   draft → briefing → pre_production → production → post_production →
 *   approval → delivered → published
 *   (any status → cancelled is allowed)
 *
 * Status changes are validated to prevent invalid regressions.
 */
@Injectable()
export class AudiovisualProjectsService {
  private readonly repo: Repository<AudiovisualProjectEntity> | null;
  private readonly deliverablesRepo: Repository<AudiovisualDeliverableEntity> | null;
  private readonly approvalsRepo: Repository<AudiovisualApprovalEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly tasks: AudiovisualTasksService,
  ) {
    this.repo             = ds?.getRepository(AudiovisualProjectEntity) ?? null;
    this.deliverablesRepo = ds?.getRepository(AudiovisualDeliverableEntity) ?? null;
    this.approvalsRepo    = ds?.getRepository(AudiovisualApprovalEntity) ?? null;
  }

  private get r(): Repository<AudiovisualProjectEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string, query: QueryAudiovisualProjectDto) {
    const qb = this.r.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');
    if (query.search)       qb.andWhere('(p.title ILIKE :s OR p.description ILIKE :s)', { s: `%${query.search}%` });
    if (query.status)       qb.andWhere('p.status = :st',       { st: query.status });
    if (query.type)         qb.andWhere('p.type = :tp',         { tp: query.type });
    if (query.artist_id)    qb.andWhere('p.artist_id = :aid',   { aid: query.artist_id });
    if (query.release_id)   qb.andWhere('p.release_id = :rid',  { rid: query.release_id });
    if (query.campaign_id)  qb.andWhere('p.campaign_id = :cid', { cid: query.campaign_id });
    if (query.event_id)     qb.andWhere('p.event_id = :eid',    { eid: query.event_id });
    qb.orderBy('p.created_at', 'DESC').skip(query.offset ?? 0).take(query.limit ?? 50);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<AudiovisualProjectEntity> {
    const p = await this.r.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as never });
    if (!p) throw new NotFoundException('Projeto audiovisual não encontrado');
    return p;
  }

  async create(tenantId: string, userId: string, dto: CreateAudiovisualProjectDto): Promise<AudiovisualProjectEntity> {
    const entity = this.r.create({
      tenant_id: tenantId,
      ...dto,
      budget_estimated: dto.budget_estimated != null ? String(dto.budget_estimated) : null,
      budget_actual:    dto.budget_actual    != null ? String(dto.budget_actual)    : null,
      status:           dto.status ?? 'draft',
      priority:         dto.priority ?? 'normal',
      metadata:         dto.metadata ?? {},
      created_by:       userId,
      updated_by:       userId,
    } as Partial<AudiovisualProjectEntity>);
    return this.r.save(entity as AudiovisualProjectEntity);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateAudiovisualProjectDto): Promise<AudiovisualProjectEntity> {
    await this.findById(tenantId, id);
    const { expectedUpdatedAt, ...rest } = dto as UpdateAudiovisualProjectDto & { expectedUpdatedAt?: string };
    const patch: Record<string, unknown> = { ...rest, updated_by: userId, updated_at: new Date() };
    if (dto.budget_estimated != null) patch.budget_estimated = String(dto.budget_estimated);
    if (dto.budget_actual    != null) patch.budget_actual    = String(dto.budget_actual);
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      expectedUpdatedAt,
      'Este projeto audiovisual foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async transitionStatus(tenantId: string, userId: string, id: string, dto: TransitionProjectStatusDto): Promise<AudiovisualProjectEntity> {
    const current = await this.findById(tenantId, id);
    this.assertValidTransition(current.status, dto.status);
    const patch: Record<string, unknown> = {
      status: dto.status, updated_by: userId, updated_at: new Date(),
    };
    if (dto.status === 'delivered') patch.completed_at = new Date();
    if (dto.status === 'published') patch.publish_date = patch.publish_date ?? new Date().toISOString().slice(0, 10);
    await casUpdate(
      this.r,
      { id, tenant_id: tenantId } as never,
      patch as never,
      dto.expectedUpdatedAt,
      'Este projeto audiovisual foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );

    // Auto-creates the new stage's default tasks (idempotent — does not duplicate)
    if (dto.status !== 'cancelled' && dto.status !== current.status) {
      try {
        await this.tasks.generateForStage(tenantId, userId, id, dto.status);
      } catch {
        // does not block the transition if task generation fails
      }
    }

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

  /**
   * Dashboard — aggregates per tenant and optional window.
   * Metrics: total active, per status, upcoming shoots (publish_date 7d),
   * pending approvals, overdue deliverables, total budget consumed.
   */
  async dashboard(tenantId: string, q: QueryDashboardDto) {
    const qb = this.r.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');
    if (q.from) qb.andWhere('p.created_at >= :from', { from: q.from });
    if (q.to)   qb.andWhere('p.created_at <= :to',   { to:   q.to });

    const rows = await qb.select(['p.id', 'p.status', 'p.type', 'p.budget_estimated', 'p.budget_actual', 'p.publish_date']).getMany();
    const by_status: Record<string, number> = {};
    const by_type: Record<string, number> = {};
    let budget_estimated_total = 0;
    let budget_actual_total = 0;
    const now = new Date();
    const sevenDaysOut = new Date(); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    let upcoming_publish = 0;
    for (const p of rows) {
      by_status[p.status] = (by_status[p.status] ?? 0) + 1;
      by_type[p.type] = (by_type[p.type] ?? 0) + 1;
      budget_estimated_total += Number(p.budget_estimated ?? 0);
      budget_actual_total    += Number(p.budget_actual    ?? 0);
      if (p.publish_date) {
        const d = new Date(p.publish_date);
        if (d >= now && d <= sevenDaysOut) upcoming_publish++;
      }
    }

    const approvalsPending = this.approvalsRepo
      ? await this.approvalsRepo.count({ where: { tenant_id: tenantId, status: 'pending' } as never })
      : 0;
    const overdueDeliverables = this.deliverablesRepo
      ? await this.deliverablesRepo.createQueryBuilder('d')
          .leftJoin('audiovisual_projects', 'p', 'p.id = d.audiovisual_project_id')
          .where('d.tenant_id = :tenantId', { tenantId })
          .andWhere('d.deleted_at IS NULL')
          .andWhere(`d.status NOT IN ('delivered','published')`)
          .andWhere('p.delivery_date IS NOT NULL AND p.delivery_date < NOW()')
          .getCount()
      : 0;

    return {
      total_projects: rows.length,
      by_status,
      by_type,
      upcoming_publish_7d: upcoming_publish,
      approvals_pending: approvalsPending,
      overdue_deliverables: overdueDeliverables,
      budget_estimated_total: round2(budget_estimated_total),
      budget_actual_total:    round2(budget_actual_total),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private assertValidTransition(from: string, to: string): void {
    if (from === to) return;
    if (to === 'cancelled') return; // may cancel from any state
    const order = [
      'draft', 'briefing', 'pre_production', 'production', 'post_production',
      'approval', 'delivered', 'published',
    ];
    const fromIdx = order.indexOf(from);
    const toIdx   = order.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) {
      throw new BadRequestException(`Transição inválida: ${from} → ${to}`);
    }
    // allows moving forward 1+, or back 1 (revision), but not jumping forward > 2 nor back > 1
    if (toIdx < fromIdx - 1) {
      throw new BadRequestException(`Regressão de status não permitida: ${from} → ${to}. Use cancelled se for o caso.`);
    }
    if (toIdx > fromIdx + 2) {
      throw new BadRequestException(`Salto de status muito grande: ${from} → ${to}. Avance gradualmente.`);
    }
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
