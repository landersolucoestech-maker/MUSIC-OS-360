import 'reflect-metadata';
import { MarketingPublishingProcessor } from './marketing-publishing.processor';
import { MARKETING_PUBLISHING_JOB_NAMES } from '../queue.constants';

/**
 * P1: MarketingPublishingProcessor read/wrote marketing_content_posts via a
 * raw this.ds.getRepository() call — never through runInTenantContext, unlike
 * every sibling processor already fixed for this exact bug (see
 * MarketBenchmarkRefreshProcessor). marketing_content_posts has FORCE ROW
 * LEVEL SECURITY; with DATABASE_SESSION_CONTEXT_ENABLED=true (required in
 * production) and the NOBYPASSRLS app role, the tenant-scoped session GUCs
 * runInTenantContext sets are what let Postgres actually return the row —
 * without them, RLS blocks it, and findOne() silently comes back null, the
 * exact same failure mode as "content not found".
 */
describe('MarketingPublishingProcessor — tenant context (P1)', () => {
  function makeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'content-1', tenant_id: 'tenant-1', channel: 'instagram',
      status: 'agendado', publication_status: null, ...overrides,
    };
  }

  function makeJob(row: Record<string, unknown> | null, claimAffected = 1) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['update'] = jest.fn(chain);
    qb['set'] = jest.fn(chain);
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['execute'] = jest.fn(async () => ({ affected: claimAffected }));
    const repo = {
      findOne: jest.fn(async () => row),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => qb),
    };
    const manager = { getRepository: jest.fn(() => repo) };
    return { repo, manager, qb };
  }

  it('wraps the DB read/write in runInTenantContext with the job\'s tenantId', async () => {
    const { repo, manager, qb } = makeJob(makeRow());
    const ds = { manager: {} };
    const dbContext = {
      runInTenantContext: jest.fn(async (ctx: unknown, work: (m: unknown) => Promise<unknown>) => {
        expect(ctx).toEqual({ tenantId: 'tenant-1', orgId: null, role: null });
        return work(manager);
      }),
    };
    const processor = new MarketingPublishingProcessor(ds as never, dbContext as never);
    // publish() is a stub that always throws (no real provider adapter configured
    // yet) — irrelevant here, we only assert the tenant-context wrapping happened
    // and the 'publishing' status transition was written through the contextual manager.
    await expect(processor.process({
      name: MARKETING_PUBLISHING_JOB_NAMES.PUBLISH_CONTENT,
      data: { tenantId: 'tenant-1', userId: 'u1', contentId: 'content-1' },
    } as never)).rejects.toThrow();

    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', orgId: null, role: null }, expect.any(Function),
    );
    expect(qb.set).toHaveBeenCalledWith(
      expect.objectContaining({ publication_status: 'publishing' }),
    );
    expect(qb.execute).toHaveBeenCalled();
    // The second update (recording the publish failure) still goes through
    // the plain repo.update() — only the initial claim needed to be atomic.
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'content-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ status: 'falhou', publication_status: 'failed' }),
    );
  });

  it('find-61333a55: claim já reivindicado por outro worker (affected=0) — pula publish() sem erro', async () => {
    const { manager, qb } = makeJob(makeRow(), 0);
    const ds = { manager: {} };
    const dbContext = {
      runInTenantContext: jest.fn(async (_ctx: unknown, work: (m: unknown) => Promise<unknown>) => work(manager)),
    };
    const processor = new MarketingPublishingProcessor(ds as never, dbContext as never);

    await processor.process({
      name: MARKETING_PUBLISHING_JOB_NAMES.PUBLISH_CONTENT,
      data: { tenantId: 'tenant-1', userId: 'u1', contentId: 'content-1' },
    } as never);

    expect(qb.execute).toHaveBeenCalled();
    // publish() always throws in this test file (no real adapter) — if it had
    // been called, process() would have rejected. It didn't reject, proving
    // the claim guard correctly skipped publish() for the loser.
  });

  it('fail-closed: rejects a job with no tenantId before touching the DB', async () => {
    const ds = { manager: {} };
    const dbContext = { runInTenantContext: jest.fn() };
    const processor = new MarketingPublishingProcessor(ds as never, dbContext as never);

    await expect(processor.process({
      name: MARKETING_PUBLISHING_JOB_NAMES.PUBLISH_CONTENT,
      data: { tenantId: '', userId: 'u1', contentId: 'content-1' },
    } as never)).rejects.toThrow(/tenantId/);

    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
  });

  it('sem dbContext (fallback): ainda usa ds.manager diretamente, comportamento preservado', async () => {
    const { repo, manager } = makeJob(makeRow({ status: 'publicado', publication_status: 'published' }));
    const ds = { manager };
    const processor = new MarketingPublishingProcessor(ds as never, undefined);

    await processor.process({
      name: MARKETING_PUBLISHING_JOB_NAMES.PUBLISH_CONTENT,
      data: { tenantId: 'tenant-1', userId: 'u1', contentId: 'content-1' },
    } as never);

    // Already published — no-op, no update calls.
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('ignora jobs de outro nome', async () => {
    const dbContext = { runInTenantContext: jest.fn() };
    const processor = new MarketingPublishingProcessor({ manager: {} } as never, dbContext as never);

    await processor.process({ name: 'unrelated', data: {} } as never);

    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
  });
});
