import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  // The script is opt-in (RUN_PG_INTEGRATION=1, throwaway initdb cluster) and starts a cluster when
  // executed, so it is read as source rather than imported: it must still carry the legacy aliases.
  describe('verify-marketing-content-approval-roundtrip.ts carries the legacy aliases', () => {
    const script = readFileSync(resolve(__dirname, '../../scripts/verify-marketing-content-approval-roundtrip.ts'), 'utf8');

    it('seeds legacy approvals and expects their canonical rewrite after up()', () => {
      // `aprovado` is seeded with surrounding spaces and a capital to prove the reader trims/lowercases.
      for (const seeded of ['"pendente"', '" Aprovado "', '"reprovado"', '"ajustes_solicitados"']) {
        expect(script).toContain(`"approval":${seeded}`);
      }
      expect(script).toContain(
        "['pending', 'approved', 'rejected', 'revision_requested', null, undefined, 'pending']",
      );
    });

    it('expects the legacy values restored one-to-one after down()', () => {
      expect(script).toContain(
        "['pendente', 'aprovado', 'reprovado', 'ajustes_solicitados', null, undefined, 'pendente']",
      );
    });

    it('carries exactly the aliases the migration backfills', () => {
      for (const [legacy, canonical] of pairs) {
        expect(script).toContain(legacy);
        expect(script).toContain(canonical);
      }
    });
  });
});
