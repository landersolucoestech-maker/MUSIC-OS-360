import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ShareEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { assertSplitBudgetNotExceeded } from './share-split-invariant.util';
import { isRegistryEligibleShare, REGISTRY_ELIGIBLE_SHARE_SQL } from './share-eligibility.util';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { SHARE_DEPRECATED_FIELDS, SHARE_NULLABLE_ALIAS_KEYS, SHARE_QUERY_DEPRECATED_FIELDS, canonicalizeShareHistory, canonicalizeShareValues } from './share-legacy-fields';
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
    const q = canonicalizeShareValues(applyDeprecatedFieldAliases(query as Record<string, unknown>, SHARE_QUERY_DEPRECATED_FIELDS));
    const qb = this.repo!
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL');

    if (q['work_id'])      qb.andWhere('s.work_id = :workId',           { workId:      q['work_id'] });
    if (q['phonogram_id']) qb.andWhere('s.phonogram_id = :phonogramId', { phonogramId: q['phonogram_id'] });
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

  /** Exact direction×status distribution (whole tenant) — the 4 KPI buckets come from here. */
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
   * Form keys persist 1:1 into their columns (2026-07-12 rule).
   * Deprecated EN aliases (holderName/role/workId/trackId/holderDoc) are
   * mapped to the canonical column names (SHARE_DEPRECATED_FIELDS); the NOT NULL ones (holder_name, percentage)
   * are mirrored from the form fields. `percentage` stopped
   * being an alias on 2026-09-13 (RenameSharePartyFieldsToEnglish): the form
   * field is already called `percentage` (it was `percentual`), so the old
   * alias and the direct field converged on the same name — nothing to map.
   */
  private toColumns(dto: CreateShareDto | UpdateShareDto): Record<string, unknown> {
    // Explicit null on a deprecated registry alias clears the canonical column
    // (existing behavior); the shared mechanism would otherwise drop it as "empty".
    const input: Record<string, unknown> = { ...(dto as Record<string, unknown>) };
    for (const alias of SHARE_NULLABLE_ALIAS_KEYS) {
      const canonical = SHARE_DEPRECATED_FIELDS[alias];
      if (input[alias] === null && input[canonical] === undefined) input[canonical] = null;
    }
    // CZ-037: deprecated field names (PT and EN) and values → canonical. The
    // canonical key wins when both are sent; deprecated keys never persist.
    const d = canonicalizeShareValues(applyDeprecatedFieldAliases(input, SHARE_DEPRECATED_FIELDS));
    const out: Record<string, unknown> = { ...d };
    if (out['history'] !== undefined) out['history'] = canonicalizeShareHistory(out['history']);
    delete out['expectedUpdatedAt'];
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
    tenantId: string, workId: string | null, phonogramId: string | null, excludeId?: string, manager?: EntityManager,
  ): Promise<number> {
    if (!workId && !phonogramId) return 0;
    const repo = manager ? manager.getRepository(ShareEntity) : this.repo!;
    const qb = repo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.percentage), 0)', 'sum')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere(REGISTRY_ELIGIBLE_SHARE_SQL);
    if (workId)      qb.andWhere('s.work_id = :workId', { workId });
    if (phonogramId) qb.andWhere('s.phonogram_id = :phonogramId', { phonogramId });
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
    // An absent share_type means a new row with the column default (NULL).
    const isEligible = isRegistryEligibleShare({ share_type: (cols['share_type'] as string | null | undefined) ?? null });
    if (!isEligible || cols['percentage'] == null) return;

    const workId      = (cols['work_id'] as string | undefined) ?? null;
    const phonogramId = (cols['phonogram_id'] as string | undefined) ?? null;
    if (!workId && !phonogramId) return;

    const percentage = Number(cols['percentage']);
    const existingSum = await this.sumEligiblePercentage(tenantId, workId, phonogramId, excludeId, manager);
    assertSplitBudgetNotExceeded(existingSum, percentage, workId ? `obra ${workId}` : `fonograma ${phonogramId}`);
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
    manager: EntityManager, tenantId: string, workId: string | null, phonogramId: string | null,
  ): Promise<void> {
    if (!workId && !phonogramId) return;
    const key = `share-split:${tenantId}:${workId ?? ''}:${phonogramId ?? ''}`;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
  }

  /** Cross-tenant FK ownership for the share's parent references (fail closed, same helper as siblings). */
  private async assertOwnedForeignKeys(tenantId: string, cols: Record<string, unknown>): Promise<void> {
    const fks: Array<[string, string, string]> = [
      ['work_id', 'works', 'Obra'],
      ['phonogram_id', 'phonograms', 'Fonograma'],
      ['artist_id', 'artists', 'Artista'],
      ['release_id', 'releases', 'Lançamento'],
    ];
    for (const [column, table, label] of fks) {
      if (cols[column] === undefined) continue;
      await assertSameTenantFk(this.ds!, table, cols[column] as string | null, tenantId, label);
    }
  }

  /**
   * Work splits, Phonogram splits and Release shares are independent structures that each total 100% in their own
   * context and never inherit from one another. A share therefore belongs to a work OR a phonogram: a row carrying
   * both would be counted in the split of each structure. A row stored with both before this rule stays editable;
   * only a write that introduces the pair is rejected.
   */
  private assertSingleStructure(
    effective: { work_id: string | null; phonogram_id: string | null },
    introducesPair: boolean,
  ): void {
    if (effective.work_id && effective.phonogram_id && introducesPair) {
      throw new BadRequestException({
        code: 'SHARE_STRUCTURE_AMBIGUOUS',
        message: 'Uma participação pertence a uma única estrutura: Obra ou Fonograma. Cadastre participações separadas para cada uma.',
        fields: ['work_id', 'phonogram_id'],
      });
    }
  }

  async create(tenantId: string, dto: CreateShareDto): Promise<ShareEntity> {
    // holder_name/percentage (ownership fields — used in the ABRAMUS/ECAD
    // submission) only receive a value when the caller sends holderName/
    // percentage explicitly. They are never derived from holder/
    // external_artist_name/payer/recipient (financial share fields — a
    // distinct concept, see Phase 5 / C6) nor filled with an artificial default.
    const cols = this.toColumns(dto);
    await this.assertOwnedForeignKeys(tenantId, cols);
    const workId      = (cols['work_id'] as string | undefined) ?? null;
    const phonogramId = (cols['phonogram_id'] as string | undefined) ?? null;
    this.assertSingleStructure({ work_id: workId, phonogram_id: phonogramId }, true);
    return this.ds!.transaction(async (manager) => {
      await this.lockSplitScope(manager, tenantId, workId, phonogramId);
      await this.assertSplitBudget(tenantId, cols, undefined, manager);
      const repo = manager.getRepository(ShareEntity);
      const entity = repo.create({ tenant_id: tenantId, ...cols } as any);
      return repo.save(entity as any) as any;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateShareDto): Promise<ShareEntity> {
    const cols = this.toColumns(dto);
    // Only FK fields present in the patch are validated (omitted = unchanged;
    // explicit null = clearing, nothing to own). Runs on the canonical columns,
    // i.e. after the legacy alias mapping, so aliases cannot bypass it.
    await this.assertOwnedForeignKeys(tenantId, cols);
    await this.ds!.transaction(async (manager) => {
      const repo = manager.getRepository(ShareEntity);
      const current = await repo
        .createQueryBuilder('s')
        .where('s.id = :id AND s.tenant_id = :tenantId AND s.deleted_at IS NULL', { id, tenantId })
        .getOne();
      if (!current) throw new NotFoundException('Participação não encontrada');

      const workId      = (cols['work_id']      !== undefined ? cols['work_id']      : current.work_id)      as string | null;
      const phonogramId = (cols['phonogram_id'] !== undefined ? cols['phonogram_id'] : current.phonogram_id) as string | null;
      this.assertSingleStructure(
        { work_id: workId, phonogram_id: phonogramId },
        (cols['work_id'] !== undefined && cols['work_id'] !== current.work_id)
          || (cols['phonogram_id'] !== undefined && cols['phonogram_id'] !== current.phonogram_id),
      );
      await this.lockSplitScope(manager, tenantId, workId, phonogramId);
      // Merge with the current row so an update that omits work_id/phonogram_id/
      // share_type (unchanged) still validates against the right scope.
      await this.assertSplitBudget(tenantId, {
        share_type:   cols['share_type']   !== undefined ? cols['share_type']   : current.share_type,
        work_id:      workId,
        phonogram_id: phonogramId,
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
