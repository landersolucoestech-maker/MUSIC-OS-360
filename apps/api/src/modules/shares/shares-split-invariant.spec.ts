/**
 * shares-split-invariant.spec.ts
 *
 * P1: SharesService.create/update persisted percentage with zero
 * validation — not even a same-row range check, let alone a cross-row
 * "splits for a work don't exceed 100%" check. A second, independent write
 * path (reports/import bulk importer) had the same gap. This closes the
 * SharesService half: a per-row range check (CreateShareDto.percentage has
 * @Min(0)/@Max(100)) plus a
 * cross-row "registry-eligible shares for the same work/phonogram never
 * exceed 100%" check — deliberately NOT "must equal exactly 100%", since a
 * work legitimately has 0/1/2/n shares entered incrementally before
 * reaching completeness; that stricter check already exists, correctly
 * scoped to registry-submission time (WorkRegistryValidationService).
 */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { SharesService } from './shares.service';
import type { CreateShareDto, UpdateShareDto } from './dto/shares.dto';

function makeRepo(opts: { existingSum?: number; findByIdRow?: Record<string, unknown> } = {}) {
  const findByIdRow = opts.findByIdRow ?? { id: 'share-1', tenant_id: 'tenant-1' };
  const qbs: Record<string, jest.Mock>[] = [];

  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'share-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    // One shared qb per createQueryBuilder() call — findById only ever calls
    // where().getOne(); sumEligiblePercentage only ever calls select()/where()/
    // andWhere().getRawOne(). Both terminal methods live on the same object
    // since only one is ever invoked per call, keeping the mock simple.
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      const chain = () => qb;
      qb['select']    = jest.fn(chain);
      qb['where']     = jest.fn(chain);
      qb['andWhere']  = jest.fn(chain);
      qb['getOne']    = jest.fn(async () => findByIdRow);
      qb['getRawOne'] = jest.fn(async () => ({ sum: String(opts.existingSum ?? 0) }));
      qbs.push(qb);
      return qb;
    }),
    __qbs: qbs,
  };
}

function makeService(
  opts: Parameters<typeof makeRepo>[0] = {},
  queryImpl = jest.fn(async () => [{ exists: 1 }]),
) {
  const repo = makeRepo(opts);
  // manager mirrors the same repo (so __qbs instrumentation still captures
  // the sum/find queries issued inside the transaction) plus a no-op query()
  // for the find-a192e412 advisory-lock statement.
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  // query() backs assertSameTenantFk's cross-tenant FK ownership check — a
  // truthy row means "found, same tenant", so these split-budget-focused
  // tests aren't coupled to that separate check.
  const ds = {
    getRepository: jest.fn(() => repo),
    query: queryImpl,
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  } as never;
  const svc = new SharesService(ds);
  return { svc, repo };
}

describe('SharesService — split budget invariant (P1)', () => {
  describe('create', () => {
    it('allows an eligible share within budget (work still incomplete)', async () => {
      const { svc } = makeService({ existingSum: 40 });
      await expect(svc.create('tenant-1', {
        holderName: 'Autor A', percentage: 30, workId: 'work-1',
      } as unknown as CreateShareDto)).resolves.toBeDefined();
    });

    it('rejects when the eligible sum would exceed 100% (existing 60% + new 50% = 110%)', async () => {
      const { svc } = makeService({ existingSum: 60 });
      await expect(svc.create('tenant-1', {
        holderName: 'Autor B', percentage: 50, workId: 'work-1',
      } as unknown as CreateShareDto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows exactly 100% (existing 60% + new 40% = 100%, within tolerance)', async () => {
      const { svc } = makeService({ existingSum: 60 });
      await expect(svc.create('tenant-1', {
        holderName: 'Autor C', percentage: 40, workId: 'work-1',
      } as unknown as CreateShareDto)).resolves.toBeDefined();
    });

    it('does NOT validate budget for financial shares (share_type set) — distinct concept (Phase 5/C6)', async () => {
      const { svc } = makeService({ existingSum: 90 });
      // explicitly setting share_type marks it as financial/pending —
      // it never counts toward the registry split budget.
      await expect(svc.create('tenant-1', {
        share_type: 'pendente', percentage: 50, workId: 'work-1',
      } as unknown as CreateShareDto)).resolves.toBeDefined();
    });

    it('does not validate budget when there is no work_id or fonograma_id (share without registry context)', async () => {
      const { svc, repo } = makeService();
      await expect(svc.create('tenant-1', {
        holderName: 'Sem Obra', percentage: 50,
      } as unknown as CreateShareDto)).resolves.toBeDefined();
      // A sum query never needed to run — no work_id/fonograma_id to scope it.
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects when the update would make the sum exceed 100%, inheriting work_id from the current row', async () => {
      const { svc } = makeService({
        existingSum: 70,
        findByIdRow: { id: 'share-1', tenant_id: 'tenant-1', work_id: 'work-1', percentage: 10, share_type: null },
      });
      await expect(svc.update('tenant-1', 'share-1', {
        percentage: 50,
      } as unknown as UpdateShareDto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('excludes its own row from the existing sum (does not count itself twice)', async () => {
      const { svc, repo } = makeService({
        existingSum: 30, // already excludes share-1 per the mocked query (asserted below)
        findByIdRow: { id: 'share-1', tenant_id: 'tenant-1', work_id: 'work-1', percentage: 30, share_type: null },
      });
      await expect(svc.update('tenant-1', 'share-1', { percentage: 40 } as unknown as UpdateShareDto))
        .resolves.toBeDefined();
      // 30 (others) + 40 (new) = 70 — within budget, must not throw, and the
      // sum query must have excluded share-1's own id from its scope.
      const sumQb = (repo as unknown as { __qbs: Record<string, jest.Mock>[] }).__qbs
        .find((qb) => (qb['andWhere'] as jest.Mock).mock.calls.some((call) => call[0] === 's.id != :excludeId'));
      expect(sumQb).toBeDefined();
      expect(sumQb!['andWhere']).toHaveBeenCalledWith('s.id != :excludeId', { excludeId: 'share-1' });
    });
  });
});

describe('SharesService — concurrent write serialization (find-a192e412)', () => {
  it('create: acquires a per-work advisory lock before checking/writing the split budget', async () => {
    const repo = makeRepo({ existingSum: 40 });
    const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
    const transactionSpy = jest.fn(async (cb: (m: unknown) => unknown) => cb(manager));
    const ds = {
      getRepository: jest.fn(() => repo),
      query: jest.fn(async () => [{ exists: 1 }]),
      transaction: transactionSpy,
    } as never;
    const svc = new SharesService(ds);

    await svc.create('tenant-1', {
      holderName: 'Autor A', percentage: 30, workId: 'work-1',
    } as unknown as CreateShareDto);

    expect(transactionSpy).toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['share-split:tenant-1:work-1:'],
    );
  });

  it('update: acquires the lock keyed by the CURRENT row scope before checking/writing', async () => {
    const repo = makeRepo({
      existingSum: 70,
      findByIdRow: { id: 'share-1', tenant_id: 'tenant-1', work_id: 'work-9', percentage: 10, share_type: null },
    });
    const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
    const ds = {
      getRepository: jest.fn(() => repo),
      query: jest.fn(async () => [{ exists: 1 }]),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    } as never;
    const svc = new SharesService(ds);

    await expect(svc.update('tenant-1', 'share-1', { percentage: 15 } as unknown as UpdateShareDto))
      .resolves.toBeDefined();

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['share-split:tenant-1:work-9:'],
    );
  });

  it('does not acquire a lock when the write has no work_id/fonograma_id scope', async () => {
    const repo = makeRepo();
    const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
    const ds = {
      getRepository: jest.fn(() => repo),
      query: jest.fn(async () => [{ exists: 1 }]),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    } as never;
    const svc = new SharesService(ds);

    await svc.create('tenant-1', { holderName: 'Sem Obra', percentage: 50 } as unknown as CreateShareDto);

    expect(manager.query).not.toHaveBeenCalled();
  });
});

describe('SharesService.create — FK cross-tenant (P1)', () => {
  it('rejects work_id (workId) from another tenant (or nonexistent)', async () => {
    const { svc } = makeService({}, jest.fn(async () => []));
    await expect(svc.create('tenant-1', {
      holderName: 'X', percentage: 10, workId: 'work-from-another-tenant',
    } as unknown as CreateShareDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fonograma_id (trackId) from another tenant (or nonexistent)', async () => {
    const { svc } = makeService({}, jest.fn(async () => []));
    await expect(svc.create('tenant-1', {
      holderName: 'X', percentage: 10, trackId: 'track-from-another-tenant',
    } as unknown as CreateShareDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows when the reference belongs to the tenant', async () => {
    const { svc } = makeService({}, jest.fn(async () => [{ exists: 1 }]));
    await expect(svc.create('tenant-1', {
      holderName: 'X', percentage: 10, workId: 'work-1',
    } as unknown as CreateShareDto)).resolves.toBeDefined();
  });
});
