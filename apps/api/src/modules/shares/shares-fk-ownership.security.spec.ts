/**
 * Abuse-case tests: cross-tenant FK ownership on SharesService create/update.
 * update() used to persist work_id/phonogram_id/artist_id/release_id with no
 * same-tenant check, so tenant A could link a share to tenant B's rows.
 * The mocked ds.query() backs assertSameTenantFk: a row is "found" only for
 * ids owned by tenant-1 (the SQL params are [id, tenantId]).
 */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { SharesService } from './shares.service';
import type { CreateShareDto, UpdateShareDto } from './dto/shares.dto';

const OWN = 'own-id';
const FOREIGN = 'foreign-tenant-id';

function makeService() {
  const repo = {
    create: jest.fn((d: unknown) => ({ ...(d as object) })),
    save: jest.fn(async (e: unknown) => ({ id: 'share-new', ...(e as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      const chain = () => qb;
      for (const m of ['select', 'where', 'andWhere']) qb[m] = jest.fn(chain);
      qb['getOne'] = jest.fn(async () => ({ id: 'share-1', tenant_id: 'tenant-1', work_id: null, phonogram_id: null }));
      qb['getRawOne'] = jest.fn(async () => ({ sum: '0' }));
      return qb;
    }),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const query = jest.fn(async (_sql: string, params: unknown[]) => (params[0] === FOREIGN ? [] : [{ '?column?': 1 }]));
  const ds = {
    getRepository: jest.fn(() => repo),
    query,
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  } as never;
  return { svc: new SharesService(ds), repo, query };
}

const update = (svc: SharesService, dto: Record<string, unknown>) =>
  svc.update('tenant-1', 'share-1', dto as unknown as UpdateShareDto);
const create = (svc: SharesService, dto: Record<string, unknown>) =>
  svc.create('tenant-1', dto as unknown as CreateShareDto);

describe('SharesService.update — cross-tenant FK ownership (abuse cases)', () => {
  const cases: Array<[string, string, string]> = [
    ['work_id', 'works', 'Obra'],
    ['phonogram_id', 'phonograms', 'Fonograma'],
    ['artist_id', 'artists', 'Artista'],
    ['release_id', 'releases', 'Lançamento'],
  ];

  it.each(cases)('rejects a foreign %s and never writes', async (field, _table, label) => {
    const { svc, repo } = makeService();
    const err = await update(svc, { [field]: FOREIGN }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).toBe(`${label} não encontrado(a) neste workspace.`);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each(cases)('accepts a same-tenant %s and checks the right table/tenant', async (field, table) => {
    const { svc, repo, query } = makeService();
    await expect(update(svc, { [field]: OWN })).resolves.toBeDefined();
    expect(query).toHaveBeenCalledWith(expect.stringContaining(`"${table}"`), [OWN, 'tenant-1']);
    expect(repo.update).toHaveBeenCalled();
  });

  it('rejects a foreign legacy alias workId (mapped to work_id before the check)', async () => {
    const { svc, repo } = makeService();
    await expect(update(svc, { workId: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects a foreign legacy alias trackId (mapped to phonogram_id)', async () => {
    const { svc, repo } = makeService();
    await expect(update(svc, { trackId: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects a foreign legacy alias artista_project_id (mapped to artist_id)', async () => {
    const { svc, repo } = makeService();
    await expect(update(svc, { artista_project_id: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('canonical wins: own work_id + foreign workId alias is accepted, the alias is never checked/persisted', async () => {
    const { svc, repo, query } = makeService();
    await update(svc, { work_id: OWN, workId: FOREIGN });
    expect(query).not.toHaveBeenCalledWith(expect.anything(), [FOREIGN, 'tenant-1']);
    expect((repo.update as jest.Mock).mock.calls[0][1]['work_id']).toBe(OWN);
  });

  it('canonical wins: foreign work_id is rejected even when a same-tenant workId alias is also sent', async () => {
    const { svc } = makeService();
    await expect(update(svc, { work_id: FOREIGN, workId: OWN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('an update that touches no FK field performs no FK query', async () => {
    const { svc, query } = makeService();
    await update(svc, { holder: 'Novo Detentor', status: 'active' });
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['work_id', 'phonogram_id', 'artist_id', 'release_id', 'workId', 'trackId'])(
    'explicit null clears %s without an FK query',
    async (field) => {
      const { svc, repo, query } = makeService();
      await expect(update(svc, { [field]: null })).resolves.toBeDefined();
      expect(query).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    },
  );
});

describe('SharesService.create — artist_id/release_id ownership (same pattern as siblings)', () => {
  it('rejects a foreign artist_id', async () => {
    const { svc, repo } = makeService();
    await expect(create(svc, { holderName: 'X', artist_id: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a foreign release_id', async () => {
    const { svc, repo } = makeService();
    await expect(create(svc, { holderName: 'X', release_id: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a foreign work_id and phonogram_id (regression guard)', async () => {
    const { svc } = makeService();
    await expect(create(svc, { holderName: 'X', work_id: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
    await expect(create(svc, { holderName: 'X', phonogram_id: FOREIGN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts same-tenant artist_id/release_id', async () => {
    const { svc } = makeService();
    await expect(create(svc, { holderName: 'X', artist_id: OWN, release_id: OWN })).resolves.toBeDefined();
  });
});
