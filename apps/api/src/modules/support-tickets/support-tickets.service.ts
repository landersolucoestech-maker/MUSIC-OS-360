import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { SupportTicketEntity, SupportTicketMessageEntity } from '../../database/entities';
import { SupportTicketStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import type { CreateSupportTicketDto, UpdateSupportTicketDto, QuerySupportTicketDto, CreateSupportTicketMessageDto } from './dto/support-tickets.dto';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

@Injectable()
export class SupportTicketsService {
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<SupportTicketEntity> | null = null;
  private readonly messagesRepo: Repository<SupportTicketMessageEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(SupportTicketEntity);
      this.messagesRepo = ds.getRepository(SupportTicketMessageEntity);
    }
  }

  async list(tenantId: string, query: QuerySupportTicketDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');

    if (q['status'])   qb.andWhere('t.status = :status',     { status:   q['status'] });
    if (q['priority']) qb.andWhere('t.priority = :priority', { priority: q['priority'] });
    if (q['search'])   qb.andWhere(
      '(t.subject ILIKE :search OR t.ticket_number ILIKE :search)',
      { search: `%${q['search']}%` },
    );

    qb.orderBy('t.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        offset: typeof q['offset'] === 'number' ? q['offset'] : 0,
        limit:  typeof q['limit']  === 'number' ? q['limit']  : 50,
      },
    };
  }

  /**
   * REM-01 (Remaining Product Completion Backlog): AdminSupport panel
   * (frontend `admin-support.service.ts`) called this real `list()` — which
   * is `@CurrentTenant()`-scoped by design (a tenant's own manager list of
   * their own tickets) — so a super_admin only ever saw the ONE tenant they
   * happened to be scoped to, never the cross-tenant view the panel implies.
   * Real cross-tenant admin listing, mirroring the `admin-users`/
   * `billing.service.ts` admin/* convention: raw SQL, no tenant_id filter
   * (relies on `super_admin_full_access` RLS + `RequireRole('super_admin')`
   * at the controller), joined with `tenants` for `tenant_name`.
   */
  async listAdmin(query: { search?: string; status?: string; priority?: string }) {
    const ds = this.ds!;
    const params: unknown[] = [];
    const filters: string[] = ['t.deleted_at IS NULL', 'tn.deleted_at IS NULL'];

    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(lower(t.subject) LIKE $${params.length} OR lower(t.ticket_number) LIKE $${params.length} OR lower(tn.name) LIKE $${params.length})`);
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`t.status = $${params.length}`);
    }
    if (query.priority) {
      params.push(query.priority);
      filters.push(`t.priority = $${params.length}`);
    }

    return ds.query(
      `
      SELECT
        t.id, t.subject, t.category, t.tenant_id, tn.name AS tenant_name,
        t.status, t.priority, t.assigned_to, t.created_at, t.updated_at, t.resolved_at
      FROM support_tickets t
      JOIN tenants tn ON tn.id = t.tenant_id
      WHERE ${filters.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT 200
      `,
      params,
    );
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<SupportTicketEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('t')
      .where('t.id = :id AND t.tenant_id = :tenantId AND t.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Ticket não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('ticket', result.status, actorRole);
    return { ...result, allowed_transitions };
  }

  async create(tenantId: string, userId: string, dto: CreateSupportTicketDto): Promise<SupportTicketEntity> {
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const entity = this.repo!.create({
      tenant_id:     tenantId,
      ...(dto as unknown as Record<string, unknown>),
      ticket_number: ticketNumber,
      created_by:    userId,
    } as Partial<SupportTicketEntity>);
    const saved = await this.repo!.save(entity as SupportTicketEntity);

    // Triggers internal native automations (e.g. support-triage). The handlers are
    // asynchronous and failure-proof — they never revert the ticket creation.
    this.events.emitTyped(DOMAIN_EVENTS.SUPPORT_TICKET_CREATED, {
      tenantId,
      userId,
      aggregateType: 'support_ticket',
      aggregateId:   saved.id,
      payload: {
        tenantId,
        ticketId:  saved.id,
        createdBy: userId,
        category:  saved.category,
        priority:  saved.priority,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateSupportTicketDto,
    actorRole?: string,
  ): Promise<SupportTicketEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;
    const toStatus = dtoMap['status'] as string | undefined;

    const { status: _s, expectedUpdatedAt, ...restFields } = dtoMap as Record<string, unknown> & { expectedUpdatedAt?: string };
    void _s;
    const conflictMessage = 'Este ticket foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const nonStatusUpdates: Record<string, unknown> = {
      updated_at: new Date(),
      ...restFields,
    };

    if (statusChanging) {
      const req = {
        entityType: 'ticket' as const,
        entityId:   id,
        tenantId,
        actorId:    userId,
        actorRole,
        fromStatus: current.status,
        toStatus:   toStatus as string,
        entity:     current as unknown as Record<string, unknown>,
      };
      await this.ds!.transaction(async (em) => {
        await this.workflowService.transitionInTx(req, em);
        // CAS in the same transaction as the status change — if the ticket was
        // edited by someone else since `current` was read, the whole
        // transaction (including the history already written by transitionInTx) rolls
        // back; it never applies a transition validated against a stale status.
        await casUpdate(
          em.getRepository(SupportTicketEntity),
          { id, tenant_id: tenantId },
          { ...nonStatusUpdates, status: toStatus as SupportTicketStatus },
          expectedUpdatedAt,
          conflictMessage,
        );
      });

      // Emit WORKFLOW_TRANSITIONED for every ticket status change
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId,
        aggregateType: 'support_ticket',
        aggregateId:   id,
        payload: {
          entityType:     'support_ticket',
          entityId:       id,
          tenantId,
          fromStatus:     current.status,
          toStatus:       toStatus as string,
          actorId:        userId,
          actorRole,
          reason:         null,
          transitionedAt: new Date().toISOString(),
        },
      });

      // Emit TICKET_RESOLVED when ticket is resolved
      if (toStatus === SupportTicketStatus.RESOLVED) {
        this.events.emitTyped(DOMAIN_EVENTS.TICKET_RESOLVED, {
          tenantId,
          userId,
          aggregateType: 'support_ticket',
          aggregateId:   id,
          payload: {
            ticketId:   id,
            tenantId,
            title:     current.subject,
            resolvedBy: userId,
            resolvedAt: new Date().toISOString(),
          },
        });
      }
    } else {
      await casUpdate(
        this.repo!,
        { id, tenant_id: tenantId } as FindOptionsWhere<SupportTicketEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<SupportTicketEntity>,
        expectedUpdatedAt,
        conflictMessage,
      );
    }

    return this.findById(tenantId, id, actorRole);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as FindOptionsWhere<SupportTicketEntity>,
      { deleted_at: new Date() } as QueryDeepPartialEntity<SupportTicketEntity>,
    );
    return { deleted: true };
  }

  // ── Messages (GAP-04: reply thread on a ticket) ────────────────────────────

  async listMessages(tenantId: string, ticketId: string): Promise<SupportTicketMessageEntity[]> {
    await this.findById(tenantId, ticketId);
    return this.messagesRepo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId AND m.ticket_id = :ticketId', { tenantId, ticketId })
      .orderBy('m.created_at', 'ASC')
      .getMany();
  }

  async addMessage(
    tenantId: string,
    ticketId: string,
    sender: { id: string; name: string; role: 'user' | 'support' | 'admin' },
    dto: CreateSupportTicketMessageDto,
  ): Promise<SupportTicketMessageEntity> {
    await this.findById(tenantId, ticketId);
    const entity = this.messagesRepo!.create({
      tenant_id: tenantId,
      ticket_id: ticketId,
      sender_id: sender.id,
      sender_name: sender.name,
      sender_role: sender.role,
      message: dto.message,
      internal_note: dto.internal_note ?? false,
    });
    return this.messagesRepo!.save(entity);
  }
}
