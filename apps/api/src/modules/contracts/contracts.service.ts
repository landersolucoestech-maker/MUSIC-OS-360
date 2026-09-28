import { Injectable, Inject, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere, IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ContractEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { groupCount, type GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { QueryContractDto }  from './dto/query-contract.dto';
import { ContractStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import {
  resolveContractAliases,
  resolveContractQueryAliases,
  canonicalContractVersions,
  type ResolvedContractWriteFields,
} from './contract-legacy-alias.util';
import { preserveServerOwnedMetadata, stripServerOwnedMetadata } from './contract-provider-signature';
import { joinContractPartyRefs, toContractResponse, type ContractResponse } from './contract-party-refs';


@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<ContractEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
    private readonly planLimit: PlanLimitService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(ContractEntity);
    }
  }

  /** One warning per legacy alias actually received in this request. Never logs values. */
  private logLegacyAliasUsage(
    aliases: string[],
    operation: 'create' | 'update' | 'list',
    tenantId: string,
    contractId?: string,
  ): void {
    for (const alias of aliases) {
      const suffix = contractId ? ` contractId=${contractId}` : '';
      this.logger.warn(`Contract legacy alias used: alias=${alias} operation=${operation} tenantId=${tenantId}${suffix}`);
    }
  }

  async list(tenantId: string, query: QueryContractDto) {
    const q = query as Record<string, unknown>;
    const { normalized: resolvedQuery, legacyAliasesUsed } = resolveContractQueryAliases(q);
    this.logLegacyAliasUsage(legacyAliasesUsed, 'list', tenantId);

    const qb = joinContractPartyRefs(this.repo!.createQueryBuilder('c'))
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (q['status'])              qb.andWhere('c.status = :status',        { status:    q['status'] });
    if (resolvedQuery.type)       qb.andWhere('c.type = :type',            { type:      resolvedQuery.type });
    if (resolvedQuery.artist_id) qb.andWhere('c.artist_id = :artistId', { artistId: resolvedQuery.artist_id });
    if (q['search'])              qb.andWhere('c.title ILIKE :search',    { search: `%${q['search']}%` });
    if (q['signing_platform'] === 'none') qb.andWhere('c.signing_platform IS NULL');
    else if (q['signing_platform'])       qb.andWhere('c.signing_platform = :sp', { sp: q['signing_platform'] });

    qb.orderBy('c.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map(toContractResponse),
      meta: {
        total,
        offset: typeof q['offset'] === 'number' ? q['offset'] : 0,
        limit:  typeof q['limit']  === 'number' ? q['limit']  : 50,
      },
    };
  }

  /**
   * Count + sum of `fixed_value` per status, over the whole tenant (not the
   * current page) — Task H: exact KPIs without downloading the whole table. The
   * bucket mapping (`vigente`/`assinado`/`aguardando`/`análise`/`encerrado`) remains
   * in the frontend (Contratos.tsx), which now iterates over this small
   * {status: count} map instead of the full contract list.
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const qb = this.repo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');
    return groupCount(qb, 'c', 'status', 'fixed_value');
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<ContractResponse & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await joinContractPartyRefs(this.repo!.createQueryBuilder('c'))
      .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Contrato não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('contract', result.status, actorRole);
    return { ...toContractResponse(result), allowed_transitions };
  }

  /**
   * Builds the final payload for persistence from the already resolved canonical
   * fields (title/type/artist_id/start_date/end_date/file_url/fixed_value
   * — see resolveContractAliases()) and the other fields unrelated to
   * aliases, which keep passing straight through to the entity.
   */
  private buildEntityPayload(dto: Record<string, unknown>, resolved: ResolvedContractWriteFields): Record<string, unknown> {
    const out: Record<string, unknown> = { ...resolved };

    out.client_id    = dto['client_id']    ?? null;
    out.release_id = dto['release_id'] ?? null;
    // exclusivo / versoes: deprecated names a pre-canonical web build still sends (CZ-026).
    out.exclusive     = dto['exclusive']     ?? dto['exclusivo'] ?? false;
    out.notes         = dto['notes']         ?? null;
    // autentique_doc_id / metadata provider* are server-owned (written only by
    // the signing integrations' sendForSignature) — never taken from a client.
    out.signing_platform  = dto['signing_platform']  ?? null;
    out.versions      = canonicalContractVersions((dto['versions'] ?? dto['versoes'] ?? []) as unknown[]);
    out.documents    = (dto['documents'] as unknown[] | undefined) ?? [];
    // Wizard fields (2026-07-12 rule: 1 column per field, exact name) — they are not aliases.
    out.template_id   = dto['template_id'] ?? null;
    if (Array.isArray(dto['signers'])) out.signers = dto['signers'];

    // parties/currency/signedAt → metadata: out of scope of C1 (C1.1), behavior unchanged.
    const metaIn = stripServerOwnedMetadata((dto['metadata'] as Record<string, unknown> | undefined) ?? {});
    const meta: Record<string, unknown> = { ...metaIn };
    if (Array.isArray(dto['parties']))  meta['parties']  = dto['parties'];
    if (dto['currency'])                meta['currency'] = dto['currency'];
    if (dto['signedAt'])                meta['signed_at'] = dto['signedAt'];
    if (Object.keys(meta).length > 0)   out.metadata = meta;

    // Removes nulls/undefined — preserves the current PATCH semantics (null does not clear a column).
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null && v !== undefined));
  }

  async create(tenantId: string, userId: string, dto: CreateContractDto, orgId?: string): Promise<ContractEntity> {
    await this.planLimit.enforce(tenantId, orgId ?? tenantId, 'contracts');
    const { status: _ignoredStatus, ...rest } = dto as unknown as Record<string, unknown>;
    void _ignoredStatus;

    const { normalized: resolved, legacyAliasesUsed } = resolveContractAliases(rest);
    if (resolved.title === undefined) {
      throw new BadRequestException({
        code: 'CONTRACT_TITLE_REQUIRED',
        message: 'Título é obrigatório.',
        fields: [{ canonical: 'title', legacy: 'title' }],
      });
    }
    this.logLegacyAliasUsage(legacyAliasesUsed, 'create', tenantId);

    const normalized = this.buildEntityPayload(rest, resolved);
    // contracts.type is NOT NULL; the wizard may not have a service type defined.
    if (normalized['type'] == null) normalized['type'] = 'outro';

    await assertSameTenantFk(this.ds!, 'artists', normalized['artist_id'] as string | undefined, tenantId, 'Artista');
    await assertSameTenantFk(this.ds!, 'clients', normalized['client_id'] as string | undefined, tenantId, 'Cliente');

    const entity = this.repo!.create({
      tenant_id:  tenantId,
      ...normalized,
      status:     ContractStatus.DRAFT,
      created_by: userId,
      updated_by: userId,
    } as Partial<ContractEntity>);
    const saved = await this.repo!.save(entity as ContractEntity);

    this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_CREATED, {
      tenantId,
      userId,
      aggregateType: 'contract',
      aggregateId:   saved.id,
      payload: {
        contractId: saved.id,
        tenantId,
        title:     saved.title ?? (normalized['title'] as string) ?? '',
        type:       saved.type   ?? (normalized['type']   as string) ?? '',
        artistId:   saved.artist_id ?? null,
        createdBy:  userId,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateContractDto,
    actorRole?: string,
  ): Promise<ContractResponse & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;
    const expectedUpdatedAt = dtoMap['expectedUpdatedAt'] as string | undefined;
    const conflictMessage = 'Este contrato foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const { status: _s, ...restFields } = dtoMap;
    void _s;

    const { normalized: resolved, legacyAliasesUsed } = resolveContractAliases(restFields);
    // update: an absent title is valid (partial PATCH); if sent,
    // resolveContractAliases() itself already guaranteed valid content/conflict.
    this.logLegacyAliasUsage(legacyAliasesUsed, 'update', tenantId, id);

    const normalized = this.buildEntityPayload(restFields, resolved);
    // No type='outro' default here — an absent PATCH must not force a value.
    // A client metadata update replaces the column: carry the server-owned
    // provider linkage over, or the signature webhook can no longer find the
    // contract (DocuSign resolves by metadata.provider_doc_id).
    if (normalized['metadata']) {
      normalized['metadata'] = preserveServerOwnedMetadata(
        current.metadata as Record<string, unknown> | null,
        normalized['metadata'] as Record<string, unknown>,
      );
    }

    const nonStatusUpdates: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: userId,
      ...normalized,
    };

    if (statusChanging) {
      const req = {
        entityType: 'contract' as const,
        entityId:   id,
        tenantId,
        actorId:    userId,
        actorRole,
        fromStatus: current.status,
        toStatus:   dtoMap['status'] as string,
        entity:     current as unknown as Record<string, unknown>,
      };
      await this.ds!.transaction(async (em) => {
        await this.workflowService.transitionInTx(req, em);
        // CAS here, inside the same transaction as the status change: if the
        // contract was edited by someone else since `current` was read
        // above, the whole transaction (including the transition history already
        // written by transitionInTx) rolls back — it never applies a
        // status transition validated against a stale fromStatus.
        await casUpdate(
          em.getRepository(ContractEntity),
          { id, tenant_id: tenantId },
          { ...nonStatusUpdates, status: dtoMap['status'] as ContractStatus },
          expectedUpdatedAt,
          conflictMessage,
        );
      });

      const nowIso = new Date().toISOString();

      // WORKFLOW_TRANSITIONED for all contract status changes
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId,
        aggregateType: 'contract',
        aggregateId:   id,
        payload: {
          entityType:     'contract',
          entityId:       id,
          tenantId,
          fromStatus:     current.status,
          toStatus:       dtoMap['status'] as string,
          actorId:        userId,
          actorRole,
          reason:         null,
          transitionedAt: nowIso,
        },
      });

      // CONTRACT_SIGNED when transitioning to signed
      if (dtoMap['status'] === ContractStatus.SIGNED) {
        this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_SIGNED, {
          tenantId,
          userId,
          aggregateType: 'contract',
          aggregateId:   id,
          payload: {
            contractId: id,
            tenantId,
            title:     current.title,
            artistId:   current.artist_id,
            signedBy:   userId,
            signedAt:   nowIso,
          },
        });
      }

      // CONTRACT_EXPIRED when transitioning to expired
      if (dtoMap['status'] === ContractStatus.EXPIRED) {
        this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_EXPIRED, {
          tenantId,
          userId,
          aggregateType: 'contract',
          aggregateId:   id,
          payload: {
            contractId: id,
            tenantId,
            title:     current.title,
            artistId:   current.artist_id,
            expiredAt:  nowIso,
          },
        });
      }

      // CONTRACT_CANCELLED when transitioning to cancelled
      if (dtoMap['status'] === ContractStatus.CANCELLED) {
        this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_CANCELLED, {
          tenantId,
          userId,
          aggregateType: 'contract',
          aggregateId:   id,
          payload: {
            contractId:  id,
            tenantId,
            title:      current.title,
            artistId:    current.artist_id,
            cancelledBy: userId,
            cancelledAt: nowIso,
          },
        });
      }

      // Generic CONTRACT_STATUS_CHANGED for all transitions (activity log, analytics)
      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED, {
        tenantId,
        userId,
        aggregateType: 'contract',
        aggregateId:   id,
        payload: {
          contractId:     id,
          tenantId,
          title:         current.title,
          previousStatus: current.status,
          newStatus:      dtoMap['status'] as string,
          changedBy:      userId,
        },
      });
    } else {
      await casUpdate(
        this.repo!,
        { id, tenant_id: tenantId } as FindOptionsWhere<ContractEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<ContractEntity>,
        expectedUpdatedAt,
        conflictMessage,
      );
    }

    return this.findById(tenantId, id, actorRole);
  }

  async softDelete(tenantId: string, userId: string, id: string) {
    const existing = await this.findById(tenantId, id);
    // find-7ced4670: without `deleted_at IS NULL` in the WHERE, two concurrent
    // cancel calls (double-click, retry racing the original) can both pass
    // findById() before either commits, then both unconditionally emit
    // CONTRACT_CANCELLED — duplicate activity-log rows and duplicate
    // notifications for one logical cancellation. Guarding the WHERE and
    // checking `affected` makes only the call that actually performed the
    // not-deleted -> deleted transition emit the event; a racing/duplicate
    // call sees affected===0 and no-ops instead.
    const result = await this.repo!.update(
      { id, tenant_id: tenantId, deleted_at: IsNull() } as FindOptionsWhere<ContractEntity>,
      { deleted_at: new Date(), updated_by: userId } as QueryDeepPartialEntity<ContractEntity>,
    );
    if (!result.affected) {
      return { deleted: true };
    }

    this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_CANCELLED, {
      tenantId,
      userId,
      aggregateType: 'contract',
      aggregateId:   id,
      payload: {
        contractId:  id,
        tenantId,
        title:      existing.title,
        artistId:    existing.artist_id,
        cancelledBy: userId,
        cancelledAt: new Date().toISOString(),
      },
    });

    return { deleted: true };
  }
}
