import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService }       from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { BillingService }      from './billing.service';
import { DATA_SOURCE }         from '../../database/database.module';
import { RealtimeService }     from '../../core/realtime/realtime.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { BillingEnforcementService } from './billing-enforcement.service';
import { BillingPlansService } from './billing-plans.service';
import { DatabaseContextService } from '../../database/database-context.service';

jest.mock('stripe', () => {
  const instance = {
    checkout:      { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    webhooks:      { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  };
  const ctor = jest.fn(() => instance);
  (ctor as any).default = ctor;
  (ctor as any).__instance = instance;
  return ctor;
});

const getStripeInstance = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StripeRaw = require('stripe');
  return StripeRaw.__instance;
};

const buildMockQb = (resolveValue: any = null) => {
  const qb: any = {
    select:     jest.fn(),
    where:      jest.fn(),
    andWhere:   jest.fn(),
    getOne:     jest.fn().mockResolvedValue(resolveValue),
    getMany:    jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    update:     jest.fn(),
    set:        jest.fn(),
    delete:     jest.fn(),
    from:       jest.fn(),
    execute:    jest.fn().mockResolvedValue({ affected: 1 }),
  };
  qb.select.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.delete.mockReturnValue(qb);
  qb.from.mockReturnValue(qb);
  return qb;
};

const buildMockRepo = (getOneValue: any = null) => {
  const qb = buildMockQb(getOneValue);
  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save:   jest.fn((v: any) => Promise.resolve({ id: 'test-id', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };
};

const buildMockDs = (getOneValue: any = null) => {
  const repo = buildMockRepo(getOneValue);
  return {
    getRepository: jest.fn(() => repo),
    query: jest.fn().mockResolvedValue([]),
    _repo: repo,
  };
};

describe('BillingService', () => {
  let service: BillingService;
  let mockDs: ReturnType<typeof buildMockDs>;
  let enforcement: Record<string, jest.Mock>;
  let plans: Record<string, jest.Mock>;
  let dbContext: { runInTenantContext: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDs = buildMockDs();
    plans = {
      resolve: jest.fn().mockResolvedValue({
        id: 'plan-pro', slug: 'professional', active: true, stripe_price_id: 'price_pro',
      }),
    };
    enforcement = {
      recordWebhookProcessed: jest.fn().mockResolvedValue('inserted'),
      markWebhookProcessed: jest.fn().mockResolvedValue(undefined),
      markWebhookFailed: jest.fn().mockResolvedValue(undefined),
      findTenantIdByStripe: jest.fn().mockResolvedValue('tenant-1'),
      findOrgIdForTenant: jest.fn().mockResolvedValue('org-1'),
      startPaymentGrace: jest.fn().mockResolvedValue({ status: 'payment_grace' }),
      activateTenant: jest.fn().mockResolvedValue({ status: 'active' }),
      ensureState: jest.fn().mockResolvedValue({ status: 'trial' }),
      cancelTenant: jest.fn().mockResolvedValue({ status: 'cancelled' }),
      suspendTenant: jest.fn().mockResolvedValue({ status: 'suspended' }),
      getState: jest.fn().mockResolvedValue({ status: 'active' }),
      getStateWithEscalation: jest.fn().mockResolvedValue({ status: 'active' }),
    };
    dbContext = { runInTenantContext: jest.fn((_ctx: unknown, work: () => unknown) => work()) };

    const stripe = getStripeInstance();
    stripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
      id:  'cs_test',
    });
    stripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/test',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => ({
              STRIPE_SECRET_KEY:         'sk_test_key',
              STRIPE_WEBHOOK_SECRET:     'whsec_test',
              STRIPE_PRICE_STARTER:      'price_starter',
              STRIPE_PRICE_PROFESSIONAL: 'price_pro',
              STRIPE_PRICE_ENTERPRISE:   'price_ent',
            }[key]),
          },
        },
        { provide: DATA_SOURCE, useValue: mockDs },
        { provide: RealtimeService, useValue: { sendToTenant: jest.fn(), sendToUser: jest.fn() } },
        { provide: EventsService, useValue: { emitTyped: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) } },
        { provide: BillingEnforcementService, useValue: enforcement },
        { provide: BillingPlansService, useValue: plans },
        { provide: DatabaseContextService, useValue: dbContext },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('upsertStripeInvoice - legacy_amount expand (LC1)', () => {
    it('dual-writes the canonical service_amount next to the legacy mirror, from the same cents expression', async () => {
      await (service as unknown as { upsertStripeInvoice(i: unknown, t: string): Promise<void> }).upsertStripeInvoice(
        { id: 'in_1', status: 'paid', amount_due: 12345, amount_paid: 12345, currency: 'brl' }, 'tenant-1',
      );
      const [sql, params] = mockDs.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/legacy_amount, service_amount, due_date/);
      expect(sql).toContain('($4::integer / 100.0), ($4::integer / 100.0)');
      expect(sql).toContain('legacy_amount = EXCLUDED.legacy_amount');
      expect(sql).toContain('service_amount = EXCLUDED.service_amount');
      expect(params[3]).toBe(12345);
      expect(params).toHaveLength(11);
    });
  });

  describe('createCheckoutSession', () => {
    it('uses stripe_price_id from the database (not STRIPE_PRICE_*)', async () => {
      const r = await service.createCheckoutSession({
        orgId: 'o1', tenantId: 't1', planRef: 'professional',
        successUrl: 'https://ok', cancelUrl: 'https://cancel',
      });
      expect(r.url).toBe('https://checkout.stripe.com/test');
      const stripe = getStripeInstance();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_pro', quantity: 1 }],
          metadata: expect.objectContaining({ plan_id: 'plan-pro', plan: 'professional', stripe_price_id: 'price_pro' }),
        }),
      );
    });

    it('fails when no plan is given', async () => {
      await expect(service.createCheckoutSession({
        orgId: 'o', tenantId: 't', successUrl: '', cancelUrl: '',
      })).rejects.toThrow(BadRequestException);
    });

    it('fails when plan_id is invalid (not found)', async () => {
      plans.resolve.mockResolvedValueOnce(null);
      await expect(service.createCheckoutSession({
        orgId: 'o', tenantId: 't', planRef: 'inexistente', successUrl: '', cancelUrl: '',
      })).rejects.toThrow(BadRequestException);
    });

    it('fails when the plan is inactive', async () => {
      plans.resolve.mockResolvedValueOnce({ id: 'p', slug: 'x', active: false, stripe_price_id: 'price_x' });
      await expect(service.createCheckoutSession({
        orgId: 'o', tenantId: 't', planRef: 'x', successUrl: '', cancelUrl: '',
      })).rejects.toThrow(BadRequestException);
    });

    it('fails when the plan is not synced with Stripe', async () => {
      plans.resolve.mockResolvedValueOnce({ id: 'p', slug: 'x', active: true, stripe_price_id: null });
      await expect(service.createCheckoutSession({
        orgId: 'o', tenantId: 't', planRef: 'x', successUrl: '', cancelUrl: '',
      })).rejects.toThrow(BadRequestException);
    });

    it('reuses the existing customer_id', async () => {
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce({ stripe_customer_id: 'cus_123', stripe_sub_id: 'sub_123' });
      await service.createCheckoutSession({
        orgId: 'o1', tenantId: 't1', planRef: 'professional',
        successUrl: 'https://ok', cancelUrl: 'https://cancel',
      });
      const stripe = getStripeInstance();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_123' }),
      );
    });
  });

  describe('createPortalSession', () => {
    it('creates a portal session for an existing customer', async () => {
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce({ stripe_customer_id: 'cus_portal' });
      const r = await service.createPortalSession('org-1', 'https://app.com');
      expect(r.url).toBe('https://billing.stripe.com/test');
    });

    it('throws BadRequestException without a subscription', async () => {
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce(null);
      await expect(service.createPortalSession('org-sem-sub', 'x')).rejects.toThrow();
    });

    it('throws BadRequestException for a pending_ customer', async () => {
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce({ stripe_customer_id: 'pending_org-1' });
      await expect(service.createPortalSession('org-1', 'x')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('rejects an invalid signature', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('signature mismatch');
      });
      await expect(service.handleWebhook('bad_sig', Buffer.from('{}'))).rejects.toThrow('inválida');
    });

    it('returns received:true for an already processed event', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce({
        id: 'evt_done', type: 'checkout.session.completed', data: { object: {} },
      });
      enforcement.recordWebhookProcessed.mockResolvedValueOnce('duplicate');
      const r = await service.handleWebhook('sig', Buffer.from('{}'));
      expect(r).toEqual({ received: true });
    });

    it('starts payment_grace on invoice.payment_failed', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce({
        id: 'evt_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_1',
            customer: 'cus_1',
            subscription: 'sub_1',
            status: 'open',
            amount_due: 25000,
            amount_paid: 0,
            currency: 'brl',
          },
        },
      });
      await service.handleWebhook('sig', Buffer.from('{}'));
      expect(enforcement.recordWebhookProcessed).toHaveBeenCalledWith(expect.objectContaining({
        stripeEventId: 'evt_failed',
        eventType: 'invoice.payment_failed',
      }));
      expect(enforcement.startPaymentGrace).toHaveBeenCalledWith('tenant-1', 'invoice.payment_failed', expect.any(Date), undefined, undefined);
    });

    it('reactivates the tenant on invoice.payment_succeeded', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce({
        id: 'evt_paid',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_2',
            customer: 'cus_1',
            subscription: 'sub_1',
            status: 'paid',
            amount_due: 25000,
            amount_paid: 25000,
            currency: 'brl',
          },
        },
      });
      await service.handleWebhook('sig', Buffer.from('{}'));
      expect(enforcement.activateTenant).toHaveBeenCalledWith('tenant-1', 'invoice.payment_succeeded', expect.any(Date), undefined, undefined);
    });

    describe('invoice.payment_succeeded/failed — stale/out-of-order delivery (find-99ea599c)', () => {
      it('an invoice.payment_succeeded older than the tenant\'s last status transition does not reactivate a suspended tenant', async () => {
        enforcement.getState.mockResolvedValueOnce({ status: 'suspended', status_changed_at: new Date('2026-01-02T00:00:00Z') });
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_paid_stale',
          type: 'invoice.payment_succeeded',
          created: Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_stale', customer: 'cus_1', subscription: 'sub_1', status: 'paid' } },
        });
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.activateTenant).not.toHaveBeenCalled();
      });

      it('an invoice.payment_succeeded newer than the last status transition still reactivates', async () => {
        enforcement.getState.mockResolvedValueOnce({ status: 'suspended', status_changed_at: new Date('2026-01-01T00:00:00Z') });
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_paid_fresh',
          type: 'invoice.payment_succeeded',
          created: Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_fresh', customer: 'cus_1', subscription: 'sub_1', status: 'paid' } },
        });
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.activateTenant).toHaveBeenCalledWith(
          'tenant-1', 'invoice.payment_succeeded', expect.any(Date), undefined,
          Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000),
        );
      });

      it('an invoice.payment_failed older than a newer payment_succeeded does not re-open grace', async () => {
        enforcement.getState.mockResolvedValueOnce({ status: 'active', status_changed_at: new Date('2026-01-02T00:00:00Z') });
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_failed_stale',
          type: 'invoice.payment_failed',
          created: Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_failed_stale', customer: 'cus_1', subscription: 'sub_1', status: 'open' } },
        });
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.startPaymentGrace).not.toHaveBeenCalled();
      });

      it('a rejected startPaymentGrace write (lost the race) skips the org-status update and websocket notification', async () => {
        enforcement.startPaymentGrace.mockResolvedValueOnce(null);
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_failed_raced',
          type: 'invoice.payment_failed',
          created: Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_failed_raced', customer: 'cus_1', subscription: 'sub_1', status: 'open' } },
        });
        const ws = (service as unknown as { ws: { sendToTenant: jest.Mock } }).ws;
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.startPaymentGrace).toHaveBeenCalled();
        expect(ws.sendToTenant).not.toHaveBeenCalledWith('tenant-1', 'billing:payment_failed', expect.anything());
      });

      it('an invoice event with no prior status_changed_at (first-ever transition) is never treated as stale', async () => {
        enforcement.getState.mockResolvedValueOnce({ status: 'trial' });
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_paid_first',
          type: 'invoice.payment_succeeded',
          created: Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_first', customer: 'cus_1', subscription: 'sub_1', status: 'paid' } },
        });
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.activateTenant).toHaveBeenCalledWith(
          'tenant-1', 'invoice.payment_succeeded', expect.any(Date), undefined,
          Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000),
        );
      });

      it('a rejected write (lost the race to a concurrent/newer event) skips the websocket notification', async () => {
        enforcement.activateTenant.mockResolvedValueOnce(null);
        const stripe = getStripeInstance();
        stripe.webhooks.constructEvent.mockReturnValueOnce({
          id: 'evt_paid_raced',
          type: 'invoice.payment_succeeded',
          created: Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000),
          data: { object: { id: 'in_raced', customer: 'cus_1', subscription: 'sub_1', status: 'paid' } },
        });
        const ws = (service as unknown as { ws: { sendToTenant: jest.Mock } }).ws;
        await service.handleWebhook('sig', Buffer.from('{}'));
        expect(enforcement.activateTenant).toHaveBeenCalled();
        expect(ws.sendToTenant).not.toHaveBeenCalledWith('tenant-1', 'billing:payment_succeeded', expect.anything());
      });
    });

    // find-03176eef: the webhook path must declare its RLS context explicitly
    // (role: 'system' when no tenant is resolvable yet, normal tenant context
    // otherwise) instead of relying on the connection having no session var set.
    it('opens the tenant DB context with role="system" when the event resolves to no tenant', async () => {
      enforcement.findTenantIdByStripe.mockResolvedValueOnce(null);
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce({
        id: 'evt_no_tenant', type: 'checkout.session.completed', data: { object: {} },
      });

      await service.handleWebhook('sig', Buffer.from('{}'));

      expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
        { tenantId: null, orgId: null, role: 'system' },
        expect.any(Function),
      );
    });

    it('opens the tenant DB context with the resolved tenantId and no system role when a tenant is known', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce({
        id: 'evt_with_tenant', type: 'invoice.payment_succeeded', data: { object: { id: 'in_1' } },
      });

      await service.handleWebhook('sig', Buffer.from('{}'));

      expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', orgId: 'org-1', role: null },
        expect.any(Function),
      );
      // org-isolated tables (billing_subscriptions/tenants/organizations) need the
      // tenant's org in context; it is resolved read-only via the enforcement service
      expect(enforcement.findOrgIdForTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('customer.subscription.updated — out-of-order delivery (find-602e8654)', () => {
    function subEvent(id: string, periodStart: number) {
      return {
        id, type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1', status: 'active', customer: 'cus_1',
            metadata: { org_id: 'org-1' },
            current_period_start: periodStart,
            current_period_end: periodStart + 30 * 86400,
            items: { data: [] },
          },
        },
      };
    }

    it('does not apply a status transition when the subscription write is rejected as stale', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(subEvent('evt_stale', 1000));
      // Empty RETURNING (from resolveOrgIdForTenant not needed — metadata.org_id
      // is present) — the upsert's WHERE guard matched zero rows.
      mockDs.query.mockResolvedValueOnce([]);

      await service.handleWebhook('sig', Buffer.from('{}'));

      expect(enforcement.activateTenant).not.toHaveBeenCalled();
    });

    it('applies the status transition when the subscription write lands', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(subEvent('evt_current', 2000));
      mockDs.query.mockResolvedValueOnce([{ tenant_id: 'tenant-1' }]);

      await service.handleWebhook('sig', Buffer.from('{}'));

      expect(enforcement.activateTenant).toHaveBeenCalledWith('tenant-1', 'customer.subscription.updated');
    });
  });

  describe('handleWebhook — lifecycle status (P0-2, retry-safe idempotency)', () => {
    function paidEvent(id: string) {
      return {
        id,
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1', customer: 'cus_1', subscription: 'sub_1',
            status: 'paid', amount_due: 25000, amount_paid: 25000, currency: 'brl',
          },
        },
      };
    }

    it('successful first run: marks processed, never failed', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(paidEvent('evt_ok'));
      await service.handleWebhook('sig', Buffer.from('{}'));
      expect(enforcement.markWebhookProcessed).toHaveBeenCalledWith('evt_ok');
      expect(enforcement.markWebhookFailed).not.toHaveBeenCalled();
    });

    it('transient failure: marks failed (never processed) and propagates the error — no silent 200', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(paidEvent('evt_transient'));
      enforcement.activateTenant.mockRejectedValueOnce(new Error('db pool exhausted'));

      await expect(service.handleWebhook('sig', Buffer.from('{}'))).rejects.toThrow('db pool exhausted');

      expect(enforcement.markWebhookFailed).toHaveBeenCalledWith('evt_transient');
      expect(enforcement.markWebhookProcessed).not.toHaveBeenCalled();
    });

    it('legitimate retry after failure: recordWebhookProcessed claims the event (status=failed → processing) and reprocesses', async () => {
      // Simulates what billing-enforcement.service.ts actually does: a FAILED
      // row is reclaimed ('inserted'), a PROCESSED one is not ('duplicate').
      // Exercised here at the BillingService boundary via the same contract
      // the enforcement service guarantees.
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(paidEvent('evt_retry'));
      enforcement.recordWebhookProcessed.mockResolvedValueOnce('inserted'); // reclaimed
      const r = await service.handleWebhook('sig', Buffer.from('{}'));
      expect(r).toEqual({ received: true });
      expect(enforcement.activateTenant).toHaveBeenCalledWith('tenant-1', 'invoice.payment_succeeded', expect.any(Date), undefined, undefined);
      expect(enforcement.markWebhookProcessed).toHaveBeenCalledWith('evt_retry');
    });

    it('duplicate after success: recordWebhookProcessed denies the claim — no effect reapplied', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(paidEvent('evt_already_done'));
      enforcement.recordWebhookProcessed.mockResolvedValueOnce('duplicate');
      const r = await service.handleWebhook('sig', Buffer.from('{}'));
      expect(r).toEqual({ received: true });
      expect(enforcement.activateTenant).not.toHaveBeenCalled();
      expect(enforcement.markWebhookProcessed).not.toHaveBeenCalled();
    });

    it('two concurrent deliveries of the same event: the second does not reapply the effect', async () => {
      const stripe = getStripeInstance();
      // Both deliveries carry the same event.id — the enforcement layer (not
      // mocked-away here) is what actually serializes this via the DB; at
      // this boundary we assert the service correctly no-ops on 'duplicate'
      // regardless of which delivery "won".
      stripe.webhooks.constructEvent
        .mockReturnValueOnce(paidEvent('evt_concurrent'))
        .mockReturnValueOnce(paidEvent('evt_concurrent'));
      enforcement.recordWebhookProcessed
        .mockResolvedValueOnce('inserted')
        .mockResolvedValueOnce('duplicate');

      await service.handleWebhook('sig', Buffer.from('{}'));
      await service.handleWebhook('sig', Buffer.from('{}'));

      expect(enforcement.activateTenant).toHaveBeenCalledTimes(1);
      expect(enforcement.markWebhookProcessed).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkout.session.completed (BILL-001-002-004)', () => {
    const buildEvent = (metadata: Record<string, string> | null) => ({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_1', subscription: 'sub_1', metadata } },
    });

    it('links customer/subscription and activates the tenant with valid metadata', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(
        buildEvent({ tenant_id: 'tenant-1', org_id: 'org-1', plan: 'professional' }),
      );
      const r = await service.handleWebhook('sig', Buffer.from('{}'));
      expect(r).toEqual({ received: true });
      // acceptance: "the tenant receives customer/subscription" — via the update chain + activation
      expect(mockDs._repo._qb.execute).toHaveBeenCalled();
      expect(enforcement.activateTenant).toHaveBeenCalledWith('tenant-1', 'checkout.session.completed');
    });

    it('does not provision (no-op) when metadata is incomplete', async () => {
      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(buildEvent({ org_id: 'org-1' }));
      const r = await service.handleWebhook('sig', Buffer.from('{}'));
      expect(r).toEqual({ received: true });
      // idempotency records the event, but no provisioning effect happens
      expect(enforcement.recordWebhookProcessed).toHaveBeenCalled();
      expect(enforcement.activateTenant).not.toHaveBeenCalled();
    });

    function buildRetryHarness() {
      const ws = { sendToTenant: jest.fn(), sendToUser: jest.fn() };
      const events = { emitTyped: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
      return { ws, events };
    }

    async function buildRetryService(ws: unknown, events: unknown): Promise<BillingService> {
      const retryModule: TestingModule = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: ConfigService, useValue: {
            get: (key: string) => ({
              STRIPE_SECRET_KEY: 'sk_test_key', STRIPE_WEBHOOK_SECRET: 'whsec_test',
            }[key]),
          } },
          { provide: DATA_SOURCE, useValue: mockDs },
          { provide: RealtimeService, useValue: ws },
          { provide: EventsService, useValue: events },
          { provide: BillingEnforcementService, useValue: enforcement },
          { provide: BillingPlansService, useValue: plans },
          { provide: DatabaseContextService, useValue: dbContext },
        ],
      }).compile();
      return retryModule.get<BillingService>(BillingService);
    }

    // find-0b089515 / find-9fd92b12: a Stripe retry (or reclaimed 'failed'
    // event) re-running this whole handler must not re-fire the realtime
    // notification / domain event when THIS EXACT checkout's effect (same
    // stripe_sub_id + same plan, already active) is already applied — the
    // upserts are idempotent, these two side effects were not.
    it('does not resend the realtime notification or TENANT_CREATED on a retry of the SAME checkout (same subscription + same plan)', async () => {
      const { ws, events } = buildRetryHarness();
      const retryService = await buildRetryService(ws, events);

      // subBefore.getOne() → already stripe_sub_id='sub_1' (matches session.subscription),
      // same plan, already active: this checkout's effect is already applied.
      mockDs._repo._qb.getOne.mockResolvedValueOnce({ stripe_sub_id: 'sub_1', plan: 'professional', status: 'active' });

      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(
        buildEvent({ tenant_id: 'tenant-1', org_id: 'org-1', plan: 'professional' }),
      );
      enforcement.recordWebhookProcessed.mockResolvedValueOnce('inserted'); // reclaimed after prior 'failed'

      await retryService.handleWebhook('sig', Buffer.from('{}'));

      expect(enforcement.activateTenant).toHaveBeenCalledWith('tenant-1', 'checkout.session.completed');
      expect(ws.sendToTenant).not.toHaveBeenCalled();
      expect(events.emitTyped).not.toHaveBeenCalledWith(
        DOMAIN_EVENTS.TENANT_CREATED, expect.anything(),
      );
    });

    // find-9fd92b12 (cross-review): a genuine SECOND checkout for an org that
    // is already active on a DIFFERENT plan (a real upgrade) must still fire
    // both side effects — "org already active" alone is not evidence of a retry.
    it('resends the notification and TENANT_CREATED for a real upgrade (same org already active, different plan)', async () => {
      const { ws, events } = buildRetryHarness();
      const retryService = await buildRetryService(ws, events);

      // 1st getOne() = subBefore → already active, but on a DIFFERENT plan than
      // this checkout is applying (a real upgrade, not a repeat of it).
      // 2nd getOne() = tenantRecord, fetched right before TENANT_CREATED emits.
      mockDs._repo._qb.getOne
        .mockResolvedValueOnce({ stripe_sub_id: 'sub_1', plan: 'starter', status: 'active' })
        .mockResolvedValueOnce({ id: 'tenant-1', name: 'Tenant 1', slug: 'tenant-1', plan: 'professional' });

      const stripe = getStripeInstance();
      stripe.webhooks.constructEvent.mockReturnValueOnce(
        buildEvent({ tenant_id: 'tenant-1', org_id: 'org-1', plan: 'professional' }),
      );

      await retryService.handleWebhook('sig', Buffer.from('{}'));

      expect(ws.sendToTenant).toHaveBeenCalledWith('tenant-1', 'billing:plan_upgraded', expect.anything());
      expect(events.emitTyped).toHaveBeenCalledWith(
        DOMAIN_EVENTS.TENANT_CREATED, expect.anything(),
      );
    });
  });

  describe('getSubscription', () => {
    it('returns null when there is no subscription', async () => {
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce(null);
      expect(await service.getSubscription('org-x')).toBeNull();
    });

    it('returns the existing subscription', async () => {
      const sub = { id: 's1', plan: 'starter', status: 'trial' };
      const repo = mockDs._repo;
      repo._qb.getOne.mockResolvedValueOnce(sub);
      expect(await service.getSubscription('org-1')).toEqual(sub);
    });
  });

  /**
   * P0-A-R3/R4 (T10): `updateAdminTenant` used to write `tenant_billing_state`
   * directly via raw SQL (bypassing `BillingEnforcementService` entirely —
   * no audit trail, no `billing_subscriptions` sync) AND independently
   * derive `tenant.active` from the same string. It now dispatches to the
   * existing, already-audited transition methods — the only writer of
   * `tenant_billing_state` anywhere in the codebase.
   */
  describe('updateAdminTenant — canonical billing authority (P0-A-R3/R4)', () => {
    let transactionManager: { getRepository: jest.Mock; query: jest.Mock };

    beforeEach(() => {
      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', deleted_at: null, name: 'Acme', settings: {} }),
        save: jest.fn().mockResolvedValue({}),
      };
      transactionManager = {
        getRepository: jest.fn(() => tenantRepo),
        query: jest.fn().mockResolvedValue([]),
      };
      (mockDs as any).transaction = jest.fn(async (cb: (m: unknown) => Promise<void>) => cb(transactionManager));
    });

    it.each([
      ['suspended', 'suspendTenant', true],
      ['active', 'activateTenant', true],
      ['cancelled', 'cancelTenant', false],
      ['past_due', 'startPaymentGrace', true],
    ] as const)('status=%s dispatches to enforcement.%s and never writes tenant_billing_state directly', async (status, method, hasNowArg) => {
      await service.updateAdminTenant('tenant-1', { status } as any);

      // P0-A-R6: the dispatch now runs INSIDE updateAdminTenant's own
      // transaction, sharing its `manager` (not opening a second one) — the
      // 3rd/4th args prove that, and the mock's `transactionManager` identity
      // proves it's the SAME manager `updateAdminTenant` used for tenant/
      // org_members writes, not a separate connection.
      if (hasNowArg) {
        expect((enforcement[method] as jest.Mock)).toHaveBeenCalledWith(
          'tenant-1', expect.stringContaining(status), expect.any(Date), transactionManager,
        );
      } else {
        expect((enforcement[method] as jest.Mock)).toHaveBeenCalledWith(
          'tenant-1', expect.stringContaining(status), transactionManager,
        );
      }
      // The old raw-SQL path targeted tenant_billing_state via the
      // transaction's manager.query — assert it's never invoked with that
      // table, proving the writer path is fully gone, not just additionally
      // present alongside the dispatch.
      for (const call of transactionManager.query.mock.calls) {
        expect(String(call[0])).not.toMatch(/tenant_billing_state/);
      }
    });

    it.each(['trial', 'pending'])('status=%s is rejected — no enforcement method called, no raw SQL fired', async (status) => {
      await expect(service.updateAdminTenant('tenant-1', { status } as any)).rejects.toThrow(BadRequestException);

      expect(enforcement.suspendTenant).not.toHaveBeenCalled();
      expect(enforcement.activateTenant).not.toHaveBeenCalled();
      expect(enforcement.cancelTenant).not.toHaveBeenCalled();
      expect(enforcement.startPaymentGrace).not.toHaveBeenCalled();
      for (const call of transactionManager.query.mock.calls) {
        expect(String(call[0])).not.toMatch(/tenant_billing_state/);
      }
    });

    it('does not touch tenant.active independently — that field is no longer derived from body.status', async () => {
      const tenantRepo = { findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', deleted_at: null, settings: {} }), save: jest.fn() };
      transactionManager.getRepository = jest.fn(() => tenantRepo);

      await service.updateAdminTenant('tenant-1', { status: 'suspended' } as any);

      const savedTenant = tenantRepo.save.mock.calls[0][0];
      expect(savedTenant.active).toBeUndefined();
    });
  });

  /**
   * P0-A-R6: `updateAdminTenant` used to commit its `ds.transaction(...)`
   * (tenant name/slug/plan/country/owner_email writes) BEFORE dispatching
   * `body.status` to `BillingEnforcementService`, which ran in a second,
   * separate, un-transacted step. An invalid status, or any exception from
   * the enforcement dispatch, left the tenant-field writes already
   * committed while the caller saw a failure response implying nothing was
   * applied — a partial commit. The fix folds the entire operation
   * (tenant/org_members writes + enforcement dispatch, including the
   * invalid-status rejection) into the ONE transaction `ds.transaction`
   * already opens, sharing its `manager`.
   *
   * NOTE: these are unit tests against a MOCKED `ds.transaction` — they
   * prove call order, exception propagation, and manager-identity/threading,
   * NOT a real Postgres COMMIT/ROLLBACK. The genuine rollback-in-Postgres
   * proof is `test/e2e/billing/billing-admin-atomicity.e2e-spec.ts` (T23).
   */
  describe('updateAdminTenant — atomicity (P0-A-R6)', () => {
    let transactionManager: { getRepository: jest.Mock; query: jest.Mock };
    let tenantRepo: { findOne: jest.Mock; save: jest.Mock };

    beforeEach(() => {
      tenantRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', deleted_at: null, name: 'Acme', settings: {} }),
        save: jest.fn().mockResolvedValue({}),
      };
      transactionManager = {
        getRepository: jest.fn(() => tenantRepo),
        query: jest.fn().mockResolvedValue([]),
      };
      (mockDs as any).transaction = jest.fn(async (cb: (m: unknown) => Promise<void>) => cb(transactionManager));
    });

    // T17: an invalid status combined with another field is rejected before
    // any write happens at all — the DTO-level rejection runs ahead of
    // `ds.transaction`, so `transaction` (and therefore tenantRepo.save) is
    // never even invoked.
    it('T17: invalid status + a valid field together are rejected atomically — no transaction opened, no partial write', async () => {
      await expect(
        service.updateAdminTenant('tenant-1', { status: 'trial', name: 'New Name' } as any),
      ).rejects.toThrow(BadRequestException);

      expect((mockDs as any).transaction).not.toHaveBeenCalled();
      expect(tenantRepo.save).not.toHaveBeenCalled();
      expect(enforcement.suspendTenant).not.toHaveBeenCalled();
    });

    // T18 (central test): a real billing-transition failure AFTER the
    // transaction has started must propagate out of `updateAdminTenant`
    // without being swallowed — proving the enforcement dispatch runs
    // inside the same `ds.transaction` callback as the tenant-field writes
    // (a single call to `transaction`), not a second, separate step that
    // could leave the first step's writes committed on its own.
    it('T18: enforcement failure after the transaction opens propagates out of updateAdminTenant, not silently swallowed', async () => {
      const boom = new Error('enforcement transition failed mid-transaction');
      (enforcement.suspendTenant as jest.Mock).mockRejectedValueOnce(boom);

      await expect(
        service.updateAdminTenant('tenant-1', { status: 'suspended', name: 'New Name' } as any),
      ).rejects.toThrow(boom);

      // Exactly one transaction was opened — the tenant-field write and the
      // enforcement dispatch are the SAME `ds.transaction` call, not two.
      expect((mockDs as any).transaction).toHaveBeenCalledTimes(1);
      // The tenant fields were staged on the manager (proving order: fields
      // first, then enforcement) — but since real TypeORM rolls back
      // everything the callback did the moment it throws, this in-memory
      // call happening does NOT mean it survived; genuine rollback-in-
      // Postgres proof lives in the T23 e2e test (real DB, real ROLLBACK).
      expect(tenantRepo.save).toHaveBeenCalledTimes(1);
      expect(enforcement.suspendTenant).toHaveBeenCalledWith(
        'tenant-1', expect.any(String), expect.any(Date), transactionManager,
      );
    });

    // T19: a combined update (fields + status) succeeds as one unit —
    // tenant fields saved and enforcement dispatched from the same manager.
    it('T19: combined field + status update succeeds in one transaction', async () => {
      const result = await service.updateAdminTenant('tenant-1', {
        name: 'New Name', country: 'BR', status: 'active',
      } as any);

      expect((mockDs as any).transaction).toHaveBeenCalledTimes(1);
      expect(tenantRepo.save).toHaveBeenCalledTimes(1);
      expect(enforcement.activateTenant).toHaveBeenCalledWith(
        'tenant-1', expect.any(String), expect.any(Date), transactionManager,
      );
      expect(result).toBeDefined();
    });

    // T20: status-only (no other field) still dispatches correctly.
    it('T20: status-only update still dispatches to enforcement', async () => {
      await service.updateAdminTenant('tenant-1', { status: 'cancelled' } as any);

      expect(enforcement.cancelTenant).toHaveBeenCalledWith('tenant-1', expect.any(String), transactionManager);
    });

    // T21: a metadata-only update (no status) never calls any enforcement
    // method — BillingEnforcementService must not be invoked unnecessarily.
    it('T21: metadata-only update (no status) never calls BillingEnforcementService', async () => {
      await service.updateAdminTenant('tenant-1', { name: 'Only Name Changes' } as any);

      expect(enforcement.suspendTenant).not.toHaveBeenCalled();
      expect(enforcement.activateTenant).not.toHaveBeenCalled();
      expect(enforcement.cancelTenant).not.toHaveBeenCalled();
      expect(enforcement.startPaymentGrace).not.toHaveBeenCalled();
    });

    // T22: repeating the same status across two separate admin calls opens
    // two independent, correctly-scoped transactions — no accidental
    // sharing/leakage of a manager across calls, and no extra transaction
    // opened per call (idempotent-status semantics themselves are
    // `BillingEnforcementService`'s concern, covered by its own recursion-
    // safety spec — this test only guards `updateAdminTenant`'s own
    // transaction-per-call atomicity).
    it('T22: repeated same-status calls each run in their own single transaction, not a shared/leaked one', async () => {
      await service.updateAdminTenant('tenant-1', { status: 'suspended' } as any);
      await service.updateAdminTenant('tenant-1', { status: 'suspended' } as any);

      expect((mockDs as any).transaction).toHaveBeenCalledTimes(2);
      expect(enforcement.suspendTenant).toHaveBeenCalledTimes(2);
    });
  });
});

/**
 * find-340abf0b / Gotcha #20 — Stripe mode exposed to the admin panel.
 * Never returns the key; LIVE never becomes 'production' (it is rejected).
 */
describe('BillingService.getStripeMode', () => {
  async function build(secret: string | undefined) {
    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'STRIPE_SECRET_KEY' ? secret : undefined) } },
        { provide: DATA_SOURCE, useValue: null },
        { provide: RealtimeService, useValue: {} },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
        { provide: BillingEnforcementService, useValue: {} },
        { provide: BillingPlansService, useValue: {} },
        { provide: DatabaseContextService, useValue: {} },
      ],
    }).compile();
    return module.get(BillingService);
  }

  const prevEnv = process.env.STRIPE_SECRET_KEY;
  beforeEach(() => { delete process.env.STRIPE_SECRET_KEY; });
  afterAll(() => { if (prevEnv === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prevEnv; });

  it('chave sk_test_ => sandbox (TEST MODE)', async () => {
    const svc = await build('sk_test_abc');
    expect(svc.getStripeMode()).toEqual({ environment: 'sandbox', keyState: 'VALID_TEST_KEY' });
  });

  it('sk_live_ key => disabled (refused), never production', async () => {
    const svc = await build('sk_live_abc');
    expect(svc.getStripeMode()).toEqual({ environment: 'disabled', keyState: 'LIVE_KEY_REJECTED' });
  });

  it('no key => disabled/MISSING', async () => {
    const svc = await build(undefined);
    expect(svc.getStripeMode()).toEqual({ environment: 'disabled', keyState: 'MISSING' });
  });

  it('the response never contains the key value', async () => {
    const svc = await build('sk_test_supersecretvalue');
    expect(JSON.stringify(svc.getStripeMode())).not.toContain('supersecretvalue');
  });
});
