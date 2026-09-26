import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { SocietySubmissionService } from './society-submission.service';
import { DATA_SOURCE } from '../../../database/database.module';
import { SocietySubmissionEntity } from '../../../database/entities';
import { SocietySubmissionStatus } from '@music-os-360/types';

/**
 * Task K — concorrência otimista em SocietySubmissionService.transition().
 *
 * Antes: `sub.status = to; ...; this.repo.save(sub)` — leitura fora de
 * transação, sem WHERE guard, dois processos/usuários decidindo a mesma
 * transição concorrentemente sobrescreviam um ao outro em silêncio. Agora:
 * a mudança é persistida via `casUpdate` (repo.update com WHERE por
 * id+tenant, e opcionalmente updated_at); 0 linhas afetadas -> 409.
 * Sem `expectedUpdatedAt`, comportamento equivalente ao anterior.
 */

const TENANT = 'tenant-test';
const SUB_ID = 'submission-test';
const NOW = new Date('2026-08-14T12:00:00.000Z');

const mockSubmission = {
  id: SUB_ID,
  tenant_id: TENANT,
  society: 'ecad',
  driver: 'manual',
  entity_type: 'work',
  entity_id: 'work-1',
  status: SocietySubmissionStatus.DRAFT,
  protocol: null,
  current_payload_snapshot_id: null,
  updated_at: NOW,
} as unknown as SocietySubmissionEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const genericRepo = {
    findOne: jest.fn().mockResolvedValue(mockSubmission),
    update: jest.fn().mockResolvedValue(updateResult),
    create: jest.fn((v: unknown) => v),
    save: jest.fn().mockResolvedValue({}),
  };
  return { getRepository: jest.fn(() => genericRepo), _repo: genericRepo };
}

describe('SocietySubmissionService — optimistic concurrency in transition()', () => {
  let service: SocietySubmissionService;
  let mockDs: ReturnType<typeof buildMockDs>;

  async function buildService(updateResult?: { affected: number }) {
    mockDs = buildMockDs(updateResult);
    const module = await Test.createTestingModule({
      providers: [
        SocietySubmissionService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    return module.get<SocietySubmissionService>(SocietySubmissionService);
  }

  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
    service = await buildService({ affected: 1 });
    await service.transition(TENANT, 'u1', SUB_ID, {
      status: SocietySubmissionStatus.VALIDATING,
    } as any);

    expect(mockDs._repo.update).toHaveBeenCalledWith(
      { id: SUB_ID, tenant_id: TENANT },
      expect.objectContaining({ status: SocietySubmissionStatus.VALIDATING }),
    );
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the criteria', async () => {
    service = await buildService({ affected: 1 });
    await service.transition(TENANT, 'u1', SUB_ID, {
      status: SocietySubmissionStatus.VALIDATING,
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._repo.update.mock.calls[0];
    expect(criteria.id).toBe(SUB_ID);
    expect(criteria.tenant_id).toBe(TENANT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    expect(payload).toEqual(expect.objectContaining({ status: SocietySubmissionStatus.VALIDATING }));
  });

  it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException (409)', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.transition(TENANT, 'u1', SUB_ID, {
        status: SocietySubmissionStatus.VALIDATING,
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt with an invalid format: 400, not 500 or silence', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.transition(TENANT, 'u1', SUB_ID, {
        status: SocietySubmissionStatus.VALIDATING,
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
