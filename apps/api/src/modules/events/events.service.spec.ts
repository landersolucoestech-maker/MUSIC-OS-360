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

describe('EventsService — State P (pre-C3, current documented behavior)', () => {
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

  describe('CreateEventDto — validation', () => {
    // Real payload from SchedulerFormModal.buildPayload() (create): title/type
    // required, startsAt/endsAt ISO, venue/artistId/capacity/metadata.
    const realFormPayload = {
      title: 'Show de Lançamento',
      type: 'show',
      artistId: 'a-1',
      venue: 'Teatro Municipal',
      startsAt: '2026-08-01T20:00:00.000Z',
      endsAt: '2026-08-01T23:00:00.000Z',
      capacity: 500,
      metadata: { note: 'Rua X', source: 'scheduler' },
    };

    it('accepts the real payload from SchedulerFormModal', async () => {
      const errors = await validateDto(realFormPayload);
      expect(errors).toEqual([]);
    });

    it('accepts the form fields with their own column (rule 2026-07-12)', async () => {
      const errors = await validateDto({
        title: 'Show', type: 'show',
        address: 'Rua X, 100', venue_contact: 'Fulano',
        fee_amount: 1500.5, expected_attendance: 300,
        description: 'desc', participants: [{ id: 'p1' }],
      });
      expect(errors).toEqual([]);
    });

    it('still accepts the deprecated PT field names during the deploy-skew window (CZ-028)', async () => {
      const errors = await validateDto({
        title: 'Show', type: 'show',
        endereco: 'Rua X, 100', contato_local: 'Fulano', publico_esperado: 300, participantes: [{ id: 'p1' }],
      });
      expect(errors).toEqual([]);
    });

    it('rejects an unknown field (whitelist)', async () => {
      const errors = await validateDto({ title: 'X', type: 'show', campo_inexistente: 'y' });
      expect(errors.some((e) => e.property === 'campo_inexistente')).toBe(true);
    });

    it('rejects invalid startsAt (unparseable date)', async () => {
      const errors = await validateDto({ title: 'X', type: 'show', startsAt: 'nao-e-data' });
      expect(errors.some((e) => e.property === 'startsAt')).toBe(true);
    });
  });

  describe('create() — current dtoToEntity mapping', () => {
    it('startsAt persists in the data column', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: new Date('2026-08-01T20:00:00Z') }),
      );
    });

    it('endsAt persists in the end_date column', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show',
        startsAt: new Date('2026-08-01T20:00:00Z'),
        endsAt: new Date('2026-08-01T23:00:00Z'),
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ end_date: new Date('2026-08-01T23:00:00Z') }),
      );
    });

    it('form fields are persisted in their own columns', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date(),
        address: 'Rua X', venue_contact: 'Fulano',
        fee_amount: 1500.5, expected_attendance: 300,
        description: 'desc', participants: [{ id: 'p1' }],
      } as never);
      expect(mockDs._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Rua X',
          venue_contact: 'Fulano',
          fee_amount: '1500.5',
          expected_attendance: 300,
          description: 'desc',
          participants: [{ id: 'p1' }],
        }),
      );
    });

    it('a pre-canonical payload (endereco, contato_local, publico_esperado, participantes) is persisted canonically (CZ-028)', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date(), venue: 'Teatro',
        endereco: 'Rua X', contato_local: 'Fulano', publico_esperado: 300, participantes: [{ id: 'p1' }],
      } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as Record<string, unknown>;
      expect(created).toMatchObject({
        venue: 'Teatro', address: 'Rua X', venue_contact: 'Fulano', expected_attendance: 300, participants: [{ id: 'p1' }],
      });
      for (const legacy of ['local', 'endereco', 'contato_local', 'publico_esperado', 'participantes']) {
        expect(created).not.toHaveProperty(legacy);
      }
    });

    it('create without startsAt uses the current fallback (data = now, NOT NULL column)', async () => {
      const before = Date.now();
      await service.create(TENANT, 'u1', { title: 'Show', type: 'show' } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date };
      expect(created.data).toBeInstanceOf(Date);
      expect(created.data.getTime()).toBeGreaterThanOrEqual(before);
    });

    // C3/E2 — legitimate adjustment: the response now also contains starts_at
    // (dual-write). `data` remains present until phase E6.
    it('response contains data and starts_at with the same instant (E2)', async () => {
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
    it('explicit startsAt writes data and starts_at with the SAME Date reference', async () => {
      await service.create(TENANT, 'u1', {
        title: 'Show', type: 'show', startsAt: new Date('2026-08-01T20:00:00Z'),
      } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date; starts_at: Date };
      expect(created.starts_at).toBe(created.data); // same reference, not just the same value
      expect(created.data.getTime()).toBe(new Date('2026-08-01T20:00:00Z').getTime());
    });

    it('fallback without startsAt writes the same instant in both (a single new Date())', async () => {
      await service.create(TENANT, 'u1', { title: 'Show', type: 'show' } as never);
      const created = mockDs._repo.create.mock.calls[0][0] as { data: Date; starts_at: Date };
      expect(created.starts_at).toBe(created.data);
    });

    it('endsAt still only goes to end_date — does not feed starts_at', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { endsAt: new Date('2026-08-01T23:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ end_date: new Date('2026-08-01T23:00:00Z') });
      expect(updateCall[1]).not.toHaveProperty('starts_at');
      expect(updateCall[1]).not.toHaveProperty('data');
    });

    it('update with startsAt updates both with the same value', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: new Date('2026-09-01T20:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        data: new Date('2026-09-01T20:00:00Z'),
        starts_at: new Date('2026-09-01T20:00:00Z'),
      });
    });

    it('PATCH without startsAt does not send data or starts_at', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('starts_at');
    });

    it('startsAt null does not send data or starts_at (current semantics preserved)', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: null } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('starts_at');
    });

    it('no create path writes only one of the columns when a start value is present', async () => {
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

    it('list() orders by e.starts_at — canonical read since phase E4', async () => {
      await service.list(TENANT, {} as never);
      expect(mockDs._repo._qb.orderBy).toHaveBeenCalledWith('e.starts_at', 'DESC');
      expect(mockDs._repo._qb.orderBy).not.toHaveBeenCalledWith('e.data', expect.anything());
    });

    it('date-range filters and the 7-day KPI read e.starts_at (C3/E4)', async () => {
      await service.list(TENANT, { dateFrom: '2026-01-01T00:00:00Z', dateTo: '2026-12-31T00:00:00Z' } as never);
      const calls = mockDs._repo._qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).toContain('e.starts_at >= :dateFrom');
      expect(calls).toContain('e.starts_at <= :dateTo');
      expect(calls.join(' ')).not.toMatch(/e\.data\b/);
    });
  });

  describe('update() — partial PATCH', () => {
    it('PATCH without startsAt does not change data', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
    });

    it('PATCH without endsAt does not change end_date', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { venue: 'Novo Local' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('end_date');
    });

    it('startsAt in the PATCH updates data', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: new Date('2026-09-01T20:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ data: new Date('2026-09-01T20:00:00Z') });
    });

    it('endsAt in the PATCH updates end_date', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { endsAt: new Date('2026-09-01T23:00:00Z') } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ end_date: new Date('2026-09-01T23:00:00Z') });
    });

    it('form fields are updatable', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { address: 'Rua Nova' } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({ address: 'Rua Nova' });
    });

    it('null preserves the current "do not change" semantics (dtoToEntity uses != null)', async () => {
      await service.update(TENANT, 'u1', EVENT_ID, { startsAt: null, venue: null } as never);
      const updateCall = mockDs._repo.update.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('data');
      expect(updateCall[1]).not.toHaveProperty('venue');
    });
  });

  describe('list() — current documented behavior', () => {

    // Documentation of the pre-existing bug (C3.5 debt): the DTO declared type/artistId
    // (EN) while the service read tipo/artist_id/dateFrom/dateTo — the type filter
    // never worked over real HTTP. The naming normalization (2026-09-05,
    // tipo -> type) fixed this mismatch specifically for type (the physical
    // column was renamed to type, matching the name already declared in the DTO).
    // artistId still has the mismatch documented below — a separate C3.5 debt.
    it('type filter (name declared in the DTO) is now applied by the service (fixed via tipo -> type)', async () => {
      await service.list(TENANT, { type: 'show' } as never);
      const calls = mockDs._repo._qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).toContain('e.type = :type');
    });

    it('artistId filter (name declared in the DTO) is NOT applied by the service', async () => {
      await service.list(TENANT, { artistId: 'a-1' } as never);
      const calls = mockDs._repo._qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain('e.artist_id = :artistId');
    });

    it('status (the only filter aligned between DTO and service) is applied', async () => {
      await service.list(TENANT, { status: 'scheduled' } as never);
      expect(mockDs._repo._qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'scheduled' });
    });
  });

  it('findById throws NotFoundException for a nonexistent event', async () => {
    mockDs._repo._qb.getOne.mockResolvedValueOnce(null);
    await expect(service.findById(TENANT, 'nao-existe')).rejects.toThrow(NotFoundException);
  });
});
