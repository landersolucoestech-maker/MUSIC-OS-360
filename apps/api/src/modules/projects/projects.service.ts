import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DATA_SOURCE } from '../../database/database.module';
import { ProjectEntity, ProjectTrackEntity, ProjectTrackParticipantEntity, type ProjectTrackRole } from '../../database/entities';
import { groupCount, type GroupStatsResult } from '../../common/stats/group-count.util';
import type { CreateProjectDto, UpdateProjectDto, QueryProjectDto } from './dto/projects.dto';
import { PROJECT_DEPRECATED_FIELDS, PROJECT_TRACK_DEPRECATED_FIELDS } from './dto/projects.dto';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { ProjectStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

type TrackRole = ProjectTrackRole;

export interface ProjectTrackResponse {
  id: string;
  name: string;
  soloFeat: string | null;
  originalRemix: string | null;
  instrumental: string | null;
  durationMinutes: string | null;
  durationSeconds: string | null;
  genre: string | null;
  language: string | null;
  lyrics: string | null;
  audioUrl: string | null;
  composers: string[];
  performers: string[];
  producers: string[];
}

type ProjectWithTracks = ProjectEntity & { tracks: ProjectTrackResponse[] };

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
   * `projects.description` (formerly `descricao`, JSON of the tracks array) was
   * normalized into `project_tracks` + `project_track_participants`
   * (migration ProjectsFormFieldAlignment20260718000013). Rehydrates them into
   * the project's `tracks` array (canonical English fields since CZ-031; the
   * pre-CZ-031 request names are accepted as deprecated aliases).
   */
  private async hydrateTracks(projects: ProjectEntity[]): Promise<ProjectWithTracks[]> {
    if (projects.length === 0) return [];
    const projectIds = projects.map((p) => p.id);
    const tracks = await this.tracksRepo!
      .createQueryBuilder('t')
      .where('t.project_id IN (:...projectIds)', { projectIds })
      .orderBy('t.sort_order', 'ASC')
      .getMany();

    const trackIds = tracks.map((t) => t.id);
    const participants = trackIds.length
      ? await this.participantsRepo!
          .createQueryBuilder('pp')
          .where('pp.project_track_id IN (:...trackIds)', { trackIds })
          .orderBy('pp.sort_order', 'ASC')
          .getMany()
      : [];

    const byTrack = new Map<string, ProjectTrackParticipantEntity[]>();
    for (const p of participants) {
      const list = byTrack.get(p.project_track_id) ?? [];
      list.push(p);
      byTrack.set(p.project_track_id, list);
    }
    const namesByRole = (trackId: string, role: TrackRole): string[] =>
      (byTrack.get(trackId) ?? []).filter((p) => p.role === role).map((p) => p.name);

    const tracksByProject = new Map<string, ProjectTrackResponse[]>();
    for (const t of tracks) {
      const list = tracksByProject.get(t.project_id) ?? [];
      list.push({
        id: t.id,
        name: t.name,
        soloFeat: t.solo_feat,
        originalRemix: t.original_remix,
        instrumental: t.instrumental,
        durationMinutes: t.duration_minutes,
        durationSeconds: t.duration_seconds,
        genre: t.music_genre,
        language: t.language,
        lyrics: t.lyrics,
        audioUrl: t.audio_url,
        composers: namesByRole(t.id, 'composer'),
        performers: namesByRole(t.id, 'performer'),
        producers: namesByRole(t.id, 'producer'),
      });
      tracksByProject.set(t.project_id, list);
    }

    return projects.map((p) => Object.assign(p, { tracks: tracksByProject.get(p.id) ?? [] }));
  }

  private async replaceTracks(
    tenantId: string,
    projectId: string,
    trackRows: Record<string, unknown>[] | undefined,
  ): Promise<void> {
    if (trackRows === undefined) return;
    await this.tracksRepo!.delete({ project_id: projectId, tenant_id: tenantId });

    let sortOrder = 0;
    for (const raw of trackRows) {
      const m = applyDeprecatedFieldAliases(raw, PROJECT_TRACK_DEPRECATED_FIELDS);
      const trackId = (typeof m.id === 'string' && m.id) || randomUUID();
      await this.tracksRepo!.save(
        this.tracksRepo!.create({
          id: trackId,
          tenant_id: tenantId,
          project_id: projectId,
          name: String(m.name ?? ''),
          solo_feat: (m.soloFeat as string) || null,
          original_remix: (m.originalRemix as string) || null,
          instrumental: (m.instrumental as string) || null,
          duration_minutes: (m.durationMinutes as string) || null,
          duration_seconds: (m.durationSeconds as string) || null,
          music_genre: (m.genre as string) || null,
          language: (m.language as string) || null,
          lyrics: (m.lyrics as string) || null,
          audio_url: (m.audioUrl as string) || null,
          sort_order: sortOrder++,
        }),
      );

      const roleFields: Array<[TrackRole, unknown]> = [
        ['composer', m.composers], ['performer', m.performers], ['producer', m.producers],
      ];
      for (const [role, list] of roleFields) {
        if (!Array.isArray(list)) continue;
        const rows = list
          .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
          .map((name, i) => this.participantsRepo!.create({
            id: randomUUID(), tenant_id: tenantId, project_track_id: trackId,
            name: name.trim(), role, sort_order: i,
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

    // Task H: keys aligned with QueryProjectDto (type/artistId, not
    // type/artist_id — a pre-existing bug: the DTO validates "type"/"artistId",
    // but the service read "type"/"artist_id", which never existed on the
    // validated object; both filters were effectively inert).
    if (q['status'])   qb.andWhere('p.status = :status',         { status:    q['status'] });
    if (q['type'])     qb.andWhere('p.type = :type',              { type:      q['type'] });
    if (q['artistId']) qb.andWhere('p.artist_id = :artistId',   { artistId: q['artistId'] });
    if (q['music_genre']) qb.andWhere('p.music_genre = :musicGenre', { musicGenre: q['music_genre'] });
    if (q['search'])   qb.andWhere('p.title ILIKE :search',      { search: `%${q['search']}%` });

    qb.orderBy('p.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [data, total] = await qb.getManyAndCount();
    const hydrated = await this.hydrateTracks(data);
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
   * Count per status, over the whole tenant (not the current page) —
   * Task H: exact KPIs without downloading the whole table. No SUM (the
   * Projects KPI is only a count per status — active/completed/drafts/total).
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
  ): Promise<ProjectWithTracks & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('p')
      .where('p.id = :id AND p.tenant_id = :tenantId AND p.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Projeto não encontrado');
    const [hydrated] = await this.hydrateTracks([result]);
    const allowed_transitions = this.workflowService.getAllowedTransitions('project', result.status, actorRole);
    return { ...hydrated, allowed_transitions };
  }

  async create(tenantId: string, userId: string, input: CreateProjectDto): Promise<ProjectWithTracks> {
    const dto = applyDeprecatedFieldAliases(input, PROJECT_DEPRECATED_FIELDS);
    const { tracks: trackRows, ...rest } = dto;
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
    await this.replaceTracks(tenantId, saved.id, trackRows);
    const [hydrated] = await this.hydrateTracks([saved]);
    return hydrated;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateProjectDto,
    actorRole?: string,
  ): Promise<ProjectWithTracks & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = applyDeprecatedFieldAliases(dto as Record<string, unknown>, PROJECT_DEPRECATED_FIELDS);
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;

    const { status: _s, tracks: trackRows, expectedUpdatedAt, ...restFields } = dtoMap as Record<string, unknown> & { tracks?: Record<string, unknown>[]; expectedUpdatedAt?: string };
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
        // CAS in the same transaction as the status change — if the project was
        // edited by someone else since `current` was read, the whole
        // transaction (including the history already written by transitionInTx) rolls
        // back; it never applies a transition validated against a stale status.
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

    await this.replaceTracks(tenantId, id, this.tracksFromLegacyEdit(dto as Record<string, unknown>, trackRows));
    return this.findById(tenantId, id, actorRole);
  }

  /**
   * An edit from a pre-CZ-031 build sends the deprecated `musicas`, built from a
   * response it can no longer read (tracks moved to `tracks`) — typically a
   * single empty placeholder row. Replacing with it would delete every stored
   * track, so only rows that carry a name are trusted, and a legacy list with
   * none leaves the stored tracks untouched. Canonical `tracks` is unaffected.
   */
  private tracksFromLegacyEdit(
    dto: Record<string, unknown>,
    trackRows: Record<string, unknown>[] | undefined,
  ): Record<string, unknown>[] | undefined {
    // trackRows present while the canonical key is absent => it came from the alias.
    if (dto['tracks'] !== undefined || !Array.isArray(trackRows)) return trackRows;
    const named = trackRows.filter((row) => typeof row['name'] === 'string' && row['name'].trim().length > 0);
    return named.length > 0 ? named : undefined;
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
