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
import type { CreateWorkDto }  from './dto/create-work.dto';
import type { UpdateWorkDto }  from './dto/update-work.dto';
import type { QueryWorkDto }   from './dto/query-work.dto';

export interface ParticipanteResponse {
  id: string;
  nome: string;
  classeFuncao: string;
  link: string | null;
  percentual: string | null;
}

type WorkWithParticipantes = WorkEntity & { participantes: ParticipanteResponse[] };

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
   * `works.participantes` foi normalizada em `work_participants`
   * (migration WorkParticipantsNormalization20260718000011). Reidrata o
   * array no MESMO formato que o frontend sempre consumiu, para que o
   * contrato de API não mude.
   */
  private async hydrateParticipantes(works: WorkEntity[]): Promise<WorkWithParticipantes[]> {
    if (works.length === 0) return [];
    const ids = works.map((w) => w.id);
    const rows = await this.participantsRepo!
      .createQueryBuilder('p')
      .where('p.work_id IN (:...ids)', { ids })
      .orderBy('p.sort_order', 'ASC')
      .getMany();

    const byWork = new Map<string, ParticipanteResponse[]>();
    for (const row of rows) {
      const list = byWork.get(row.work_id) ?? [];
      list.push({
        id: row.id,
        nome: row.nome,
        classeFuncao: row.classe_funcao,
        link: row.link,
        percentual: row.percentual,
      });
      byWork.set(row.work_id, list);
    }

    return works.map((w) => Object.assign(w, { participantes: byWork.get(w.id) ?? [] }));
  }

  /** Recebe o repo explicitamente (em vez de usar sempre this.participantsRepo)
   * para poder rodar dentro da MESMA transação do update/create da obra —
   * ver comentário em update(). */
  private async replaceParticipantes(
    repo: Repository<WorkParticipantEntity>,
    tenantId: string,
    workId: string,
    participantes: unknown[] | undefined,
  ): Promise<void> {
    if (participantes === undefined) return;
    await repo.delete({ work_id: workId, tenant_id: tenantId });
    const rows = (participantes as Array<Record<string, unknown>>).map((p, index) =>
      repo.create({
        id: (typeof p.id === 'string' && p.id) || randomUUID(),
        tenant_id: tenantId,
        work_id: workId,
        nome: String(p.nome ?? ''),
        classe_funcao: String(p.classeFuncao ?? 'não_informado'),
        link: (p.link as string) || null,
        percentual: p.percentual != null && p.percentual !== '' ? String(p.percentual) : null,
        sort_order: index,
      }),
    );
    if (rows.length > 0) await repo.save(rows);
  }

  /** QueryBuilder base (tenant + not-deleted + filtros) partilhado por list() e stats(). */
  private baseQb(tenantId: string, query: QueryWorkDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.deleted_at IS NULL');

    if (q['status'])     qb.andWhere('w.status = :status', { status: q['status'] });
    if (q['tipo_obra'])  qb.andWhere('w.tipo_obra = :tipoObra', { tipoObra: q['tipo_obra'] });
    if (q['genero'])     qb.andWhere('LOWER(w.genero) = LOWER(:genero)', { genero: q['genero'] });
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
    const hydrated = await this.hydrateParticipantes(data);
    return { data: hydrated, meta: { total, offset: (query as any).offset ?? 0, limit: (query as any).limit ?? 50 } };
  }

  /** Contagem exata por status, tenant inteiro — nunca só a página carregada. */
  async stats(tenantId: string, query: QueryWorkDto): Promise<GroupStatsResult> {
    return groupCount(this.baseQb(tenantId, query), 'w', 'status');
  }

  /** Gêneros distintos do tenant — usado no filtro (dropdown não pode ficar preso aos 50 primeiros registros). */
  async distinctGeneros(tenantId: string): Promise<string[]> {
    const rows = await this.repo!
      .createQueryBuilder('w')
      .select('DISTINCT w.genero', 'genero')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.deleted_at IS NULL')
      .andWhere('w.genero IS NOT NULL')
      .orderBy('w.genero', 'ASC')
      .getRawMany<{ genero: string }>();
    return rows.map((r) => r.genero);
  }

  async findById(tenantId: string, id: string): Promise<WorkWithParticipantes> {
    const result = await this.repo!
      .createQueryBuilder('w')
      .where('w.id = :id AND w.tenant_id = :tenantId AND w.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Obra não encontrada');
    const [hydrated] = await this.hydrateParticipantes([result]);
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

  async create(tenantId: string, userId: string, dto: CreateWorkDto): Promise<WorkWithParticipantes> {
    // works.type é NOT NULL; o formulário envia tipo_obra (campo próprio).
    const type = dto.type ?? dto.tipo_obra ?? 'composicao';
    const { participantes, ...rest } = dto as CreateWorkDto & { participantes?: unknown[] };
    // find-f81eebf2: artist_id had no FK (DB or app-layer) — a work could
    // silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);

    // Obra + participantes na mesma transação: se a gravação dos participantes
    // falhar, a criação da obra também reverte — nunca fica uma obra "órfã"
    // sem os participantes que o formulário enviou junto.
    const saved = await this.ds!.transaction(async (em) => {
      const workRepo = em.getRepository(WorkEntity);
      const participantsRepo = em.getRepository(WorkParticipantEntity);
      const entity = workRepo.create({ tenant_id: tenantId, ...(rest as any), type, created_by: userId, updated_by: userId });
      const savedWork = (await workRepo.save(entity as any)) as WorkEntity;
      await this.replaceParticipantes(participantsRepo, tenantId, savedWork.id, participantes);
      return savedWork;
    });

    // Dispara automações nativas internas (ex.: catalog-metadata-validator). Os
    // handlers são assíncronos e à prova de falha — nunca revertem a criação da obra.
    this.events.emitTyped(DOMAIN_EVENTS.CATALOG_WORK_CREATED, {
      tenantId,
      userId,
      aggregateType: 'work',
      aggregateId:   saved.id,
      payload: { tenantId, workId: saved.id, createdBy: userId },
    });

    return this.findById(tenantId, saved.id);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateWorkDto): Promise<WorkWithParticipantes> {
    await this.findById(tenantId, id);
    const { participantes, expectedUpdatedAt, ...rest } = dto as UpdateWorkDto & { participantes?: unknown[] };
    // find-f81eebf2: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (rest.artist_id !== undefined) await assertSameTenantFk(this.ds!, 'artists', rest.artist_id, tenantId, 'Artista');
    this.normalizeIsrcField(rest);

    // Task L: casUpdate() e replaceParticipantes() rodavam como duas operações
    // independentes — se a gravação dos participantes falhasse depois do
    // casUpdate já ter aplicado, a obra ficava com os campos principais
    // atualizados mas os participantes antigos (ou parcialmente apagados),
    // um estado inconsistente. Agora ambas rodam na mesma transação: qualquer
    // falha (incluindo o 409 do CAS) reverte as duas por igual.
    await this.ds!.transaction(async (em) => {
      const workRepo = em.getRepository(WorkEntity);
      const participantsRepo = em.getRepository(WorkParticipantEntity);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await casUpdate(
        workRepo,
        { id, tenant_id: tenantId } as any,
        { ...(rest as any), updated_at: new Date(), updated_by: userId } as any,
        expectedUpdatedAt,
        'Esta obra foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
      );
      await this.replaceParticipantes(participantsRepo, tenantId, id, participantes);
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
