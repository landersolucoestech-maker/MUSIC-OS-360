import { ReleaseStatus } from '@music-os-360/types';
import { ReleasesService } from './releases.service';

/**
 * find-ed7823e9 — proof of the real initial state: every created release starts
 * in DRAFT, regardless of what the client sends. Any consumer that treats
 * "just created" as distributed is wrong by construction.
 */
describe('ReleasesService.create — initial state', () => {
  function build() {
    const repo = {
      create: jest.fn((v: Record<string, unknown>) => v),
      save: jest.fn(async (v: Record<string, unknown>) => ({ id: 'r-new', created_at: new Date(), ...v })),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const events = { emitTyped: jest.fn() };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const svc = new ReleasesService(ds as never, workflow as never, events as never);
    return { svc, repo, events, workflow };
  }

  it('persists status DRAFT even if the payload tries another status', async () => {
    const { svc, repo } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single', status: 'distributed' } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: ReleaseStatus.DRAFT, tenant_id: 't1' }));
  });

  it('does not emit RELEASE_DISTRIBUTED on creation', async () => {
    const { svc, events } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single' } as never);
    const emitted = events.emitTyped.mock.calls.map((c) => c[0]);
    expect(emitted).not.toContain('release.distributed');
  });
});
