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

describe('PhonogramsService — Estado B (pré-C2, comportamento atual documentado)', () => {
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

  describe('CreatePhonogramDto — validação', () => {
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
      instrumental: false,
      nacional: true,
      pub_simultanea: false,
      emissao: null,
      gravacao_original: null,
      data_lancamento: null,
      duracao: '03:30',
      duracao_min: 3,
      duracao_seg: 30,
      midia: null,
      classificacao: null,
      pais_origem: null,
      pais_publicacao: null,
      gravadora: null,
      observacoes: null,
      status: 'pending',
      participacao: null,
      arquivo_audio: null,
    };

    it('aceita o payload PT-BR real do frontend (todos os 21 campos físicos da migration)', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('ainda aceita o payload EN legado (title/workId/artistId)', async () => {
      const errors = await validateDto({
        title: 'Noite Estrelada',
        workId: '123e4567-e89b-12d3-a456-426614174000',
        artistId: '223e4567-e89b-12d3-a456-426614174000',
      });
      expect(errors).toEqual([]);
    });

    it('rejeita campo desconhecido (whitelist)', async () => {
      const errors = await validateDto({ title: 'X', campo_inexistente: 'y' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });
  });

  describe('create() — obrigatoriedade de título', () => {
    it('lança BadRequestException quando title e titulo estão ausentes, sem chamar o repositório', async () => {
      await expect(
        service.create(TENANT, 'u1', {} as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockDs._repo.save).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando title e titulo são strings em branco', async () => {
      await expect(
        service.create(TENANT, 'u1', { title: '   ', titulo: '' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockDs._repo.save).not.toHaveBeenCalled();
    });
  });

  describe('create() — resolução PT/EN via normalizador (C2)', () => {
    it('titulo (PT legado) sozinho é persistido em title', async () => {
      await service.create(TENANT, 'u1', { titulo: 'Nome PT' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nome PT' }),
      );
    });

    it('title (EN, canônico) sozinho é persistido', async () => {
      await service.create(TENANT, 'u1', { title: 'Nome EN' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nome EN' }),
      );
    });

    // C2: mudança intencional de contrato — antes PT vencia silenciosamente;
    // agora valores conflitantes (não-equivalentes) são rejeitados com 400
    // antes de qualquer chamada ao repository.
    it('quando ambos presentes e diferentes: 400 PHONOGRAM_ALIAS_CONFLICT, repository não chamado', async () => {
      await expect(
        service.create(TENANT, 'u1', { title: 'Nome EN', titulo: 'Nome PT' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('work_id (PT) e workId (EN) diferentes: 400 PHONOGRAM_ALIAS_CONFLICT, repository não chamado', async () => {
      await expect(
        service.create(TENANT, 'u1', {
          title: 'X',
          work_id: '123e4567-e89b-12d3-a456-426614174000',
          workId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('artist_id (PT) e artistId (EN) diferentes: 400 PHONOGRAM_ALIAS_CONFLICT, repository não chamado', async () => {
      await expect(
        service.create(TENANT, 'u1', {
          title: 'X',
          artist_id: '123e4567-e89b-12d3-a456-426614174000',
          artistId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.create).not.toHaveBeenCalled();
    });

    it('titulo ausente (undefined explícito) + title=valor → title persistido com o valor de title', async () => {
      await service.create(TENANT, 'u1', { title: 'ok', titulo: undefined } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'ok' }),
      );
    });

    it('work_id e workId equivalentes (mesmo UUID, case-insensitive): aceito, valor canônico persistido', async () => {
      await service.create(TENANT, 'u1', {
        title: 'X',
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '123E4567-E89B-12D3-A456-426614174000',
      } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ work_id: '123e4567-e89b-12d3-a456-426614174000' }),
      );
    });

    it('warning é emitido quando um alias legado é efetivamente recebido', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.create(TENANT, 'u1', { titulo: 'Nome PT' } as any);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Phonogram legacy alias used: alias=titulo operation=create tenantId=tenant-test'),
      );
    });

    it('nenhum warning é emitido quando apenas campos canônicos são usados', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.create(TENANT, 'u1', { title: 'X' } as any);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('create() — type default aplicado somente no create', () => {
    it("aplica type='master' quando o DTO não envia type", async () => {
      await service.create(TENANT, 'u1', { title: 'X' } as any);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'master' }),
      );
    });

    // C2: payload reescrito para usar aliases equivalentes (não mais
    // conflitantes) — o objetivo original do teste (resposta contém somente
    // nomes canônicos, sem aliases legados) é preservado.
    it('resposta do create não contém aliases legados (titulo/workId/artistId/duration/fileUrl)', async () => {
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

  describe('update() — PATCH parcial não sobrescreve type', () => {
    it('não inclui type no payload de update quando o DTO não o envia', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { observacoes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('type');
    });

    it('preserva type enviado explicitamente no update', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { type: 'remix' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toHaveProperty('type', 'remix');
    });
  });

  describe('update() — resolução de aliases (C2)', () => {
    it('PATCH sem title/titulo/work_id/artist_id: nenhum desses campos é alterado (ausência não altera)', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { observacoes: 'x' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('title');
      expect(updateCall[1]).not.toHaveProperty('work_id');
      expect(updateCall[1]).not.toHaveProperty('artist_id');
    });

    it('alias legado em update: aceito e resolvido para o nome canônico', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { titulo: 'Novo Nome' } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ title: 'Novo Nome' });
      expect(updateCall[1]).not.toHaveProperty('titulo');
    });

    it('warning emitido no update quando alias legado é usado (inclui phonogramId)', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.update(TENANT, 'u1', PHONO_ID, { titulo: 'Novo Nome' } as any);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`operation=update tenantId=${TENANT} phonogramId=${PHONO_ID}`),
      );
    });

    it('conflito PT/EN no update: 400, repository.update não chamado', async () => {
      await expect(
        service.update(TENANT, 'u1', PHONO_ID, { title: 'A', titulo: 'B' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo.update).not.toHaveBeenCalled();
    });

    it('title inválido (vazio) no update: 400, repository.update não chamado', async () => {
      await expect(
        service.update(TENANT, 'u1', PHONO_ID, { title: '' } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_TITLE_INVALID' } });
      expect(mockDs._repo.update).not.toHaveBeenCalled();
    });

    it('null opcional (work_id) sozinho no update: aceito, removido antes da persistência (não limpa coluna nesta fase)', async () => {
      await service.update(TENANT, 'u1', PHONO_ID, { work_id: null } as any);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('work_id');
    });
  });

  describe('list() — resolução de aliases de work_id/artist_id (C2)', () => {
    it('work_id: filtra pelo canônico', async () => {
      await service.list(TENANT, { work_id: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('workId (alias legado): filtra pelo canônico e emite warning', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.list(TENANT, { workId: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('alias=workId operation=list'));
    });

    it('work_id e workId iguais: aceita e filtra normalmente', async () => {
      await service.list(TENANT, {
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '123e4567-e89b-12d3-a456-426614174000',
      } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.work_id = :workId', { workId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('work_id e workId conflitantes: 400 antes do query builder', async () => {
      await expect(
        service.list(TENANT, {
          work_id: '123e4567-e89b-12d3-a456-426614174000',
          workId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
      expect(mockDs._repo._qb.getManyAndCount).not.toHaveBeenCalled();
    });

    it('artist_id: filtra pelo canônico', async () => {
      await service.list(TENANT, { artist_id: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.artist_id = :artistId', { artistId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('artistId (alias legado): filtra pelo canônico e emite warning', async () => {
      await service.list(TENANT, { artistId: '123e4567-e89b-12d3-a456-426614174000' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith(
        'p.artist_id = :artistId', { artistId: '123e4567-e89b-12d3-a456-426614174000' },
      );
    });

    it('artist_id e artistId conflitantes: 400', async () => {
      await expect(
        service.list(TENANT, {
          artist_id: '123e4567-e89b-12d3-a456-426614174000',
          artistId: '223e4567-e89b-12d3-a456-426614174000',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PHONOGRAM_ALIAS_CONFLICT' } });
    });

    it('ausência de work_id/artist_id: não adiciona filtro para esses campos', async () => {
      await service.list(TENANT, { status: 'active' } as any);
      const calledWithObraId = mockDs._repo._qb.andWhere.mock.calls.some((c: unknown[]) => c[0] === 'p.work_id = :workId');
      const calledWithArtistaId = mockDs._repo._qb.andWhere.mock.calls.some((c: unknown[]) => c[0] === 'p.artist_id = :artistId');
      expect(calledWithObraId).toBe(false);
      expect(calledWithArtistaId).toBe(false);
    });

    it('demais filtros (status, search) continuam funcionando', async () => {
      await service.list(TENANT, { status: 'active', search: 'noite' } as any);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('p.status = :status', { status: 'active' });
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('p.title ILIKE :search', { search: '%noite%' });
    });
  });

  it('findById lança NotFoundException para fonograma inexistente', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });
});
