import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AudiovisualApprovalsService } from './approvals.service';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualApprovalEntity } from '../../../database/entities';

/**
 * Task K — concorrência otimista em AudiovisualApprovalsService.decide().
 *
 * Antes: `if (current.status !== 'pending') throw ...` era checado ANTES do
 * UPDATE, mas o UPDATE em si não repetia essa condição — duas decisões
 * concorrentes (dois managers decidindo a mesma aprovação ao mesmo tempo)
 * passavam ambas no pre-check e a segunda sobrescrevia a primeira em
 * silêncio. Agora: status='pending' faz parte da PRÓPRIA condição do
 * UPDATE (não só do pre-check) — 0 linhas afetadas -> 409. Opcionalmente
 * também aceita `expectedUpdatedAt` para o guard genérico de Task K.
 */

const TENANT = 'tenant-test';
const APPROVAL_ID = 'approval-test';
const NOW = new Date('2026-08-14T12:00:00.000Z');

const mockApproval = {
  id: APPROVAL_ID,
  tenant_id: TENANT,
  audiovisual_project_id: 'proj-1',
  deliverable_id: null,
  status: 'pending',
  comments: null,
  revision_round: 1,
  updated_at: NOW,
} as unknown as AudiovisualApprovalEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const approvalsRepo = {
    findOne: jest.fn().mockResolvedValue(mockApproval),
    update: jest.fn().mockResolvedValue(updateResult),
  };
  const deliverablesRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const projectsRepo = {};
  return {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === AudiovisualApprovalEntity) return approvalsRepo;
      return deliverablesRepo ?? projectsRepo;
    }),
    _approvalsRepo: approvalsRepo,
    _deliverablesRepo: deliverablesRepo,
  };
}

describe('AudiovisualApprovalsService — optimistic concurrency in decide()', () => {
  let service: AudiovisualApprovalsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  async function buildService(updateResult?: { affected: number }) {
    mockDs = buildMockDs(updateResult);
    const module = await Test.createTestingModule({
      providers: [
        AudiovisualApprovalsService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    return module.get<AudiovisualApprovalsService>(AudiovisualApprovalsService);
  }

  it('normal decision (1 row affected): applies and returns without error', async () => {
    service = await buildService({ affected: 1 });
    await service.decide(TENANT, 'manager1', APPROVAL_ID, { status: 'approved' } as any);

    expect(mockDs._approvalsRepo.update).toHaveBeenCalledWith(
      { id: APPROVAL_ID, tenant_id: TENANT, status: 'pending' },
      expect.objectContaining({ status: 'approved' }),
    );
  });

  it('concurrent decision (0 rows affected — already decided by another manager): throws ConflictException (409)', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.decide(TENANT, 'manager2', APPROVAL_ID, { status: 'rejected' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the criteria besides the status guard', async () => {
    // Task Y — decide() passou a reaproveitar o casUpdate compartilhado
    // (Task X); updated_at deixou de ser igualdade exata de Date (timestamp
    // sem tz perde precisão no round-trip Date/JSON) e virou Raw() truncado
    // a milissegundos — ver optimistic-update.util.ts.
    service = await buildService({ affected: 1 });
    await service.decide(TENANT, 'manager1', APPROVAL_ID, {
      status: 'approved',
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._approvalsRepo.update.mock.calls[0];
    expect(criteria.id).toBe(APPROVAL_ID);
    expect(criteria.tenant_id).toBe(TENANT);
    expect(criteria.status).toBe('pending');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    expect(payload).toEqual(expect.objectContaining({ status: 'approved' }));
  });

  it('expectedUpdatedAt with an invalid format: 400, not 500 or silence', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.decide(TENANT, 'manager1', APPROVAL_ID, {
        status: 'approved',
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
