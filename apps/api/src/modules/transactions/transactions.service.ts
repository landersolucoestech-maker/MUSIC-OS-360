import { Injectable, Inject, Optional, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { TransactionEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
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

/** finance_category_keyword_rules only covers RECEITA/DESPESA — other types (investimento, imposto, transferencia) are never eligible. */
export function toRuleTransactionType(transactionType: unknown): 'RECEITA' | 'DESPESA' | null {
  if (transactionType === 'receita') return 'RECEITA';
  if (transactionType === 'despesa') return 'DESPESA';
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

function buildPersistencePayload(
  tenantId: string,
  userId: string,
  dto: Partial<CreateTransactionDto | UpdateTransactionDto | PatchTransactionDto>,
  existing?: TransactionEntity,
): AnyRecord {
  const currentMetadata = (existing?.metadata ?? {}) as AnyRecord;
  const metadataKeys = [
    'tipoCliente', 'subcategoria', 'formaPagamento', 'tipoPagamento',
    'quantidadeParcelas', 'intervaloParcelas', 'dataPrimeiraParcela',
    'artistaVinculado', 'projetoVinculado', 'contratoVinculado',
    'eventoVinculado', 'fornecedorCliente', 'orgaoArrecadador',
    'itemInvestimento', 'motivoViagem', 'advertisingName', 'observacao',
    'anexoUrl', 'anexoNome',
  ];
  const metadata = { ...currentMetadata };
  for (const key of metadataKeys) {
    if ((dto as AnyRecord)[key] !== undefined) metadata[key] = (dto as AnyRecord)[key];
  }

  const payload: AnyRecord = { metadata, updated_by: userId };
  if (!existing) {
    payload.tenant_id = tenantId;
    payload.created_by = userId;
    // categoria is NOT NULL in the DB; the validator does not require it for `transferencia`,
    // so we apply a defensive default on creation to avoid 23502 → 500.
    payload.categoria = (dto.category && String(dto.category).trim()) || 'outros';
  } else if (dto.category !== undefined) {
    payload.categoria = dto.category || 'outros';
  }
  if (dto.tipoTransacao !== undefined) payload.type = dto.tipoTransacao;
  if (dto.description !== undefined) payload.descricao = dto.description;
  if (dto.amount !== undefined) payload.valor = String(dto.amount);
  if (dto.dataTransacao !== undefined) payload.data = dto.dataTransacao;
  if (dto.status !== undefined) payload.status = dto.status;
  if ((dto as AnyRecord).artistaVinculado !== undefined) payload.artist_id = (dto as AnyRecord).artistaVinculado || null;
  if ((dto as AnyRecord).contratoVinculado !== undefined) payload.contrato_id = (dto as AnyRecord).contratoVinculado || null;
  if ((dto as AnyRecord).projetoVinculado !== undefined) payload.project_id = (dto as AnyRecord).projetoVinculado || null;
  if ((dto as AnyRecord).anexoUrl !== undefined) payload.comprovante_url = (dto as AnyRecord).anexoUrl || null;
  if ((dto as AnyRecord).observacao !== undefined) payload.referencia = (dto as AnyRecord).observacao || null;
  return payload;
}

export function toTransactionDetails(entity: TransactionEntity): TransactionDetailsDTO {
  const metadata = (entity.metadata ?? {}) as AnyRecord;
  const amount = toNumber(entity.valor);
  const attachments = Array.isArray(metadata.attachments)
    ? metadata.attachments as Array<Record<string, unknown>>
    : entity.comprovante_url
      ? [{
          name: metadata.anexoNome ?? 'Comprovante',
          url: entity.comprovante_url,
          type: metadata.attachmentType ?? null,
          size: metadata.attachmentSize ?? null,
        }]
      : [];

  return {
    id: entity.id,
    type: entity.type,
    status: entity.status,
    description: entity.descricao,
    note: (metadata.observacao as string | undefined) ?? entity.referencia,
    amount,
    grossAmount: toNumber(metadata.grossAmount ?? metadata.valorBruto ?? amount),
    netAmount: metadata.netAmount === undefined && metadata.valorLiquido === undefined ? amount : toNumber(metadata.netAmount ?? metadata.valorLiquido),
    fees: metadata.fees === undefined && metadata.taxas === undefined ? null : toNumber(metadata.fees ?? metadata.taxas),
    discount: metadata.discount === undefined && metadata.desconto === undefined ? null : toNumber(metadata.discount ?? metadata.desconto),
    taxes: metadata.taxes === undefined && metadata.impostos === undefined ? null : toNumber(metadata.taxes ?? metadata.impostos),
    interest: metadata.interest === undefined && metadata.juros === undefined ? null : toNumber(metadata.interest ?? metadata.juros),
    fine: metadata.fine === undefined && metadata.multa === undefined ? null : toNumber(metadata.fine ?? metadata.multa),
    currency: (metadata.currency as string | undefined) ?? 'BRL',
    transactionDate: toIso(entity.data),
    competence: metadata.competence as string | null | undefined,
    dueDate: metadata.dueDate as string | null | undefined,
    paidAt: metadata.paidAt as string | null | undefined,
    recurrence: metadata.recurrence as string | null | undefined,
    paymentMethod: metadata.formaPagamento as string | null | undefined,
    paymentType: metadata.tipoPagamento as string | null | undefined,
    installments: metadata.quantidadeParcelas as number | string | null | undefined,
    installmentCurrent: metadata.installmentCurrent == null ? null : toNumber(metadata.installmentCurrent),
    bankAccount: metadata.bankAccount as Record<string, unknown> | string | null | undefined,
    category: entity.categoria,
    subcategory: metadata.subcategoria as string | null | undefined,
    costCenter: metadata.costCenter as Record<string, unknown> | string | null | undefined,
    tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : [],
    labels: Array.isArray(metadata.labels) ? metadata.labels as string[] : [],
    attachments,
    artist: metadata.artist as Record<string, unknown> | null | undefined,
    artistId: entity.artist_id,
    project: metadata.project as Record<string, unknown> | null | undefined,
    projectId: entity.project_id,
    campaign: metadata.campaign as Record<string, unknown> | null | undefined,
    contract: metadata.contract as Record<string, unknown> | null | undefined,
    contractId: entity.contrato_id,
    release: metadata.release as Record<string, unknown> | null | undefined,
    event: metadata.event as Record<string, unknown> | null | undefined,
    linkedEventId: metadata.eventoVinculado as string | null | undefined,
    supplierOrClient: metadata.fornecedorCliente as string | null | undefined,
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
    const q = query as AnyRecord;
    const qb = this.repo!
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.deleted_at IS NULL');

    if (q.status)     qb.andWhere('t.status = :status', { status: q.status });
    if (q.type)       qb.andWhere('t.type = :type', { type: q.type });
    if (q.category)   qb.andWhere('t.categoria = :categoria', { categoria: q.category });
    if (q.artist_id) qb.andWhere('t.artist_id = :artistId', { artistId: q.artist_id });
    if (q.dateFrom)   qb.andWhere('t.data >= :dateFrom', { dateFrom: q.dateFrom });
    if (q.dateTo)     qb.andWhere('t.data <= :dateTo', { dateTo: q.dateTo });
    if (q.search)     qb.andWhere('t.descricao ILIKE :search', { search: `%${q.search}%` });

    return qb;
  }

  async list(tenantId: string, query: QueryTransactionDto) {
    const q = query as AnyRecord;
    const qb = this.baseQb(tenantId, query);

    qb.orderBy('t.data', q.ascending ? 'ASC' : 'DESC')
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
      .addSelect('COALESCE(SUM(t.valor::numeric), 0)', 'sum')
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
   * find-4cd2f044: artist_id/contrato_id/project_id had no cross-tenant
   * ownership check — a transaction could silently reference another
   * tenant's artist/contract/project. Only validates fields actually
   * present in `payload` (omitted on update = "unchanged", already
   * validated at its own create/prior-update time).
   */
  private async assertLinkedFks(tenantId: string, payload: AnyRecord): Promise<void> {
    const ds = this.repo!.manager.connection;
    if (payload.artist_id !== undefined) await assertSameTenantFk(ds, 'artists', payload.artist_id as string | undefined, tenantId, 'Artista');
    if (payload.contrato_id !== undefined) await assertSameTenantFk(ds, 'contracts', payload.contrato_id as string | undefined, tenantId, 'Contrato');
    if (payload.project_id !== undefined) await assertSameTenantFk(ds, 'projects', payload.project_id as string | undefined, tenantId, 'Projeto');
  }

  async create(tenantId: string, userId: string, dto: CreateTransactionDto): Promise<TransactionEntity> {
    const payload = buildPersistencePayload(tenantId, userId, dto);
    await this.assertLinkedFks(tenantId, payload);
    payload.categoria = await this.resolveCategory(tenantId, dto, payload.categoria as string);
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
          type:          saved.type ?? (dto as AnyRecord).tipoTransacao as string ?? '',
          category:      saved.categoria ?? (dto as AnyRecord).category as string ?? '',
          valor: amountText,
          contratoId:    saved.contrato_id ?? null,
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
          metadata:     { type: saved.type, category: saved.categoria, valor: amountText },
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
          valor:         String(existing.valor),
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
          description:  transactionCancelledCopy(existing.valor),
          metadata:     { type: existing.type, valor: String(existing.valor), cancelledAt },
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
   * "outros" — any real category, chosen manually or by
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

    const ruleType = toRuleTransactionType((dto as AnyRecord).tipoTransacao);
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
    const amountText  = String(after.valor);

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
          valor: amountText,
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
            valor: amountText,
            contratoId:    after.contrato_id ?? null,
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
            valor: amountText,
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
          metadata:     { previousStatus: before.status, newStatus: requestedStatus, valor: amountText },
        });
      } catch { /* non-critical */ }
    }
  }
}
