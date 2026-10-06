import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { assertPercentagesValid } from '../../common/percentage-validation';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkEntity, WorkParticipantEntity } from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { groupCount, GroupStatsResult } from '../../common/stats/group-count.util';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';
import { normalizeIsrc, normalizeIswc, isValidIswc, isValidIsrc } from '../registry/validators/registry-validators';
import { deriveWorkRegistryFields, type WorkRegistrySourceFields } from './work-registry-fields.util';
import { canonicalWorkParticipantRole, canonicalizeWorkInput, canonicalizeWorkQuery } from './work-legacy-fields';
/** The canonical participant roles of a Work: composer/author and publisher. */
const WORK_PARTICIPANT_ROLES_CLOSED = ['composer_author', 'publisher'] as const;

import type { CreateWorkDto }  from './dto/create-work.dto';
import type { UpdateWorkDto }  from './dto/update-work.dto';
import type { QueryWorkDto }   from './dto/query-work.dto';

export interface ParticipantResponse {
  id: string;
  name: string;
  role: string;
  link: string | null;
  percentage: string | null;
}

type WorkWithParticipants = WorkEntity & { participants: ParticipantResponse[] };

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
   * participants array on every work response (`participants`, CZ-039).
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
        role: row.role,
        link: row.link,
        percentage: row.percentage,
      });
      byWork.set(row.work_id, list);
    }

    return works.map((w) => Object.assign(w, { participants: byWork.get(w.id) ?? [] }));
  }

  /** Receives the repo explicitly (instead of always using this.participantsRepo)
   * so it can run inside the SAME transaction as the work's update/create —
   * see the comment in update(). */
  private async replaceParticipants(
    repo: Repository<WorkParticipantEntity>,
    tenantId: string,
    workId: string,
    participants: unknown[] | null | undefined,
  ): Promise<void> {
    // Absent or null leaves the stored participants untouched (null used to
    // reach `.map` and 500); an explicit [] clears them.
    if (participants == null) return;
    await repo.delete({ work_id: workId, tenant_id: tenantId });
    const rows = (participants as Array<Record<string, unknown>>).map((p, index) =>
      repo.create({
        id: (typeof p.id === 'string' && p.id) || randomUUID(),
        tenant_id: tenantId,
        work_id: workId,
        name: String(p.name ?? ''),
        role: canonicalWorkParticipantRole(p.role),
        link: (p.link as string) || null,
        percentage: p.percentage != null && p.percentage !== '' ? String(p.percentage) : null,
        sort_order: index,
      }),
    );
    if (rows.length > 0) await repo.save(rows);
  }

  /** Base QueryBuilder (tenant + not-deleted + filters) shared by list() and stats(). */
  private baseQb(tenantId: string, query: QueryWorkDto) {
    const q = canonicalizeWorkQuery(query as Record<string, unknown>);
    const qb = this.repo!
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.deleted_at IS NULL');

    if (q['status'])     qb.andWhere('w.status = :status', { status: q['status'] });
    if (q['work_origin']) qb.andWhere('w.work_origin = :workOrigin', { workOrigin: q['work_origin'] });
    if (q['music_genre']) qb.andWhere('LOWER(w.music_genre) = LOWER(:musicGenre)', { musicGenre: q['music_genre'] });
    if (q['project_id']) {
      if (q['project_id'] === 'none') qb.andWhere('w.project_id IS NULL');
      else qb.andWhere('w.project_id = :projectId', { projectId: q['project_id'] });
    }
    if (q['ecad'] === 'with_code')         qb.andWhere("w.ecad_code IS NOT NULL AND w.ecad_code <> ''");
    else if (q['ecad'] === 'without_code') qb.andWhere("(w.ecad_code IS NULL OR w.ecad_code = '')");
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

  /**
   * The ISWC belongs to the Work. Same convention as the ISRC above: validated and stored in its canonical
   * form on every write path, never invented, optional at creation.
   */
  private normalizeIswcField(rest: { iswc?: string }): void {
    if (typeof rest.iswc !== 'string') return;
    if (rest.iswc.trim() === '') {
      // Blank means "not informed": one representation (null, the column's absence), never whitespace stored as an identifier.
      (rest as { iswc?: string | null }).iswc = null;
      return;
    }
    const canonicalIswc = normalizeIswc(rest.iswc);
    if (!isValidIswc(canonicalIswc)) {
      throw new BadRequestException({
        code: 'WORK_ISWC_INVALID',
        message: 'ISWC inválido. Formato esperado: T-DDD.DDD.DDD-C (T mais 10 dígitos, separadores opcionais).',
        field: 'iswc',
      });
    }
    rest.iswc = canonicalIswc;
  }

  /**
   * A Work has exactly two kinds of participant: composer/author and publisher. 'unspecified' only means no role was
   * chosen yet. A role already stored on this work (a legacy administrator or translator) may be re-posted unchanged,
   * so an edit form that sends back what it loaded keeps working; a new value outside the list is rejected.
   */
  private assertParticipantRoles(participants: unknown[] | null | undefined, storedRoles: readonly string[] = []): void {
    if (!Array.isArray(participants)) return;
    const accepted = new Set<string>([...WORK_PARTICIPANT_ROLES_CLOSED, 'unspecified', ...storedRoles]);
    const invalid = [...new Set(participants
      .map((p) => canonicalWorkParticipantRole((p as Record<string, unknown> | null)?.role))
      .filter((role) => !accepted.has(role)))];
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'WORK_PARTICIPANT_ROLE_INVALID',
        message: 'Papel de participante inválido. A obra aceita somente: compositor/autor e editora.',
        allowed: [...WORK_PARTICIPANT_ROLES_CLOSED],
        invalid,
      });
    }
  }

  /** Work percentages are decimal(6,3): at most 3 decimals, each 0..100, never above 100% in total. */
  private assertParticipantPercentages(participants: unknown[] | null | undefined): void {
    if (!Array.isArray(participants)) return;
    assertPercentagesValid(
      participants.map((p) => (p as Record<string, unknown> | null)?.percentage),
      { maxDecimals: 3, scope: 'participantes da obra' },
    );
  }

  async create(tenantId: string, userId: string, input: CreateWorkDto): Promise<WorkWithParticipants> {
    const dto = canonicalizeWorkInput(input);
    // works.type is NOT NULL. find-tipo-obra-type-collision: the real form
    // never sends `type` -- only `work_origin` ('original'|'reference', the
    // record's origin in the catalog, see WorkTypeSelectorModal.tsx), a
    // distinct concept from the musical classification that ABRAMUS/ECAD
    // registration reads from `type`. `type` only takes its default when the
    // caller does not send it.
    const type = dto.type ?? 'composition';
    const { participants, ...rest } = dto as CreateWorkDto & { participants?: unknown[] };
    // find-f81eebf2: artist_id had no FK (DB or app-layer) — a work could
    // silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);
    this.normalizeIswcField(rest);
    this.assertParticipantPercentages(participants);
    this.assertParticipantRoles(participants);
    // duration_seconds and ai_tools/ai_prompts are derived from the fields the
    // form captures (duration_text, ai_harmony/ai_melody/ai_lyrics) so the
    // ABRAMUS/ECAD payload (society-payload-builder buildWorkPayload) gets them.
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

  async update(tenantId: string, userId: string, id: string, input: UpdateWorkDto): Promise<WorkWithParticipants> {
    const current = await this.findById(tenantId, id);
    const { participants, expectedUpdatedAt, ...rest } = canonicalizeWorkInput(input, { update: true }) as UpdateWorkDto & { participants?: unknown[] };
    // find-f81eebf2: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (rest.artist_id !== undefined) await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);
    this.normalizeIswcField(rest);
    this.assertParticipantPercentages(participants);
    this.assertParticipantRoles(participants, (current.participants ?? []).map((p) => String(p.role)));
    // Merge the patch over the CURRENT row before deriving: a partial update
    // that only touches e.g. `ai_melody` must still derive ai_tools/ai_prompts
    // from the unchanged sibling fields, not from `undefined`.
    const mergedForRegistry: WorkRegistrySourceFields = {
      duration_text: rest.duration_text !== undefined ? rest.duration_text : current.duration_text,
      ai_harmony: rest.ai_harmony !== undefined ? rest.ai_harmony : (current.ai_harmony as WorkRegistrySourceFields['ai_harmony']),
      ai_melody: rest.ai_melody !== undefined ? rest.ai_melody : (current.ai_melody as WorkRegistrySourceFields['ai_melody']),
      ai_lyrics: rest.ai_lyrics !== undefined ? rest.ai_lyrics : (current.ai_lyrics as WorkRegistrySourceFields['ai_lyrics']),
    };
    const registryFields = deriveWorkRegistryFields(mergedForRegistry);

    // Task L: casUpdate() and replaceParticipants() ran as two independent
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
