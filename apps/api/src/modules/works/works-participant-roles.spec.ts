/**
 * A Work has exactly two kinds of participant: composer/author and publisher. A role already stored on the work (a
 * legacy administrator or translator) may be re-posted unchanged so an edit form that sends back what it loaded keeps
 * working; any new role outside the list is rejected before anything is written.
 */
import 'reflect-metadata';
import { WorksService } from './works.service';
import { WorkEntity, WorkParticipantEntity } from '../../database/entities';

const WORK = { id: 'w1', tenant_id: 't1', title: 'T', deleted_at: null, updated_at: new Date('2026-01-01T00:00:00Z') };

function build(stored: Array<Record<string, unknown>> = []) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb['getOne'] = jest.fn(async () => WORK);
  const workRepo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: Record<string, unknown>) => v),
    save: jest.fn(async (v: Record<string, unknown>) => ({ id: 'w1', ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const pqb: Record<string, jest.Mock> = {};
  pqb['where'] = jest.fn(() => pqb);
  pqb['orderBy'] = jest.fn(() => pqb);
  pqb['getMany'] = jest.fn(async () => stored.map((s, i) => ({ id: `p${i}`, work_id: 'w1', name: `N${i}`, link: null, percentage: null, ...s })));
  const participantsRepo = {
    createQueryBuilder: jest.fn(() => pqb),
    create: jest.fn((v: Record<string, unknown>) => v),
    save: jest.fn(async (v: unknown) => v),
    delete: jest.fn(async () => ({ affected: 0 })),
  };
  const getRepository = jest.fn((e: unknown) => (e === WorkParticipantEntity ? participantsRepo : e === WorkEntity ? workRepo : workRepo));
  const ds = {
    getRepository,
    transaction: jest.fn((cb: (em: unknown) => unknown) => cb({ getRepository })),
    query: jest.fn(async () => [{ exists: 1 }]),
  };
  return { svc: new WorksService(ds as never, { emitTyped: jest.fn() } as never), workRepo, participantsRepo };
}

const invalid = (roles: string[]) => ({
  response: { code: 'WORK_PARTICIPANT_ROLE_INVALID', allowed: ['composer_author', 'publisher'], invalid: roles },
});

describe('Work participant roles: create', () => {
  it.each([
    ['administrator', 'administrator'],
    ['translator', 'translator'],
    ['a free-text role', 'my-custom-role'],
    ['the deprecated Portuguese administrator', 'administrador'],
    ['the deprecated Portuguese translator', 'tradutor'],
  ])('rejects %s and writes nothing', async (_label, role) => {
    const { svc, workRepo, participantsRepo } = build();
    const expected = role === 'administrador' ? 'administrator' : role === 'tradutor' ? 'translator' : role;
    await expect(svc.create('t1', 'u1', { title: 'Obra', type: 'composition', participants: [{ name: 'A', role }] } as never))
      .rejects.toMatchObject(invalid([expected]));
    expect(workRepo.save).not.toHaveBeenCalled();
    expect(participantsRepo.save).not.toHaveBeenCalled();
  });

  it('reports every distinct invalid role once', async () => {
    const { svc } = build();
    await expect(svc.create('t1', 'u1', {
      title: 'Obra', type: 'composition',
      participants: [{ name: 'A', role: 'translator' }, { name: 'B', role: 'translator' }, { name: 'C', role: 'administrator' }, { name: 'D', role: 'composer_author' }],
    } as never)).rejects.toMatchObject(invalid(['translator', 'administrator']));
  });

  it.each([
    ['composer/author', 'composer_author'],
    ['publisher', 'publisher'],
    ['no role chosen yet', ''],
    ['the deprecated Portuguese publisher', 'editor'],
    ['the deprecated Portuguese composer/author', 'compositor/autor'],
  ])('accepts %s', async (_label, role) => {
    const { svc, participantsRepo } = build();
    await expect(svc.create('t1', 'u1', { title: 'Obra', type: 'composition', participants: [{ name: 'A', role }] } as never)).resolves.toBeDefined();
    expect(participantsRepo.save).toHaveBeenCalledTimes(1);
  });

  it('does not validate roles when no participants are sent', async () => {
    const { svc } = build();
    await expect(svc.create('t1', 'u1', { title: 'Obra', type: 'composition' } as never)).resolves.toBeDefined();
  });
});

describe('Work participant roles: update', () => {
  const stored = [{ name: 'Adm', role: 'administrator' }, { name: 'Tra', role: 'translator' }];

  it('accepts a role the work already stores, posted back unchanged', async () => {
    const { svc, participantsRepo } = build(stored);
    await expect(svc.update('t1', 'u1', 'w1', { participants: [{ name: 'Adm', role: 'administrator' }, { name: 'Ed', role: 'publisher' }] } as never)).resolves.toBeDefined();
    expect(participantsRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a new role outside the list even when other legacy roles are stored', async () => {
    const { svc, participantsRepo } = build([{ name: 'Adm', role: 'administrator' }]);
    await expect(svc.update('t1', 'u1', 'w1', { participants: [{ name: 'Tra', role: 'translator' }] } as never)).rejects.toMatchObject(invalid(['translator']));
    expect(participantsRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects a legacy role on a work that never stored it', async () => {
    const { svc, participantsRepo } = build([{ name: 'Ed', role: 'publisher' }]);
    await expect(svc.update('t1', 'u1', 'w1', { participants: [{ name: 'Adm', role: 'administrator' }] } as never)).rejects.toMatchObject(invalid(['administrator']));
    expect(participantsRepo.delete).not.toHaveBeenCalled();
  });

  it('leaves the roles alone when the patch sends no participants', async () => {
    const { svc, participantsRepo } = build(stored);
    await expect(svc.update('t1', 'u1', 'w1', { title: 'Novo' } as never)).resolves.toBeDefined();
    expect(participantsRepo.delete).not.toHaveBeenCalled();
  });
});
