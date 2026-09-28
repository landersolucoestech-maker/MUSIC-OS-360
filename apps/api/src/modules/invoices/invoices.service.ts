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
import { invoiceCancelledCopy, invoiceCreatedCopy, invoiceStatusChangedCopy } from './i18n/invoice-copy.pt-br';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { INVOICE_DEPRECATED_FIELDS, INVOICE_ITEM_DEPRECATED_FIELDS } from './invoice-legacy-fields';

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
    if (!this.repo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
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
    // Pre-CZ-036 names -> canonical (the item-level aliases too).
    const input = applyDeprecatedFieldAliases(dto as unknown as Record<string, unknown>, INVOICE_DEPRECATED_FIELDS);
    const payload: Record<string, unknown> = { ...input };
    if (Array.isArray(input['items'])) {
      payload['items'] = (input['items'] as Record<string, unknown>[]).map((item) =>
        applyDeprecatedFieldAliases(item, INVOICE_ITEM_DEPRECATED_FIELDS),
      );
    }

    if (input['tipo_nota'] !== undefined) payload['type'] = input['tipo_nota'];
    if (input['service_amount'] !== undefined) payload['legacy_amount'] = input['service_amount'];

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
      // REM-06: `invoices` also receives the Stripe invoices of the tenant's own SaaS
      // subscription (billing.service.ts upsertStripeInvoice, type=
      // 'stripe_subscription'). This endpoint (RequireRole('viewer')) is the
      // list of service invoices issued by the tenant to ITS clients —
      // without this filter, a viewer via /invoices bypassed the
      // RequireRole('admin') barrier that protects the same data in /billing/subscription.
      .andWhere("i.type != 'stripe_subscription'");

    if (query.status) qb.andWhere('i.status = :status', { status: query.status });

    const fiscalDocumentType = query.tipo_nota ?? query.type;
    if (fiscalDocumentType) {
      qb.andWhere('(i.tipo_nota = :tipoNota OR i.type = :tipoNota)', { tipoNota: fiscalDocumentType });
    }
    if (query.client_id) qb.andWhere('i.client_id = :clientId', { clientId: query.client_id });
    if (query.artistId) qb.andWhere('i.prestador_id = :prestadorId', { prestadorId: query.artistId });
    if (query.search) {
      qb.andWhere(
        '(i.invoice_number ILIKE :search OR i.tomador_legal_name ILIKE :search OR i.service_description ILIKE :search)',
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
      // REM-06: same exclusion as list() — never expose a SaaS subscription
      // Stripe invoice via GET /invoices/:id.
      .andWhere("i.type != 'stripe_subscription'")
      .getOne();
    if (!result) throw new NotFoundException('Nota fiscal não encontrada');
    return this.mapInvoice(result);
  }

  async create(tenantId: string, userId: string, dto: CreateInvoiceDto) {
    // find-99749ea0: client_id had no cross-tenant ownership check — an
    // invoice could silently reference another tenant's client. (sale_id's
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
        amount: String((saved as unknown as Record<string, unknown>)['service_amount'] ?? saved.legacy_amount ?? 0),
        invoiceNumber: saved.invoice_number ?? null,
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
          description: invoiceCreatedCopy(saved.invoice_number, (mapped['service_amount'] ?? mapped['legacy_amount']) ?? 0),
          metadata: {
            type: mapped['tipo_nota'] ?? mapped['type'],
            amount: String((mapped['service_amount'] ?? mapped['legacy_amount']) ?? 0),
            invoiceNumber: saved.invoice_number,
          },
        });
      } catch { /* auditing does not block the main operation */ }
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
          description: invoiceCancelledCopy(current['invoice_number']),
          metadata: { invoiceNumber: current['invoice_number'], amount: String((current['service_amount'] ?? current['legacy_amount']) ?? 0) },
        });
      } catch { /* auditing does not block the main operation */ }
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
    const invoiceNumber = after['invoice_number'] == null ? null : String(after['invoice_number']);
    const amount = String((after['service_amount'] ?? after['legacy_amount']) ?? 0);

    this.events?.emitTyped(DOMAIN_EVENTS.INVOICE_STATUS_CHANGED, {
      tenantId,
      userId,
      aggregateType: 'invoice',
      aggregateId: invoiceId,
      payload: {
        invoiceId,
        tenantId,
        invoiceNumber,
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
          amount,
          invoiceNumber,
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
          invoiceNumber,
          amount,
          dueAt: String(after['due_at'] ?? nowIso),
        },
      });
    }

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type: 'invoice',
          entity_id: invoiceId,
          action: 'status_changed',
          description: invoiceStatusChangedCopy(invoiceNumber, before['status'], newStatus),
          metadata: { previousStatus: before['status'], newStatus, invoiceNumber },
        });
      } catch { /* auditing does not block the main operation */ }
    }
  }
}
