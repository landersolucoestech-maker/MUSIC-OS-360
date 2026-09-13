import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { EventEntity } from '../../database/entities';
import type { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto/events.dto';
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
    if (q['dateFrom'])   qb.andWhere('e.data >= :dateFrom',      { dateFrom:   q['dateFrom'] });
    if (q['dateTo'])     qb.andWhere('e.data <= :dateTo',        { dateTo:     q['dateTo'] });
    if (q['search'])     qb.andWhere('e.title ILIKE :search',   { search: `%${q['search']}%` });

    return qb;
  }

  async list(tenantId: string, query: QueryEventDto) {
    const q = query as Record<string, unknown>;
    const qb = this.baseQb(tenantId, query);

    qb.orderBy('e.data', q['ascending'] ? 'ASC' : 'DESC')
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
   * KPIs do tenant inteiro (nunca calculados só sobre o período do calendário
   * visível): contagem exata por status + "próximos 7 dias" (janela móvel,
   * não é um GROUP BY — query separada e simples).
   */
  async stats(tenantId: string): Promise<GroupStatsResult & { upcoming7Days: number }> {
    const byStatus = await groupCount(
      this.repo!.createQueryBuilder('e').where('e.tenant_id = :tenantId', { tenantId }).andWhere('e.deleted_at IS NULL'),
      'e',
      'status',
    );
    const now = new Date();
    const em7Dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming7Days = await this.repo!
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.deleted_at IS NULL')
      .andWhere('e.data >= :now AND e.data <= :em7Dias', { now, em7Dias })
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
   * Maps CreateEventDto / UpdateEventDto (camelCase EN) → EventEntity columns (snake_case PT).
   * Backend DTO usa title/type/startsAt/venue/artistId; tabela usa title/type/data/local/artist_id.
   */
  private dtoToEntity(dto: Partial<CreateEventDto & UpdateEventDto>): Partial<EventEntity> {
    const d = dto as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (d['title']     != null) out['title']     = d['title'];
    if (d['type']      != null) out['type']       = d['type'];
    if (d['artistId']  != null) out['artist_id'] = d['artistId'];
    if (d['venue']     != null) out['local']      = d['venue'];
    if (d['startsAt']  != null) {
      // C3/E2 — dual-write: o MESMO objeto Date alimenta a coluna legada `data`
      // e a canônica futura `starts_at` (zero janela de divergência; leitura
      // canônica só na fase E4, remoção de `data` só na E6).
      const startValue = new Date(d['startsAt'] as string | Date);
      out['data']      = startValue;
      out['starts_at'] = startValue;
    }
    if (d['endsAt']    != null) out['end_date']   = new Date(d['endsAt'] as string | Date);
    if (d['status']    != null) out['status']     = d['status'];
    if (d['metadata']  != null) out['metadata']   = d['metadata'];
    // Campos do formulário (regra 2026-07-12: coluna própria, sem metadata)
    if (d['endereco']         != null) out['endereco']         = d['endereco'];
    if (d['contato_local']    != null) out['contato_local']    = d['contato_local'];
    if (d['valor_cache']      != null) out['valor_cache']      = String(d['valor_cache']);
    if (d['publico_esperado'] != null) out['publico_esperado'] = d['publico_esperado'];
    if (d['descricao']        != null) out['descricao']        = d['descricao'];
    if (d['observacoes']      != null) out['observacoes']      = d['observacoes'];
    if (d['participantes']    != null) out['participantes']    = d['participantes'];
    return out as Partial<EventEntity>;
  }

  async create(tenantId: string, userId: string, dto: CreateEventDto): Promise<EventEntity> {
    const mapped = this.dtoToEntity(dto);
    // find-50dd3726: artist_id had no cross-tenant ownership check — an
    // event could silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', mapped.artist_id, tenantId, 'Artista');
    if (!mapped.data) {
      // Coluna NOT NULL — usa "agora" como fallback seguro se startsAt não veio.
      // C3/E2 — dual-write: o mesmo instante alimenta `data` e `starts_at`
      // (uma única chamada a new Date(); duas chamadas poderiam divergir em ms).
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
      data: saved.data,
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
