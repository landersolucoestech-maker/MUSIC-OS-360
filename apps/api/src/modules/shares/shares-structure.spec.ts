/**
 * Work splits, Phonogram splits and Release shares are independent structures, each totalling 100% in its own
 * context and never inheriting from another. A share belongs to a work OR a phonogram, never both; a row stored with
 * both before this rule stays editable, and only a write that introduces the pair is rejected.
 */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { SharesService } from './shares.service';
import type { CreateShareDto, UpdateShareDto } from './dto/shares.dto';

function makeService(current: Record<string, unknown> = { id: 'share-1', tenant_id: 'tenant-1', work_id: null, phonogram_id: null, percentage: 10, share_type: null }) {
  const repo = {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'share-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['select', 'where', 'andWhere']) qb[m] = jest.fn(() => qb);
      qb['getOne'] = jest.fn(async () => current);
      qb['getRawOne'] = jest.fn(async () => ({ sum: '0' }));
      return qb;
    }),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const ds = {
    getRepository: jest.fn(() => repo),
    query: jest.fn(async () => [{ exists: 1 }]),
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  } as never;
  return { svc: new SharesService(ds), repo };
}

const ambiguous = { response: { code: 'SHARE_STRUCTURE_AMBIGUOUS', fields: ['work_id', 'phonogram_id'] } };

describe('SharesService.create: a share belongs to one structure', () => {
  it('rejects a share that carries both a work and a phonogram, and persists nothing', async () => {
    const { svc, repo } = makeService();
    await expect(svc.create('tenant-1', { holder_name: 'A', percentage: 10, work_id: 'w1', phonogram_id: 'p1' } as unknown as CreateShareDto))
      .rejects.toMatchObject(ambiguous);
    await expect(svc.create('tenant-1', { holder_name: 'A', percentage: 10, work_id: 'w1', phonogram_id: 'p1' } as unknown as CreateShareDto))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('the deprecated aliases cannot bypass it', async () => {
    const { svc, repo } = makeService();
    await expect(svc.create('tenant-1', { holderName: 'A', percentage: 10, workId: 'w1', trackId: 'p1' } as unknown as CreateShareDto))
      .rejects.toMatchObject(ambiguous);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('a financial share (share_type set) is not a way around it either', async () => {
    const { svc, repo } = makeService();
    await expect(svc.create('tenant-1', {
      share_type: 'internal_release', release_id: 'r1', work_id: 'w1', phonogram_id: 'p1', percentage: 10,
    } as unknown as CreateShareDto)).rejects.toMatchObject(ambiguous);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['a Work split', { work_id: 'w1' }],
    ['a Phonogram split', { phonogram_id: 'p1' }],
    ['a Release share', { share_type: 'internal_release', release_id: 'r1' }],
  ])('accepts %s', async (_label, ids) => {
    const { svc, repo } = makeService();
    await expect(svc.create('tenant-1', { holder_name: 'A', percentage: 10, ...ids } as unknown as CreateShareDto)).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('SharesService.update: only a write that introduces the pair is rejected', () => {
  it('rejects adding a phonogram to a Work split', async () => {
    const { svc, repo } = makeService({ id: 'share-1', tenant_id: 'tenant-1', work_id: 'w1', phonogram_id: null, percentage: 10, share_type: null });
    await expect(svc.update('tenant-1', 'share-1', { phonogram_id: 'p1' } as unknown as UpdateShareDto)).rejects.toMatchObject(ambiguous);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects adding a work to a Phonogram split through the deprecated alias too', async () => {
    const { svc, repo } = makeService({ id: 'share-1', tenant_id: 'tenant-1', work_id: null, phonogram_id: 'p1', percentage: 10, share_type: null });
    await expect(svc.update('tenant-1', 'share-1', { workId: 'w1' } as unknown as UpdateShareDto)).rejects.toMatchObject(ambiguous);
    expect(repo.update).not.toHaveBeenCalled();
  });

  describe('a legacy row stored with both ids', () => {
    const legacy = { id: 'share-1', tenant_id: 'tenant-1', work_id: 'w1', phonogram_id: 'p1', percentage: 10, share_type: null, updated_at: new Date('2026-01-01T00:00:00Z') };

    it('stays editable when the write does not touch the ids', async () => {
      const { svc } = makeService(legacy);
      await expect(svc.update('tenant-1', 'share-1', { percentage: 20 } as unknown as UpdateShareDto)).resolves.toBeDefined();
    });

    it('stays editable when the same ids are posted back unchanged', async () => {
      const { svc } = makeService(legacy);
      await expect(svc.update('tenant-1', 'share-1', { work_id: 'w1', phonogram_id: 'p1', percentage: 20 } as unknown as UpdateShareDto)).resolves.toBeDefined();
    });

    it('can be repaired by clearing one of the two ids', async () => {
      const { svc } = makeService(legacy);
      await expect(svc.update('tenant-1', 'share-1', { phonogram_id: null } as unknown as UpdateShareDto)).resolves.toBeDefined();
    });

    it('rejects pointing it at a different work while the phonogram is kept', async () => {
      const { svc, repo } = makeService(legacy);
      await expect(svc.update('tenant-1', 'share-1', { work_id: 'w2' } as unknown as UpdateShareDto)).rejects.toMatchObject(ambiguous);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
