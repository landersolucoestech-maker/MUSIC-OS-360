import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkEntity, WorkParticipantEntity } from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { groupCount, GroupStatsResult } from '../../common/stats/group-count.util';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { normalizeIsrc, isValidIsrc } from '../registry/validators/registry-validators';
import { deriveWorkRegistryFields, type WorkRegistrySourceFields } from './work-registry-fields.util';
import type { CreateWorkDto }  from './dto/create-work.dto';
import type { UpdateWorkDto }  from './dto/update-work.dto';
import type { QueryWorkDto }   from './dto/query-work.dto';

export interface ParticipantResponse {
  id: string;
  name: string;
  classeFuncao: string;
  link: string | null;
  percentual: string | null;
}

type WorkWithParticipants = WorkEntity & { participantes: ParticipantResponse[] };

@Injectable()
export class WorksService {
  private readonly ds: DataSource | null = null;
  private readonly repo: Repository<WorkEntity> | null = null;
  private readonly participantsRepo: Repository<WorkParticipantEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.ds = ds;
      this.repo = ds.getRepository(WorkEntity);
      this.participantsRepo = ds.getRepository(WorkParticipantEntity);
    }
  }

  /**
   * `works.participantes` was normalized into `work_participants`
   * (migration WorkParticipantsNormalization20260718000011). Rehydrates the
   * array into the SAME format the frontend always consumed, so the
   * API contract does not change.
   */
  private async hydrateParticipants(works: WorkEntity[]): Promise<WorkWithParticipants[]> {
    if (works.length === 0) return [];
    const ids = works.map((w) => w.id);
    const rows = await this.participantsRepo!
      .createQueryBuilder('p')
      .where('p.work_id IN (:...ids)', { ids })
      .orderBy('p.sort_order', 'ASC')
      .getMany();

    const byWork = new Map<string, ParticipantResponse[]>();
    for (const row of rows) {
      const list = byWork.get(row.work_id) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        classeFuncao: row.classe_funcao,
        link: row.link,
        percentual: row.percentual,
      });
      byWork.set(row.work_id, list);
    }

    return works.map((w) => Object.assign(w, { participantes: byWork.get(w.id) ?? [] }));
  }

  /** Receives the repo explicitly (instead of always using this.participantsRepo)
   * so it can run inside the SAME transaction as the work's update/create —
   * see the comment in update(). */
  private async replaceParticipants(
    repo: Repository<WorkParticipantEntity>,
    tenantId: string,
    workId: string,
    participants: unknown[] | undefined,
  ): Promise<void> {
    if (participants === undefined) return;
    await repo.delete({ work_id: workId, tenant_id: tenantId });
    const rows = (participants as Array<Record<string, unknown>>).map((p, index) =>
      repo.create({
        id: (typeof p.id === 'string' && p.id) || randomUUID(),
        tenant_id: tenantId,
        work_id: workId,
        name: String(p.name ?? ''),
        classe_funcao: String(p.classeFuncao ?? 'não_informado'),
        link: (p.link as string) || null,
        percentual: p.percentual != null && p.percentual !== '' ? String(p.percentual) : null,
        sort_order: index,
      }),
    );
    if (rows.length > 0) await repo.save(rows);
  }

  /** Base QueryBuilder (tenant + not-deleted + filters) shared by list() and stats(). */
  private baseQb(tenantId: string, query: QueryWorkDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.deleted_at IS NULL');

    if (q['status'])     qb.andWhere('w.status = :status', { status: q['status'] });
    if (q['tipo_obra'])  qb.andWhere('w.tipo_obra = :tipoObra', { tipoObra: q['tipo_obra'] });
    if (q['music_genre']) qb.andWhere('LOWER(w.music_genre) = LOWER(:musicGenre)', { musicGenre: q['music_genre'] });
    if (q['project_id']) {
      if (q['project_id'] === 'no-projeto') qb.andWhere('w.project_id IS NULL');
      else qb.andWhere('w.project_id = :projectId', { projectId: q['project_id'] });
    }
    if (q['ecad'] === 'com-ecad')      qb.andWhere("w.cod_ecad IS NOT NULL AND w.cod_ecad <> ''");
    else if (q['ecad'] === 'sem-ecad') qb.andWhere("(w.cod_ecad IS NULL OR w.cod_ecad = '')");
    if (q['search']) qb.andWhere('w.title ILIKE :search', { search: `%${q['search']}%` });
    const artistId = q['artist_id'] ?? q['artistId'];
    if (artistId) qb.andWhere('w.artist_id = :artistId', { artistId });

    return qb;
  }

  async list(tenantId: string, query: QueryWorkDto) {
    const qb = this.baseQb(tenantId, query);

    qb.orderBy('w.created_at', (query as any).ascending ? 'ASC' : 'DESC')
      .skip((query as any).offset ?? 0)
      .take((query as any).limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    const hydrated = await this.hydrateParticipants(data);
    return { data: hydrated, meta: { total, offset: (query as any).offset ?? 0, limit: (query as any).limit ?? 50 } };
  }

  /** Exact count per status, whole tenant — never only the loaded page. */
  async stats(tenantId: string, query: QueryWorkDto): Promise<GroupStatsResult> {
    return groupCount(this.baseQb(tenantId, query), 'w', 'status');
  }

  /** The tenant's distinct genres — used in the filter (the dropdown cannot be stuck on the first 50 records). */
  async distinctMusicGenres(tenantId: string): Promise<string[]> {
    const rows = await this.repo!
      .createQueryBuilder('w')
      .select('DISTINCT w.music_genre', 'musicGenre')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.deleted_at IS NULL')
      .andWhere('w.music_genre IS NOT NULL')
      .orderBy('w.music_genre', 'ASC')
      .getRawMany<{ musicGenre: string }>();
    return rows.map((r) => r.musicGenre);
  }

  async findById(tenantId: string, id: string): Promise<WorkWithParticipants> {
    const result = await this.repo!
      .createQueryBuilder('w')
      .where('w.id = :id AND w.tenant_id = :tenantId AND w.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Obra não encontrada');
    const [hydrated] = await this.hydrateParticipants([result]);
    return hydrated;
  }

  /**
   * find-1e77a856: ISRC had zero format validation/normalization on this
   * write path (only the registry-submission flow validated it) — the same
   * real ISRC could be persisted in different textual forms depending on
   * entry path. Mutates `rest.isrc` in place to its canonical form.
   */
  private normalizeIsrcField(rest: { isrc?: string }): void {
    if (typeof rest.isrc !== 'string' || rest.isrc.trim() === '') return;
    const canonicalIsrc = normalizeIsrc(rest.isrc);
    if (!isValidIsrc(canonicalIsrc)) {
      throw new BadRequestException({
        code: 'WORK_ISRC_INVALID',
        message: 'ISRC inválido. Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).',
        field: 'isrc',
      });
    }
    rest.isrc = canonicalIsrc;
  }

  async create(tenantId: string, userId: string, dto: CreateWorkDto): Promise<WorkWithParticipants> {
    // works.type is NOT NULL. find-tipo-obra-type-collision: the real form
    // (formToObraPayload) NEVER sends `type` -- only `tipo_obra` ('autoral'|
    // 'referencia', the record's origin in the catalog, see
    // ObraTipoSelectorModal.tsx). The `?? dto.tipo_obra` fallback that existed
    // here therefore ALWAYS fired in real use, writing 'autoral'/
    // 'referencia' into the column that ABRAMUS/ECAD registration reads as the
    // work's musical classification (e.g. 'composicao') -- two distinct
    // concepts silently conflated in 100% of the works created
    // through the real UI. `tipo_obra` remains its own column, untouched;
    // `type` now only uses the real default when the caller does not send it.
    const type = dto.type ?? 'composicao';
    const { participantes: participants, ...rest } = dto as CreateWorkDto & { participantes?: unknown[] };
    // find-f81eebf2: artist_id had no FK (DB or app-layer) — a work could
    // silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);
    // find-registry-null-fields: the PT form fields (idioma/instrumental/
    // criada_por_ia/duration_text/outros_titulos/ia_*) are the only ones the
    // real form writes -- the English Registry Fields
    // (language/is_instrumental/duration_seconds/ai_used/ai_tools/ai_prompts/
    // alternative_titles) that society-payload-builder.service.ts's
    // buildWorkPayload() actually reads were never derived, so every
    // ABRAMUS/ECAD work submission shipped them null. Derived here on every
    // create so both sides finally agree.
    const registryFields = deriveWorkRegistryFields(rest as WorkRegistrySourceFields);

    // Work + participants in the same transaction: if writing the participants
    // fails, the work creation also rolls back — there is never an "orphan" work
    // without the participants the form sent along with it.
    const saved = await this.ds!.transaction(async (em) => {
      const workRepo = em.getRepository(WorkEntity);
      const participantsRepo = em.getRepository(WorkParticipantEntity);
      const entity = workRepo.create({
        tenant_id: tenantId,
        ...(rest as any),
        ...registryFields,
        type,
        created_by: userId,
        updated_by: userId,
      });
      const savedWork = (await workRepo.save(entity as any)) as WorkEntity;
      await this.replaceParticipants(participantsRepo, tenantId, savedWork.id, participants);
      return savedWork;
    });

    // Triggers internal native automations (e.g. catalog-metadata-validator). The
    // handlers are asynchronous and failure-proof — they never revert the work creation.
    this.events.emitTyped(DOMAIN_EVENTS.CATALOG_WORK_CREATED, {
      tenantId,
      userId,
      aggregateType: 'work',
      aggregateId:   saved.id,
      payload: { tenantId, workId: saved.id, createdBy: userId },
    });

    return this.findById(tenantId, saved.id);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateWorkDto): Promise<WorkWithParticipants> {
    const current = await this.findById(tenantId, id);
    const { participantes: participants, expectedUpdatedAt, ...rest } = dto as UpdateWorkDto & { participantes?: unknown[] };
    // find-f81eebf2: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (rest.artist_id !== undefined) await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);
    // find-registry-null-fields: merge the patch's PT fields over the
    // CURRENT row's PT fields before deriving the English Registry Fields —
    // a partial update that only touches e.g. `idioma` must still derive
    // correct ai_tools/ai_prompts/etc. from the unchanged sibling fields,
    // not from `undefined`. See create()'s identical derivation above.
    const mergedForRegistry: WorkRegistrySourceFields = {
      idioma: rest.idioma !== undefined ? rest.idioma : current.idioma,
      instrumental: rest.instrumental !== undefined ? rest.instrumental : current.instrumental,
      criada_por_ia: rest.criada_por_ia !== undefined ? rest.criada_por_ia : current.criada_por_ia,
      duration_text: rest.duration_text !== undefined ? rest.duration_text : current.duration_text,
      outros_titulos: rest.outros_titulos !== undefined ? rest.outros_titulos : current.outros_titulos,
      letra_completa: rest.letra_completa !== undefined ? rest.letra_completa : current.letra_completa,
      ia_harmonia: rest.ia_harmonia !== undefined ? rest.ia_harmonia : (current.ia_harmonia as WorkRegistrySourceFields['ia_harmonia']),
      ia_melodia: rest.ia_melodia !== undefined ? rest.ia_melodia : (current.ia_melodia as WorkRegistrySourceFields['ia_melodia']),
      ia_letra: rest.ia_letra !== undefined ? rest.ia_letra : (current.ia_letra as WorkRegistrySourceFields['ia_letra']),
    };
    const registryFields = deriveWorkRegistryFields(mergedForRegistry);

    // Task L: casUpdate() and replaceParticipantes() ran as two independent
    // operations — if writing the participants failed after the
    // casUpdate had already applied, the work kept its main fields
    // updated but the old (or partially deleted) participants,
    // an inconsistent state. Now both run in the same transaction: any
    // failure (including the CAS 409) rolls both back equally.
    await this.ds!.transaction(async (em) => {
      const workRepo = em.getRepository(WorkEntity);
      const participantsRepo = em.getRepository(WorkParticipantEntity);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await casUpdate(
        workRepo,
        { id, tenant_id: tenantId } as any,
        { ...(rest as any), ...registryFields, updated_at: new Date(), updated_by: userId } as any,
        expectedUpdatedAt,
        'Esta obra foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
      );
      await this.replaceParticipants(participantsRepo, tenantId, id, participants);
    });
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo!.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }
}
