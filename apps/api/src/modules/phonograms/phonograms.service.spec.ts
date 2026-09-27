import 'reflect-metadata';
import { Test }              from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance }   from 'class-transformer';
import { validate }          from 'class-validator';
import { PhonogramsService } from './phonograms.service';
import { CreatePhonogramDto } from './dto/create-phonogram.dto';
import { DATA_SOURCE }       from '../../database/database.module';
import { EventsService }     from '../../core/events/events.service';

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreatePhonogramDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const TENANT = 'tenant-test';
const PHONO_ID = 'phono-test';
const mockPhono = { id: PHONO_ID, tenant_id: TENANT, title: 'Test', type: 'master', deleted_at: null };

const buildMockQb = (getOneValue: any = mockPhono) => {
  const qb: any = {
    where:           jest.fn(),
    andWhere:        jest.fn(),
    getOne:          jest.fn().mockResolvedValue(getOneValue),
    getManyAndCount: jest.fn().mockResolvedValue([[mockPhono], 1]),
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

const buildMockDs = (getOneValue: any = mockPhono) => {
  const qb   = buildMockQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save:   jest.fn((v: any) => Promise.resolve({ id: PHONO_ID, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };
  return {
    getRepository: jest.fn(() => repo),
    // assertSameTenantFk's ownership check — a truthy row means "found, same
    // tenant", so tests not focused on that behavior aren't coupled to it.
    query: jest.fn().mockResolvedValue([{ exists: 1 }]),
    _repo: repo,
  };
};

describe('PhonogramsService — State B (pre-C2, current behavior documented)', () => {
  let service: PhonogramsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDs = buildMockDs();
    const module = await Test.createTestingModule({
      providers: [
        PhonogramsService,
        { provide: DATA_SOURCE, useValue: mockDs },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();
    service = module.get<PhonogramsService>(PhonogramsService);
  });

  describe('CreatePhonogramDto — validation', () => {
    const realFormPayload = {
      title: 'Noite Estrelada',
      work_id: '123e4567-e89b-12d3-a456-426614174000',
      artist_id: '223e4567-e89b-12d3-a456-426614174000',
      cod_ecad: null,
      cod_entidade: null,
      agregadora: null,
      isrc_pais: 'BR',
      isrc_registrante: 'ABC',
      isrc_ano: '25',
      isrc_designacao: '12345',
      criada_por_ia: false,
      is_instrumental: false,
      nacional: true,
      pub_simultanea: false,
      emissao: null,
      gravacao_original: null,
      data_lancamento: null,
      duration_text: '03:30',
      duracao_min: 3,
      duracao_seg: 30,
      midia: null,
      classificacao: null,
      pais_origem: null,
      pais_publicacao: null,
      gravadora: null,
      notes: null,
      status: 'pending',
      participacao: null,
      arquivo_audio: null,
    };

    it('accepts the real PT-BR payload from the frontend (all 21 physical fields from the migration)', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('still accepts the legacy EN payload (title/workId/artistId)', async () => {
      const errors = await validateDto({
        title: 'Noite Estrelada',
        workId: '123e4567-e89b-12d3-a456-426614174000',
        artistId: '223e4567-e89b-12d3-a456-426614174000',
      });
      expect(errors).toEqual([]);
    });

    // participacao: real bug found during naming-closure Phase 2 --
    // the previous shape (`@IsArray() participacao?: unknown[]`) rejected the
    // real object that PhonogramFormModal.tsx always sent
    // (ParticipacaoCategoria: { produtorFonografico, interprete,
    // musicoAcompanhante }), with "participacao must be an array" on EVERY
    // real submit with participants filled in -- verified
    // empirically before the fix. ParticipacaoDto fixes the shape.
    it('accepts the real participacao shape (object with array categories, not an array)', async () => {
      const errors = await validateDto({
        title: 'Noite Estrelada',
        participacao: {
          produtorFonografico: [{ id: '1', name: 'Produtor A', percentual: '50' }],
          interprete: [{ id: '2', name: 'Intérprete B', percentual: '50' }],
          musicoAcompanhante: [],
        },
      });
      expect(errors).toEqual([]);
    });

    it('rejects participacao in the old incorrect shape (array, not object)', async () => {
      const errors = await validateDto({
        title: 'Noite Estrelada',
        participacao: [{ role: 'interprete', name: 'X' }],
      });
      expect(errors.some((e) => e.property === 'participacao')).toBe(true);
    });

    it('rejects malformed participant inside a category (non-string percentual)', async () => {
      const errors = await validateDto({
        title: 'Noite Estrelada',
        participacao: { interprete: [{ id: '1', name: 'X', percentual: 50 }] },
      });
      expect(errors.some((e) => e.property === 'participacao')).toBe(true);
    });

    it('rejects unknown field (whitelist)', async () => {
      const errors = await validateDto({ title: 'X', campo_inexistente: 'y' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });
  });

  describe('create() — title required', () => {
    it('throws BadRequestException when title and titulo are absent, without calling the repository', async () => {
      await expect(
        service.create(TENANT, 'u1', {} as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockDs._repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when title and titulo are blank strings', async () => {
      await expect(
        service.create(TENANT, 'u1', { title: '   ', titulo: '' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockDs._repo.save).not.toHaveBeenCalled();
    });
  });

  describe('create() — PT/EN resolution via normalizer (C2)', () => {
    it('titulo (PT legacy) alone is persisted to title', async () => {
      await service.create(TENANT, 'u1', { titulo: 'Nome PT' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nome PT' }),
      );
    });

    it('title (EN, canonical) alone is persisted', async () => {
      await service.create(TENANT, 'u1', { title: 'Nome EN' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nome EN' }),
      );
    });

    // C2: intentional contract change — previously PT silently won;
    // now conflicting (non-equivalent) values are rejected with 400
    // before any call to the repository.
    it('when both present and different: 400 PHONOGRAM_ALIAS_CONFLICT, repository not called', async () => {
      await expect(
        service.create(TENANT, 'u1', { title: 'Nome EN', titulo: 'Nome PT' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('work_id (PT) and workId (EN) different: 400 PHONOGRAM_ALIAS_CONFLICT, repository not called', async () => {
      await expect(
        service.create(TENANT, 'u1', {
          title: 'X',
          work_id: '123e4567-e89b-12d3-a456-426614174000',
          workId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('artist_id (PT) and artistId (EN) different: 400 PHONOGRAM_ALIAS_CONFLICT, repository not called', async () => {
      await expect(
        service.create(TENANT, 'u1', {
          title: 'X',
          artist_id: '123e4567-e89b-12d3-a456-426614174000',
          artistId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('absent titulo (explicit undefined) + title=value → title persisted with the value of title', async () => {
      await service.create(TENANT, 'u1', { title: 'ok', titulo: undefined } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'ok' }),
      );
    });

    it('work_id and workId equivalent (same UUID, case-insensitive): accepted, canonical value persisted', async () => {
      await service.create(TENANT, 'u1', {
        title: 'X',
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '123E4567-E89B-12D3-A456-426614174000',
      } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ work_id: '123e4567-e89b-12d3-a456-426614174000' }),
      );
    });

    it('warning is emitted when a legacy alias is actually received', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.create(TENANT, 'u1', { titulo: 'Nome PT' } as any);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Phonogram legacy alias used: alias=titulo operation=create tenantId=tenant-test'),
      );
    });

    it('no warning is emitted when only canonical fields are used', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.create(TENANT, 'u1', { title: 'X' } as any);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('create() — type default applied only on create', () => {
    it("applies type='master' when the DTO sends no type", async () => {
      await service.create(TENANT, 'u1', { title: 'X' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'master' }),
      );
    });

    // C2: payload rewritten to use equivalent aliases (no longer
    // conflicting) — the original test goal (response contains only
    // canonical names, no legacy aliases) is preserved.
    it('create response does not contain legacy aliases (titulo/workId/artistId/duration/fileUrl)', async () => {
      await service.create(TENANT, 'u1', {
        title: 'X', titulo: 'X',
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '123e4567-e89b-12d3-a456-426614174000',
        artist_id: '223e4567-e89b-12d3-a456-426614174000',
        artistId: '223e4567-e89b-12d3-a456-426614174000',
        duration: 120, fileUrl: 'x.mp3',
      } as any);
      const created = mockDs._repo.create.mock.calls[0][0];
      expect(created).not.toHaveProperty('titulo');
      expect(created).not.toHaveProperty('workId');
      expect(created).not.toHaveProperty('artistId');
      expect(created).not.toHaveProperty('duration');
      expect(created).not.toHaveProperty('fileUrl');
      expect(created).toMatchObject({
        title: 'X',
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        artist_id: '223e4567-e89b-12d3-a456-426614174000',
      });
    });
  });

  describe('update() — partial PATCH does not overwrite type', () => {
    it('does not include type in the update payload when the DTO does not send it', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { notes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('type');
    });

    it('preserves type explicitly sent in the update', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { type: 'remix' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toHaveProperty('type', 'remix');
    });
  });

  describe('update() — alias resolution (C2)', () => {
    it('PATCH without title/titulo/work_id/artist_id: none of these fields is changed (absence does not change)', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { notes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('title');
      expect(updateCall[1]).not.toHaveProperty('work_id');
      expect(updateCall[1]).not.toHaveProperty('artist_id');
    });

    it('legacy alias in update: accepted and resolved to the canonical name', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { titulo: 'Novo Nome' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ title: 'Novo Nome' });
      expect(updateCall[1]).not.toHaveProperty('titulo');
    });

    it('warning emitted on update when a legacy alias is used (includes phonogramId)', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.update(TENANT, 'u1', PHONO_ID, { titulo: 'Novo Nome' } as any);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`operation=update tenantId=${TENANT} phonogramId=${PHONO_ID}`),
      );
    });

    it('PT/EN conflict on update: 400, repository.update not called', async () => {
      await expect(
        service.update(TENANT, 'u1', PHONO_ID, { title: 'A', titulo: 'B' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.update).not.toHaveBeenCalled();
    });

    it('invalid title (empty) on update: 400, repository.update not called', async () => {
      await expect(
        service.update(TENANT, 'u1', PHONO_ID, { title: '' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_TITLE_INVALID' } });
      expect(mockDs._repo.update).not.toHaveBeenCalled();
    });

    it('optional null (work_id) alone on update: accepted, removed before persistence (does not clear the column at this stage)', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { work_id: null } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('work_id');
    });
  });

  describe('list() — work_id/artist_id alias resolution (C2)', () => {
    it('work_id: filters by the canonical field', async () => {
      await service.list(TENANT, { work_id: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('workId (legacy alias): filters by the canonical field and emits a warning', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.list(TENANT, { workId: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('alias=workId operation=list'));
    });

    it('work_id and workId equal: accepts and filters normally', async () => {
      await service.list(TENANT, {
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '123e4567-e89b-12d3-a456-426614174000',
      } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('work_id and workId conflicting: 400 before the query builder', async () => {
      await expect(
        service.list(TENANT, {
          work_id: '123e4567-e89b-12d3-a456-426614174000',
          workId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo._qb.getManyAndCount).not.toHaveBeenCalled();
    });

    it('artist_id: filters by the canonical field', async () => {
      await service.list(TENANT, { artist_id: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.artist_id = :artistId', { artistId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('artistId (legacy alias): filters by the canonical field and emits a warning', async () => {
      await service.list(TENANT, { artistId: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.artist_id = :artistId', { artistId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('artist_id and artistId conflicting: 400', async () => {
      await expect(
        service.list(TENANT, {
          artist_id: '123e4567-e89b-12d3-a456-426614174000',
          artistId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
    });

    it('absence of work_id/artist_id: does not add a filter for those fields', async () => {
      await service.list(TENANT, { status: 'active' } as any);
      const calledWithWorkId = mockDs._repo._qb.andWhere.mock.calls.some((c: unknown[]) => c[0] === 'p.work_id = :workId');
      const calledWithArtistId = mockDs._repo._qb.andWhere.mock.calls.some((c: unknown[]) => c[0] === 'p.artist_id = :artistId');
      expect(calledWithWorkId).toBe(false);
      expect(calledWithArtistId).toBe(false);
    });

    it('other filters (status, search) keep working', async () => {
      await service.list(TENANT, { status: 'active', search: 'noite' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('p.status = :status', { status: 'active' });
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('p.title ILIKE :search', { search: '%noite%' });
    });
  });

  it('findById throws NotFoundException for a nonexistent phonogram', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });
});
