import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AudiovisualApprovalsService } from './approvals.service';
import { DATA_SOURCE } from '../../../database/database.tokens';
import { AudiovisualApprovalEntity } from '../../../database/entities';

/**
 * Task K — optimistic concurrency in AudiovisualApprovalsService.decide().
 *
 * Before: `if (current.status !== 'pending') throw ...` was checked BEFORE the
 * UPDATE, but the UPDATE itself did not repeat that condition — two concurrent
 * decisions (two managers deciding the same approval at the same time)
 * both passed the pre-check and the second silently overwrote the first.
 * Now: status='pending' is part of the UPDATE's OWN condition
 * (not only the pre-check) — 0 affected rows -> 409. Optionally
 * also accepts `expectedUpdatedAt` for the generic Task K guard.
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
    // Task Y — decide() now reuses the shared casUpdate
    // (Task X); updated_at stopped being an exact Date equality (a timestamp
    // without tz loses precision in the Date/JSON round-trip) and became a Raw()
    // truncated to milliseconds — see optimistic-update.util.ts.
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
