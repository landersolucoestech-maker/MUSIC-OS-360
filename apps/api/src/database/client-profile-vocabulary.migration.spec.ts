import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BackfillClientProfileToEnglish20260930000012 as Migration } from './migrations/20260930000012_BackfillClientProfileToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { CLIENT_PROFILES, LEGACY_CLIENT_PROFILES, canonicalClientProfile } from '../modules/clients/client-profile-vocabulary';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; residue?: string[]; changed?: Array<{ value: string; affected: number }> } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('WITH updated AS')) return opts.changed ?? [{ value: 'outros', affected: 3 }];
    if (sql.includes('SELECT DISTINCT')) return (opts.residue ?? []).map((value) => ({ value }));
    return [];
  });
  return { query, calls };
}

describe('BackfillClientProfileToEnglish20260930000012', () => {
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

  it('up() sets lock_timeout, backfills exactly the API legacy map (exact match, bound parameters), then reports residue', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");

    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.params).toEqual([Object.keys(LEGACY_CLIENT_PROFILES), Object.values(LEGACY_CLIENT_PROFILES)]);
    expect(Object.keys(LEGACY_CLIENT_PROFILES)).toHaveLength(50);
    // exact match: no case folding / trimming; updated_at untouched
    expect(update.sql).toContain('c."profile" = m.legacy');
    expect(update.sql).not.toMatch(/lower\(|btrim|trim\(/i);
    expect(update.sql).not.toContain('updated_at');
    expect(calls.findIndex((c) => c.sql.includes('WITH updated AS'))).toBeLessThan(calls.findIndex((c) => c.sql.includes('SELECT DISTINCT')));
  });

  it('adds no constraint and drops nothing', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) expect(c.sql).not.toMatch(/CONSTRAINT|DROP|ALTER TABLE|DELETE/i);
  });

  it('residue report audits exactly the canonical set and is bounded (never aborts)', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `v${i}-${'x'.repeat(100)}`);
    const { query, calls } = runner({ residue: many });
    await expect(migration.up({ query } as never)).resolves.toBeUndefined();
    const audit = calls.find((c) => c.sql.includes('SELECT DISTINCT'))!;
    expect(audit.sql).toContain('LIMIT 21');
    expect([...audit.sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...CLIENT_PROFILES].sort());
    const message = String(log.mock.calls.map((c) => c[0]).find((m) => String(m).includes('outside the canonical set')));
    expect(message).toContain('more not shown');
    expect(message).not.toContain('x'.repeat(41));
    expect(message.match(/v\d+-/g)).toHaveLength(20);
  });

  it('down() restores the Portuguese slugs with the same map (one-to-one), guarded', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.sql).toContain('SET "profile" = m.legacy');
    expect(update.sql).toContain('c."profile" = m.canonical');
    expect(update.params).toEqual([Object.keys(LEGACY_CLIENT_PROFILES), Object.values(LEGACY_CLIENT_PROFILES)]);
    expect(new Set(Object.values(LEGACY_CLIENT_PROFILES)).size).toBe(50);
  });
});

describe('clients.profile vocabulary constants', () => {
  it('60 canonical ids: 10 kept + 50 renamed targets, legacy keys never canonical', () => {
    expect(CLIENT_PROFILES).toHaveLength(60);
    expect(new Set(CLIENT_PROFILES).size).toBe(60);
    const renamed = Object.values(LEGACY_CLIENT_PROFILES);
    for (const target of renamed) expect(CLIENT_PROFILES as readonly string[]).toContain(target);
    for (const legacy of Object.keys(LEGACY_CLIENT_PROFILES)) expect(CLIENT_PROFILES as readonly string[]).not.toContain(legacy);
    expect(CLIENT_PROFILES.filter((id) => !renamed.includes(id as never))).toHaveLength(10);
  });

  it('CHECK-free by design: the web catalog ids are set-equal to CLIENT_PROFILES', () => {
    const web = readFileSync(resolve(__dirname, '../../../web/src/modules/crm-relationships/constants/contact-classification.ts'), 'utf8');
    const ids = new Set([...web.matchAll(/opt\("([a-z_]+)", "/g)].map((m) => m[1]));
    expect([...ids].sort()).toEqual([...CLIENT_PROFILES].sort());
  });

  it('canonical wins, deprecated slugs are mapped, unknown values are returned unchanged', () => {
    expect(canonicalClientProfile('gravadora_selo')).toBe('record_label');
    expect(canonicalClientProfile('record_label')).toBe('record_label');
    expect(canonicalClientProfile('manager')).toBe('manager');
    expect(canonicalClientProfile('produtora')).toBe('produtora');
    expect(canonicalClientProfile(null)).toBeNull();
  });
});
