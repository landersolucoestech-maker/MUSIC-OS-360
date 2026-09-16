import 'reflect-metadata';
import { ArtistsService } from './artists.service';
import { EncryptionService } from '../../core/security/encryption.service';
import { EventsService } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import { NotFoundException } from '@nestjs/common';
import { createTestTenant, createTestUser, createTestArtist } from '../../../test/helpers/tenant-fixtures';

function makePlanLimitMock() {
  return { enforce: jest.fn().mockResolvedValue(undefined) } as unknown as PlanLimitService;
}

function makeEventsMock() {
  return {
    emit:      jest.fn(),
    emitTyped: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
    on:        jest.fn(),
    off:       jest.fn(),
  } as unknown as EventsService;
}

function makeEncryptionMock(): jest.Mocked<EncryptionService> {
  return {
    encrypt:         jest.fn().mockImplementation((v: string) => `enc:${v}`),
    decrypt:         jest.fn().mockImplementation((v: string) => v.replace('enc:', '')),
    encryptNullable: jest.fn().mockImplementation((v: string | null | undefined) =>
      v == null || v === '' ? null : `enc:${v}`,
    ),
    decryptNullable: jest.fn().mockReturnValue(null),
  } as unknown as jest.Mocked<EncryptionService>;
}

const { tenantId: TENANT_A } = createTestTenant();
const { tenantId: TENANT_B } = createTestTenant();
const { userId: USER_ID } = createTestUser();
const fixtureArtist = createTestArtist();

const artistOfA = {
  id: fixtureArtist.id,
  tenant_id: TENANT_A,
  nome_artistico: 'Artista do Tenant A',
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeQb(getOneValue: unknown = artistOfA) {
  const qb: Record<string, jest.Mock> = {
    where:           jest.fn(),
    andWhere:        jest.fn(),
    orderBy:         jest.fn(),
    skip:            jest.fn(),
    take:            jest.fn(),
    getOne:          jest.fn().mockResolvedValue(getOneValue),
    getManyAndCount: jest.fn().mockResolvedValue([[artistOfA], 1]),
  };

  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);

  return qb;
}

function makeDataSource(getOneValue: unknown = artistOfA) {
  const qb = makeQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: Record<string, unknown>) =>
      Promise.resolve({ id: fixtureArtist.id, ...value }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };

  return {
    getRepository: jest.fn(() => repo),
    // Task H: list() enriquece cada artista com o vínculo via query bruta
    // restrita aos IDs da página — sem contratos mockados, resolve "independente".
    query: jest.fn().mockResolvedValue([]),
    _repo: repo,
  };
}

describe('Tenant Isolation - ArtistsService', () => {
  it('list() devolve apenas artistas do tenant correcto', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock(), makePlanLimitMock());

    const result = await service.list(TENANT_A, {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].tenant_id).toBe(TENANT_A);
    expect(ds._repo._qb.where).toHaveBeenCalledWith(
      'a.tenant_id = :tenantId',
      { tenantId: TENANT_A },
    );
  });

  it('findById() retorna artista quando tenant coincide', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock(), makePlanLimitMock());

    const result = await service.findById(TENANT_A, artistOfA.id);
    expect(result.id).toBe(artistOfA.id);
  });

  it('findById() lanca NotFoundException ao aceder a artista de outro tenant', async () => {
    const ds = makeDataSource(null);
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock(), makePlanLimitMock());

    await expect(service.findById(TENANT_B, artistOfA.id)).rejects.toThrow(NotFoundException);
  });

  it('update() lanca NotFoundException ao atualizar artista de outro tenant', async () => {
    const ds = makeDataSource(null);
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock(), makePlanLimitMock());

    await expect(
      service.update(TENANT_B, USER_ID, artistOfA.id, { nome_artistico: 'Hack' }),
    ).rejects.toThrow(NotFoundException);
  });
});
