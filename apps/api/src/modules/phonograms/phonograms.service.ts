import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { PhonogramEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { resolvePhonogramDerivedFields } from '../../common/registry-fields/registry-fields.util';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { groupCount, GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreatePhonogramDto } from './dto/create-phonogram.dto';
import type { UpdatePhonogramDto } from './dto/update-phonogram.dto';
import type { QueryPhonogramDto }  from './dto/query-phonogram.dto';
import {
  resolvePhonogramAliases,
  resolvePhonogramQueryAliases,
  type ResolvedPhonogramWriteFields,
} from './phonogram-legacy-alias.util';
import { canonicalizePhonogramInput } from './phonogram-legacy-fields';
import { assertPercentagesValid } from '../../common/percentage-validation';

@Injectable()
export class PhonogramsService {
  private readonly logger = new Logger(PhonogramsService.name);
  private readonly repo: Repository<PhonogramEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(PhonogramEntity);
  }

  /** One warning per legacy alias actually received in this request. Never logs values. */
  private logLegacyAliasUsage(
    aliases: string[],
    operation: 'create' | 'update' | 'list',
    tenantId: string,
    phonogramId?: string,
  ): void {
    for (const alias of aliases) {
      const suffix = phonogramId ? ` phonogramId=${phonogramId}` : '';
      this.logger.warn(`Phonogram legacy alias used: alias=${alias} operation=${operation} tenantId=${tenantId}${suffix}`);
    }
  }

  /** Base QueryBuilder (tenant + not-deleted + filters) shared by list() and stats(). */
  private baseQb(tenantId: string, query: QueryPhonogramDto): { qb: SelectQueryBuilder<PhonogramEntity>; legacyAliasesUsed: string[] } {
    const q = query as unknown as Record<string, unknown>;
    const { normalized: resolvedQuery, legacyAliasesUsed } = resolvePhonogramQueryAliases(q);

    const qb = this.repo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');

    if (q['status'])    qb.andWhere('p.status = :status',       { status:    q['status'] });
    if (q['type'])      qb.andWhere('p.type = :type',           { type:      q['type'] });
    if (resolvedQuery.artist_id) qb.andWhere('p.artist_id = :artistId', { artistId: resolvedQuery.artist_id });
    if (resolvedQuery.work_id)    qb.andWhere('p.work_id = :workId',      { workId:    resolvedQuery.work_id });
    if (q['has_work'] === 'false') qb.andWhere('p.work_id IS NULL');
    else if (q['has_work'] === 'true') qb.andWhere('p.work_id IS NOT NULL');
    if (q['music_genre'] || q['genre']) {
      qb.andWhere('LOWER(p.music_genre) = LOWER(:genre)', { genre: q['music_genre'] ?? q['genre'] });
    }
    if (q['ecad'] === 'with_code')         qb.andWhere("p.ecad_code IS NOT NULL AND p.ecad_code <> ''");
    else if (q['ecad'] === 'without_code') qb.andWhere("(p.ecad_code IS NULL OR p.ecad_code = '')");
    if (q['search'])    qb.andWhere('p.title ILIKE :search',   { search: `%${q['search']}%` });

    return { qb, legacyAliasesUsed };
  }

  async list(tenantId: string, query: QueryPhonogramDto) {
    const q = query as Record<string, unknown>;
    const { qb, legacyAliasesUsed } = this.baseQb(tenantId, query);
    this.logLegacyAliasUsage(legacyAliasesUsed, 'list', tenantId);

    qb.orderBy('p.created_at', q['ascending'] ? 'ASC' : 'DESC')
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

  /** Exact count per status, whole tenant — never only the loaded page. */
  async stats(tenantId: string, query: QueryPhonogramDto): Promise<GroupStatsResult> {
    const { qb } = this.baseQb(tenantId, query);
    return groupCount(qb, 'p', 'status');
  }

  /** The tenant's distinct genres — used in the filter (the dropdown cannot be stuck on the first 50 records). */
  async distinctMusicGenres(tenantId: string): Promise<string[]> {
    const rows = await this.repo!
      .createQueryBuilder('p')
      .select('DISTINCT p.music_genre', 'musicGenre')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.music_genre IS NOT NULL')
      .orderBy('p.music_genre', 'ASC')
      .getRawMany<{ musicGenre: string }>();
    return rows.map((r) => r.musicGenre);
  }

  async findById(tenantId: string, id: string): Promise<PhonogramEntity> {
    const result = await this.repo!
      .createQueryBuilder('p')
      .where('p.id = :id AND p.tenant_id = :tenantId AND p.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Fonograma não encontrado');
    return result;
  }

  /**
   * Builds the final payload for persistence from the already resolved canonical
   * fields (title/work_id/artist_id — see resolvePhonogramAliases()) and
   * the other fields unrelated to aliases (the form's 21 physical
   * fields, duration/duration_text, metadata, status, ISRC etc.), which
   * keep passing straight through to the entity, unchanged.
   */
  private buildEntityPayload(
    input: Record<string, unknown>,
    resolved: ResolvedPhonogramWriteFields,
    current: PhonogramEntity | null = null,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...input, ...resolved };

    // duration (raw seconds, mapped to duration_seconds) is a distinct
    // concept from duration_text (formatted "MM:SS" string, plain
    // passthrough). recording_date / release_date / duration_seconds /
    // country_of_recording are written directly (CZ-040: the registry columns
    // read by society-payload-builder buildRecordingPayload are the single
    // source of truth; the legacy PT inputs are mapped onto them by
    // canonicalizePhonogramInput).
    out['duration_seconds'] = input['duration_seconds'] ?? input['duration'];
    // type: default only when explicitly absent on CREATE (see create());
    // in a PATCH without type, do not overwrite the persisted value.
    if (input['type'] !== undefined) out['type'] = input['type'];

    delete out['titulo'];
    delete out['workId'];
    delete out['artistId'];
    delete out['duration'];
    delete out['fileUrl'];

    // Authoritative/derived pairs (BLK-PHONOGRAMS-DERIVED-FIELDS): duration_seconds is authoritative and
    // duration_text is rewritten from it; the compact isrc is authoritative and the four isrc_* parts are
    // rewritten from it. A partial PATCH merges the isrc parts over `current`. ISRC format validation and
    // normalisation (find-1e77a856) live in the same shared resolver, so every write path applies one rule.
    const { values, issue } = resolvePhonogramDerivedFields(out, current as unknown as Record<string, unknown> | null);
    if (issue) {
      throw new BadRequestException({ code: issue.code, message: issue.message, field: issue.field });
    }
    Object.assign(out, values);

    // Removes null/undefined — preserves the current PATCH semantics (null does not
    // clear a column in this phase; see debt C2.4).
    Object.keys(out).forEach((key) => (out[key] === undefined || out[key] === null) && delete out[key]);
    return out;
  }

  /**
   * `participation` holds the Phonogram percentages (producers, performers, session musicians). They are an
   * independent structure from the Work percentages and the Release shares. Every informed value must be a
   * number from 0 to 100 and the running total cannot exceed 100%; the exact total is checked at registry
   * validation, once every participant is entered.
   */
  private assertParticipationPercentages(participation: unknown): void {
    if (participation == null || typeof participation !== 'object') return;
    const record = participation as Record<string, unknown>;
    const values: unknown[] = [];
    for (const category of ['phonographic_producers', 'performers', 'session_musicians']) {
      const list = record[category];
      if (!Array.isArray(list)) continue;
      for (const participant of list) values.push((participant as Record<string, unknown> | null)?.percentage);
    }
    assertPercentagesValid(values, { maxDecimals: 4, scope: 'participações do fonograma' });
  }

  async create(tenantId: string, userId: string, dto: CreatePhonogramDto): Promise<PhonogramEntity> {
    const input = canonicalizePhonogramInput(dto as unknown as Record<string, unknown>);
    this.assertParticipationPercentages(input['participation']);
    const { normalized: resolved, legacyAliasesUsed } = resolvePhonogramAliases(input);

    if (resolved.title === undefined) {
      throw new BadRequestException({
        code: 'PHONOGRAM_TITLE_REQUIRED',
        message: 'Título é obrigatório.',
        fields: [{ canonical: 'title', legacy: 'titulo' }],
      });
    }
    this.logLegacyAliasUsage(legacyAliasesUsed, 'create', tenantId);
    // find-f81eebf2: work_id/artist_id had no FK (DB or app-layer) — a
    // phonogram could silently reference another tenant's work/artist.
    await assertSameTenantFk(this.ds!, 'works',   resolved.work_id,   tenantId, 'Obra');
    await assertSameTenantFk(this.ds!, 'artists', resolved.artist_id, tenantId, 'Artista');

    const normalized = this.buildEntityPayload(input, resolved);
    const entity = this.repo!.create({
      tenant_id: tenantId,
      type: 'master',
      ...normalized,
      created_by: userId,
      updated_by: userId,
    } as Partial<PhonogramEntity>);
    const saved = (await this.repo!.save(entity as PhonogramEntity)) as PhonogramEntity;

    // Triggers internal native automations (e.g. catalog-metadata-validator). The
    // handlers are asynchronous and failure-proof — they never revert the phonogram creation.
    this.events.emitTyped(DOMAIN_EVENTS.CATALOG_RECORDING_CREATED, {
      tenantId,
      userId,
      aggregateType: 'recording',
      aggregateId:   saved.id,
      payload: { tenantId, recordingId: saved.id, createdBy: userId },
    });

    return saved;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdatePhonogramDto): Promise<PhonogramEntity> {
    const current = await this.findById(tenantId, id);
    const input = canonicalizePhonogramInput(dto as unknown as Record<string, unknown>, { update: true });
    this.assertParticipationPercentages(input['participation']);
    const { normalized: resolved, legacyAliasesUsed } = resolvePhonogramAliases(input);
    // update: an absent title is valid (partial PATCH); if sent,
    // resolvePhonogramAliases() itself already guaranteed valid content/conflict.
    this.logLegacyAliasUsage(legacyAliasesUsed, 'update', tenantId, id);
    // find-f81eebf2: only validate when the patch actually sets work_id/artist_id
    // — an omitted field means "unchanged", already validated at its own create time.
    if (resolved.work_id !== undefined)   await assertSameTenantFk(this.ds!, 'works',   resolved.work_id,   tenantId, 'Obra');
    if (resolved.artist_id !== undefined) await assertSameTenantFk(this.ds!, 'artists', resolved.artist_id, tenantId, 'Artista');

    const normalized = this.buildEntityPayload(input, resolved, current);
    delete normalized['expectedUpdatedAt'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      { ...normalized, updated_at: new Date(), updated_by: userId } as any,
      (input as { expectedUpdatedAt?: string }).expectedUpdatedAt,
      'Este fonograma foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
