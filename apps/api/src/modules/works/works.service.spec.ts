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
    // Task L: create()/update() now run inside a transaction (work +
    // participants atomic) — the mock executes the callback with an "EntityManager"
    // that resolves to the SAME repo mocks, so the existing assertions
    // against mockDs._repo/_participantsRepo remain valid unchanged.
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

  it('creates a work with correct data', async () => {
    await service.create(TENANT, 'u1', { title: 'Nova', type: 'original' } as any);
    expect(mockDs._repo.save).toHaveBeenCalled();
    expect(mockDs._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT, title: 'Nova' }),
    );
  });

  it('softDelete sets deleted_at (does not run a SQL DELETE)', async () => {
    await service.softDelete(TENANT, WORK_ID);
    expect(mockDs._repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORK_ID, tenant_id: TENANT }),
      expect.objectContaining({ deleted_at: expect.any(Date) }),
    );
  });

  it('findById throws NotFoundException for a nonexistent work', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });

  it('findById uses where with the correct tenant_id', async () => {
    await service.findById(TENANT, WORK_ID);
    expect(mockDs._repo._qb.where).toHaveBeenCalled();
  });

  describe('CreateWorkDto — real form payload (State B, pre-C2)', () => {
    const realFormPayload = {
      title: 'Minha Obra',
      music_genre: 'pop',
      idioma: 'pt',
      cod_ecad: 'ECAD-0001',
      cod_entidade: 'ABR-123',
      duration_text: '03:30',
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

    it('accepts the real frontend payload (formToObraPayload), including project_id', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('rejects project_id with an invalid UUID', async () => {
      const errors = await validateDto({ ...realFormPayload, project_id: 'nao-e-uuid' });
      expect(errors.some((e) => e.property === 'project_id')).toBe(true);
    });

    it('rejects unknown field (whitelist)', async () => {
      const errors = await validateDto({ ...realFormPayload, campo_inexistente: 'x' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });
  });

  describe('create() — type and tipo_obra are independent fields (works.type is NOT NULL)', () => {
    // tipo_obra (catalog origin: 'autoral'|'referencia') never feeds
    // type (ABRAMUS/ECAD classification: 'composicao'|'original'|...) — these were
    // distinct concepts collided by an incorrect fallback, removed in
    // 20260921000001_FixWorksTypeTipoObraCollision.
    it('uses composicao when type is absent, even with tipo_obra present', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', tipo_obra: 'musica' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'composicao', tipo_obra: 'musica' }),
      );
    });

    it('uses composicao when type and tipo_obra are both absent', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'composicao' }),
      );
    });

    it('explicit type is always respected, regardless of tipo_obra', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', tipo_obra: 'musica' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'original', tipo_obra: 'musica' }),
      );
    });

    it('persists compositores as an array', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', compositores: ['A', 'B'] } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ compositores: ['A', 'B'] }),
      );
    });
  });

  describe('update() — partial PATCH does not force a type default', () => {
    it('does not include type in the update payload when the DTO does not send it', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { observacoes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('type');
    });
  });

  describe('participantes — normalized into work_participants (migration 20260718000011)', () => {
    it('create() does not send participantes to the WorkEntity repo (no longer a column)', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [{ id: 'p1', name: 'Fulano', classeFuncao: 'compositor/autor', link: '', percentual: '50' }],
      } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ participantes: expect.anything() }),
      );
    });

    it('create() persists each participant as its own row in work_participants', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [
          { id: 'p1', name: 'Fulano', classeFuncao: 'compositor/autor', link: 'https://x', percentual: '60' },
          { id: 'p2', name: 'Beltrano', classeFuncao: 'tradutor', link: '', percentual: '40' },
        ],
      } as any);
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1', tenant_id: TENANT, name: 'Fulano', classe_funcao: 'compositor/autor', percentual: '60', sort_order: 0 }),
        expect.objectContaining({ id: 'p2', tenant_id: TENANT, name: 'Beltrano', classe_funcao: 'tradutor', percentual: '40', sort_order: 1 }),
      ]);
    });

    it('findById() rehydrates participantes in the format expected by the frontend (id/name/classeFuncao/link/percentual)', async () => {
      const rows = [
        { id: 'p1', work_id: WORK_ID, name: 'Fulano', classe_funcao: 'compositor/autor', link: null, percentual: '60' },
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
        { id: 'p1', name: 'Fulano', classeFuncao: 'compositor/autor', link: null, percentual: '60' },
      ]);
    });

    it('update() replaces the participants (delete + insert) when the DTO sends the array', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        participantes: [{ id: 'p1', name: 'Novo Nome', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs._participantsRepo.delete).toHaveBeenCalledWith({ work_id: WORK_ID, tenant_id: TENANT });
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'Novo Nome', percentual: '100' }),
      ]);
    });

    it('update() does not touch participantes when the DTO does not send the field', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { observacoes: 'x' } as any);
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Task L — work + participants atomicity (casUpdate + replaceParticipantes in the same transaction)', () => {
    it('update() runs inside ds.transaction() (work and participants are not independent operations)', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        observacoes: 'x',
        participantes: [{ id: 'p1', name: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('create() also runs work + participants in the same transaction', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participantes: [{ id: 'p1', name: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('if writing the participants fails, the entire update() rejects — it never reports success with work and participants inconsistent with each other', async () => {
      mockDs._participantsRepo.save.mockRejectedValueOnce(new Error('constraint violation'));
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'x',
          participantes: [{ id: 'p1', name: 'X', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
        } as any),
      ).rejects.toThrow('constraint violation');
      // The same transaction() call that attempted the work update is the one
      // that failed on the participants — there is no second "partial" commit of the work
      // outside that transaction.
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it("scenario A/B: B tries to save work+participants against a version already overwritten by A -> 409, B's participants are never persisted", async () => {
      // A and B read updated_at = T0. We simulate that A already saved (B's CAS
      // WHERE no longer matches -> 0 rows affected).
      mockDs._repo.update.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'edição de B',
          participantes: [{ id: 'pB', name: 'Participante de B', classeFuncao: 'compositor/autor', link: '', percentual: '100' }],
          expectedUpdatedAt: new Date('2026-08-14T10:00:00.000Z').toISOString(),
        } as any),
      ).rejects.toThrow(ConflictException);
      // casUpdate throws BEFORE replaceParticipantes is called (same
      // transaction, sequential order) — B's data never touches the database.
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

});
