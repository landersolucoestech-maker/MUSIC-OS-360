import { Injectable, Inject, Optional, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { InvoiceEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import type { CreateInvoiceDto, UpdateInvoiceDto, QueryInvoiceDto } from './dto/invoices.dto';

const CANCELLED_STATUSES = new Set(['cancelled']);
const ISSUED_STATUSES = new Set(['issued']);
const OVERDUE_STATUSES = new Set(['overdue']);

@Injectable()
export class InvoicesService {
  private readonly repo: Repository<InvoiceEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly enc: EncryptionService,
    @Optional() private readonly events?: EventsService,
    @Optional() private readonly activityLogs?: ActivityLogsService,
  ) {
    this.repo = ds?.getRepository(InvoiceEntity) ?? null;
  }

  private get repository(): Repository<InvoiceEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Database unavailable for invoices');
    return this.repo;
  }

  private mapInvoice(entity: InvoiceEntity): Record<string, unknown> {
    const raw = entity as unknown as Record<string, unknown>;
    const encrypted = raw['tomador_doc_encrypted'];
    const decrypted = typeof encrypted === 'string' && encrypted.length > 0
      ? this.enc.decryptNullable(encrypted)
      : null;

    const mapped: Record<string, unknown> = { ...raw };
    mapped['tomador_cnpj'] = raw['tomador_cnpj'] ?? decrypted ?? null;
    delete mapped['tomador_doc_encrypted'];
    return mapped;
  }

  private normalizePayload(dto: CreateInvoiceDto | UpdateInvoiceDto): Record<string, unknown> {
    const input = dto as unknown as Record<string, unknown>;
    const payload: Record<string, unknown> = { ...input };

    if (input['tipo_nota'] !== undefined) payload['type'] = input['tipo_nota'];
    if (input['valor_servicos'] !== undefined) payload['valor'] = input['valor_servicos'];
    if (input['vencimento'] !== undefined) payload['data_vencimento'] = input['vencimento'];

    const cnpj = input['tomador_cnpj'];
    if (cnpj !== undefined) {
      payload['tomador_doc_encrypted'] = this.enc.encryptNullable(
        typeof cnpj === 'string' ? cnpj : null,
      );
    }

    return payload;
  }

  async list(tenantId: string, query: QueryInvoiceDto) {
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.deleted_at IS NULL')
      // REM-06: `invoices` também recebe as faturas Stripe da assinatura SaaS
      // do próprio tenant (billing.service.ts upsertStripeInvoice, type=
      // 'stripe_subscription'). Este endpoint (RequireRole('viewer')) é a
      // listagem de Notas Fiscais emitidas pelo tenant aos SEUS clientes —
      // sem este filtro, um viewer via /invoices contornava a barreira
      // RequireRole('admin') que protege os mesmos dados em /billing/subscription.
      .andWhere("i.type != 'stripe_subscription'");

    if (query.status) qb.andWhere('i.status = :status', { status: query.status });

    const tipoNota = query.tipo_nota ?? query.type;
    if (tipoNota) {
      qb.andWhere('(i.tipo_nota = :tipoNota OR i.type = :tipoNota)', { tipoNota });
    }
    if (query.client_id) qb.andWhere('i.client_id = :clientId', { clientId: query.client_id });
    if (query.artistId) qb.andWhere('i.prestador_id = :prestadorId', { prestadorId: query.artistId });
    if (query.search) {
      qb.andWhere(
        '(i.numero ILIKE :search OR i.tomador_razao_social ILIKE :search OR i.descricao_servicos ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('i.created_at', query.ascending ? 'ASC' : 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((row) => this.mapInvoice(row)),
      meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 50 },
    };
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown>> {
    const result = await this.repository
      .createQueryBuilder('i')
      .where('i.id = :id AND i.tenant_id = :tenantId AND i.deleted_at IS NULL', { id, tenantId })
      // REM-06: mesma exclusão de list() — nunca expor uma fatura Stripe de
      // assinatura SaaS via GET /invoices/:id.
      .andWhere("i.type != 'stripe_subscription'")
      .getOne();
    if (!result) throw new NotFoundException('Nota fiscal não encontrada');
    return this.mapInvoice(result);
  }

  async create(tenantId: string, userId: string, dto: CreateInvoiceDto) {
    // find-99749ea0: client_id had no cross-tenant ownership check — an
    // invoice could silently reference another tenant's client. (venda_id's
    // target table is not established anywhere in the codebase — no FK
    // constraint, no comment, no other reader — so it is deliberately left
    // unchecked here rather than guessing a table.)
    await assertSameTenantFk(this.repository.manager.connection, 'clients', dto.client_id, tenantId, 'Cliente');
    const payload = this.normalizePayload(dto);
    const entity = this.repository.create({
      tenant_id: tenantId,
      ...payload,
      created_by: userId,
    } as Partial<InvoiceEntity>);
    const saved = await this.repository.save(entity as InvoiceEntity);
    const mapped = this.mapInvoice(saved);

    this.events?.emitTyped(DOMAIN_EVENTS.INVOICE_CREATED, {
      tenantId,
      userId,
      aggregateType: 'invoice',
      aggregateId: saved.id,
      payload: {
        invoiceId: saved.id,
        tenantId,
        type: String((saved as unknown as Record<string, unknown>)['tipo_nota'] ?? saved.type ?? ''),
        valor: String((saved as unknown as Record<string, unknown>)['valor_servicos'] ?? saved.valor ?? 0),
        numero: saved.numero ?? null,
        prestadorId: saved.prestador_id ?? null,
        createdBy: userId,
      },
    });

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type: 'invoice',
          entity_id: saved.id,
          action: 'created',
          description: `Nota fiscal${saved.numero ? ` nº ${saved.numero}` : ''} criada — R$${String((mapped['valor_servicos'] ?? mapped['valor']) ?? 0)}`,
          metadata: {
            type: mapped['tipo_nota'] ?? mapped['type'],
            valor: String((mapped['valor_servicos'] ?? mapped['valor']) ?? 0),
            numero: saved.numero,
          },
        });
      } catch { /* auditoria não bloqueia a operação principal */ }
    }

    return mapped;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateInvoiceDto) {
    const current = await this.findById(tenantId, id);
    if (CANCELLED_STATUSES.has(String(current['status'] ?? ''))) {
      throw new ForbiddenException('Nota fiscal cancelada não pode ser editada');
    }
    // find-99749ea0: only validate when the patch actually sets client_id —
    // omitted means "unchanged", already validated at its own create time.
    if (dto.client_id !== undefined) {
      await assertSameTenantFk(this.repository.manager.connection, 'clients', dto.client_id, tenantId, 'Cliente');
    }

    const updates = {
      ...this.normalizePayload(dto),
      updated_at: new Date(),
    };
    delete (updates as Record<string, unknown>)['expectedUpdatedAt'];
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as never,
      updates as never,
      dto.expectedUpdatedAt,
      'Esta nota fiscal foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    const updated = await this.findById(tenantId, id);

    const newStatus = dto.status;
    if (newStatus && newStatus !== current['status']) {
      await this.emitStatusEvents(tenantId, userId, current, updated, newStatus);
    }
    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const current = await this.findById(tenantId, id);
    await this.repository.update(
      { id, tenant_id: tenantId } as never,
      { deleted_at: new Date(), updated_at: new Date() } as never,
    );

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type: 'invoice',
          entity_id: id,
          action: 'cancelled',
          description: `Nota fiscal${current['numero'] ? ` nº ${String(current['numero'])}` : ''} cancelada`,
          metadata: { numero: current['numero'], valor: String((current['valor_servicos'] ?? current['valor']) ?? 0) },
        });
      } catch { /* auditoria não bloqueia a operação principal */ }
    }
    return { deleted: true };
  }

  private async emitStatusEvents(
    tenantId: string,
    userId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    newStatus: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const invoiceId = String(after['id']);
    const numero = after['numero'] == null ? null : String(after['numero']);
    const valor = String((after['valor_servicos'] ?? after['valor']) ?? 0);

    this.events?.emitTyped(DOMAIN_EVENTS.INVOICE_STATUS_CHANGED, {
      tenantId,
      userId,
      aggregateType: 'invoice',
      aggregateId: invoiceId,
      payload: {
        invoiceId,
        tenantId,
        numero,
        previousStatus: String(before['status'] ?? ''),
        newStatus,
        changedBy: userId,
      },
    });

    if (ISSUED_STATUSES.has(newStatus)) {
      this.events?.emitTyped(DOMAIN_EVENTS.INVOICE_ISSUED, {
        tenantId,
        userId,
        aggregateType: 'invoice',
        aggregateId: invoiceId,
        payload: {
          invoiceId,
          tenantId,
          type: String(after['tipo_nota'] ?? after['type'] ?? ''),
          valor,
          numero,
          issuedBy: userId,
          issuedAt: nowIso,
        },
      });
    }

    if (OVERDUE_STATUSES.has(newStatus)) {
      this.events?.emitTyped(DOMAIN_EVENTS.INVOICE_OVERDUE, {
        tenantId,
        userId: 'system',
        aggregateType: 'invoice',
        aggregateId: invoiceId,
        payload: {
          invoiceId,
          tenantId,
          numero,
          valor,
          dataVencimento: String(after['vencimento'] ?? after['data_vencimento'] ?? nowIso),
        },
      });
    }

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type: 'invoice',
          entity_id: invoiceId,
          action: 'status_changed',
          description: `Nota fiscal ${String(before['status'] ?? '')} → ${newStatus}`,
          metadata: { previousStatus: before['status'], newStatus, numero },
        });
      } catch { /* auditoria não bloqueia a operação principal */ }
    }
  }
}
