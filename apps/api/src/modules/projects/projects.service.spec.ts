import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService } from '../../core/events/events.service';
import { ProjectEntity, ProjectTrackEntity, ProjectTrackParticipantEntity } from '../../database/entities';

const TENANT = 'tenant-test';
const PROJECT_ID = 'project-test';
const mockProject = { id: PROJECT_ID, tenant_id: TENANT, title: 'Test', type: 'album', status: 'planning', deleted_at: null };

const buildMockQb = (getOneValue: unknown = mockProject) => {
  const qb: any = {
    where: jest.fn(), andWhere: jest.fn(),
    getOne: jest.fn().mockResolvedValue(getOneValue),
    getMany: jest.fn().mockResolvedValue([mockProject]),
    getManyAndCount: jest.fn().mockResolvedValue([[mockProject], 1]),
    skip: jest.fn(), take: jest.fn(), orderBy: jest.fn(),
  };
  qb.where.mockReturnValue(qb); qb.andWhere.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb); qb.take.mockReturnValue(qb); qb.orderBy.mockReturnValue(qb);
  return qb;
};

const buildMockChildRepo = (rows: any[] = []) => {
  const qb: any = { where: jest.fn(), orderBy: jest.fn(), getMany: jest.fn().mockResolvedValue(rows) };
  qb.where.mockReturnValue(qb); qb.orderBy.mockReturnValue(qb);
  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => Promise.resolve(v)),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    find: jest.fn().mockResolvedValue([]),
    _qb: qb,
  };
};

const buildMockDs = (getOneValue: unknown = mockProject, trackRows: any[] = [], participantRows: any[] = []) => {
  const qb = buildMockQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => Promise.resolve({ id: PROJECT_ID, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };
  const tracksRepo = buildMockChildRepo(trackRows);
  const participantsRepo = buildMockChildRepo(participantRows);
  return {
    getRepository: jest.fn((entity: any) => {
      if (entity === ProjectTrackEntity) return tracksRepo;
      if (entity === ProjectTrackParticipantEntity) return participantsRepo;
      return repo;
    }),
    transaction: jest.fn((cb: any) => cb({ update: jest.fn() })),
    _repo: repo, _tracksRepo: tracksRepo, _participantsRepo: participantsRepo,
  };
};

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  const buildModule = async (ds = buildMockDs()) => {
    mockDs = ds;
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: DATA_SOURCE, useValue: mockDs },
        { provide: WorkflowService, useValue: { getAllowedTransitions: jest.fn().mockReturnValue([]), transitionInTx: jest.fn() } },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();
    service = module.get<ProjectsService>(ProjectsService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await buildModule();
  });

  it('create() persists title/type/status/notes/description/music_genre correctly', async () => {
    await service.create(TENANT, 'u1', {
      title: 'Meu Álbum', type: 'album', notes: 'nota', description: null, music_genre: 'pop',
    } as any);
    expect(mockDs._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT, title: 'Meu Álbum', type: 'album', notes: 'nota', music_genre: 'pop' }),
    );
  });

  it('create() does not send tracks (or the deprecated musicas) to the ProjectEntity repo (no longer a column)', async () => {
    await service.create(TENANT, 'u1', {
      title: 'X', type: 'single', tracks: [{ name: 'Faixa 1' }],
    } as any);
    await service.create(TENANT, 'u1', {
      title: 'Y', type: 'single', musicas: [{ name: 'Faixa 2' }],
    } as any);
    for (const [row] of mockDs._repo.create.mock.calls) {
      expect(row).not.toHaveProperty('tracks');
      expect(row).not.toHaveProperty('musicas');
    }
  });

  it('create() persists each track as its own row in project_tracks, with participants per role', async () => {
    await service.create(TENANT, 'u1', {
      title: 'X', type: 'album',
      tracks: [
        {
          id: 't1', name: 'Faixa 1', durationMinutes: '3', durationSeconds: '30', language: 'pt-BR', lyrics: 'lalala',
          composers: ['Fulano'], performers: ['Beltrano'], producers: ['Ciclano'],
        },
      ],
    } as any);
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1', tenant_id: TENANT, name: 'Faixa 1', duration_minutes: '3', duration_seconds: '30',
        language: 'pt-BR', lyrics: 'lalala', sort_order: 0,
      }),
    );
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Fulano', role: 'composer' }),
    ]);
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Beltrano', role: 'performer' }),
    ]);
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Ciclano', role: 'producer' }),
    ]);
  });

  it('create() still persists the pre-CZ-031 web payload (musicas + Portuguese track fields) canonically', async () => {
    await service.create(TENANT, 'u1', {
      title: 'X', type: 'album',
      musicas: [
        {
          id: 't1', name: 'Faixa 1', duracaoMin: '3', duracaoSeg: '30', genero: 'pop', idioma: 'pt-BR', letra: 'lalala',
          compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'],
        },
      ],
    } as any);
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1', duration_minutes: '3', duration_seconds: '30', music_genre: 'pop', language: 'pt-BR', lyrics: 'lalala',
      }),
    );
    const roles = mockDs._participantsRepo.save.mock.calls.map(([rows]: [Array<{ name: string; role: string }>]) => rows[0]);
    expect(roles).toEqual([
      expect.objectContaining({ name: 'Fulano', role: 'composer' }),
      expect.objectContaining({ name: 'Beltrano', role: 'performer' }),
      expect.objectContaining({ name: 'Ciclano', role: 'producer' }),
    ]);
  });

  it('findById() rehydrates tracks with the canonical English fields (a row not yet backfilled reads canonical)', async () => {
    const trackRows = [{
      id: 't1', project_id: PROJECT_ID, name: 'Faixa 1', solo_feat: 'solo', original_remix: 'original',
      instrumental: 'nao', duration_minutes: '3', duration_seconds: '30', music_genre: 'pop', language: 'portugues',
      lyrics: 'lalala', audio_url: null,
    }];
    const participantRows = [
      { project_track_id: 't1', name: 'Fulano', role: 'composer' },
      { project_track_id: 't1', name: 'Beltrano', role: 'performer' },
    ];
    await buildModule(buildMockDs(mockProject, trackRows, participantRows));

    const found = await service.findById(TENANT, PROJECT_ID);
    expect(found).not.toHaveProperty('musicas');
    expect(found.tracks).toEqual([
      {
        id: 't1', name: 'Faixa 1', soloFeat: 'solo', originalRemix: 'original', instrumental: 'no',
        durationMinutes: '3', durationSeconds: '30', genre: 'pop', language: 'pt', lyrics: 'lalala', audioUrl: null,
        composers: ['Fulano'], performers: ['Beltrano'], producers: [],
      },
    ]);
  });

  it('update() writes canonical track values even when a deprecated build sends sim/nao and a language slug', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { tracks: [{ name: 'Faixa', instrumental: 'sim', language: 'ingles' }] } as any);
    expect(mockDs._tracksRepo.create).toHaveBeenCalledWith(expect.objectContaining({ instrumental: 'yes', language: 'en' }));
  });

  it('update() replaces the tracks (delete + insert) when the DTO sends the array', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { tracks: [{ name: 'Nova Faixa' }] } as any);
    expect(mockDs._tracksRepo.delete).toHaveBeenCalledWith({ project_id: PROJECT_ID, tenant_id: TENANT });
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nova Faixa' }));
  });

  it('update() accepts the deprecated musicas array during the deploy-skew window', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { musicas: [{ name: 'Faixa Legada' }] } as any);
    expect(mockDs._tracksRepo.delete).toHaveBeenCalledWith({ project_id: PROJECT_ID, tenant_id: TENANT });
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Faixa Legada' }));
  });

  it('update() with a pre-CZ-031 placeholder musicas list (no named row) never deletes the stored tracks (deploy skew)', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { musicas: [{ name: '', compositores: [''] }] } as any);
    expect(mockDs._tracksRepo.delete).not.toHaveBeenCalled();
    expect(mockDs._tracksRepo.save).not.toHaveBeenCalled();
  });

  it('update() with canonical tracks: [] still clears the tracks (explicit intent)', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { tracks: [] } as any);
    expect(mockDs._tracksRepo.delete).toHaveBeenCalledWith({ project_id: PROJECT_ID, tenant_id: TENANT });
  });

  it('update() leaves the tracks untouched when the DTO does not send the field', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { notes: 'x' } as any);
    expect(mockDs._tracksRepo.delete).not.toHaveBeenCalled();
    expect(mockDs._tracksRepo.save).not.toHaveBeenCalled();
  });
});
