import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AudiovisualShotsService } from './shots.service';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualShotEntity, AudiovisualProjectEntity } from '../../../database/entities';

/**
 * Task M — reorder() fazia N updates sequenciais sem transação e sem checar
 * staleness (dois usuários reordenando ao mesmo tempo, ou um shot
 * criado/removido entre a leitura e o submit, corrompia o ordering em
 * silêncio). Corrigido com transação real + guarda de "mesmo conjunto de
 * ids". Este spec prova atomicidade, o guard de staleness e rollback.
 */
const TENANT = 'tenant-test';
const PROJECT_ID = 'proj-test';

function shot(id: string) {
  return { id } as unknown as AudiovisualShotEntity;
}

function buildMockDs(existingIds: string[], updateImpl?: (...args: unknown[]) => Promise<unknown>) {
  const txShotsRepo = {
    find: jest.fn().mockResolvedValue(existingIds.map(shot)),
    update: jest.fn(updateImpl ?? (async () => ({ affected: 1 }))),
  };
  const projectsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: PROJECT_ID, tenant_id: TENANT, deleted_at: null }),
  };
  const em = {
    getRepository: jest.fn(() => txShotsRepo),
  };
  return {
    getRepository: jest.fn((entity: unknown) =>
      entity === AudiovisualProjectEntity ? projectsRepo : txShotsRepo),
    transaction: jest.fn((cb: (em: unknown) => Promise<unknown>) => cb(em)),
    _txShotsRepo: txShotsRepo,
    _em: em,
  };
}

async function buildService(mockDs: ReturnType<typeof buildMockDs>) {
  const module = await Test.createTestingModule({
    providers: [
      AudiovisualShotsService,
      { provide: DATA_SOURCE, useValue: mockDs },
    ],
  }).compile();
  return module.get<AudiovisualShotsService>(AudiovisualShotsService);
}

describe('AudiovisualShotsService.reorder() — Task M concurrency/atomicity', () => {
  it('an id set equal to the current one: applies all N updates in a transaction', async () => {
    const mockDs = buildMockDs(['a', 'b', 'c']);
    const service = await buildService(mockDs);

    const result = await service.reorder(TENANT, PROJECT_ID, ['c', 'a', 'b']);

    expect(mockDs.transaction).toHaveBeenCalledTimes(1);
    expect(mockDs._txShotsRepo.update).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ reordered: 3 });
  });

  it('A/B scenario: A adds/removes a shot; B reorders with the old list -> 409, no write applied', async () => {
    const mockDs = buildMockDs(['a', 'b', 'c', 'd']); // servidor já tem 'd' (adicionado por A)
    const service = await buildService(mockDs);

    await expect(
      service.reorder(TENANT, PROJECT_ID, ['a', 'b', 'c']), // B ainda não viu 'd'
    ).rejects.toThrow(ConflictException);

    expect(mockDs._txShotsRepo.update).not.toHaveBeenCalled();
  });

  it('rollback: a failure mid-loop rejects the whole operation (the real transaction undoes everything)', async () => {
    let calls = 0;
    const mockDs = buildMockDs(['a', 'b', 'c'], async () => {
      calls += 1;
      if (calls === 2) throw new Error('db connection lost');
      return { affected: 1 };
    });
    const service = await buildService(mockDs);

    await expect(service.reorder(TENANT, PROJECT_ID, ['a', 'b', 'c'])).rejects.toThrow('db connection lost');
    expect(mockDs._txShotsRepo.update).toHaveBeenCalledTimes(2);
  });
});
