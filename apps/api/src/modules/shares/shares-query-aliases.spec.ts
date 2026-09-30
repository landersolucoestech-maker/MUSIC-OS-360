/**
 * Deprecated QUERY aliases (workId, trackId, role) must FILTER, not be silently
 * dropped: an old web build's filtered list must not return unfiltered rows.
 * Tenant scope is never widened by an alias.
 */
import 'reflect-metadata';
import { SharesService } from './shares.service';
import type { QueryShareDto } from './dto/shares.dto';

const TENANT = 'tenant-1';
const WORK = '11111111-1111-4111-8111-111111111111';
const WORK2 = '22222222-2222-4222-8222-222222222222';
const PH = '33333333-3333-4333-8333-333333333333';

function build() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take', 'select', 'addSelect', 'groupBy', 'addGroupBy']) qb[m] = jest.fn(() => qb);
  qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
  qb['getRawMany'] = jest.fn(async () => []);
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const svc = new SharesService({ getRepository: jest.fn(() => repo) } as never);
  const clauses = () => qb['andWhere'].mock.calls.map((c) => [c[0], c[1]]);
  return { svc, qb, clauses };
}

describe('SharesService list/stats — deprecated query aliases are applied', () => {
  it.each([
    ['workId', WORK, 's.work_id = :workId', { workId: WORK }],
    ['trackId', PH, 's.phonogram_id = :phonogramId', { phonogramId: PH }],
    ['role', 'composer', 's.party_role = :partyRole', { partyRole: 'composer' }],
  ])('list: %s filters like its canonical field', async (alias, value, clause, params) => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { [alias]: value } as unknown as QueryShareDto);
    expect(clauses()).toContainEqual([clause, params]);
  });

  it('stats: alias also filters (shared baseQb)', async () => {
    const { svc, clauses } = build();
    await svc.stats(TENANT, { workId: WORK } as unknown as QueryShareDto);
    expect(clauses()).toContainEqual(['s.work_id = :workId', { workId: WORK }]);
  });

  it('legacy Portuguese role value is canonicalized after aliasing', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { role: 'compositor' } as unknown as QueryShareDto);
    expect(clauses()).toContainEqual(['s.party_role = :partyRole', { partyRole: 'composer' }]);
  });

  it('canonical wins when both alias and canonical are sent', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { workId: WORK2, work_id: WORK } as unknown as QueryShareDto);
    const w = clauses().filter((c) => c[0] === 's.work_id = :workId');
    expect(w).toEqual([['s.work_id = :workId', { workId: WORK }]]);
  });

  it('empty alias values add no filter', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { workId: '', trackId: '', role: '' } as unknown as QueryShareDto);
    expect(clauses().map((c) => c[0])).toEqual(['s.deleted_at IS NULL']);
  });

  it('does not mutate the caller query object', async () => {
    const { svc } = build();
    const q = { workId: WORK } as unknown as QueryShareDto;
    await svc.list(TENANT, q);
    expect(q).toEqual({ workId: WORK });
  });

  it('tenant scope is untouched and an alias cannot widen or override it', async () => {
    const { svc, qb, clauses } = build();
    await svc.list(TENANT, { workId: WORK, tenant_id: 'other', tenantId: 'other' } as unknown as QueryShareDto);
    expect(qb['where']).toHaveBeenCalledWith('s.tenant_id = :tenantId', { tenantId: TENANT });
    expect(qb['where']).toHaveBeenCalledTimes(1);
    expect(clauses().some((c) => JSON.stringify(c).includes('other'))).toBe(false);
    expect(clauses()).toContainEqual(['s.work_id = :workId', { workId: WORK }]);
  });
});

// Security review: the deprecated aliases must be validated like their canonical fields, so a
// non-UUID value is a 400 instead of a Postgres 22P02 (500) from the query builder.
describe('QueryShareDto deprecated aliases validation', () => {
  const validateQuery = async (payload: Record<string, unknown>) => {
    const { plainToInstance } = await import('class-transformer');
    const { validate } = await import('class-validator');
    const { QueryShareDto } = await import('./dto/shares.dto');
    return validate(plainToInstance(QueryShareDto, payload), { whitelist: true, forbidNonWhitelisted: true });
  };

  it.each([['workId'], ['trackId']])('rejects a non-UUID %s', async (key) => {
    expect((await validateQuery({ [key]: 'not-a-uuid' })).length).toBeGreaterThan(0);
  });

  it.each([['workId'], ['trackId']])('accepts a UUID %s', async (key) => {
    expect(await validateQuery({ [key]: '3f2b8c1e-5d4a-4b6f-9c7e-1a2b3c4d5e6f' })).toEqual([]);
  });
});
