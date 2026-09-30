/**
 * Deprecated QUERY alias `artistId` must FILTER (canonical `artist_id`), not be
 * silently dropped. Tenant scope is never widened by an alias.
 */
import 'reflect-metadata';
import { TransactionsService } from './transactions.service';
import type { QueryTransactionDto } from './dto/query-transaction.dto';

const TENANT = 'tenant-test';
const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const CLAUSE = 't.artist_id = :artistId';

function build() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const svc = new TransactionsService({ getRepository: jest.fn(() => repo) } as never, undefined as never, undefined as never, undefined as never);
  const clauses = () => qb['andWhere'].mock.calls.map((c) => [c[0], c[1]]);
  return { svc, qb, clauses };
}

describe('TransactionsService.list — deprecated query alias artistId', () => {
  it('filters like artist_id', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { artistId: A1 } as QueryTransactionDto);
    expect(clauses()).toContainEqual([CLAUSE, { artistId: A1 }]);
  });

  it('canonical wins when both are sent', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { artistId: A2, artist_id: A1 } as QueryTransactionDto);
    expect(clauses().filter((c) => c[0] === CLAUSE)).toEqual([[CLAUSE, { artistId: A1 }]]);
  });

  it('empty alias adds no filter', async () => {
    const { svc, clauses } = build();
    await svc.list(TENANT, { artistId: '' } as unknown as QueryTransactionDto);
    expect(clauses().some((c) => c[0] === CLAUSE)).toBe(false);
  });

  it('does not mutate the caller query object', async () => {
    const { svc } = build();
    const q = { artistId: A1 } as QueryTransactionDto;
    await svc.list(TENANT, q);
    expect(q).toEqual({ artistId: A1 });
  });

  it('tenant scope is untouched and an alias cannot widen or override it', async () => {
    const { svc, qb, clauses } = build();
    await svc.list(TENANT, { artistId: A1, tenant_id: 'other' } as unknown as QueryTransactionDto);
    expect(qb['where']).toHaveBeenCalledWith('t.tenant_id = :tenantId', { tenantId: TENANT });
    expect(qb['where']).toHaveBeenCalledTimes(1);
    expect(clauses().some((c) => JSON.stringify(c).includes('other'))).toBe(false);
    expect(clauses()).toContainEqual([CLAUSE, { artistId: A1 }]);
  });
});
