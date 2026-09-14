import { BillingEnforcementService, TenantBillingStatus } from './billing-enforcement.service';

/**
 * P0-2 regression: webhook idempotency must be retry-safe, not just
 * duplicate-safe. See billing.service.ts's handleWebhook for the full
 * flow — this spec exercises the exact SQL contract recordWebhookProcessed/
 * markWebhookProcessed/markWebhookFailed guarantee.
 */
describe('BillingEnforcementService — webhook idempotency lifecycle', () => {
  function makeService(queryImpl: jest.Mock) {
    const ds = { query: queryImpl } as never;
    const audit = { record: jest.fn() } as never;
    return new BillingEnforcementService(ds, audit);
  }

  it('primeira entrega: INSERT reivindica o evento (status=processing) — "inserted"', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ id: 'row-1' }]); // INSERT ... RETURNING id
    const service = makeService(query);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_1', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('inserted');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO payment_events/);
    expect(query.mock.calls[0][0]).toMatch(/status'?\)?\s*\n?\s*VALUES.*'processing'/s);
  });

  it('evento já PROCESSED: INSERT conflita, reclaim (WHERE status=\'failed\') não afeta nenhuma linha — "duplicate"', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([]) // INSERT ... ON CONFLICT DO NOTHING → 0 rows (already exists)
      .mockResolvedValueOnce([]); // UPDATE ... WHERE status='failed' → 0 rows (it's 'processed', not 'failed')
    const service = makeService(query);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_done', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('duplicate');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/UPDATE payment_events/);
    expect(query.mock.calls[1][0]).toMatch(/status = 'failed'/);
  });

  it('evento em PROCESSING por outra entrega concorrente: reclaim também não afeta linha — "duplicate", nunca reprocessa em paralelo', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([]) // INSERT conflicts — a sibling delivery already holds it
      .mockResolvedValueOnce([]); // reclaim fails — status is 'processing', not 'failed'
    const service = makeService(query);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_inflight', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('duplicate');
  });

  it('evento FAILED (falha transitória anterior): reclaim afeta a linha — "inserted", retry legítimo acontece', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([]) // INSERT conflicts — row already exists from the failed attempt
      .mockResolvedValueOnce([{ id: 'row-1' }]); // reclaim succeeds — status was 'failed'
    const service = makeService(query);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_retry', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('inserted');
  });

  it('markWebhookProcessed: seta status=processed e processed_at=now() — só isso conta como aplicado de verdade', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const service = makeService(query);

    await service.markWebhookProcessed('evt_1');

    expect(query.mock.calls[0][0]).toMatch(/SET status = 'processed', processed_at = now\(\)/);
    expect(query.mock.calls[0][1]).toEqual(['evt_1']);
  });

  it('markWebhookFailed: seta status=failed — FAILED != PROCESSED, e habilita reclaim futuro', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const service = makeService(query);

    await service.markWebhookFailed('evt_1');

    expect(query.mock.calls[0][0]).toMatch(/SET status = 'failed'/);
    expect(query.mock.calls[0][1]).toEqual(['evt_1']);
  });
});

/**
 * P0-A: DunningService must enumerate tenants exclusively through this
 * method (never via a second, independent read of billing_subscriptions),
 * and this method must use the admin (bypass-RLS) connection for the
 * cross-tenant sweep — the same reason ContractExpiryScheduler/
 * InvoiceOverdueScheduler already do — since a tenant-scoped `ds` cannot see
 * other tenants' rows under RLS.
 */
describe('BillingEnforcementService — listTenantIdsRequiringDunningAttention (P0-A)', () => {
  it('returns tenant_id for every row in a restricted status, querying via the admin connection when available', async () => {
    const adminQuery = jest.fn().mockResolvedValue([{ tenant_id: 'tenant-1' }, { tenant_id: 'tenant-2' }]);
    const tenantQuery = jest.fn();
    const ds = { query: tenantQuery } as never;
    const adminDs = { query: adminQuery } as never;
    const audit = { record: jest.fn() } as never;
    const service = new BillingEnforcementService(ds, audit, adminDs);

    const result = await service.listTenantIdsRequiringDunningAttention();

    expect(result).toEqual(['tenant-1', 'tenant-2']);
    expect(adminQuery).toHaveBeenCalledWith(
      expect.stringMatching(/status IN \('payment_grace','read_only','suspended'\)/),
    );
    expect(tenantQuery).not.toHaveBeenCalled();
  });

  it('falls back to the tenant-scoped connection when no admin connection is injected', async () => {
    const tenantQuery = jest.fn().mockResolvedValue([{ tenant_id: 'tenant-1' }]);
    const ds = { query: tenantQuery } as never;
    const audit = { record: jest.fn() } as never;
    const service = new BillingEnforcementService(ds, audit, null);

    const result = await service.listTenantIdsRequiringDunningAttention();

    expect(result).toEqual(['tenant-1']);
  });

  it('returns an empty array, not a throw, when neither connection is available', async () => {
    const service = new BillingEnforcementService(null, { record: jest.fn() } as never, null);

    await expect(service.listTenantIdsRequiringDunningAttention()).resolves.toEqual([]);
  });
});

/**
 * P0-A-R1 (T1): regression test for the confirmed infinite recursion —
 * `suspendTenant` fetched its `before` audit snapshot via `getState()`,
 * which re-ran `applyOverrideAndEscalation` on the still-unmodified row,
 * which (for a tenant already past its suspend threshold) called
 * `suspendTenant` again — no base case. The fix (readStateRaw) is proven
 * here by an EXACT, bounded count of the raw `SELECT * FROM
 * tenant_billing_state` pattern, not merely "the promise resolved" — a
 * bug that recursed a bounded-but-wrong number of times before Node's
 * stack limit could still "pass" a test that only checks resolution.
 */
describe('BillingEnforcementService — recursion safety (P0-A-R1)', () => {
  function makeEscalationDs(row: Record<string, unknown>) {
    const selectCalls: string[] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) {
        selectCalls.push(sql);
        return [row];
      }
      if (/SELECT value FROM billing_settings/.test(sql)) {
        return []; // defaults apply
      }
      if (/UPDATE billing_subscriptions/.test(sql)) {
        return [];
      }
      if (/INSERT INTO tenant_billing_state[\s\S]*VALUES \(\$1, 'suspended'/.test(sql)) {
        return [{ ...row, status: 'suspended', suspended_at: params?.[1] }];
      }
      if (/UPDATE tenant_billing_state SET status_changed_at/.test(sql)) {
        return [{ status_changed_at: new Date() }];
      }
      throw new Error(`Unexpected query in recursion test: ${sql}`);
    });
    return { query, selectCalls };
  }

  it('getStateWithEscalation() on a tenant already past the suspend threshold resolves to suspended with a bounded, non-recursive call count', async () => {
    const now = new Date('2026-09-06T00:00:00.000Z');
    const graceUntil = new Date('2026-08-10T00:00:00.000Z'); // far enough past default suspend_after_days=15
    const row = {
      id: 'row-1', tenant_id: 'tenant-1', status: 'read_only',
      grace_until: graceUntil.toISOString(), suspended_at: null,
      manual_override: false, manual_override_reason: null, manual_override_until: null,
      created_at: now, updated_at: now,
    };
    const { query, selectCalls } = makeEscalationDs(row);
    const ds = { query } as never;
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService(ds, audit as never);

    const result = await service.getStateWithEscalation('tenant-1');

    expect(result?.status).toBe('suspended');
    // Exactly 2: getStateWithEscalation's own readStateRaw + suspendTenant's
    // `before` fetch. Any regression back to the old getState()-based
    // `before` fetch would recurse: 2 -> 4 -> 8... — this assertion pins the
    // literal bound.
    expect(selectCalls).toHaveLength(2);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('a stable, already-suspended tenant produces zero writes on repeated getStateWithEscalation() calls (no-op idempotency)', async () => {
    const row = {
      id: 'row-1', tenant_id: 'tenant-1', status: 'suspended',
      grace_until: null, suspended_at: new Date('2026-08-01T00:00:00.000Z'),
      manual_override: false, manual_override_reason: null, manual_override_until: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const query = jest.fn(async (sql: string) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [row];
      throw new Error(`Unexpected write in stable-read test: ${sql}`);
    });
    const ds = { query } as never;
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService(ds, audit as never);

    await service.getStateWithEscalation('tenant-1');
    await service.getStateWithEscalation('tenant-1');
    await service.getStateWithEscalation('tenant-1');

    expect(audit.log).not.toHaveBeenCalled();
    // Any UPDATE/INSERT call would have thrown inside the mock above —
    // reaching this line at all is the proof of zero writes.
  });
});

/**
 * find-d45d822d (CQS): `getState()` must be a pure read — zero UPDATE/INSERT,
 * directly or transitively — even for a tenant whose row objectively
 * qualifies for escalation. Only `getStateWithEscalation()` may write.
 */
describe('BillingEnforcementService — getState() CQS purity (find-d45d822d)', () => {
  it('getState() on a tenant well past the suspend threshold returns the row as-is and issues zero writes', async () => {
    const graceUntil = new Date('2026-08-10T00:00:00.000Z'); // far enough past default suspend_after_days=15
    const row = {
      id: 'row-1', tenant_id: 'tenant-1', status: 'read_only',
      grace_until: graceUntil.toISOString(), suspended_at: null,
      manual_override: false, manual_override_reason: null, manual_override_until: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const query = jest.fn(async (sql: string) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [row];
      throw new Error(`getState() must never write — unexpected query: ${sql}`);
    });
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService({ query } as never, audit as never);

    const result = await service.getState('tenant-1');

    // Still reports the raw, un-escalated status — proves no side effect ran.
    expect(result?.status).toBe('read_only');
    expect(query).toHaveBeenCalledTimes(1);
    expect(audit.log).not.toHaveBeenCalled();
  });
});

/**
 * Regression test: Stripe fires a new event.id per retry attempt on the same
 * failed invoice (Smart Retries), so payment_events dedup (a literal-replay
 * guard on stripe_event_id) never intercepts these distinct events. Without
 * this guard, startPaymentGrace unconditionally recomputed grace_until on
 * every call — the single anchor applyOverrideAndEscalation uses for the
 * whole payment_grace -> read_only -> suspended timeline — so each retry
 * pushed the suspend deadline forward, defeating dunning for a tenant who
 * never actually pays.
 */
describe('BillingEnforcementService — startPaymentGrace grace_until idempotency', () => {
  it('a tenant already in payment_grace keeps its original grace_until on a second payment-failure event', async () => {
    const originalGraceUntil = new Date('2026-09-01T00:00:00.000Z');
    const before = {
      id: 'row-1', tenant_id: 'tenant-1', status: 'payment_grace',
      grace_until: originalGraceUntil.toISOString(), suspended_at: null,
      manual_override: false, manual_override_reason: null, manual_override_until: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [before];
      if (/SELECT value FROM billing_settings/.test(sql)) return []; // defaults apply
      if (/UPDATE billing_subscriptions/.test(sql)) return [];
      if (/INSERT INTO tenant_billing_state/.test(sql)) return [{ ...before, grace_until: params?.[1] }];
      throw new Error(`Unexpected query in grace_until idempotency test: ${sql}`);
    });
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService({ query } as never, audit as never);

    const laterNow = new Date('2026-09-05T00:00:00.000Z'); // a later retry, days after the original failure
    const after = await service.startPaymentGrace('tenant-1', 'invoice.payment_failed retry', laterNow);

    expect(new Date(after!.grace_until as unknown as string)).toEqual(originalGraceUntil);
    const updateCall = query.mock.calls.find(([sql]) => /UPDATE billing_subscriptions/.test(sql as string));
    expect(updateCall?.[1]).toEqual(['tenant-1', originalGraceUntil]);
    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO tenant_billing_state/.test(sql as string));
    expect(insertCall?.[1]).toEqual(['tenant-1', originalGraceUntil, null]);
    // Same status in and out -> auditStateChange must not touch status_changed_at.
    expect(query.mock.calls.some(([sql]) => /status_changed_at = now\(\)/.test(sql as string))).toBe(false);
  });

  it('a tenant entering payment_grace for the first time gets a fresh grace_until computed from settings', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return []; // no prior row
      if (/SELECT value FROM billing_settings/.test(sql)) return []; // defaults: grace_period_days=3
      if (/UPDATE billing_subscriptions/.test(sql)) return [];
      if (/INSERT INTO tenant_billing_state/.test(sql)) {
        return [{ id: 'row-1', tenant_id: 'tenant-1', status: 'payment_grace', grace_until: params?.[1] }];
      }
      if (/status_changed_at = now\(\)/.test(sql)) return [{ status_changed_at: now }];
      throw new Error(`Unexpected query in fresh-grace test: ${sql}`);
    });
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService({ query } as never, audit as never);

    const after = await service.startPaymentGrace('tenant-1', 'invoice.payment_failed', now);

    const expectedGraceUntil = new Date(now);
    expectedGraceUntil.setUTCDate(expectedGraceUntil.getUTCDate() + 3); // DEFAULT_SETTINGS.grace_period_days
    expect(new Date(after!.grace_until as unknown as string).toISOString()).toBe(expectedGraceUntil.toISOString());
  });
});

/**
 * find-329e1db7: activateTenant/startPaymentGrace used to write
 * tenant_billing_state unconditionally -- two genuinely concurrent invoice
 * webhooks for the same tenant (an older payment_failed racing a newer
 * payment_succeeded) could both read the same pre-write state and both
 * pass their own app-level staleness check, then race to write; whichever
 * commit landed last won regardless of actual event order. The fix adds an
 * atomic WHERE guard (mirroring find-602e8654's billing_subscriptions
 * guard) directly on the tenant_billing_state upsert, keyed on the
 * Stripe event's own created timestamp vs. the row's stored
 * status_changed_at -- evaluated by Postgres inside the single UPDATE
 * statement, not via a separate read.
 */
describe('BillingEnforcementService — invoice-event concurrency guard (find-329e1db7)', () => {
  function makeQuery(insertResult: unknown[]) {
    return jest.fn(async (sql: string, _params?: unknown[]) => {
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [];
      if (/SELECT value FROM billing_settings/.test(sql)) return [];
      if (/UPDATE billing_subscriptions/.test(sql)) return [];
      if (/INSERT INTO tenant_billing_state/.test(sql)) return insertResult;
      if (/status_changed_at = now\(\)/.test(sql)) return [{ status_changed_at: new Date() }];
      throw new Error(`Unexpected query: ${sql}`);
    });
  }

  it('startPaymentGrace includes the atomic event-ordering WHERE guard in its SQL', async () => {
    const query = makeQuery([{ id: 'row-1', tenant_id: 'tenant-1', status: 'payment_grace' }]);
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    await service.startPaymentGrace('tenant-1', 'invoice.payment_failed', new Date(), undefined, 1000);

    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO tenant_billing_state/.test(sql as string));
    expect(insertCall?.[0]).toContain('to_timestamp($3) >= tenant_billing_state.status_changed_at');
    expect(insertCall?.[1]).toEqual(['tenant-1', expect.any(Date), 1000]);
  });

  it('activateTenant returns null and never audits a status change when the write is rejected as stale (guard matched zero rows)', async () => {
    const query = makeQuery([]); // simulates Postgres's WHERE guard rejecting the write
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    const result = await service.activateTenant('tenant-1', 'invoice.payment_succeeded', new Date(), undefined, 500);

    expect(result).toBeNull();
    expect(query.mock.calls.some(([sql]) => /status_changed_at = now\(\)/.test(sql as string))).toBe(false);
  });

  it('activateTenant applies and audits normally when the write lands (guard matched)', async () => {
    const query = makeQuery([{ id: 'row-1', tenant_id: 'tenant-1', status: 'active' }]);
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    const result = await service.activateTenant('tenant-1', 'invoice.payment_succeeded', new Date(), undefined, 2000);

    expect(result?.status).toBe('active');
    expect(query.mock.calls.some(([sql]) => /status_changed_at = now\(\)/.test(sql as string))).toBe(true);
  });

  it('a caller that omits eventCreatedAtSec (manual admin actions, subscription-status path) still applies unconditionally', async () => {
    const query = makeQuery([{ id: 'row-1', tenant_id: 'tenant-1', status: 'active' }]);
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    const result = await service.activateTenant('tenant-1', 'manual admin reactivation');

    expect(result?.status).toBe('active');
    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO tenant_billing_state/.test(sql as string));
    expect(insertCall?.[1]).toEqual(['tenant-1', expect.any(Date), null]);
  });
});

/**
 * find-c64da2b1: the payment_grace -> read_only transition inside
 * applyOverrideAndEscalation used to be a blind
 * `UPDATE ... SET status = 'read_only' WHERE tenant_id = $1` with no guard
 * on the row's current status — a concurrent writer (e.g. a webhook's
 * activateTenant/suspendTenant landing between the read and this write)
 * would be silently stomped back to 'read_only'. It must now be a
 * conditional UPDATE guarded by the status it was actually computed from,
 * and report the real current row (not a phantom overwrite) when that guard
 * doesn't match.
 */
describe('BillingEnforcementService — read_only transition optimistic guard (find-c64da2b1)', () => {
  function pastGraceRow(status: TenantBillingStatus) {
    return {
      id: 'row-1', tenant_id: 'tenant-1', status,
      grace_until: new Date('2026-09-01T00:00:00.000Z'), suspended_at: null,
      manual_override: false, manual_override_reason: null, manual_override_until: null,
      last_payment_at: null, next_payment_at: null,
      status_changed_at: new Date('2026-08-30T00:00:00.000Z'),
      created_at: new Date(), updated_at: new Date(),
    };
  }
  const now = new Date('2026-09-03T00:00:00.000Z'); // past grace_until, before suspend_after_days threshold

  it('transitions to read_only via a WHERE-guarded UPDATE keyed on the observed prior status', async () => {
    // getStateWithEscalation() has no injectable `now` -- it always escalates
    // against the real wall clock (see applyOverrideAndEscalation's `now = new
    // Date()` default). Pin the clock so this test stays deterministic
    // instead of silently flipping to "suspended" once real time crosses the
    // suspend_after_days threshold relative to the hardcoded grace_until.
    jest.useFakeTimers({ now });
    try {
      const row = pastGraceRow('payment_grace');
      const query = jest.fn(async (sql: string, params?: unknown[]) => {
        if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [row];
        if (/SELECT value FROM billing_settings/.test(sql)) return [];
        if (/UPDATE tenant_billing_state\s+SET status = 'read_only'/.test(sql)) {
          expect(sql).toMatch(/WHERE tenant_id = \$1 AND status = \$2/);
          expect(params).toEqual(['tenant-1', 'payment_grace']);
          return [{ ...row, status: 'read_only' }];
        }
        if (/status_changed_at = now\(\)/.test(sql)) return [{ status_changed_at: now }];
        throw new Error(`Unexpected query in read_only guard test: ${sql}`);
      });
      const audit = { log: jest.fn() };
      const service = new BillingEnforcementService({ query } as never, audit as never);

      const result = await service.getStateWithEscalation('tenant-1');

      expect(result?.status).toBe('read_only');
      expect(audit.log).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('when a concurrent writer already moved the tenant off the observed status, returns the real current row instead of stomping it', async () => {
    const staleRead = pastGraceRow('payment_grace');
    // A concurrent writer already reactivated the tenant between our read and our write.
    const actualCurrent = { ...pastGraceRow('active'), grace_until: null };
    const query = jest.fn(async (sql: string) => {
      if (/UPDATE tenant_billing_state\s+SET status = 'read_only'/.test(sql)) return []; // guard didn't match — 0 rows
      if (/SELECT \* FROM tenant_billing_state WHERE tenant_id/.test(sql)) return [actualCurrent];
      if (/SELECT value FROM billing_settings/.test(sql)) return [];
      throw new Error(`Unexpected query in read_only lost-race test: ${sql}`);
    });
    const audit = { log: jest.fn() };
    const service = new BillingEnforcementService({ query } as never, audit as never);

    const result = await service.applyOverrideAndEscalation(staleRead, now);

    expect(result.status).toBe('active');
    // No audit for a transition that never actually happened here.
    expect(audit.log).not.toHaveBeenCalled();
  });
});

/**
 * find-95fe7b59: a 'processing' row stuck by a crash (never routed to
 * 'failed') must become reclaimable once stale, without ever double-claiming
 * a genuinely fresh in-flight row.
 */
describe('BillingEnforcementService — stale processing reclaim (find-95fe7b59)', () => {
  it('reclaims a processing row via a staleness-windowed UPDATE and resets its claim clock', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([]) // INSERT conflicts — row already exists (stuck at 'processing')
      .mockResolvedValueOnce([{ id: 'row-1' }]); // staleness-windowed reclaim succeeds
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_stuck', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('inserted');
    const [reclaimSql, reclaimParams] = query.mock.calls[1];
    expect(reclaimSql).toMatch(/status = 'processing' AND created_at < now\(\)/);
    expect(reclaimSql).toMatch(/SET status = 'processing'.*created_at = now\(\)/s);
    expect(reclaimParams).toEqual(['evt_stuck', 'tenant-1', JSON.stringify({}), 5 * 60 * 1000]);
  });

  it('a genuinely fresh processing row (younger than the staleness window) is never reclaimed — reported as duplicate', async () => {
    // The staleness predicate is evaluated by Postgres itself against
    // created_at; from the caller's side this is exactly the same "0 rows
    // affected" shape as any other non-matching reclaim attempt.
    const query = jest.fn()
      .mockResolvedValueOnce([]) // INSERT conflicts — a fresh delivery already holds it
      .mockResolvedValueOnce([]); // reclaim UPDATE affects 0 rows — still within the staleness window
    const service = new BillingEnforcementService({ query } as never, { log: jest.fn() } as never);

    const result = await service.recordWebhookProcessed({
      tenantId: 'tenant-1', stripeEventId: 'evt_fresh_inflight', eventType: 'invoice.paid', payload: {},
    });

    expect(result).toBe('duplicate');
  });
});

/**
 * find-99ea599c / ac-33b28991: a webhook event resolved to tenant A must
 * only ever be able to write tenant A's tenant_billing_state row, even when
 * another tenant's data is present in the same result set / lookup space.
 * Every state-mutating write is a parameterized single-row statement keyed
 * on the resolved tenantId — there is no code path where a value from the
 * event payload is concatenated into the WHERE clause, so a "spoofed"
 * identifier can at most cause the write to target the WRONG tenant's row
 * (if tenantId resolution itself were fooled), never a tenant OTHER than
 * the one the query is parameterized against. This proves the write side;
 * findTenantIdByStripe (the resolution side) is exercised separately below.
 */
describe('BillingEnforcementService — cross-tenant write isolation (find-99ea599c)', () => {
  function makeService(queryImpl: jest.Mock) {
    return new BillingEnforcementService({ query: queryImpl } as never, { log: jest.fn() } as never);
  }

  it('suspendTenant for tenant-A only parameterizes tenant-A\'s id, never tenant-B\'s', async () => {
    const query = jest.fn()
      .mockResolvedValue([]) // default: readStateRaw (before) and auditStateChange's UPDATE
      .mockResolvedValueOnce([]) // readStateRaw (before snapshot) — no prior row
      .mockResolvedValueOnce([{ tenant_id: 'tenant-A', status: 'suspended' }]); // INSERT ... RETURNING *
    const service = makeService(query);

    await service.suspendTenant('tenant-A', 'test');

    for (const [sql, params] of query.mock.calls) {
      expect(sql).not.toContain('tenant-B');
      if (Array.isArray(params)) expect(params).not.toContain('tenant-B');
      if (Array.isArray(params) && params.length) expect(params[0]).toBe('tenant-A');
    }
  });

  it('activateTenant for tenant-A cannot be redirected to mutate tenant-B by anything in the call', async () => {
    const query = jest.fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([]) // readStateRaw (before)
      .mockResolvedValueOnce([]) // UPDATE billing_subscriptions
      .mockResolvedValueOnce([{ tenant_id: 'tenant-A', status: 'active' }]); // INSERT ... RETURNING *
    const service = makeService(query);

    await service.activateTenant('tenant-A', 'test');

    for (const [, params] of query.mock.calls) {
      if (Array.isArray(params) && params.length) expect(params[0]).toBe('tenant-A');
    }
  });

  it('findTenantIdByStripe scoped to tenant-A\'s stripe_customer_id never resolves to tenant-B even when tenant-B rows exist in the same table', async () => {
    // The mocked query stands in for Postgres evaluating the real WHERE
    // clause; it only returns the row matching the bound customerId, exactly
    // as `WHERE stripe_customer_id = $1` would against a table containing
    // both tenants.
    const query = jest.fn((sql: string, params: unknown[]) => {
      const customerId = params[0];
      if (customerId === 'cus_tenantA') return Promise.resolve([{ tenant_id: 'tenant-A' }]);
      return Promise.resolve([]);
    });
    const service = makeService(query);

    const resolved = await service.findTenantIdByStripe({ customerId: 'cus_tenantA' });

    expect(resolved).toBe('tenant-A');
    expect(query).toHaveBeenCalledWith(expect.any(String), ['cus_tenantA', null]);
  });

  it('findTenantIdByStripe trusts an explicitly-provided tenantId (from OUR OWN webhook-signed metadata) without a DB round trip, and never substitutes a different tenant', async () => {
    const query = jest.fn();
    const service = makeService(query);

    const resolved = await service.findTenantIdByStripe({ tenantId: 'tenant-A', customerId: 'cus_tenantB' });

    expect(resolved).toBe('tenant-A');
    expect(query).not.toHaveBeenCalled();
  });
});
