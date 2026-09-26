import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { LicensingService } from './licensing.service';
import { DATA_SOURCE } from '../../database/database.module';
import { LicenseEntity } from '../../database/entities';

/**
 * Task K — concorrência otimista em LicensingService.update().
 * Antes: repo.update() incondicional — dois usuários editando a mesma
 * licença em paralelo, o segundo save sobrescrevia o primeiro em silêncio.
 * Agora, com `expectedUpdatedAt`, 0 linhas afetadas -> 409 (ConflictException).
 * Sem `expectedUpdatedAt`, comportamento idêntico ao anterior.
 */

const TENANT = 'tenant-test';
const LICENSE_ID = 'license-test';
const NOW = new Date('2026-08-14T12:00:00.000Z');

const mockLicense = {
  id: LICENSE_ID,
  tenant_id: TENANT,
  title: 'Licença teste',
  status: 'negociacao',
  valor: '100',
  moeda: 'BRL',
  percentage: null,
  deleted_at: null,
  updated_at: NOW,
} as unknown as LicenseEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(mockLicense),
    update: jest.fn().mockResolvedValue(updateResult),
  };
  return { getRepository: jest.fn(() => repo), _repo: repo };
}

describe('LicensingService — optimistic concurrency in update()', () => {
  let service: LicensingService;
  let mockDs: ReturnType<typeof buildMockDs>;

  async function buildService(updateResult?: { affected: number }) {
    mockDs = buildMockDs(updateResult);
    const module = await Test.createTestingModule({
      providers: [
        LicensingService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    return module.get<LicensingService>(LicensingService);
  }

  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
    service = await buildService({ affected: 1 });
    await service.update(TENANT, 'u1', LICENSE_ID, { title: 'Novo título' } as any);

    expect(mockDs._repo.update).toHaveBeenCalledWith(
      { id: LICENSE_ID, tenant_id: TENANT },
      expect.objectContaining({ title: 'Novo título' }),
    );
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the criteria', async () => {
    service = await buildService({ affected: 1 });
    await service.update(TENANT, 'u1', LICENSE_ID, {
      title: 'Editado',
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._repo.update.mock.calls[0];
    expect(criteria.id).toBe(LICENSE_ID);
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
      service.update(TENANT, 'u1', LICENSE_ID, {
        title: 'Tentativa concorrente',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt with an invalid format: 400, not 500 or silence', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.update(TENANT, 'u1', LICENSE_ID, {
        title: 'x',
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
