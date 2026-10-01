import { Injectable, Inject, Optional, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { TransactionEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { canonicalExternalRightsReceipts, externalRightsReceiptsVariants } from '../../common/compat/external-rights-receipts';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { FinanceCategoryRulesService } from '../finance-category-rules/finance-category-rules.service';
import {
  TRANSACTION_ALREADY_CANCELLED,
  TRANSACTION_CANCELLED_NOT_EDITABLE,
  transactionCancelledCopy,
  transactionCreatedCopy,
  transactionStatusChangedCopy,
} from './i18n/transaction-copy.pt-br';
import type { QueryTransactionDto } from './dto/query-transaction.dto';
import { canonicalTransactionType, TRANSACTION_QUERY_DEPRECATED_FIELDS } from './transaction-legacy-fields';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import type { TransactionDetailsDTO } from './dto/transaction-details.dto';
import type {
  CreateTransactionDto,
  UpdateTransactionDto,
  PatchTransactionDto,
} from './validators/transaction.validator';

type AnyRecord = Record<string, unknown>;

const PAID_STATUSES      = new Set(['paid', 'confirmed', 'completed']);
const CANCELLED_STATUSES = new Set(['cancelled']);

/**
 * The "no real choice" category — never offered as an option in the manual
 * form (it only exists as a defensive backend fallback and as the fixed
 * placeholder of the OFX import, which cannot know the bank's real category).
 * The only value treated as "eligible for auto-categorization" — any
 * other explicit category is always preserved (never overwritten).
 */
export const UNCATEGORIZED_PLACEHOLDER = 'outros';

/** finance_category_keyword_rules only covers REVENUE/EXPENSE — other types (investment, tax, transfer) are never eligible. */
export function toRuleTransactionType(transactionType: unknown): 'REVENUE' | 'EXPENSE' | null {
  if (transactionType === 'revenue') return 'REVENUE';
  if (transactionType === 'expense') return 'EXPENSE';
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Canonical request key -> column (CZ-041). Blank values persist as NULL. */
const FIELD_TO_COLUMN: ReadonlyArray<[field: string, column: string]> = [
  ['counterpartyType', 'counterparty_type'],
  ['subcategory', 'subcategory'],
  ['notes', 'notes'],
  ['counterpartyName', 'counterparty_name'],
  ['taxAuthority', 'tax_authority'],
  ['costCenter', 'cost_center'],
  ['referenceMonth', 'reference_month'],
  ['sourceBankAccount', 'source_bank_account'],
  ['destinationBankAccount', 'destination_bank_account'],
  ['investmentItem', 'investment_item'],
  ['travelReason', 'travel_reason'],
  ['advertisingName', 'advertising_name'],
  ['paymentMethod', 'payment_method'],
  ['paymentType', 'payment_type'],
  ['installmentInterval', 'installment_interval'],
  ['firstInstallmentDate', 'first_installment_date'],
  ['attachmentUrl', 'attachment_url'],
  ['attachmentName', 'attachment_name'],
  ['artistId', 'artist_id'],
  ['projectId', 'project_id'],
  ['contractId', 'contract_id'],
  ['eventId', 'event_id'],
];

function buildPersistencePayload(
  tenantId: string,
  userId: string,
  dto: Partial<CreateTransactionDto | UpdateTransactionDto | PatchTransactionDto>,
  existing?: TransactionEntity,
): AnyRecord {
  const input = dto as AnyRecord;
  const payload: AnyRecord = { updated_by: userId };
  if (!existing) {
    payload.tenant_id = tenantId;
    payload.created_by = userId;
    // category is NOT NULL in the DB; the validator does not require it for `transfer`,
    // so we apply a defensive default on creation to avoid 23502 → 500.
    payload.category = canonicalExternalRightsReceipts((input.category && String(input.category).trim()) || UNCATEGORIZED_PLACEHOLDER);
  } else if (input.category !== undefined) {
    payload.category = canonicalExternalRightsReceipts(input.category || UNCATEGORIZED_PLACEHOLDER);
  }
  if (input.transactionType !== undefined && input.transactionType !== null) payload.type = input.transactionType;
  if (input.description !== undefined) payload.description = input.description;
  if (input.amount !== undefined && input.amount !== null) payload.amount = String(input.amount);
  if (input.transactionDate !== undefined && input.transactionDate !== null) payload.transaction_date = input.transactionDate;
  if (input.status !== undefined && input.status !== null) payload.status = input.status;
  for (const [field, column] of FIELD_TO_COLUMN) {
    if (input[field] === undefined) continue;
    const value = input[field];
    payload[column] = value === '' ? null : value;
  }
  if (input.installmentCount !== undefined) {
    const count = input.installmentCount === null ? NaN : parseInt(String(input.installmentCount), 10);
    payload.installment_count = Number.isFinite(count) ? count : null;
  }
  return payload;
}

export function toTransactionDetails(entity: TransactionEntity): TransactionDetailsDTO {
  const metadata = (entity.metadata ?? {}) as AnyRecord;
  const amount = toNumber(entity.amount);
  const attachments = Array.isArray(metadata.attachments)
    ? metadata.attachments as Array<Record<string, unknown>>
    : entity.attachment_url
      ? [{
          name: entity.attachment_name ?? 'Comprovante',
          url: entity.attachment_url,
          type: metadata.attachmentType ?? null,
          size: metadata.attachmentSize ?? null,
        }]
      : [];

  return {
    id: entity.id,
    type: entity.type,
    status: entity.status,
    description: entity.description,
    note: entity.notes,
    amount,
    grossAmount: toNumber(metadata.grossAmount ?? amount),
    netAmount: metadata.netAmount === undefined ? amount : toNumber(metadata.netAmount),
    fees: metadata.fees === undefined ? null : toNumber(metadata.fees),
    discount: metadata.discount === undefined ? null : toNumber(metadata.discount),
    taxes: metadata.taxes === undefined ? null : toNumber(metadata.taxes),
    interest: metadata.interest === undefined ? null : toNumber(metadata.interest),
    fine: metadata.fine === undefined ? null : toNumber(metadata.fine),
    currency: (metadata.currency as string | undefined) ?? 'BRL',
    transactionDate: toIso(entity.transaction_date),
    competence: entity.reference_month,
    dueDate: metadata.dueDate as string | null | undefined,
    paidAt: metadata.paidAt as string | null | undefined,
    recurrence: metadata.recurrence as string | null | undefined,
    paymentMethod: entity.payment_method,
    paymentType: entity.payment_type,
    installments: entity.installment_count,
    installmentCurrent: metadata.installmentCurrent == null ? null : toNumber(metadata.installmentCurrent),
    bankAccount: metadata.bankAccount as Record<string, unknown> | string | null | undefined,
    category: entity.category,
    subcategory: entity.subcategory,
    costCenter: entity.cost_center,
    tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : [],
    labels: Array.isArray(metadata.labels) ? metadata.labels as string[] : [],
    attachments,
    artist: metadata.artist as Record<string, unknown> | null | undefined,
    artistId: entity.artist_id,
    project: metadata.project as Record<string, unknown> | null | undefined,
    projectId: entity.project_id,
    campaign: metadata.campaign as Record<string, unknown> | null | undefined,
    contract: metadata.contract as Record<string, unknown> | null | undefined,
    contractId: entity.contract_id,
    release: metadata.release as Record<string, unknown> | null | undefined,
    event: metadata.event as Record<string, unknown> | null | undefined,
    linkedEventId: entity.event_id,
    supplierOrClient: entity.counterparty_name,
    counterpartyType: entity.counterparty_type,
    taxAuthority: entity.tax_authority,
    sourceBankAccount: entity.source_bank_account,
    destinationBankAccount: entity.destination_bank_account,
    investmentItem: entity.investment_item,
    travelReason: entity.travel_reason,
    advertisingName: entity.advertising_name,
    installmentInterval: entity.installment_interval,
    firstInstallmentDate: entity.first_installment_date == null ? null : String(entity.first_installment_date).slice(0, 10),
    supplier: metadata.supplier as Record<string, unknown> | string | null | undefined,
    metadata,
    createdBy: entity.created_by,
    updatedBy: entity.updated_by,
    created_at: toIso(entity.created_at) ?? '',
    updated_at: toIso(entity.updated_at) ?? '',
  };
}

@Injectable()
export class TransactionsService {
  private readonly repo: Repository<TransactionEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly financeCategoryRules: FinanceCategoryRulesService,
  ) {
    if (ds) this.repo = ds.getRepository(TransactionEntity);
  }

  private baseQb(tenantId: string, query: QueryTransactionDto) {
    const q = applyDeprecatedFieldAliases(query as AnyRecord, TRANSACTION_QUERY_DEPRECATED_FIELDS);
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');

    if (q.status)     qb.andWhere('t.status = :status', { status: q.status });
    if (q.type)       qb.andWhere('t.type = :type', { type: canonicalTransactionType(q.type) });
    if (q.category) {
      // The external-rights category matches both its canonical id and the legacy phrase (expand/contract).
      const categories = externalRightsReceiptsVariants(String(q.category));
      if (categories.length > 1) qb.andWhere('t.category IN (:...categories)', { categories });
      else                       qb.andWhere('t.category = :category', { category: q.category });
    }
    if (q.artist_id) qb.andWhere('t.artist_id = :artistId', { artistId: q.artist_id });
    if (q.dateFrom)   qb.andWhere('t.transaction_date >= :dateFrom', { dateFrom: q.dateFrom });
    if (q.dateTo)     qb.andWhere('t.transaction_date <= :dateTo', { dateTo: q.dateTo });
    if (q.search)     qb.andWhere('t.description ILIKE :search', { search: `%${q.search}%` });

    return qb;
  }

  async list(tenantId: string, query: QueryTransactionDto) {
    const q = query as AnyRecord;
    const qb = this.baseQb(tenantId, query);

    // id tie-break: rows sharing a date must page deterministically (offset sweeps).
    qb.orderBy('t.transaction_date', q.ascending ? 'ASC' : 'DESC')
      .addOrderBy('t.id', 'ASC')
      .skip((q.offset as number) ?? 0)
      .take((q.limit as number) ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  /**
   * Exact type×status distribution + value sum (whole tenant, ignores
   * the table's date/search filters — the KPIs always reflect the real
   * total, never the page or the currently visible date range).
   */
  async stats(tenantId: string): Promise<Array<{ type: string; status: string; cnt: number; sum: number }>> {
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL')
      .select('t.type', 'type')
      .addSelect('t.status', 'status')
      .addSelect('COUNT(*)::int', 'cnt')
      .addSelect('COALESCE(SUM(t.amount::numeric), 0)', 'sum')
      .groupBy('t.type')
      .addGroupBy('t.status');
    const rows = await qb.getRawMany<{ type: string; status: string; cnt: string; sum: string }>();
    return rows.map((r) => ({ type: r.type, status: r.status, cnt: parseInt(r.cnt, 10) || 0, sum: parseFloat(r.sum) || 0 }));
  }

  private async findEntityById(tenantId: string, id: string): Promise<TransactionEntity> {
    const result = await this.repo!
      .createQueryBuilder('t')
      .where('t.id = :id AND t.tenant_id = :tenantId AND t.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Transação não encontrada');
    return result;
  }

  async findById(tenantId: string, id: string): Promise<TransactionDetailsDTO> {
    return toTransactionDetails(await this.findEntityById(tenantId, id));
  }

  /**
   * find-4cd2f044: artist_id/contract_id/project_id had no cross-tenant
   * ownership check — a transaction could silently reference another
   * tenant's artist/contract/project. Only validates fields actually
   * present in `payload` (omitted on update = "unchanged", already
   * validated at its own create/prior-update time).
   */
  private async assertLinkedFks(tenantId: string, payload: AnyRecord): Promise<void> {
    const ds = this.repo!.manager.connection;
    if (payload.artist_id !== undefined) await assertSameTenantFk(ds, 'artists', payload.artist_id as string | undefined, tenantId, 'Artista');
    if (payload.contract_id !== undefined) await assertSameTenantFk(ds, 'contracts', payload.contract_id as string | undefined, tenantId, 'Contrato');
    if (payload.project_id !== undefined) await assertSameTenantFk(ds, 'projects', payload.project_id as string | undefined, tenantId, 'Projeto');
    if (payload.event_id !== undefined) await assertSameTenantFk(ds, 'events', payload.event_id as string | undefined, tenantId, 'Evento');
  }

  async create(tenantId: string, userId: string, dto: CreateTransactionDto): Promise<TransactionEntity> {
    const payload = buildPersistencePayload(tenantId, userId, dto);
    await this.assertLinkedFks(tenantId, payload);
    payload.category = await this.resolveCategory(tenantId, dto, payload.category as string);
    const entity = this.repo!.create(payload as Parameters<Repository<TransactionEntity>['create']>[0]);
    const saved = await this.repo!.save(entity as TransactionEntity);

    const amountText = String((dto as AnyRecord).amount ?? '0');

    if (this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_CREATED, {
        tenantId,
        userId,
        aggregateType: 'transaction',
        aggregateId:   saved.id,
        payload: {
          transactionId: saved.id,
          tenantId,
          type:          saved.type ?? (dto as AnyRecord).transactionType as string ?? '',
          category:      saved.category ?? (dto as AnyRecord).category as string ?? '',
          amount:        amountText,
          contractId:    saved.contract_id ?? null,
          artistId:     saved.artist_id ?? null,
          createdBy:     userId,
        },
      });
    }

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type:  'transaction',
          entity_id:    saved.id,
          action:       'created',
          description:  transactionCreatedCopy(saved.type, amountText),
          metadata:     { type: saved.type, category: saved.category, amount: amountText },
        });
      } catch { /* non-critical */ }
    }

    return saved;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionEntity> {
    const existing = await this.findEntityById(tenantId, id);
    this.assertEditable(existing);

    const newStatus = (dto as AnyRecord).status as string | undefined;
    const payload = buildPersistencePayload(tenantId, userId, dto, existing);
    await this.assertLinkedFks(tenantId, payload);
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as AnyRecord,
      { ...payload, updated_at: new Date() },
      (dto as AnyRecord).expectedUpdatedAt as string | undefined,
      'Esta transação foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    const updated = await this.findEntityById(tenantId, id);
    await this.emitStatusEvents(tenantId, userId, existing, updated, newStatus);
    return updated;
  }

  async patch(tenantId: string, userId: string, id: string, dto: PatchTransactionDto): Promise<TransactionEntity> {
    const existing = await this.findEntityById(tenantId, id);
    this.assertEditable(existing);

    const newStatus = (dto as AnyRecord).status as string | undefined;
    const patchPayload = buildPersistencePayload(tenantId, userId, dto, existing);
    await this.assertLinkedFks(tenantId, patchPayload);
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as AnyRecord,
      { ...patchPayload, updated_at: new Date() },
      (dto as AnyRecord).expectedUpdatedAt as string | undefined,
      'Esta transação foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    const updated = await this.findEntityById(tenantId, id);
    await this.emitStatusEvents(tenantId, userId, existing, updated, newStatus);
    return updated;
  }

  async softDelete(tenantId: string, userId: string, id: string) {
    const existing = await this.findEntityById(tenantId, id);

    if (CANCELLED_STATUSES.has(existing.status as string)) {
      throw new BadRequestException(TRANSACTION_ALREADY_CANCELLED);
    }

    const cancelledAt = new Date().toISOString();
    await this.repo!.update(
      { id, tenant_id: tenantId } as AnyRecord,
      { deleted_at: new Date(), updated_by: userId } as AnyRecord,
    );

    if (this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_CANCELLED, {
        tenantId,
        userId,
        aggregateType: 'transaction',
        aggregateId:   id,
        payload: {
          transactionId: id,
          tenantId,
          type:          existing.type as string,
          amount:        String(existing.amount),
          cancelledBy:   userId,
          cancelledAt,
        },
      });
    }

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type:  'transaction',
          entity_id:    id,
          action:       'cancelled',
          description:  transactionCancelledCopy(existing.amount),
          metadata:     { type: existing.type, amount: String(existing.amount), cancelledAt },
        });
      } catch { /* non-critical */ }
    }

    return { deleted: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Task W — keyword auto-categorization on transaction creation
   * (covers manual creation and the OFX import, which reuses this same
   * endpoint). Acts only when the resolved category is the placeholder
   * "outros" (an unchanged category slug) — any real category, chosen manually or by
   * any other flow, is never overwritten. Never crosses tenants (the rules
   * lookup is already scoped by tenantId). If there is no matching
   * rule, or the matcher is unavailable, keeps "outros".
   */
  private async resolveCategory(
    tenantId: string,
    dto: CreateTransactionDto,
    currentCategory: string,
  ): Promise<string> {
    if (currentCategory.trim().toLowerCase() !== UNCATEGORIZED_PLACEHOLDER) {
      return currentCategory;
    }

    const ruleType = toRuleTransactionType((dto as AnyRecord).transactionType);
    const description = (dto as AnyRecord).description as string | undefined;
    if (!ruleType || !description || !this.financeCategoryRules) {
      return currentCategory;
    }

    try {
      const suggestion = await this.financeCategoryRules.suggestCategoryForTransaction(tenantId, ruleType, description);
      return suggestion?.categoryName ?? currentCategory;
    } catch {
      return currentCategory;
    }
  }

  private assertEditable(entity: TransactionEntity): void {
    if (CANCELLED_STATUSES.has(entity.status as string)) {
      throw new ForbiddenException(TRANSACTION_CANCELLED_NOT_EDITABLE);
    }
  }

  private async emitStatusEvents(
    tenantId: string,
    userId: string,
    before: TransactionEntity,
    after: TransactionEntity,
    requestedStatus: string | undefined,
  ): Promise<void> {
    if (!requestedStatus || requestedStatus === before.status) return;

    const nowIso = new Date().toISOString();
    const amountText  = String(after.amount);

    if (this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_STATUS_CHANGED, {
        tenantId,
        userId,
        aggregateType: 'transaction',
        aggregateId:   after.id,
        payload: {
          transactionId:  after.id,
          tenantId,
          type:           after.type as string,
          amount:         amountText,
          previousStatus: before.status as string,
          newStatus:      requestedStatus,
          changedBy:      userId,
        },
      });

      if (PAID_STATUSES.has(requestedStatus)) {
        this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_PAID, {
          tenantId,
          userId,
          aggregateType: 'transaction',
          aggregateId:   after.id,
          payload: {
            transactionId: after.id,
            tenantId,
            type:          after.type as string,
            amount:        amountText,
            contractId:    after.contract_id ?? null,
            artistId:     after.artist_id  ?? null,
            paidBy:        userId,
            paidAt:        nowIso,
          },
        });
      }

      if (CANCELLED_STATUSES.has(requestedStatus)) {
        this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_CANCELLED, {
          tenantId,
          userId,
          aggregateType: 'transaction',
          aggregateId:   after.id,
          payload: {
            transactionId: after.id,
            tenantId,
            type:          after.type as string,
            amount:        amountText,
            cancelledBy:   userId,
            cancelledAt:   nowIso,
          },
        });
      }
    }

    if (this.activityLogs) {
      try {
        await this.activityLogs.create(tenantId, userId, {
          entity_type:  'transaction',
          entity_id:    after.id,
          action:       'status_changed',
          description:  transactionStatusChangedCopy(before.status, requestedStatus),
          metadata:     { previousStatus: before.status, newStatus: requestedStatus, amount: amountText },
        });
      } catch { /* non-critical */ }
    }
  }
}
