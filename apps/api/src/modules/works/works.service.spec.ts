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

  describe('CreateWorkDto — real form payload (CZ-039 canonical contract)', () => {
    const realFormPayload = {
      title: 'Minha Obra',
      music_genre: 'pop',
      language: 'pt',
      ecad_code: 'ECAD-0001',
      society_code: 'ABR-123',
      duration_text: '03:30',
      is_instrumental: false,
      ai_used: false,
      ai_usage_level: null,
      ai_harmony: null,
      ai_melody: null,
      ai_lyrics: null,
      alternative_titles: null,
      related_references: null,
      lyrics: null,
      participants: null,
      status: 'pending',
      composer_names: ['Fulano'],
      translator_names: null,
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      artist_id: null,
      work_origin: 'original',
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

  describe('create() — type and work_origin are independent fields (works.type is NOT NULL)', () => {
    // work_origin (catalog origin: 'original'|'reference') never feeds
    // type (ABRAMUS/ECAD classification: 'composition'|'other'|...) — these were
    // distinct concepts collided by an incorrect fallback, removed in
    // 20260921000001_FixWorksTypeTipoObraCollision.
    it('uses composition when type is absent, even with work_origin present', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', work_origin: 'reference' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'composition', work_origin: 'reference' }),
      );
    });

    it('uses composition when type and work_origin are both absent', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'composition' }),
      );
    });

    it('explicit type is always respected, regardless of work_origin', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', work_origin: 'reference' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'original', work_origin: 'reference' }),
      );
    });

    it('persists composer_names as an array', async () => {
      await service.create(TENANT, 'u1', { title: 'Nova', type: 'original', composer_names: ['A', 'B'] } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ composer_names: ['A', 'B'] }),
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

  describe('participants — normalized into work_participants (migration 20260718000011)', () => {
    it('create() does not send participants to the WorkEntity repo (not a column)', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participants: [{ id: 'p1', name: 'Fulano', role: 'composer_author', link: '', percentage: '50' }],
      } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ participants: expect.anything() }),
      );
    });

    it('create() persists each participant as its own row in work_participants', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participants: [
          { id: 'p1', name: 'Fulano', role: 'composer_author', link: 'https://x', percentage: '60' },
          { id: 'p2', name: 'Beltrano', role: 'translator', link: '', percentage: '40' },
        ],
      } as any);
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1', tenant_id: TENANT, name: 'Fulano', role: 'composer_author', percentage: '60', sort_order: 0 }),
        expect.objectContaining({ id: 'p2', tenant_id: TENANT, name: 'Beltrano', role: 'translator', percentage: '40', sort_order: 1 }),
      ]);
    });

    it('findById() rehydrates participants as {id, name, role, link, percentage}', async () => {
      const rows = [
        { id: 'p1', work_id: WORK_ID, name: 'Fulano', role: 'composer_author', link: null, percentage: '60' },
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
      expect(found.participants).toEqual([
        { id: 'p1', name: 'Fulano', role: 'composer_author', link: null, percentage: '60' },
      ]);
    });

    it('update() replaces the participants (delete + insert) when the DTO sends the array', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        participants: [{ id: 'p1', name: 'Novo Nome', role: 'composer_author', link: '', percentage: '100' }],
      } as any);
      expect(mockDs._participantsRepo.delete).toHaveBeenCalledWith({ work_id: WORK_ID, tenant_id: TENANT });
      expect(mockDs._participantsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'Novo Nome', percentage: '100' }),
      ]);
    });

    it('update() does not touch participants when the DTO does not send the field', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { observacoes: 'x' } as any);
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Task L — work + participants atomicity (casUpdate + replaceParticipants in the same transaction)', () => {
    it('update() runs inside ds.transaction() (work and participants are not independent operations)', async () => {
      await service.update(TENANT, 'u1', WORK_ID, {
        observacoes: 'x',
        participants: [{ id: 'p1', name: 'X', role: 'composer_author', link: '', percentage: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('create() also runs work + participants in the same transaction', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Nova', type: 'original',
        participants: [{ id: 'p1', name: 'X', role: 'composer_author', link: '', percentage: '100' }],
      } as any);
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('if writing the participants fails, the entire update() rejects — it never reports success with work and participants inconsistent with each other', async () => {
      mockDs._participantsRepo.save.mockRejectedValueOnce(new Error('constraint violation'));
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'x',
          participants: [{ id: 'p1', name: 'X', role: 'composer_author', link: '', percentage: '100' }],
        } as any),
      ).rejects.toThrow('constraint violation');
      // The same transaction() call that attempted the work update is the one
      // that failed on the participants — there is no second "partial" commit of the work
      // outside that transaction.
      expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    });

    it('participants: null leaves the stored participants untouched (no TypeError/500); [] clears them', async () => {
      await service.update(TENANT, 'u1', WORK_ID, { title: 'x', participants: null } as any);
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      await service.update(TENANT, 'u1', WORK_ID, { title: 'x', participants: [] } as any);
      expect(mockDs._participantsRepo.delete).toHaveBeenCalledTimes(1);
    });

    it("scenario A/B: B tries to save work+participants against a version already overwritten by A -> 409, B's participants are never persisted", async () => {
      // A and B read updated_at = T0. We simulate that A already saved (B's CAS
      // WHERE no longer matches -> 0 rows affected).
      mockDs._repo.update.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.update(TENANT, 'u1', WORK_ID, {
          observacoes: 'edição de B',
          participants: [{ id: 'pB', name: 'Participante de B', role: 'composer_author', link: '', percentage: '100' }],
          expectedUpdatedAt: new Date('2026-08-14T10:00:00.000Z').toISOString(),
        } as any),
      ).rejects.toThrow(ConflictException);
      // casUpdate throws BEFORE replaceParticipants is called (same
      // transaction, sequential order) — B's data never touches the database.
      expect(mockDs._participantsRepo.delete).not.toHaveBeenCalled();
      expect(mockDs._participantsRepo.save).not.toHaveBeenCalled();
    });
  });

});
