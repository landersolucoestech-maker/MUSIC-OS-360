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

  it('create() persiste title/type/status/observacoes/descricao/genero corretamente', async () => {
    await service.create(TENANT, 'u1', {
      title: 'Meu Álbum', type: 'album', observacoes: 'nota', descricao: null, genero: 'pop',
    } as any);
    expect(mockDs._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT, title: 'Meu Álbum', type: 'album', observacoes: 'nota', genero: 'pop' }),
    );
  });

  it('create() não envia musicas para o repo de ProjectEntity (não é mais coluna)', async () => {
    await service.create(TENANT, 'u1', {
      title: 'X', type: 'single', musicas: [{ nome: 'Faixa 1' }],
    } as any);
    expect(mockDs._repo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ musicas: expect.anything() }),
    );
  });

  it('create() persiste cada música como linha própria em project_tracks, com participantes por role', async () => {
    await service.create(TENANT, 'u1', {
      title: 'X', type: 'album',
      musicas: [
        {
          id: 't1', nome: 'Faixa 1', duracaoMin: '3', duracaoSeg: '30',
          compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'],
        },
      ],
    } as any);
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', tenant_id: TENANT, nome: 'Faixa 1', duracao_min: '3', duracao_seg: '30', ordem: 0 }),
    );
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ nome: 'Fulano', role: 'compositor' }),
    ]);
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ nome: 'Beltrano', role: 'interprete' }),
    ]);
    expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ nome: 'Ciclano', role: 'produtor' }),
    ]);
  });

  it('findById() reidrata musicas no formato esperado pelo frontend', async () => {
    const trackRows = [{
      id: 't1', project_id: PROJECT_ID, nome: 'Faixa 1', solo_feat: 'solo', original_remix: 'original',
      instrumental: 'nao', duracao_min: '3', duracao_seg: '30', genero: 'pop', idioma: 'pt-BR',
      letra: 'lalala', audio_url: null,
    }];
    const participantRows = [
      { project_track_id: 't1', nome: 'Fulano', role: 'compositor' },
      { project_track_id: 't1', nome: 'Beltrano', role: 'interprete' },
    ];
    await buildModule(buildMockDs(mockProject, trackRows, participantRows));

    const found = await service.findById(TENANT, PROJECT_ID);
    expect(found.musicas).toEqual([
      {
        id: 't1', nome: 'Faixa 1', soloFeat: 'solo', originalRemix: 'original', instrumental: 'nao',
        duracaoMin: '3', duracaoSeg: '30', genero: 'pop', idioma: 'pt-BR', letra: 'lalala', audioUrl: null,
        compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: [],
      },
    ]);
  });

  it('update() substitui as musicas (delete + insert) quando o DTO envia o array', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { musicas: [{ nome: 'Nova Faixa' }] } as any);
    expect(mockDs._tracksRepo.delete).toHaveBeenCalledWith({ project_id: PROJECT_ID, tenant_id: TENANT });
    expect(mockDs._tracksRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Nova Faixa' }));
  });

  it('update() não mexe em musicas quando o DTO não envia o campo', async () => {
    await service.update(TENANT, 'u1', PROJECT_ID, { observacoes: 'x' } as any);
    expect(mockDs._tracksRepo.delete).not.toHaveBeenCalled();
    expect(mockDs._tracksRepo.save).not.toHaveBeenCalled();
  });
});
