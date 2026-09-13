import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { CampaignEntity } from '../../database/entities';
import type { CreateCampaignDto, UpdateCampaignDto, QueryCampaignDto } from './dto/campaigns.dto';
import { CampaignStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class CampaignsService {
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<CampaignEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(CampaignEntity);
    }
  }

  async list(tenantId: string, query: QueryCampaignDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL');

    if (q['status'])     qb.andWhere('c.status = :status',         { status:     q['status'] });
    if (q['type'])       qb.andWhere('c.type = :type',             { type:       q['type'] });
    if (q['artist_id']) qb.andWhere('c.artist_id = :artistId',  { artistId:  q['artist_id'] });
    if (q['search'])     qb.andWhere('c.nome ILIKE :search',       { search: `%${q['search']}%` });

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

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<CampaignEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('c')
      .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Campanha não encontrada');
    const allowed_transitions = this.workflowService.getAllowedTransitions('campaign', result.status, actorRole);
    return { ...result, allowed_transitions };
  }

  /**
   * find-c06511bf: CreateCampaignDto/UpdateCampaignDto use EN camelCase
   * field names (title/artistId/budget/currency/startsAt/endsAt) that never
   * matched CampaignEntity's real PT snake_case columns (nome/artist_id/
   * orcamento/start_date/end_date) — TypeORM silently drops unrecognized
   * plain properties at INSERT/UPDATE time, so every campaign created via
   * this DTO persisted with no title/artist/budget/dates at all. `currency`/
   * `platforms` have no dedicated column at all — folded into `metadata`
   * (same non-destructive fallback events.service.ts uses for its own
   * extra form fields) rather than silently dropped.
   */
  /**
   * find-e0f93ecc (Wave 8 cross-review): `metadata` is a single JSONB column
   * a plain UPDATE overwrites wholesale — building it from ONLY this
   * request's fields (as the first version of this mapper did) silently
   * deleted any previously stored metadata key the caller didn't re-send
   * (e.g. PATCH {currency:'USD'} alone would erase a stored `platforms`
   * array). `currentMetadata` (the row's metadata BEFORE this write) is
   * merged first so only keys this request actually touches change.
   */
  private dtoToEntity(dto: Record<string, unknown>, currentMetadata: Record<string, unknown> = {}): Partial<CampaignEntity> {
    const out: Record<string, unknown> = {};
    if (dto['title']    !== undefined) out['nome']       = dto['title'];
    if (dto['type']     !== undefined) out['type']       = dto['type'];
    if (dto['artistId'] !== undefined) out['artist_id']  = dto['artistId'];
    if (dto['budget']   !== undefined) out['orcamento']  = dto['budget'];
    if (dto['startsAt'] !== undefined) out['start_date'] = dto['startsAt'];
    if (dto['endsAt']   !== undefined) out['end_date']   = dto['endsAt'];
    if (dto['currency'] !== undefined || dto['platforms'] !== undefined || dto['metadata'] !== undefined) {
      out['metadata'] = {
        ...currentMetadata,
        ...(dto['metadata'] as Record<string, unknown> ?? {}),
        ...(dto['currency']  !== undefined ? { currency: dto['currency'] }   : {}),
        ...(dto['platforms'] !== undefined ? { platforms: dto['platforms'] } : {}),
      };
    }
    return out as Partial<CampaignEntity>;
  }

  async create(tenantId: string, userId: string, dto: CreateCampaignDto): Promise<CampaignEntity> {
    const mapped = this.dtoToEntity(dto as unknown as Record<string, unknown>);
    // find-50dd3726: artist_id had no cross-tenant ownership check — a
    // campaign could silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', mapped.artist_id, tenantId, 'Artista');
    const entity = this.repo!.create({
      tenant_id:  tenantId,
      ...mapped,
      status:     CampaignStatus.DRAFT,
      created_by: userId,
      updated_by: userId,
    } as Partial<CampaignEntity>);
    return this.repo!.save(entity as CampaignEntity);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCampaignDto,
    actorRole?: string,
  ): Promise<CampaignEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;
    const toStatus = dtoMap['status'] as string | undefined;

    const { status: _s, ...restFields } = dtoMap;
    void _s;
    const mapped = this.dtoToEntity(restFields, current.metadata ?? {});
    // find-50dd3726: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (mapped.artist_id !== undefined) {
      await assertSameTenantFk(this.ds!, 'artists', mapped.artist_id, tenantId, 'Artista');
    }

    const nonStatusUpdates: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: userId,
      ...mapped,
    };

    if (statusChanging) {
      const req = {
        entityType: 'campaign' as const,
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
        await em.update(CampaignEntity, { id, tenant_id: tenantId }, {
          ...nonStatusUpdates,
          status: toStatus as CampaignStatus,
        });
      });

      // Emit WORKFLOW_TRANSITIONED for every campaign status change
      const now = new Date().toISOString();
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId,
        aggregateType: 'campaign',
        aggregateId:   id,
        payload: {
          entityType:     'campaign',
          entityId:       id,
          tenantId,
          fromStatus:     current.status,
          toStatus:       toStatus as string,
          actorId:        userId,
          actorRole,
          reason:         null,
          transitionedAt: now,
        },
      });

      // Emit domain events on status transitions
      if (toStatus === CampaignStatus.ACTIVE) {
        this.events.emitTyped(DOMAIN_EVENTS.CAMPAIGN_STARTED, {
          tenantId,
          userId,
          aggregateType: 'campaign',
          aggregateId:   id,
          payload: {
            campaignId: id,
            tenantId,
            title:     current.nome,
            startedBy:  userId,
            startedAt:  now,
          },
        });
      } else if (
        toStatus === CampaignStatus.COMPLETED ||
        toStatus === CampaignStatus.CANCELLED
      ) {
        this.events.emitTyped(DOMAIN_EVENTS.CAMPAIGN_ENDED, {
          tenantId,
          userId,
          aggregateType: 'campaign',
          aggregateId:   id,
          payload: {
            campaignId: id,
            tenantId,
            title:     current.nome,
            endedAt:    now,
          },
        });
      }
    } else {
      await this.repo!.update(
        { id, tenant_id: tenantId } as FindOptionsWhere<CampaignEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<CampaignEntity>,
      );
    }

    return this.findById(tenantId, id, actorRole);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as FindOptionsWhere<CampaignEntity>,
      { deleted_at: new Date() } as QueryDeepPartialEntity<CampaignEntity>,
    );
    return { deleted: true };
  }
}
