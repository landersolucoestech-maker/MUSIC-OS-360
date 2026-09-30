import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BackfillOrganizationIndustryToEnglish20260930000013 as Migration } from './migrations/20260930000013_BackfillOrganizationIndustryToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  DEFAULT_ORGANIZATION_INDUSTRY,
  LEGACY_ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRIES,
} from '../modules/auth/organization-industry';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; residue?: string[] } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('WITH updated AS')) return [{ value: 'gravadora', affected: 2 }];
    if (sql.includes('SELECT DISTINCT')) return (opts.residue ?? []).map((value) => ({ value }));
    return [];
  });
  return { query, calls };
}

describe('BackfillOrganizationIndustryToEnglish20260930000013', () => {
  const migration = new Migration();
  let log: jest.SpyInstance;

  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up(): lock_timeout, exact-match backfill of the API legacy map, new DEFAULT, then a bounded residue report', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.params).toEqual([Object.keys(LEGACY_ORGANIZATION_INDUSTRIES), Object.values(LEGACY_ORGANIZATION_INDUSTRIES)]);
    expect(update.sql).toContain('o."industry" = m.legacy');
    expect(update.sql).not.toMatch(/lower\(|btrim|trim\(|updated_at/i);
    const setDefault = calls.findIndex((c) => c.sql.includes('SET DEFAULT'));
    expect(calls[setDefault].sql).toContain(`SET DEFAULT '${DEFAULT_ORGANIZATION_INDUSTRY}'`);
    expect(calls.findIndex((c) => c.sql.includes('WITH updated AS'))).toBeLessThan(setDefault);
    expect(setDefault).toBeLessThan(calls.findIndex((c) => c.sql.includes('SELECT DISTINCT')));
  });

  it('adds no CHECK and drops nothing', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) expect(c.sql).not.toMatch(/CONSTRAINT|DROP|DELETE|ADD COLUMN/i);
  });

  it('residue report audits exactly the canonical set, never aborts, and is bounded', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `v${i}-${'x'.repeat(100)}`);
    const { query, calls } = runner({ residue: many });
    await expect(migration.up({ query } as never)).resolves.toBeUndefined();
    const audit = calls.find((c) => c.sql.includes('SELECT DISTINCT'))!;
    expect(audit.sql).toContain('LIMIT 21');
    expect([...audit.sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...ORGANIZATION_INDUSTRIES].sort());
    const message = String(log.mock.calls.map((c) => c[0]).find((m) => String(m).includes('outside the canonical set')));
    expect(message).toContain('more not shown');
    expect(message).not.toContain('x'.repeat(41));
  });

  it("down() restores the previous DEFAULT 'gravadora' and the Portuguese values with the same map", async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls.find((c) => c.sql.includes('SET DEFAULT'))!.sql).toContain(`SET DEFAULT 'gravadora'`);
    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.sql).toContain('SET "industry" = m.legacy');
    expect(update.sql).toContain('o."industry" = m.canonical');
    expect(update.params).toEqual([Object.keys(LEGACY_ORGANIZATION_INDUSTRIES), Object.values(LEGACY_ORGANIZATION_INDUSTRIES)]);
  });

  it('the new DEFAULT is the canonical constant in the entity, the vocabulary and the seeds', () => {
    const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
    expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(DEFAULT_ORGANIZATION_INDUSTRY);
    expect(read('./entities.ts')).toContain(`industry: string;`);
    expect(read('./entities.ts')).toMatch(new RegExp(`default: '${DEFAULT_ORGANIZATION_INDUSTRY}' \\}\\) industry: string`));
    for (const file of ['./seeds/01_default_tenant.ts', './seeds/03_operational_seed.ts', './bootstrap-tenant-zero.ts']) {
      expect(read(file)).toContain(`'${DEFAULT_ORGANIZATION_INDUSTRY}'`);
      expect(read(file)).not.toContain("'gravadora'");
    }
  });
});
