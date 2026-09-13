import 'reflect-metadata';
import { Test }              from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance }   from 'class-transformer';
import { validate }          from 'class-validator';
import { EventsService }     from './events.service';
import { CreateEventDto }    from './dto/events.dto';
import { DATA_SOURCE }       from '../../database/database.module';

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateEventDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const TENANT = 'tenant-test';
const EVENT_ID = 'event-test';
const mockEvent = { id: EVENT_ID, tenant_id: TENANT, title: 'Show', type: 'show', data: new Date('2026-08-01T20:00:00Z'), deleted_at: null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const buildMockQb = (getOneValue: any = mockEvent) => {
  const qb: any = {
    where:           jest.fn(),
    andWhere:        jest.fn(),
    orderBy:         jest.fn(),
    skip:            jest.fn(),
    take:            jest.fn(),
    getOne:          jest.fn().mockResolvedValue(getOneValue),
    getManyAndCount: jest.fn().mockResolvedValue([[mockEvent], 1]),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
};

const buildMockDs = (getOneValue: any = mockEvent) => {
  const qb   = buildMockQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save:   jest.fn((v: any) => Promise.resolve({ id: EVENT_ID, ...v })),
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

describe('EventsService — Estado P (pré-C3, comportamento atual documentado)', () => {
  let service: EventsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDs = buildMockDs();
    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });

  describe('CreateEventDto — validação', () => {
    // Payload real do SchedulerFormModal.buildPayload() (create): title/type
    // obrigatórios, startsAt/endsAt ISO, venue/artistId/capacity/metadata.
    const realFormPayload = {
      title: 'Show de Lançamento',
      type: 'show',
      artistId: 'a-1',
      venue: 'Teatro Municipal',
      startsAt: '2026-08-01T20:00:00.000Z',
      endsAt: '2026-08-01T23:00:00.000Z',
      capacity: 500,
      metadata: { endereco: 'Rua X', valor_cache: '1000.00' },
    };

    it('aceita o payload real do SchedulerFormModal', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('aceita os campos do formulário com coluna própria (regra 2026-07-12)', async () => {
      const errors = await validateDto({
        title: 'Show', type: 'show',
        endereco: 'Rua X, 100', contato_local: 'Fulano',
        valor_cache: 1500.5, publico_esperado: 300,
        descricao: 'desc', participantes: [{ id: 'p1' }],
      });
      expect(errors).toEqual([]);
    });

    it('rejeita campo desconhecido (whitelist)', async () => {
      const errors = await validateDto({ title: 'X', type: 'show', campo_inexistente: 'y' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });

    it('rejeita startsAt inválido (data não parseável)', async () => {
      const errors = await validateDto({ title: 'X', type: 'show', startsAt: 'nao-e-data' });
      expect(errors.some((e) => e.property === 'startsAt')).toBe(true);
    });
  });

  describe('create() — mapeamento dtoToEntity atual', () => {
    it('startsAt persiste na coluna data', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: new Date('2026-08-01T20:00:00Z') }),
      );
    });

    it('endsAt persiste na coluna end_date', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show',
        startsAt: new Date('2026-08-01T20:00:00Z'),
        endsAt: new Date('2026-08-01T23:00:00Z'),
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ end_date: new Date('2026-08-01T23:00:00Z') }),
      );
    });

    it('campos do formulário são persistidos nas colunas próprias', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date(),
        endereco: 'Rua X', contato_local: 'Fulano',
        valor_cache: 1500.5, publico_esperado: 300,
        descricao: 'desc', participantes: [{ id: 'p1' }],
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endereco: 'Rua X',
          contato_local: 'Fulano',
          valor_cache: '1500.5',
          publico_esperado: 300,
          descricao: 'desc',
          participantes: [{ id: 'p1' }],
        }),
      );
    });

    it('create sem startsAt usa o fallback atual (data = agora, coluna NOT NULL)', async () => {
      const before = Date.now();
      await service.create(TENANT, 'u1', { title: 'Show', type: 'show' } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date };
      expect(created.data).toBeInstanceOf(Date);
      expect(created.data.getTime()).toBeGreaterThanOrEqual(before);
    });

    // C3/E2 — ajuste legítimo: a resposta agora contém também starts_at
    // (dual-write). `data` permanece presente até a fase E6.
    it('resposta contém data e starts_at com o mesmo instante (E2)', async () => {
      const saved = await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never) as { data: Date; starts_at: Date };
      expect(saved).toHaveProperty('data');
      expect(saved).toHaveProperty('starts_at');
      expect(saved.starts_at.getTime()).toBe(saved.data.getTime());
      expect(saved).not.toHaveProperty('start_date');
      expect(saved).not.toHaveProperty('startsAt');
    });
  });

  describe('create()/update() — dual-write data/starts_at (C3/E2)', () => {
    it('startsAt explícito grava data e starts_at com a MESMA referência Date', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date; starts_at: Date };
      expect(created.starts_at).toBe(created.data); // mesma referência, não só mesmo valor
      expect(created.data.getTime()).toBe(new Date('2026-08-01T20:00:00Z').getTime());
    });

    it('fallback sem startsAt grava o mesmo instante em ambas (uma única new Date())', async () => {
      await service.create(TENANT, 'u1', { title: 'Show', type: 'show' } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date; starts_at: Date };
      expect(created.starts_at).toBe(created.data);
    });

    it('endsAt continua indo somente para end_date — não alimenta starts_at', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { endsAt: new Date('2026-08-01T23:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ end_date: new Date('2026-08-01T23:00:00Z') });
      expect(updateCall[1]).not.toHaveProperty('starts_at');
      expect(updateCall[1]).not.toHaveProperty('data');
    });

    it('update com startsAt atualiza ambos com o mesmo valor', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: new Date('2026-09-01T20:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        data: new Date('2026-09-01T20:00:00Z'),
        starts_at: new Date('2026-09-01T20:00:00Z'),
      });
    });

    it('PATCH sem startsAt não envia data nem starts_at', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('starts_at');
    });

    it('startsAt null não envia data nem starts_at (semântica atual preservada)', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: null } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('starts_at');
    });

    it('nenhum caminho de create escreve apenas uma das colunas quando há valor de início', async () => {
      await service.create(TENANT, 'u1', {
        title: 'A', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never);
      await service.create(TENANT, 'u1', { title: 'B', type: 'show' } as never);
      for (const call of mockDs._repo.create.mock.calls) {
        const payload = call[0] as { data?: Date; starts_at?: Date };
        expect(payload.data).toBeInstanceOf(Date);
        expect(payload.starts_at).toBeInstanceOf(Date);
        expect(payload.starts_at!.getTime()).toBe(payload.data!.getTime());
      }
    });

    it('list() continua ordenando por e.data — leitura canônica só na fase E4', async () => {
      await service.list(TENANT, {} as never);
      expect(mockDs._repo._qb.orderBy).toHaveBeenCalledWith('e.data', 'DESC');
      expect(mockDs._repo._qb.orderBy).not.toHaveBeenCalledWith('e.starts_at', expect.anything());
    });
  });

  describe('update() — PATCH parcial', () => {
    it('PATCH sem startsAt não altera data', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
    });

    it('PATCH sem endsAt não altera end_date', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('end_date');
    });

    it('startsAt no PATCH atualiza data', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: new Date('2026-09-01T20:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ data: new Date('2026-09-01T20:00:00Z') });
    });

    it('endsAt no PATCH atualiza end_date', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { endsAt: new Date('2026-09-01T23:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ end_date: new Date('2026-09-01T23:00:00Z') });
    });

    it('campos do formulário são atualizáveis', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { endereco: 'Rua Nova' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ endereco: 'Rua Nova' });
    });

    it('null preserva a semântica atual de "não alterar" (dtoToEntity usa != null)', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: null, venue: null } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('local');
    });
  });

  describe('list() — comportamento atual documentado (pré-C3, sem correção)', () => {
    it('ordena por e.data (coluna legada)', async () => {
      await service.list(TENANT, {} as never);
      expect(mockDs._repo._qb.orderBy).toHaveBeenCalledWith('e.data', 'DESC');
    });

    // Documentação do bug pré-existente (dívida C3.5): o DTO declarava type/artistId
    // (EN) enquanto o service lia tipo/artist_id/dateFrom/dateTo — o filtro type
    // nunca funcionava via HTTP real. A normalização de nomenclatura (2026-09-05,
    // tipo -> type) corrigiu esse mismatch especificamente para type (a coluna
    // física passou a se chamar type, igual ao nome já declarado no DTO).
    // artistId continua com o mismatch documentado abaixo — dívida C3.5 separada.
    it('filtro type (nome declarado no DTO) agora É aplicado pelo service (corrigido por tipo -> type)', async () => {
      await service.list(TENANT, { type: 'show' } as never);
      const calls = mockDs._repo._qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).toContain('e.type = :type');
    });

    it('filtro artistId (nome declarado no DTO) NÃO é aplicado pelo service', async () => {
      await service.list(TENANT, { artistId: 'a-1' } as never);
      const calls = mockDs._repo._qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain('e.artist_id = :artistId');
    });

    it('status (único filtro alinhado DTO↔service) é aplicado', async () => {
      await service.list(TENANT, { status: 'scheduled' } as never);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'scheduled' });
    });
  });

  it('findById lança NotFoundException para evento inexistente', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });
});
