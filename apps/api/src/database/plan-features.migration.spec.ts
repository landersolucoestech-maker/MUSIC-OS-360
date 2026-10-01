import { BackfillPlanFeatureKeysToEnglish20260930000024 as Migration, canonicalFeaturesForBackfill } from './migrations/20260930000024_BackfillPlanFeatureKeysToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { canonicalPlanFeatures } from '../common/compat/plan-features';
import { fakeRunner, makeFakeDb } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const legacy = (r: Record<string, unknown>) => !!r['features'] && typeof r['features'] === 'object' && !Array.isArray(r['features']) && 'moduleRh' in (r['features'] as object);

describe('BackfillPlanFeatureKeysToEnglish20260930000024', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and agrees with the application rename', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    const sample = { moduleRh: true, moduleCrm: false };
    expect(canonicalFeaturesForBackfill(sample).value).toEqual(canonicalPlanFeatures(sample));
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb({ tenants: [], billing_plans: [] }, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('renames in tenants and billing_plans (objects only), preserves other keys, skips canonical and array/label shapes', async () => {
    const tenants = [
      { id: ID(1), features: { moduleRh: true, moduleCrm: true, integrations: { a: 1 } } },
      { id: ID(2), features: { moduleHr: true } },
      { id: ID(3), features: { moduleRh: false, moduleHr: true } },
    ];
    const plans = [
      { id: ID(4), features: { moduleRh: true, moduleArtists: true } },
      { id: ID(5), features: { labels: ['a', 'b'] } },
      { id: ID(6), features: [] },
    ];
    const db = makeFakeDb({ tenants, billing_plans: plans });
    const runner = fakeRunner(db, (_t, r) => legacy(r));
    await migration.up(runner as never);
    expect(tenants[0].features).toEqual({ moduleHr: true, moduleCrm: true, integrations: { a: 1 } });
    expect(tenants[1].features).toEqual({ moduleHr: true });
    expect(tenants[2].features).toEqual({ moduleHr: true });
    expect(plans[0].features).toEqual({ moduleHr: true, moduleArtists: true });
    expect(plans[1].features).toEqual({ labels: ['a', 'b'] });
    expect(plans[2].features).toEqual([]);
    expect(db.log).toHaveLength(3);
    expect(db.log.find((l) => l.id === ID(4))!.tenant_id).toBe(ID(4)); // fake maps via "id"; real SQL uses the nil uuid for billing_plans
    const logs = (console.log as unknown as jest.Mock).mock.calls.map((a) => String(a[0]));
    expect(logs.some((l) => /1 key conflict/.test(l))).toBe(true);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE')).length;
    const n = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(n);
    const select = db.statements.find((s) => s.sql.includes('FROM "billing_plans"'))!;
    expect(select.sql).toContain(`'00000000-0000-0000-0000-000000000000'::uuid AS "tenant_id"`);
    expect(select.sql).toContain(`jsonb_typeof("features") = 'object'`);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE/i);
  });

  it('down() restores untouched rows only', async () => {
    const tenants = [{ id: ID(1), features: { moduleRh: true } }, { id: ID(2), features: { moduleRh: false } }];
    const db = makeFakeDb({ tenants, billing_plans: [] });
    const runner = fakeRunner(db, (_t, r) => legacy(r));
    await migration.up(runner as never);
    (tenants[1].features as Record<string, unknown>)['extra'] = true;
    await migration.down(runner as never);
    expect(tenants[0].features).toEqual({ moduleRh: true });
    expect(tenants[1].features).toEqual({ moduleHr: false, extra: true });
  });
});
