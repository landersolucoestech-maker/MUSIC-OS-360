import { BackfillContractLastPaymentKeysToEnglish20260930000023 as Migration, canonicalContractMetadataForBackfill } from './migrations/20260930000023_BackfillContractLastPaymentKeysToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_LAST_PAYMENT_KEYS } from '../common/compat/contract-last-payment';
import { fakeRunner, makeFakeDb } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const hasLegacy = (m: unknown) => Object.keys(LEGACY_LAST_PAYMENT_KEYS).some((k) => m && typeof m === 'object' && k in (m as object));

describe('BackfillContractLastPaymentKeysToEnglish20260930000023', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and uses the application key map', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    const legacy = Object.fromEntries(Object.keys(LEGACY_LAST_PAYMENT_KEYS).map((k) => [k, 'v']));
    expect(canonicalContractMetadataForBackfill(legacy).value).toEqual(Object.fromEntries(Object.values(LEGACY_LAST_PAYMENT_KEYS).map((k) => [k, 'v'])));
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb({ contracts: [] }, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('renames the three keys, preserves the rest, skips canonical rows, idempotent, conflict canonical-wins', async () => {
    const rows = [
      { id: ID(1), tenant_id: 't', metadata: { keep: { a: 1 }, ultimo_pagamento_em: '2026-01-01', ultimo_pagamento_valor: '10', ultimo_pagamento_por: 'u' } },
      { id: ID(2), tenant_id: 't', metadata: { last_payment_at: 'x' } },
      { id: ID(3), tenant_id: 't', metadata: { ultimo_pagamento_em: 'old', last_payment_at: 'new' } },
    ];
    const db = makeFakeDb({ contracts: rows });
    const runner = fakeRunner(db, (_t, r) => hasLegacy(r['metadata']));
    await migration.up(runner as never);
    expect(rows[0].metadata).toEqual({ keep: { a: 1 }, last_payment_at: '2026-01-01', last_payment_amount: '10', last_payment_by: 'u' });
    expect(rows[1].metadata).toEqual({ last_payment_at: 'x' });
    expect(rows[2].metadata).toEqual({ last_payment_at: 'new' });
    expect(db.log).toHaveLength(2);
    const logs = (console.log as unknown as jest.Mock).mock.calls.map((a) => String(a[0]));
    expect(logs.some((l) => /1 key conflict/.test(l))).toBe(true);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE "contracts"')).length;
    const n = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(n);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE/i);
  });

  it('down() restores BEFORE for untouched rows only', async () => {
    const rows = [
      { id: ID(1), tenant_id: 't', metadata: { ultimo_pagamento_em: 'a' } },
      { id: ID(2), tenant_id: 't', metadata: { ultimo_pagamento_em: 'b' } },
    ];
    const db = makeFakeDb({ contracts: rows });
    const runner = fakeRunner(db, (_t, r) => hasLegacy(r['metadata']));
    await migration.up(runner as never);
    (rows[1].metadata as Record<string, unknown>)['last_payment_at'] = 'edited';
    await migration.down(runner as never);
    expect(rows[0].metadata).toEqual({ ultimo_pagamento_em: 'a' });
    expect(rows[1].metadata).toEqual({ last_payment_at: 'edited' });
  });
});
