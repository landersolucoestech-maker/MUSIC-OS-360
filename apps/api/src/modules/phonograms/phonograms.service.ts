import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { PhonogramEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { normalizeIsrc, isValidIsrc } from '../registry/validators/registry-validators';
import { derivePhonogramRegistryFields, type PhonogramRegistrySourceFields } from './phonogram-registry-fields.util';
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
    const q = query as Record<string, unknown>;
    const { normalized: resolvedQuery, legacyAliasesUsed } = resolvePhonogramQueryAliases(q);

    const qb = this.repo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');

    if (q['status'])    qb.andWhere('p.status = :status',       { status:    q['status'] });
    if (q['type'])      qb.andWhere('p.type = :type',           { type:      q['type'] });
    if (resolvedQuery.artist_id) qb.andWhere('p.artist_id = :artistId', { artistId: resolvedQuery.artist_id });
    if (resolvedQuery.work_id)    qb.andWhere('p.work_id = :workId',      { workId:    resolvedQuery.work_id });
    if (q['obra_vinculada'] === 'sem-obra') qb.andWhere('p.work_id IS NULL');
    else if (q['obra_vinculada'] === 'com-obra') qb.andWhere('p.work_id IS NOT NULL');
    if (q['music_genre'] || q['genre']) {
      qb.andWhere('p.music_genre = :genre', { genre: q['music_genre'] ?? q['genre'] });
    }
    if (q['ecad'] === 'com-ecad')      qb.andWhere("p.cod_ecad IS NOT NULL AND p.cod_ecad <> ''");
    else if (q['ecad'] === 'sem-ecad') qb.andWhere("(p.cod_ecad IS NULL OR p.cod_ecad = '')");
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
    current?: PhonogramEntity,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...input, ...resolved };

    // duration (raw seconds, mapped to duration_seconds) is a distinct
    // concept from duration_text (formatted "MM:SS" string, plain
    // passthrough) — naming-normalization 20260918000003 resolved the
    // former collision between the two by disambiguating duracao ->
    // duration_text instead of duration.
    // find-registry-null-fields: explicit input['duration_seconds']/
    // ['duration'] still wins when a caller actually sends it (e.g. a
    // future registry-aware form or API client); otherwise it's derived
    // below from duracao_min/duracao_seg, the PT fields the real
    // FonogramaFormModal actually writes.
    out['duration_seconds'] = input['duration_seconds'] ?? input['duration'];
    // type: default only when explicitly absent on CREATE (see create());
    // in a PATCH without type, do not overwrite the persisted value.
    if (input['type'] !== undefined) out['type'] = input['type'];

    // find-registry-null-fields: gravacao_original/data_lancamento/
    // duracao_min+duracao_seg/pais_origem are the only fields the real form
    // writes -- the English Registry Fields (recording_date/release_date/
    // duration_seconds/country_of_recording) that society-payload-builder.
    // service.ts's buildRecordingPayload() actually reads were never
    // derived, so every ABRAMUS/ECAD recording submission shipped them
    // null. Merge the patch's PT fields over the current row's (so a
    // partial PATCH still derives correctly) before deriving.
    const mergedForRegistry: PhonogramRegistrySourceFields = {
      gravacao_original: 'gravacao_original' in out ? (out['gravacao_original'] as string | null) : current?.gravacao_original,
      data_lancamento: 'data_lancamento' in out ? (out['data_lancamento'] as string | null) : current?.data_lancamento,
      duracao_min: 'duracao_min' in out ? (out['duracao_min'] as number | null) : current?.duracao_min,
      duracao_seg: 'duracao_seg' in out ? (out['duracao_seg'] as number | null) : current?.duracao_seg,
      pais_origem: 'pais_origem' in out ? (out['pais_origem'] as string | null) : current?.pais_origem,
    };
    const registryFields = derivePhonogramRegistryFields(mergedForRegistry);
    // Only overwrite duration_seconds from this derivation when nothing
    // more explicit (input['duration_seconds']/['duration'], handled above)
    // already set it.
    if (out['duration_seconds'] === undefined) out['duration_seconds'] = registryFields.duration_seconds;
    if (out['recording_date'] === undefined) out['recording_date'] = registryFields.recording_date;
    if (out['release_date'] === undefined) out['release_date'] = registryFields.release_date;
    if (out['country_of_recording'] === undefined) out['country_of_recording'] = registryFields.country_of_recording;

    delete out['titulo'];
    delete out['workId'];
    delete out['artistId'];
    delete out['duration'];
    delete out['fileUrl'];

    // find-1e77a856: ISRC had zero format validation/normalization on this
    // write path (only the registry-submission flow validated it) — the same
    // real ISRC could be persisted in different textual forms depending on
    // entry path. Normalize to canonical uppercase/no-separator form and
    // reject malformed values before persist, same rule the registry
    // submission validator already enforces (registry-validators.ts).
    if (typeof out['isrc'] === 'string' && out['isrc'].trim() !== '') {
      const canonicalIsrc = normalizeIsrc(out['isrc']);
      if (!isValidIsrc(canonicalIsrc)) {
        throw new BadRequestException({
          code: 'PHONOGRAM_ISRC_INVALID',
          message: 'ISRC inválido. Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).',
          field: 'isrc',
        });
      }
      out['isrc'] = canonicalIsrc;
    }

    // Removes null/undefined — preserves the current PATCH semantics (null does not
    // clear a column in this phase; see debt C2.4).
    Object.keys(out).forEach((key) => (out[key] === undefined || out[key] === null) && delete out[key]);
    return out;
  }

  async create(tenantId: string, userId: string, dto: CreatePhonogramDto): Promise<PhonogramEntity> {
    const input = dto as unknown as Record<string, unknown>;
    const { normalized: resolved, legacyAliasesUsed } = resolvePhonogramAliases(input);

    if (resolved.title === undefined) {
      throw new BadRequestException({
        code: 'PHONOGRAM_TITLE_REQUIRED',
        message: 'title é obrigatório.',
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
    const input = dto as unknown as Record<string, unknown>;
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
