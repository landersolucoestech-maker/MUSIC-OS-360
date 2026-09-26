import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { IntegrationPolicyService } from './integration-policy.service';
import { IntegrationUsageGuard } from './integration-usage.guard';
import {
  PlatformIntegrationEntity, IntegrationCategoryEntity,
  IntegrationEntity, OAuthConnectionEntity, BillingPlanEntity,
} from '../../../database/entities';
import {
  IntegrationClassification, IntegrationReasonCode,
  IntegrationTechnicalState, IntegrationPublicationState,
} from '@music-os-360/types';

type Aud = { mode: string; plans: string[]; tenantIds: string[] };
const aud = (mode: string, plans: string[] = [], tenantIds: string[] = []): Aud =>
  ({ mode, plans, tenantIds });

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'row-1', provider_key: 'docusign', name: 'DocuSign', category_id: 'cat-1',
    connection_kind: 'oauth', required_env: [],
    publication_state: IntegrationPublicationState.AVAILABLE,
    technical_state: IntegrationTechnicalState.READY,
    classification: IntegrationClassification.COMMERCIAL,
    view_audience: aud('all'), use_audience: aud('all'),
    is_core: false, notes: null, ...over,
  };
}

/** plans: slug -> integrations[] */
function buildPolicy(opts: {
  rows?: unknown[]; oauth?: unknown[]; integrations?: unknown[];
  plans?: Array<{ slug: string; integrations: string[]; amount?: number }>;
  env?: Record<string, string>;
} = {}) {
  const rows = opts.rows ?? [row()];
  const plans = opts.plans ?? [{ slug: 'enterprise', integrations: ['docusign'], amount: 3 }];
  const qb = (data: unknown[]) => ({
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => data),
    getOne: jest.fn(async () => data[0] ?? null),
  });
  const ds = {
    getRepository: jest.fn((e: unknown) => {
      if (e === PlatformIntegrationEntity) return { find: jest.fn(async () => rows), findOne: jest.fn(async () => rows[0] ?? null) };
      if (e === IntegrationCategoryEntity) return { find: jest.fn(async () => [{ id: 'cat-1', slug: 'signing', name: 'Assinatura' }]) };
      if (e === BillingPlanEntity) return {
        find: jest.fn(async () => plans),
        findOne: jest.fn(async ({ where }: { where: { slug: string } }) =>
          plans.find((p) => p.slug === where.slug) ?? null),
      };
      if (e === IntegrationEntity) return { createQueryBuilder: jest.fn(() => qb(opts.integrations ?? [])) };
      if (e === OAuthConnectionEntity) return { createQueryBuilder: jest.fn(() => qb(opts.oauth ?? [])) };
      return {};
    }),
  };
  const env = opts.env ?? {};
  return new IntegrationPolicyService(ds as never, { get: jest.fn((k: string) => env[k]) } as never);
}

const CTX = { tenantId: 'tenant-1', userId: 'user-1', planSlug: 'enterprise' };
const CONNECTED = [{ provider: 'docusign', metadata: {}, expires_at: null }];

describe('Per-plan entitlement — composition', () => {
  it('ready + entitled + conectado → canUse', async () => {
    const [r] = await buildPolicy({ oauth: CONNECTED }).resolveAll(CTX);
    expect(r.entitled).toBe(true);
    expect(r.canUse).toBe(true);
    expect(r.reasonCode).toBe(IntegrationReasonCode.CONNECTED);
  });

  it('ready + entitled + NOT connected → canConnect, no canUse', async () => {
    const [r] = await buildPolicy().resolveAll(CTX);
    expect(r.canConnect).toBe(true);
    expect(r.canUse).toBe(false);
    expect(r.reasonCode).toBe(IntegrationReasonCode.NOT_CONNECTED);
  });

  it('VIEW allowed + NO entitlement → VISIBLE and blocked (never hidden)', async () => {
    const [r] = await buildPolicy({ plans: [{ slug: 'enterprise', integrations: [] }] }).resolveAll(CTX);
    expect(r.canDiscover).toBe(true);        // continua no catálogo
    expect(r.entitled).toBe(false);
    expect(r.canConnect).toBe(false);
    expect(r.canUse).toBe(false);
    expect(r.reasonCode).toBe(IntegrationReasonCode.PLAN_NOT_INCLUDED);
  });

  it('technical NOT ready + entitled → no Connect (entitlement does not create an implementation)', async () => {
    const [r] = await buildPolicy({
      rows: [row({ provider_key: 'clicksign', technical_state: IntegrationTechnicalState.AWAITING_PROVIDER,
                   publication_state: IntegrationPublicationState.COMING_SOON })],
      plans: [{ slug: 'enterprise', integrations: ['clicksign'] }],
    }).resolveAll(CTX);
    expect(r.entitled).toBe(true);
    expect(r.canDiscover).toBe(true);
    expect(r.canConnect).toBe(false);
    expect(r.reasonCode).toBe(IntegrationReasonCode.COMING_SOON);
  });

  it('the upgrade hint is DISCOVERED by query — no hardcoded plan name', async () => {
    const p = buildPolicy({ plans: [
      { slug: 'starter', integrations: [], amount: 1 },
      { slug: 'professional', integrations: ['docusign'], amount: 2 },
    ] });
    expect(await p.plansIncluding('docusign')).toEqual(['professional']);
    expect(await p.plansIncluding('inexistente')).toEqual([]);
  });

  it('MULTI-TENANT: mesmo provider, planos diferentes → acessos diferentes', async () => {
    const plans = [
      { slug: 'starter', integrations: [], amount: 1 },
      { slug: 'enterprise', integrations: ['docusign'], amount: 3 },
    ];
    const [a] = await buildPolicy({ plans, oauth: CONNECTED }).resolveAll({ ...CTX, planSlug: 'enterprise' });
    const [b] = await buildPolicy({ plans, oauth: CONNECTED }).resolveAll({ tenantId: 'tenant-2', userId: 'u2', planSlug: 'starter' });
    expect(a.canUse).toBe(true);
    expect(b.canUse).toBe(false);
    expect(b.reasonCode).toBe(IntegrationReasonCode.PLAN_NOT_INCLUDED);
  });

  it('override por tenant (tenants.features.integrations) vence o plano', async () => {
    const [r] = await buildPolicy({
      plans: [{ slug: 'enterprise', integrations: [] }], oauth: CONNECTED,
    }).resolveAll({ ...CTX, tenantFeatures: { integrations: ['docusign'] } });
    expect(r.entitled).toBe(true);
  });
});

describe('Classification — internal/billing outside the commercial catalog', () => {
  for (const c of [IntegrationClassification.INTERNAL_PLATFORM, IntegrationClassification.PLATFORM_BILLING]) {
    it(`${c} nunca é descoberto nem usável, mesmo publicado e com audiência all`, async () => {
      const [r] = await buildPolicy({
        rows: [row({ classification: c, view_audience: aud('all'), use_audience: aud('all') })],
        oauth: CONNECTED,
      }).resolveAll(CTX);
      expect(r.canDiscover).toBe(false);
      expect(r.canUse).toBe(false);
      expect(r.reasonCode).toBe(IntegrationReasonCode.NOT_CUSTOMER_FACING);
    });
  }
});

/** §61 — regressão específica do bug tenant.plan vs plan_slug. */
describe('REGRESSION: per-plan audience uses tenant.plan', () => {
  it('tenant.plan="enterprise" + audience plans=["enterprise"] → MATCH', async () => {
    const [r] = await buildPolicy({
      rows: [row({ view_audience: aud('plans', ['enterprise']), use_audience: aud('plans', ['enterprise']) })],
      oauth: CONNECTED,
    }).resolveAll({ ...CTX, planSlug: 'enterprise' });
    expect(r.canDiscover).toBe(true);
    expect(r.canUse).toBe(true);
  });

  it('tenant.plan="starter" + audience plans=["enterprise"] → NO MATCH', async () => {
    const [r] = await buildPolicy({
      rows: [row({ view_audience: aud('plans', ['enterprise']), use_audience: aud('plans', ['enterprise']) })],
      plans: [{ slug: 'starter', integrations: ['docusign'] }],
      oauth: CONNECTED,
    }).resolveAll({ ...CTX, planSlug: 'starter' });
    expect(r.canDiscover).toBe(false);
    expect(r.reasonCode).toBe(IntegrationReasonCode.AUDIENCE_NOT_ALLOWED);
  });

  it('an absent planSlug never matches a per-plan audience (fail-closed)', async () => {
    const [r] = await buildPolicy({
      rows: [row({ view_audience: aud('plans', ['enterprise']), use_audience: aud('plans', ['enterprise']) })],
    }).resolveAll({ tenantId: 't', userId: 'u', planSlug: null });
    expect(r.canDiscover).toBe(false);
  });
});

describe('IntegrationUsageGuard — enforcement', () => {
  const ctxFor = (req: Record<string, unknown>) => ({
    getHandler: () => 'h', getClass: () => 'c',
    switchToHttp: () => ({ getRequest: () => req }),
  }) as never;
  const reflectorFor = (v: unknown) => ({ getAllAndOverride: jest.fn(() => v) }) as never;
  const req = { tenant: { id: 'tenant-1', plan: 'enterprise' }, auth: { userId: 'user-1' } };

  it('no declared requirement → passes', async () => {
    const g = new IntegrationUsageGuard(reflectorFor(undefined), buildPolicy());
    await expect(g.canActivate(ctxFor(req))).resolves.toBe(true);
  });

  it('BLOCKS direct use when the plan does not include it', async () => {
    const g = new IntegrationUsageGuard(
      reflectorFor({ providerKey: 'docusign', mode: 'use' }),
      buildPolicy({ plans: [{ slug: 'enterprise', integrations: [] }], oauth: CONNECTED }),
    );
    await expect(g.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mode=connect does NOT require a prior connection (otherwise connecting would be impossible)', async () => {
    const g = new IntegrationUsageGuard(
      reflectorFor({ providerKey: 'docusign', mode: 'connect' }),
      buildPolicy(), // sem oauth → não conectado
    );
    await expect(g.canActivate(ctxFor(req))).resolves.toBe(true);
  });

  it('mode=connect ainda exige entitlement', async () => {
    const g = new IntegrationUsageGuard(
      reflectorFor({ providerKey: 'docusign', mode: 'connect' }),
      buildPolicy({ plans: [{ slug: 'enterprise', integrations: [] }] }),
    );
    await expect(g.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fail-closed: no tenant and no registered policy', async () => {
    const g1 = new IntegrationUsageGuard(reflectorFor({ providerKey: 'docusign', mode: 'use' }), buildPolicy());
    await expect(g1.canActivate(ctxFor({ auth: { userId: 'u' } }))).rejects.toBeInstanceOf(ForbiddenException);
    const g2 = new IntegrationUsageGuard(reflectorFor({ providerKey: 'x', mode: 'use' }), buildPolicy({ rows: [] }));
    await expect(g2.canActivate(ctxFor(req))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
