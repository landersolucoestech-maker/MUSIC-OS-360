import 'reflect-metadata';
import { WorksService } from './works.service';
import { WorkEntity, WorkParticipantEntity } from '../../database/entities';

/**
 * A web build released before CZ-039 sends the deprecated work names/values. The service must map
 * them (list filters, create, update, participant roles) before querying / persisting.
 */
describe('WorksService legacy wiring', () => {
  const WORK = { id: 'w1', tenant_id: 't1', title: 'T', deleted_at: null, updated_at: new Date('2026-01-01T00:00:00Z') };

  function build() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
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
    pqb['getMany'] = jest.fn(async () => []);
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
    const svc = new WorksService(ds as never, { emitTyped: jest.fn() } as never);
    return { svc, qb, workRepo, participantsRepo };
  }

  const LEGACY_PAYLOAD = {
    title: 'Obra',
    'tipo_obra': 'autoral',
    'tipo_ia': 'totalmente',
    'idioma': 'Inglês',
    'compositor': 'Fulano',
  };

  it('list maps legacy filters (tipo_obra=autoral, project_id=no-projeto) to the canonical query', async () => {
    const { svc, qb } = build();
    await svc.list('t1', { 'tipo_obra': 'autoral', project_id: 'no-projeto' } as never);
    const clauses = qb['andWhere'].mock.calls.map((c) => [c[0], c[1]]);
    expect(clauses).toContainEqual(['w.work_origin = :workOrigin', { workOrigin: 'original' }]);
    expect(clauses).toContainEqual(['w.project_id IS NULL', undefined]);
    expect(clauses.some((c) => String(c[0]).includes('w.project_id = :projectId'))).toBe(false);
  });

  it('list maps work_origin=referencia', async () => {
    const { svc, qb } = build();
    await svc.list('t1', { work_origin: 'referencia' } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('w.work_origin = :workOrigin', { workOrigin: 'reference' });
  });

  it('create persists canonical fields/values for a legacy payload and canonical participant roles', async () => {
    const { svc, workRepo, participantsRepo } = build();
    await svc.create('t1', 'u1', {
      ...LEGACY_PAYLOAD,
      'participantes': [
        { 'nome': 'Ed', 'classeFuncao': 'editor', 'percentual': 50 },
        { 'nome': 'Comp', 'classeFuncao': 'Compositor/Autor' },
        { name: 'NoRole' },
        { name: 'Blank', role: '  ' },
      ],
    } as never);
    const persisted = workRepo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({
      work_origin: 'original', ai_usage_level: 'full', language: 'en', composer_name: 'Fulano', title: 'Obra',
    });
    for (const legacyKey of ['tipo_obra', 'tipo_ia', 'idioma', 'compositor', 'participantes']) expect(persisted).not.toHaveProperty(legacyKey);
    const rows = participantsRepo.create.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(rows.map((r) => [r['name'], r['role']])).toEqual([
      ['Ed', 'publisher'],
      ['Comp', 'composer_author'],
      ['NoRole', 'unspecified'],
      ['Blank', 'unspecified'],
    ]);
    expect(rows[0]['percentage']).toBe('50');
  });

  it('update canonicalizes a legacy payload and drops the keys a pre-CZ-039 edit cannot have read', async () => {
    const { svc, workRepo, participantsRepo } = build();
    await svc.update('t1', 'u1', 'w1', {
      'tipo_ia': 'parcialmente',
      'idioma': 'Português',
      'tipo_obra': 'referencia',
      'instrumental': 'nao',
      'criada_por_ia': false,
      'participantes': [],
    } as never);
    const patch = (workRepo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch).toMatchObject({ ai_usage_level: 'partial', language: 'pt' });
    for (const droppedKey of ['tipo_obra', 'work_origin', 'instrumental', 'is_instrumental', 'criada_por_ia', 'ai_used', 'participantes', 'participants', 'tipo_ia', 'idioma']) {
      expect(patch).not.toHaveProperty(droppedKey);
    }
    // an empty legacy participant list must NOT clear the stored participants
    expect(participantsRepo.delete).not.toHaveBeenCalled();
  });

  it('update maps legacy participants (role and keys) to canonical rows', async () => {
    const { svc, participantsRepo } = build();
    await svc.update('t1', 'u1', 'w1', { 'participantes': [{ 'nome': 'Ed', 'classeFuncao': 'editor' }, { name: 'X' }] } as never);
    expect(participantsRepo.delete).toHaveBeenCalledTimes(1);
    const rows = participantsRepo.create.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(rows.map((r) => [r['name'], r['role']])).toEqual([['Ed', 'publisher'], ['X', 'unspecified']]);
  });
});
