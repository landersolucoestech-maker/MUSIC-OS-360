import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ShareEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { assertSplitBudgetNotExceeded } from './share-split-invariant.util';
import type { CreateShareDto, UpdateShareDto, QueryShareDto } from './dto/shares.dto';

@Injectable()
export class SharesService {
  private readonly repo: Repository<ShareEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(ShareEntity);
    this.ds = ds;
  }

  private baseQb(tenantId: string, query: QueryShareDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL');

    if (q['work_id'])      qb.andWhere('s.work_id = :workId',           { workId:      q['work_id'] });
    if (q['fonograma_id']) qb.andWhere('s.fonograma_id = :fonogramaId', { fonogramaId: q['fonograma_id'] });
    if (q['party_role'])   qb.andWhere('s.party_role = :partyRole',     { partyRole:   q['party_role'] });
    if (q['direction'])    qb.andWhere('s.direction = :direction',      { direction:   q['direction'] });
    if (q['status'])       qb.andWhere('s.status = :status',            { status:      q['status'] });
    if (q['type'])         qb.andWhere('s.type = :type',                { type:        q['type'] });
    if (q['share_type'])   qb.andWhere('s.share_type = :shareType',     { shareType:   q['share_type'] });
    if (q['search']) {
      qb.andWhere('(s.music_title ILIKE :search OR s.holder ILIKE :search)', { search: `%${q['search']}%` });
    }

    return qb;
  }

  async list(tenantId: string, query: QueryShareDto) {
    const q = query as Record<string, unknown>;
    const qb = this.baseQb(tenantId, query);

    qb.orderBy('s.created_at', q['ascending'] ? 'ASC' : 'DESC')
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

  /** Distribuição exata direção×status (tenant inteiro) — os 4 baldes de KPI vêm daqui. */
  async stats(tenantId: string, query: QueryShareDto): Promise<Array<{ direction: string | null; status: string; cnt: number }>> {
    const qb = this.baseQb(tenantId, query);
    qb.select('s.direction', 'direction')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(*)::int', 'cnt')
      .groupBy('s.direction')
      .addGroupBy('s.status');
    const rows = await qb.getRawMany<{ direction: string | null; status: string; cnt: string }>();
    return rows.map((r) => ({ direction: r.direction, status: r.status, cnt: parseInt(r.cnt, 10) || 0 }));
  }

  async findById(tenantId: string, id: string): Promise<ShareEntity> {
    const result = await this.repo!
      .createQueryBuilder('s')
      .where('s.id = :id AND s.tenant_id = :tenantId AND s.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Participação não encontrada');
    return result;
  }

  /**
   * Chaves do formulário persistem 1:1 nas suas colunas (regra 2026-07-12).
   * Aliases EN legados (holderName/role/workId/trackId/holderDoc) são
   * mapeados para as colunas físicas; as NOT NULL (holder_name, percentage)
   * são espelhadas a partir dos campos do formulário. `percentage` deixou de
   * ser um alias em 2026-09-13 (RenameSharePartyFieldsToEnglish): o campo do
   * formulário já se chama `percentage` (era `percentual`), então o antigo
   * alias e o campo direto convergiram no mesmo nome — sem mapeamento a fazer.
   */
  private toColumns(dto: CreateShareDto | UpdateShareDto): Record<string, unknown> {
    const d = dto as Record<string, unknown>;
    const out: Record<string, unknown> = { ...d };
    // Aliases EN → colunas legadas (nunca sobrescrevem campos do form)
    if (d['holderName'] !== undefined) out['holder_name']     = d['holderName'];
    if (d['holderDoc']  !== undefined) out['holder_document'] = d['holderDoc'];
    if (d['role']       !== undefined) out['party_role']      = d['role'];
    if (d['workId']     !== undefined) out['work_id']         = d['workId'];
    if (d['trackId']    !== undefined) out['fonograma_id']    = d['trackId'];
    for (const k of ['holderName', 'holderDoc', 'role', 'workId', 'trackId', 'expectedUpdatedAt']) delete out[k];
    Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  /**
   * Sum of registry-eligible (share_type IS NULL, non-deleted) shares'
   * percentage for the same work/phonogram — same eligibility predicate
   * WorkRegistryValidationService uses (REGISTRY_ELIGIBLE_SHARE_SQL), so
   * this never diverges from what the final "must equal 100%"
   * registry-submission check considers.
   */
  private async sumEligiblePercentage(
    tenantId: string, workId: string | null, fonogramaId: string | null, excludeId?: string, manager?: EntityManager,
  ): Promise<number> {
    if (!workId && !fonogramaId) return 0;
    const repo = manager ? manager.getRepository(ShareEntity) : this.repo!;
    const qb = repo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.percentage), 0)', 'sum')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.share_type IS NULL');
    if (workId)      qb.andWhere('s.work_id = :workId', { workId });
    if (fonogramaId) qb.andWhere('s.fonograma_id = :fonogramaId', { fonogramaId });
    if (excludeId)   qb.andWhere('s.id != :excludeId', { excludeId });
    const row = await qb.getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  /**
   * Only registry-eligible shares (share_type IS NULL) are gated — financial/
   * pending shares (share_type set) are a distinct concept (Fase 5 / C6) and
   * were never part of the "splits must not exceed 100%" invariant.
   */
  private async assertSplitBudget(
    tenantId: string, cols: Record<string, unknown>, excludeId?: string, manager?: EntityManager,
  ): Promise<void> {
    const isEligible = cols['share_type'] === undefined || cols['share_type'] === null;
    if (!isEligible || cols['percentage'] == null) return;

    const workId      = (cols['work_id'] as string | undefined) ?? null;
    const fonogramaId = (cols['fonograma_id'] as string | undefined) ?? null;
    if (!workId && !fonogramaId) return;

    const percentage = Number(cols['percentage']);
    const existingSum = await this.sumEligiblePercentage(tenantId, workId, fonogramaId, excludeId, manager);
    assertSplitBudgetNotExceeded(existingSum, percentage, workId ? `obra ${workId}` : `fonograma ${fonogramaId}`);
  }

  /**
   * find-a192e412: check-then-write (sumEligiblePercentual → INSERT/UPDATE)
   * was two separate statements with no lock — two concurrent requests for
   * the same work/phonogram could each read the same pre-write sum and both
   * commit, persisting >100% total. A Postgres transaction-scoped advisory
   * lock keyed by tenant+work/phonogram serializes the check+write for that
   * scope without a schema change (the cross-row sum can't be a CHECK
   * constraint — it needs sibling rows, see 20260905000002's own comment).
   * Auto-released on commit/rollback; a lock on one work/phonogram never
   * blocks writes to a different one.
   */
  private async lockSplitScope(
    manager: EntityManager, tenantId: string, workId: string | null, fonogramaId: string | null,
  ): Promise<void> {
    if (!workId && !fonogramaId) return;
    const key = `share-split:${tenantId}:${workId ?? ''}:${fonogramaId ?? ''}`;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
  }

  async create(tenantId: string, dto: CreateShareDto): Promise<ShareEntity> {
    // holder_name/percentage (campos de titularidade — usados na submissão
    // ABRAMUS/ECAD) só recebem valor quando o chamador envia holderName/
    // percentage explicitamente. Nunca são derivados de holder/
    // artista_externo/pagador/recipient (campos do share financeiro —
    // conceito distinto, ver Fase 5 / C6) nem preenchidos com default artificial.
    const cols = this.toColumns(dto);
    await assertSameTenantFk(this.ds!, 'works',      cols['work_id']      as string | undefined, tenantId, 'Obra');
    await assertSameTenantFk(this.ds!, 'phonograms', cols['fonograma_id'] as string | undefined, tenantId, 'Fonograma');
    const workId      = (cols['work_id'] as string | undefined) ?? null;
    const fonogramaId = (cols['fonograma_id'] as string | undefined) ?? null;
    return this.ds!.transaction(async (manager) => {
      await this.lockSplitScope(manager, tenantId, workId, fonogramaId);
      await this.assertSplitBudget(tenantId, cols, undefined, manager);
      const repo = manager.getRepository(ShareEntity);
      const entity = repo.create({ tenant_id: tenantId, ...cols } as any);
      return repo.save(entity as any) as any;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateShareDto): Promise<ShareEntity> {
    const cols = this.toColumns(dto);
    await this.ds!.transaction(async (manager) => {
      const repo = manager.getRepository(ShareEntity);
      const current = await repo
        .createQueryBuilder('s')
        .where('s.id = :id AND s.tenant_id = :tenantId AND s.deleted_at IS NULL', { id, tenantId })
        .getOne();
      if (!current) throw new NotFoundException('Participação não encontrada');

      const workId      = (cols['work_id']      !== undefined ? cols['work_id']      : current.work_id)      as string | null;
      const fonogramaId = (cols['fonograma_id'] !== undefined ? cols['fonograma_id'] : current.fonograma_id) as string | null;
      await this.lockSplitScope(manager, tenantId, workId, fonogramaId);
      // Merge with the current row so an update that omits work_id/fonograma_id/
      // share_type (unchanged) still validates against the right scope.
      await this.assertSplitBudget(tenantId, {
        share_type:   cols['share_type']   !== undefined ? cols['share_type']   : current.share_type,
        work_id:      workId,
        fonograma_id: fonogramaId,
        percentage:   cols['percentage']   !== undefined ? cols['percentage']   : current.percentage,
      }, id, manager);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await casUpdate(
        repo,
        { id, tenant_id: tenantId } as any,
        { ...cols, updated_at: new Date() } as any,
        dto.expectedUpdatedAt,
        'Esta participação (share) foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
      );
    });
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
