import { Injectable, Inject, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere, IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ContractEntity, ArtistEntity, ClientEntity } from '../../database/entities';
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
  type ResolvedContractWriteFields,
} from './contract-legacy-alias.util';


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

  /** Um warning por alias legado efetivamente recebido nesta requisição. Nunca loga valores. */
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

    const qb = this.repo!
      .createQueryBuilder('c')
      .leftJoinAndMapOne(
        'c.artistas',
        ArtistEntity,
        'artistas',
        'artistas.id = c.artist_id AND artistas.tenant_id = c.tenant_id AND artistas.deleted_at IS NULL',
      )
      .leftJoinAndMapOne(
        'c.clientes',
        ClientEntity,
        'clientes',
        'clientes.id = c.client_id AND clientes.tenant_id = c.tenant_id AND clientes.deleted_at IS NULL',
      )
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
   * Contagem + soma de `valor` por status, sobre o tenant inteiro (não a
   * página atual) — Task H: KPIs exatos sem baixar a tabela inteira. O
   * bucket-mapping (vigente/assinado/aguardando/análise/encerrado) continua
   * no frontend (Contratos.tsx), que agora itera sobre este mapa pequeno
   * {status: count} em vez da lista completa de contratos.
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const qb = this.repo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');
    return groupCount(qb, 'c', 'status', 'valor');
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<ContractEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('c')
      .leftJoinAndMapOne(
        'c.artistas',
        ArtistEntity,
        'artistas',
        'artistas.id = c.artist_id AND artistas.tenant_id = c.tenant_id AND artistas.deleted_at IS NULL',
      )
      .leftJoinAndMapOne(
        'c.clientes',
        ClientEntity,
        'clientes',
        'clientes.id = c.client_id AND clientes.tenant_id = c.tenant_id AND clientes.deleted_at IS NULL',
      )
      .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Contrato não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('contract', result.status, actorRole);
    return { ...result, allowed_transitions };
  }

  /**
   * Monta o payload final para persistência a partir dos campos canônicos já
   * resolvidos (title/type/artist_id/start_date/end_date/arquivo_url/valor
   * — ver resolveContractAliases()) e dos demais campos não relacionados a
   * aliases, que continuam passando direto para a entity.
   */
  private buildEntityPayload(dto: Record<string, unknown>, resolved: ResolvedContractWriteFields): Record<string, unknown> {
    const out: Record<string, unknown> = { ...resolved };

    out.client_id    = dto['client_id']    ?? null;
    out.release_id = dto['release_id'] ?? null;
    out.exclusivo     = dto['exclusivo']     ?? false;
    out.observacoes   = dto['observacoes']   ?? null;
    out.autentique_doc_id = dto['autentique_doc_id'] ?? null;
    out.signing_platform  = dto['signing_platform']  ?? null;
    out.versoes       = (dto['versoes'] as unknown[] | undefined) ?? [];
    out.documents    = (dto['documents'] as unknown[] | undefined) ?? [];
    // Campos do wizard (regra 2026-07-12: 1 coluna por campo, nome exato) — não são aliases.
    out.template_id   = dto['template_id'] ?? null;
    if (Array.isArray(dto['signers'])) out.signers = dto['signers'];

    // parties/currency/signedAt → metadata: fora do escopo do C1 (C1.1), comportamento inalterado.
    const metaIn = (dto['metadata'] as Record<string, unknown> | undefined) ?? {};
    const meta: Record<string, unknown> = { ...metaIn };
    if (Array.isArray(dto['parties']))  meta['parties']  = dto['parties'];
    if (dto['currency'])                meta['currency'] = dto['currency'];
    if (dto['signedAt'])                meta['signed_at'] = dto['signedAt'];
    if (Object.keys(meta).length > 0)   out.metadata = meta;

    // Remove nulls/undefined — preserva a semântica atual de PATCH (null não limpa coluna).
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
    // contracts.type é NOT NULL; o wizard pode não ter tipo de serviço definido.
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
  ): Promise<ContractEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;
    const expectedUpdatedAt = dtoMap['expectedUpdatedAt'] as string | undefined;
    const conflictMessage = 'Este contrato foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const { status: _s, ...restFields } = dtoMap;
    void _s;

    const { normalized: resolved, legacyAliasesUsed } = resolveContractAliases(restFields);
    // update: ausência de título é válida (PATCH parcial); se enviado, o
    // próprio resolveContractAliases() já garantiu conteúdo/conflito válidos.
    this.logLegacyAliasUsage(legacyAliasesUsed, 'update', tenantId, id);

    const normalized = this.buildEntityPayload(restFields, resolved);
    // Sem default de type='outro' aqui — PATCH ausente não deve forçar um valor.

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
        // CAS aqui, dentro da mesma transação da mudança de status: se o
        // contrato foi editado por outra pessoa desde a leitura de `current`
        // acima, a transação inteira (incluindo o histórico de transição já
        // gravado por transitionInTx) faz rollback — nunca aplica uma
        // transição de status validada contra um fromStatus desatualizado.
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
