import { ReleaseStatus } from '@music-os-360/types';
import { ReleasesService } from './releases.service';

/**
 * find-ed7823e9 — prova do estado inicial real: todo lançamento criado nasce
 * em DRAFT, independentemente do que o cliente mande. Qualquer consumidor que
 * trate "recém-criado" como distribuído está errado por construção.
 */
describe('ReleasesService.create — estado inicial', () => {
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

  it('persiste status DRAFT mesmo se o payload tentar outro status', async () => {
    const { svc, repo } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single', status: 'distributed' } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: ReleaseStatus.DRAFT, tenant_id: 't1' }));
  });

  it('não emite RELEASE_DISTRIBUTED na criação', async () => {
    const { svc, events } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single' } as never);
    const emitted = events.emitTyped.mock.calls.map((c) => c[0]);
    expect(emitted).not.toContain('release.distributed');
  });
});
