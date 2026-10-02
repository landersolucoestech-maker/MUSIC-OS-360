import { BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003 as Migration } from './migrations/20260930000003_BackfillAndRestrictMarketingContentApprovalToEnglish';

// The opt-in round trip script (scripts/verify-marketing-content-approval-roundtrip.ts) verifies this
// migration against legacy approvals; here the same migration is run for real against a recording runner.
describe('marketing content approval legacy values (legacy in, canonical out)', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  const pairs: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['aprovado', 'approved'],
    ['reprovado', 'rejected'],
    ['ajustes_solicitados', 'revision_requested'],
  ];

  it('up() rewrites every legacy approval to its canonical value and restricts the CHECK to canonical', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('rolbypassrls')) return [{ bypass: true }];
      if (sql.includes('count(*)')) return [{ affected: 1 }];
      return [];
    });
    await new Migration().up({ query } as never);
    const backfills = calls.filter((c) => c.sql.includes('WITH updated AS')).map((c) => c.params);
    expect(backfills).toEqual(pairs);
    const add = calls.find((c) => c.sql.includes('ADD CONSTRAINT'))!.sql;
    for (const [legacy, canonical] of pairs) {
      expect(add).toContain(`'${canonical}'`);
      expect(add).not.toContain(`'${legacy}'`);
    }
  });

  it('down() accepts canonical and legacy values and restores the legacy value of every canonical approval one-to-one', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('rolbypassrls')) return [{ bypass: true }];
      if (sql.includes('count(*)')) return [{ affected: 1 }];
      return [];
    });
    await new Migration().down({ query } as never);
    const guard = calls.find((c) => c.sql.includes('SELECT DISTINCT'))!.sql;
    for (const [legacy, canonical] of pairs) {
      expect(guard).toContain(`'${legacy}'`);
      expect(guard).toContain(`'${canonical}'`);
    }
    const reverse = calls.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.params);
    expect(reverse).toEqual(pairs);
  });
});
