import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ProjectEntity, ProjectTrackEntity, ProjectTrackParticipantEntity } from '../../database/entities';
import { groupCount, type GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateProjectDto, UpdateProjectDto, QueryProjectDto } from './dto/projects.dto';
import { ProjectStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

type TrackRole = 'compositor' | 'interprete' | 'produtor';

export interface MusicaResponse {
  id: string;
  nome: string;
  soloFeat: string | null;
  originalRemix: string | null;
  instrumental: string | null;
  duracaoMin: string | null;
  duracaoSeg: string | null;
  genero: string | null;
  idioma: string | null;
  letra: string | null;
  audioUrl: string | null;
  compositores: string[];
  interpretes: string[];
  produtores: string[];
}

type ProjectWithMusicas = ProjectEntity & { musicas: MusicaResponse[] };

@Injectable()
export class ProjectsService {
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<ProjectEntity> | null = null;
  private readonly tracksRepo: Repository<ProjectTrackEntity> | null = null;
  private readonly participantsRepo: Repository<ProjectTrackParticipantEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(ProjectEntity);
      this.tracksRepo = ds.getRepository(ProjectTrackEntity);
      this.participantsRepo = ds.getRepository(ProjectTrackParticipantEntity);
    }
  }

  /**
   * `projects.descricao` (JSON de musicas[]) foi normalizada em
   * `project_tracks` + `project_track_participants` (migration
   * ProjectsFormFieldAlignment20260718000013). Reidrata no MESMO formato que
   * o frontend sempre consumiu, para que o contrato de API não mude.
   */
  private async hydrateMusicas(projects: ProjectEntity[]): Promise<ProjectWithMusicas[]> {
    if (projects.length === 0) return [];
    const projectIds = projects.map((p) => p.id);
    const tracks = await this.tracksRepo!
      .createQueryBuilder('t')
      .where('t.project_id IN (:...projectIds)', { projectIds })
      .orderBy('t.ordem', 'ASC')
      .getMany();

    const trackIds = tracks.map((t) => t.id);
    const participants = trackIds.length
      ? await this.participantsRepo!
          .createQueryBuilder('pp')
          .where('pp.project_track_id IN (:...trackIds)', { trackIds })
          .orderBy('pp.ordem', 'ASC')
          .getMany()
      : [];

    const byTrack = new Map<string, ProjectTrackParticipantEntity[]>();
    for (const p of participants) {
      const list = byTrack.get(p.project_track_id) ?? [];
      list.push(p);
      byTrack.set(p.project_track_id, list);
    }
    const namesByRole = (trackId: string, role: TrackRole): string[] =>
      (byTrack.get(trackId) ?? []).filter((p) => p.role === role).map((p) => p.nome);

    const musicasByProject = new Map<string, MusicaResponse[]>();
    for (const t of tracks) {
      const list = musicasByProject.get(t.project_id) ?? [];
      list.push({
        id: t.id,
        nome: t.nome,
        soloFeat: t.solo_feat,
        originalRemix: t.original_remix,
        instrumental: t.instrumental,
        duracaoMin: t.duracao_min,
        duracaoSeg: t.duracao_seg,
        genero: t.genero,
        idioma: t.idioma,
        letra: t.letra,
        audioUrl: t.audio_url,
        compositores: namesByRole(t.id, 'compositor'),
        interpretes: namesByRole(t.id, 'interprete'),
        produtores: namesByRole(t.id, 'produtor'),
      });
      musicasByProject.set(t.project_id, list);
    }

    return projects.map((p) => Object.assign(p, { musicas: musicasByProject.get(p.id) ?? [] }));
  }

  private async replaceMusicas(
    tenantId: string,
    projectId: string,
    musicas: Record<string, unknown>[] | undefined,
  ): Promise<void> {
    if (musicas === undefined) return;
    await this.tracksRepo!.delete({ project_id: projectId, tenant_id: tenantId });

    let ordem = 0;
    for (const m of musicas) {
      const trackId = (typeof m.id === 'string' && m.id) || randomUUID();
      await this.tracksRepo!.save(
        this.tracksRepo!.create({
          id: trackId,
          tenant_id: tenantId,
          project_id: projectId,
          nome: String(m.nome ?? ''),
          solo_feat: (m.soloFeat as string) || null,
          original_remix: (m.originalRemix as string) || null,
          instrumental: (m.instrumental as string) || null,
          duracao_min: (m.duracaoMin as string) || null,
          duracao_seg: (m.duracaoSeg as string) || null,
          genero: (m.genero as string) || null,
          idioma: (m.idioma as string) || null,
          letra: (m.letra as string) || null,
          audio_url: (m.audioUrl as string) || null,
          ordem: ordem++,
        }),
      );

      const roleFields: Array<[TrackRole, unknown]> = [
        ['compositor', m.compositores], ['interprete', m.interpretes], ['produtor', m.produtores],
      ];
      for (const [role, list] of roleFields) {
        if (!Array.isArray(list)) continue;
        const rows = list
          .filter((nome): nome is string => typeof nome === 'string' && nome.trim().length > 0)
          .map((nome, i) => this.participantsRepo!.create({
            id: randomUUID(), tenant_id: tenantId, project_track_id: trackId,
            nome: nome.trim(), role, ordem: i,
          }));
        if (rows.length > 0) await this.participantsRepo!.save(rows);
      }
    }
  }

  async list(tenantId: string, query: QueryProjectDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');

    // Task H: chaves alinhadas com QueryProjectDto (type/artistId, não
    // type/artist_id — bug pré-existente: o DTO valida "type"/"artistId",
    // mas o service lia "type"/"artist_id", que nunca existiam no objeto
    // validado; os dois filtros eram efetivamente inertes).
    if (q['status'])   qb.andWhere('p.status = :status',         { status:    q['status'] });
    if (q['type'])     qb.andWhere('p.type = :type',              { type:      q['type'] });
    if (q['artistId']) qb.andWhere('p.artist_id = :artistId',   { artistId: q['artistId'] });
    if (q['genero'])   qb.andWhere('p.genero = :genero',          { genero:    q['genero'] });
    if (q['search'])   qb.andWhere('p.title ILIKE :search',      { search: `%${q['search']}%` });

    qb.orderBy('p.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [data, total] = await qb.getManyAndCount();
    const hydrated = await this.hydrateMusicas(data);
    return {
      data: hydrated,
      meta: {
        total,
        offset: typeof q['offset'] === 'number' ? q['offset'] : 0,
        limit:  typeof q['limit']  === 'number' ? q['limit']  : 50,
      },
    };
  }

  /**
   * Contagem por status, sobre o tenant inteiro (não a página atual) —
   * Task H: KPIs exatos sem baixar a tabela inteira. Sem SUM (KPI de
   * Projetos é só contagem por status — ativos/concluídos/rascunhos/total).
   */
  async stats(tenantId: string): Promise<GroupStatsResult> {
    const qb = this.repo!
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');
    return groupCount(qb, 'p', 'status');
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<ProjectWithMusicas & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('p')
      .where('p.id = :id AND p.tenant_id = :tenantId AND p.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Projeto não encontrado');
    const [hydrated] = await this.hydrateMusicas([result]);
    const allowed_transitions = this.workflowService.getAllowedTransitions('project', result.status, actorRole);
    return { ...hydrated, allowed_transitions };
  }

  async create(tenantId: string, userId: string, dto: CreateProjectDto): Promise<ProjectWithMusicas> {
    const { musicas, ...rest } = dto as CreateProjectDto & { musicas?: Record<string, unknown>[] };
    // find-50dd3726: artist_id had no cross-tenant ownership check — a
    // project could silently reference another tenant's artist.
    await assertSameTenantFk(this.ds!, 'artists', (rest as { artist_id?: string }).artist_id, tenantId, 'Artista');
    const entity = this.repo!.create({
      tenant_id:  tenantId,
      ...(rest as Record<string, unknown>),
      status:     ProjectStatus.PLANNING,
      created_by: userId,
      updated_by: userId,
    } as Partial<ProjectEntity>);
    const saved = await this.repo!.save(entity as ProjectEntity);
    await this.replaceMusicas(tenantId, saved.id, musicas);
    const [hydrated] = await this.hydrateMusicas([saved]);
    return hydrated;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateProjectDto,
    actorRole?: string,
  ): Promise<ProjectWithMusicas & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;

    const { status: _s, musicas, expectedUpdatedAt, ...restFields } = dtoMap as Record<string, unknown> & { musicas?: Record<string, unknown>[]; expectedUpdatedAt?: string };
    void _s;
    // find-50dd3726: only validate when the patch actually sets artist_id —
    // omitted means "unchanged", already validated at its own create time.
    if (restFields['artist_id'] !== undefined) {
      await assertSameTenantFk(this.ds!, 'artists', restFields['artist_id'] as string | undefined, tenantId, 'Artista');
    }
    const conflictMessage = 'Este projeto foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const nonStatusUpdates: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: userId,
      ...restFields,
    };

    if (statusChanging) {
      const req = {
        entityType: 'project' as const,
        entityId:   id,
        tenantId,
        actorId:    userId,
        actorRole,
        fromStatus: current.status,
        toStatus:   dtoMap['status'] as string,
        entity:     current as unknown as Record<string, unknown>,
      };
      await this.ds!.transaction(async (em) => {
        await this.workflowService.transitionInTx(req, em);
        // CAS na mesma transação da mudança de status — se o projeto foi
        // editado por outra pessoa desde a leitura de `current`, a transação
        // inteira (incluindo o histórico já gravado por transitionInTx) faz
        // rollback, nunca aplica uma transição validada contra status stale.
        await casUpdate(
          em.getRepository(ProjectEntity),
          { id, tenant_id: tenantId },
          { ...nonStatusUpdates, status: dtoMap['status'] as ProjectStatus },
          expectedUpdatedAt as string | undefined,
          conflictMessage,
        );
      });

      this.emitStatusEvents(tenantId, userId, current, dtoMap['status'] as string);
    } else {
      await casUpdate(
        this.repo!,
        { id, tenant_id: tenantId } as FindOptionsWhere<ProjectEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<ProjectEntity>,
        expectedUpdatedAt as string | undefined,
        conflictMessage,
      );
    }

    await this.replaceMusicas(tenantId, id, musicas);
    return this.findById(tenantId, id, actorRole);
  }

  private emitStatusEvents(
    tenantId: string,
    userId: string,
    project: ProjectEntity,
    toStatus: string,
  ): void {
    if (toStatus !== ProjectStatus.COMPLETED) return;
    const completedAt = new Date().toISOString();
    this.events.emitTyped(DOMAIN_EVENTS.PROJECT_COMPLETED, {
      tenantId,
      userId,
      aggregateType: 'project',
      aggregateId:   project.id,
      payload: {
        projectId:   project.id,
        tenantId,
        title:       project.title,
        type:        project.type,
        artistId:    project.artist_id,
        completedBy: userId,
        completedAt,
      },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as FindOptionsWhere<ProjectEntity>,
      { deleted_at: new Date() } as QueryDeepPartialEntity<ProjectEntity>,
    );
    return { deleted: true };
  }
}
