import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { EventEntity } from '../../database/entities';
import type { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto/events.dto';
import { EVENT_DEPRECATED_FIELDS } from './dto/events.dto';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { groupCount, GroupStatsResult } from '../../common/stats/group-count.util';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

@Injectable()
export class EventsService {
  private readonly repo: Repository<EventEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional() private readonly activityLogs?: ActivityLogsService,
  ) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(EventEntity);
  }

  private baseQb(tenantId: string, query: QueryEventDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.deleted_at IS NULL');

    if (q['status'])     qb.andWhere('e.status = :status',       { status:     q['status'] });
    if (q['type'])       qb.andWhere('e.type = :type',           { type:       q['type'] });
    if (q['artist_id']) qb.andWhere('e.artist_id = :artistId', { artistId: q['artist_id'] });
    if (q['dateFrom'])   qb.andWhere('e.starts_at >= :dateFrom', { dateFrom:   q['dateFrom'] });
    if (q['dateTo'])     qb.andWhere('e.starts_at <= :dateTo',   { dateTo:     q['dateTo'] });
    if (q['search'])     qb.andWhere('e.title ILIKE :search',   { search: `%${q['search']}%` });

    return qb;
  }

  async list(tenantId: string, query: QueryEventDto) {
    const q = query as Record<string, unknown>;
    const qb = this.baseQb(tenantId, query);

    qb.orderBy('e.starts_at', q['ascending'] ? 'ASC' : 'DESC')
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
   * KPIs for the whole tenant (never computed only over the visible calendar
   * period): exact count per status + "next 7 days" (rolling window,
   * not a GROUP BY — a separate, simple query).
   */
  async stats(tenantId: string): Promise<GroupStatsResult & { upcoming7Days: number }> {
    const byStatus = await groupCount(
      this.repo!.createQueryBuilder('e').where('e.tenant_id = :tenantId', { tenantId }).andWhere('e.deleted_at IS NULL'),
      'e',
      'status',
    );
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming7Days = await this.repo!
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.deleted_at IS NULL')
      .andWhere('e.starts_at >= :now AND e.starts_at <= :inSevenDays', { now, inSevenDays })
      .getCount();
    return { ...byStatus, upcoming7Days };
  }

  async findById(tenantId: string, id: string): Promise<EventEntity> {
    const result = await this.repo!
      .createQueryBuilder('e')
      .where('e.id = :id AND e.tenant_id = :tenantId AND e.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Evento não encontrado');
    return result;
  }

  /**
   * Maps CreateEventDto / UpdateEventDto → EventEntity columns.
   * The DTO uses title/type/startsAt/venue/artistId; the table uses title/type/data+starts_at/venue/artist_id.
   */
  private dtoToEntity(dto: Partial<CreateEventDto & UpdateEventDto>): Partial<EventEntity> {
    const d = applyDeprecatedFieldAliases(dto as Record<string, unknown>, EVENT_DEPRECATED_FIELDS);
    const out: Record<string, unknown> = {};
    if (d['title']     != null) out['title']     = d['title'];
    if (d['type']      != null) out['type']       = d['type'];
    if (d['artistId']  != null) out['artist_id'] = d['artistId'];
    if (d['venue']     != null) out['venue']      = d['venue'];
    if (d['startsAt']  != null) {
      // C3 — dual-write: the SAME Date object feeds the canonical `starts_at`
      // (read everywhere since E4) and the legacy `data` column (removed in E6).
      const startValue = new Date(d['startsAt'] as string | Date);
      out['data']      = startValue;
      out['starts_at'] = startValue;
    }
    if (d['endsAt']    != null) out['end_date']   = new Date(d['endsAt'] as string | Date);
    if (d['status']    != null) out['status']     = d['status'];
    if (d['metadata']  != null) out['metadata']   = d['metadata'];
    // Form fields (2026-07-12 rule: own column, no metadata)
    if (d['address']             != null) out['address']             = d['address'];
    if (d['venue_contact']       != null) out['venue_contact']       = d['venue_contact'];
    if (d['fee_amount']       != null) out['fee_amount']       = String(d['fee_amount']);
    if (d['expected_attendance'] != null) out['expected_attendance'] = d['expected_attendance'];
    if (d['description']      != null) out['description']      = d['description'];
    if (d['notes']            != null) out['notes']             = d['notes'];
    if (d['participants']        != null) out['participants']        = d['participants'];
    return out as Partial<EventEntity>;
  }

  async create(tenantId: string, userId: string, dto: CreateEventDto): Promise<EventEntity> {
    const mapped = this.dtoToEntity(dto);
    // find-50dd3726: artist_id had no cross-tenant ownership check — an
    // event could silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', mapped.artist_id, tenantId, 'Artista');
    if (!mapped.data) {
      // NOT NULL column — uses "now" as a safe fallback when startsAt was not sent.
      // C3/E2 — dual-write: the same instant feeds `data` and `starts_at`
      // (a single new Date() call; two calls could diverge by ms).
      const fallbackValue = new Date();
      mapped.data = fallbackValue;
      mapped.starts_at = fallbackValue;
    }
    const entity = this.repo!.create({
      tenant_id:  tenantId,
      ...mapped,
      created_by: userId,
      updated_by: userId,
    } as Partial<EventEntity>);
    const saved = await this.repo!.save(entity as EventEntity);
    await this.recordActivity(tenantId, userId, saved.id, 'created', `Evento "${saved.title}" criado`, {
      title: saved.title,
      type: saved.type,
      artistId: saved.artist_id,
      startsAt: saved.starts_at,
    });
    return saved;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateEventDto): Promise<EventEntity> {
    await this.findById(tenantId, id);
    const mapped = this.dtoToEntity(dto);
    // find-50dd3726: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (mapped.artist_id !== undefined) {
      await assertSameTenantFk(this.ds!, 'artists', mapped.artist_id, tenantId, 'Artista');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      { ...mapped, updated_at: new Date(), updated_by: userId } as any,
      (dto as UpdateEventDto & { expectedUpdatedAt?: string }).expectedUpdatedAt,
      'Este evento foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }

  private async recordActivity(
    tenantId: string,
    userId: string,
    entityId: string,
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ) {
    if (!this.activityLogs) return;
    try {
      await this.activityLogs.create(tenantId, userId || 'system', {
        entity_type: 'event',
        entity_id:   entityId,
        action,
        description,
        metadata,
      });
    } catch {
      // Activity feed failures are detected by runtime validation but must not corrupt CRUD persistence.
    }
  }
}
