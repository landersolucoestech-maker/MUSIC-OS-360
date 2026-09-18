import 'reflect-metadata';
import { Test }              from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { plainToInstance }   from 'class-transformer';
import { validate }          from 'class-validator';
import { WorksService }      from './works.service';
import { CreateWorkDto }     from './dto/create-work.dto';
import { DATA_SOURCE }       from '../../database/database.module';
import { EventsService }     from '../../core/events/events.service';
import { WorkEntity, WorkParticipantEntity } from '../../database/entities';

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateWorkDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const TENANT  = 'tenant-test';
const WORK_ID = 'work-test';
const mockWork = { id: WORK_ID, tenant_id: TENANT, title: 'Test', type: 'original', deleted_at: null };

const buildMockQb = (getOneValue: any = mockWork) => {
  const qb: any = {
    where:           jest.fn(),
    andWhere:        jest.fn(),
    getOne:          jest.fn().mockResolvedValue(getOneValue),
    getMany:         jest.fn().mockResolvedValue([mockWork]),
    getManyAndCount: jest.fn().mockResolvedValue([[mockWork], 1]),
    skip:            jest.fn(),
    take:            jest.fn(),
    orderBy:         jest.fn(),
    update:          jest.fn(),
    set:             jest.fn(),
    execute:         jest.fn().mockResolvedValue({ affected: 1 }),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  return qb;
};

const buildMockParticipantsRepo = (rows: any[] = []) => {
  const qb: any = {
    where:    jest.fn(),
    orderBy:  jest.fn(),
    getMany:  jest.fn().mockResolvedValue(rows),
  };
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save:   jest.fn((v: any) => Promise.resolve(v)),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    _qb: qb,
  };
};

const buildMockDs = (getOneValue: any = mockWork, participantRows: any[] = []) => {
  const qb   = buildMockQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save:   jest.fn((v: any) => Promise.resolve({ id: WORK_ID, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };
  const participantsRepo = buildMockParticipantsRepo(participantRows);
  const getRepository = jest.fn((entity: any) => (entity === WorkParticipantEntity ? participantsRepo : repo));
  return {
    getRepository,
    // Task L: create()/update() agora rodam dentro de uma transação (obra +
    // participantes atômicos) — o mock executa o callback com um "EntityManager"
    // que resolve para os MESMOS mocks de repo, então as asserções existentes
    // contra mockDs._repo/_participantsRepo continuam válidas inalteradas.
    transaction: jest.fn((cb: any) => cb({ getRepository })),
    // assertSameTenantFk's ownership check — a truthy row means "found, same
    // tenant", so tests not focused on that behavior aren't coupled to it.
    query: jest.fn().mockResolvedValue([{ exists: 1 }]),
    _repo: repo,
    _participantsRepo: participantsRepo,
  };
};

describe('WorksService', () => {
  let service: WorksService;
  let mockDs: ReturnType<typeof buildMockDs>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDs = buildMockDs();
    const module = await Test.createTestingModule({
      providers: [
        WorksService,
        { provide: DATA_SOURCE, useValue: mockDs },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();
    service = module.get<WorksService>(WorksService);
  });

  it('cria obra com dados corretos', async () => {
    await service.create(TENANT, 'u1', { title: 'Nova', type: 'original' } as any);
    expect(mockDs._repo.save).toHaveBeenCalled();
    expect(mockDs._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT, title: 'Nova' }),
    );
  });

  it('softDelete define deleted_at (não executa DELETE SQL)', async () => {
    await service.softDelete(TENANT, WORK_ID);
    expect(mockDs._repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORK_ID, tenant_id: TENANT }),
      expect.objectContaining({ deleted_at: expect.any(Date) }),
    );
  });

  it('findById lança NotFoundException para obra inexistente', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });

  it('findById usa where com tenant_id correto', async () => {
    await service.findById(TENANT, WORK_ID);
    expect(mockDs._repo._qb.where).toHaveBeenCalled();
  });

  describe('CreateWorkDto — payload real do formulário (Estado B, pré-C2)', () => {
    const realFormPayload = {
      title: 'Minha Obra',
      genero: 'pop',
      idioma: 'pt',
      cod_ecad: 'ECAD-0001',
      cod_entidade: 'ABR-123',
      duracao: '03:30',
      instrumental: 'nao',
      criada_por_ia: false,
      tipo_ia: null,
      ia_harmonia: null,
      ia_melodia: null,
      ia_letra: null,
      outros_titulos: null,
      referencias_conexas: null,
      letra_completa: null,
      participantes: null,
      status: 'pending',
      compositores: ['Fulano'],
      letristas: null,
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      artist_id: null,
      tipo_obra: 'musica',
    };

    it('aceita o payload real do frontend (formToObraPayload), incluindo project_id', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('rejeita project_id com UUID inválido', async () => {
      const errors = await validateDto({ ...realFormPayload, project_id: 'nao-e-uuid' });
      expect(errors.some((e) => e.property === 'project_id')).toBe(true);
    });

    it('rejeita campo desconhecido (whitelist)', async () => {
      const errors = await validateDto({ ...realFormPayload, campo_inexistente: 'x' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });
  });

  describe('create() — fallback de type (works.type é NOT NULL)', () => {
    it('usa tipo_obra quando type está ausente', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', tipo_obra: 'musica' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'musica' }),
      );
    });

    it('usa composicao quando type e tipo_obra estão ausentes', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'composicao' }),
      );
    });

    it('type explícito vence sobre tipo_obra quando ambos presentes', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', tipo_obra: 'musica' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'original' }),
      );
    });

    it('persiste compositores como array', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', compositores: ['A', 'B'] } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ compositores: ['A', 'B'] }),
      );
    });
  });

  describe('update() — PATCH parcial não força default de type', () => {
    it('não inclui type no payload de update quando o DTO não o envia', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { observacoes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('type');
    });
  });

  describe('participantes — normalizado em work_participants (migration 20260718000011)', () => {
    it('create() não envia participantes para o repo de WorkEntity (não é mais coluna)', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [{ id: 'p1', nome: 'Fulano', classeFuncao: 'compositor/autor', link: '', percentual: '50' }],
      } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ participantes: expect.anything() }),
      );
    });

    it('create() persiste cada participante como linha própria em work_participants', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [
          { id: 'p1', nome: 'Fulano', classeFuncao: 'compositor/autor', link: 'https://x', percentual: '60' },
          { id: 'p2', nome: 'Beltrano', classeFuncao: 'tradutor', link: '', percentual: '40' },
        ],
      } as any);
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1', tenant_id: TENANT, nome: 'Fulano', classe_funcao: 'compositor/autor', percentual: '60', sort_order: 0 }),
        expect.objectContaining({ id: 'p2', tenant_id: TENANT, nome: 'Beltrano', classe_funcao: 'tradutor', percentual: '40', sort_order: 1 }),
      ]);
    });

    it('findById() reidrata participantes no formato esperado pelo frontend (id/nome/classeFuncao/link/percentual)', async () => {
      const rows = [
        { id: 'p1', work_id: WORK_ID, nome: 'Fulano', classe_funcao: 'compositor/autor', link: null, percentual: '60' },
      ];
      mockDs = buildMockDs(mockWork, rows);
      const module = await Test.createTestingModule({
        providers: [
          WorksService,
          { provide: DATA_SOURCE, useValue: mockDs },
          { provide: EventsService, useValue: { emitTyped: jest.fn() } },
        ],
      }).compile();
      service = module.get<WorksService>(WorksService);

      const found = await service.findById(TENANT, WORK_ID);
      expect(found.participantes).toEqual([
        { id: 'p1', nome: 'Fulano', classeFuncao: 'compositor/autor', link: null, percentual: '60' },
      ]);
    });

    it('update() substitui os participantes (delete + insert) quando o DTO envia o array', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        participantes: [{ id: 'p1', nome: 'Novo Nome', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs._participantsRepo.delete).toHaveBeenCalledWith({ work_id: WORK_ID, tenant_id: TENANT });
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ nome: 'Novo Nome', percentual: '100' }),
      ]);
    });

    it('update() não mexe em participantes quando o DTO não envia o campo', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { observacoes: 'x' } as any);
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Task L — atomicidade obra + participantes (casUpdate + replaceParticipantes na mesma transação)', () => {
    it('update() roda dentro de ds.transaction() (obra e participantes não são operações independentes)', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        observacoes: 'x',
        participantes: [{ id: 'p1', nome: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('create() também roda obra + participantes na mesma transação', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [{ id: 'p1', nome: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('se a gravação dos participantes falhar, update() inteiro rejeita — nunca reporta sucesso com obra e participantes inconsistentes entre si', async () => {
      mockDs._participantsRepo.save.mockRejectedValueOnce(new Error('constraint violation'));
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'x',
          participantes: [{ id: 'p1', nome: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
        } as any),
      ).rejects.toThrow('constraint violation');
      // A mesma chamada de transaction() que tentou o update da obra é a que
      // falhou nos participantes — não há um segundo commit "parcial" da obra
      // fora dessa transação.
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('cenário A/B: B tenta salvar obra+participantes contra versão já sobrescrita por A -> 409, participantes de B nunca são persistidos', async () => {
      // A e B leram updated_at = T0. Simulamos que A já salvou (WHERE do CAS
      // de B não bate mais -> 0 linhas afetadas).
      mockDs._repo.update.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'edição de B',
          participantes: [{ id: 'pB', nome: 'Participante de B', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
          expectedUpdatedAt: new Date('2026-08-14T10:00:00.000Z').toISOString(),
        } as any),
      ).rejects.toThrow(ConflictException);
      // casUpdate lança ANTES de replaceParticipantes ser chamado (mesma
      // transação, ordem sequencial) — os dados de B nunca tocam o banco.
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

});
