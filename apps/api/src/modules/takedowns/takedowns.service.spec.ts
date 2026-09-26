import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { TakedownsService } from './takedowns.service';
import { DATA_SOURCE } from '../../database/database.module';
import { TakedownEntity } from '../../database/entities';

/**
 * Task K — optimistic concurrency in TakedownsService.update().
 * Before: an unconditional repo.update(). Now, with `expectedUpdatedAt`, 0
 * affected rows -> 409 (ConflictException). Without it, identical behavior.
 */

const TENANT = 'tenant-test';
const TAKEDOWN_ID = 'takedown-test';
const NOW = new Date('2026-08-14T12:00:00.000Z');

const mockTakedown = {
  id: TAKEDOWN_ID,
  tenant_id: TENANT,
  title: 'Takedown teste',
  status: 'pendente',
  plataforma: 'youtube',
  deleted_at: null,
  updated_at: NOW,
} as unknown as TakedownEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const qb: any = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne: jest.fn().mockResolvedValue(mockTakedown),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn().mockResolvedValue(updateResult),
  };
  return { getRepository: jest.fn(() => repo), _repo: repo };
}

describe('TakedownsService — optimistic concurrency in update()', () => {
  let service: TakedownsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  async function buildService(updateResult?: { affected: number }) {
    mockDs = buildMockDs(updateResult);
    const module = await Test.createTestingModule({
      providers: [
        TakedownsService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    return module.get<TakedownsService>(TakedownsService);
  }

  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
    service = await buildService({ affected: 1 });
    await service.update(TENANT, 'u1', TAKEDOWN_ID, { title: 'Novo título' } as any);

    expect(mockDs._repo.update).toHaveBeenCalledWith(
      { id: TAKEDOWN_ID, tenant_id: TENANT },
      expect.objectContaining({ title: 'Novo título' }),
    );
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the criteria', async () => {
    service = await buildService({ affected: 1 });
    await service.update(TENANT, 'u1', TAKEDOWN_ID, {
      title: 'Editado',
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._repo.update.mock.calls[0];
    expect(criteria.id).toBe(TAKEDOWN_ID);
    expect(criteria.tenant_id).toBe(TENANT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    expect(payload).toEqual(expect.objectContaining({ title: 'Editado' }));
  });

  it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException (409)', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.update(TENANT, 'u1', TAKEDOWN_ID, {
        title: 'Tentativa concorrente',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt with an invalid format: 400, not 500 or silence', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.update(TENANT, 'u1', TAKEDOWN_ID, {
        title: 'x',
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
