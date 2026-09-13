import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingEnforcementGuard } from './billing-enforcement.guard';
import { BillingEnforcementService } from '../../modules/billing/billing-enforcement.service';

function context(method: string, url: string): ExecutionContext {
  const request = {
    method,
    originalUrl: url,
    url,
    tenant: { id: 'tenant-1' },
  };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}

function setup(status: string | null) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const billing = {
    getStateWithEscalation: jest.fn().mockResolvedValue(status ? { status } : null),
  } as unknown as BillingEnforcementService;
  return {
    guard: new BillingEnforcementGuard(reflector, billing),
    billing,
  };
}

describe('BillingEnforcementGuard', () => {
  it('bloqueia rota tenant-scoped quando tenant esta suspended', async () => {
    const { guard } = setup('suspended');
    await expect(guard.canActivate(context('GET', '/api/v1/artists'))).rejects.toThrow(ForbiddenException);
  });

  it('permite /billing mesmo quando tenant esta suspended', async () => {
    const { guard } = setup('suspended');
    await expect(guard.canActivate(context('POST', '/api/v1/billing/portal'))).resolves.toBe(true);
  });

  it('permite leitura em read_only', async () => {
    const { guard } = setup('read_only');
    await expect(guard.canActivate(context('GET', '/api/v1/contracts'))).resolves.toBe(true);
  });

  it('bloqueia mutacao em read_only', async () => {
    const { guard } = setup('read_only');
    await expect(guard.canActivate(context('POST', '/api/v1/contracts'))).rejects.toThrow(ForbiddenException);
  });

  /**
   * P0-A-R2 regression test. The prior `SUSPENDED_BLOCKED_PREFIXES` was a
   * finite ~28-item enumeration covering only ~27 of 87 controller groups —
   * any route NOT on that list (notifications, rbac, integrations, admin,
   * analytics, and any future module) was silently reachable by a suspended
   * tenant. This is the single test that would have failed under the old
   * enumerated-denylist code and must keep passing under the new
   * blanket-deny-except-allowlist model: an entirely unmapped route, never
   * present in the old list, still gets blocked.
   */
  it('P0-A-R2: bloqueia rota nao mapeada por nenhuma allowlist quando suspended (regressao fechada)', async () => {
    const { guard } = setup('suspended');
    await expect(guard.canActivate(context('GET', '/api/v1/notifications'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context('GET', '/api/v1/rbac'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context('POST', '/api/v1/integrations/whatsapp/send'))).rejects.toThrow(ForbiddenException);
  });

  it('P0-A-R2: allowlist explicita continua permitida quando suspended', async () => {
    const { guard } = setup('suspended');
    await expect(guard.canActivate(context('GET', '/api/v1/auth/logout'))).resolves.toBe(true);
    await expect(guard.canActivate(context('GET', '/api/v1/support'))).resolves.toBe(true);
    await expect(guard.canActivate(context('GET', '/api/v1/health'))).resolves.toBe(true);
    await expect(guard.canActivate(context('GET', '/api/v1/metrics'))).resolves.toBe(true);
  });

  it('P0-A-R2: tenant active nao e bloqueado em nenhuma rota', async () => {
    const { guard } = setup('active');
    await expect(guard.canActivate(context('GET', '/api/v1/notifications'))).resolves.toBe(true);
    await expect(guard.canActivate(context('POST', '/api/v1/artists'))).resolves.toBe(true);
  });

  /**
   * find-9e311421: confirmed CORRECT, not a bug — a brand-new tenant has no
   * `tenant_billing_state` row at all until the first Stripe checkout/
   * webhook creates one (`WorkspaceProvisioningService` does not insert one
   * at signup). If this guard denied on `!state` instead of allowing, every
   * legitimate first request of a new tenant would be blocked before
   * billing ever gets a chance to establish a row. This test pins the
   * intentional fail-open behavior against regression.
   */
  it('find-9e311421: permite requisicao quando o tenant ainda nao tem tenant_billing_state (novo tenant)', async () => {
    const { guard, billing } = setup(null);
    await expect(guard.canActivate(context('POST', '/api/v1/artists'))).resolves.toBe(true);
    expect(billing.getStateWithEscalation).toHaveBeenCalledWith('tenant-1');
  });

  /**
   * find-0837dbc3 / find-cf172810: path comparison must be case-insensitive
   * because Express routing itself is case-insensitive. A differently-cased
   * request path (e.g. "/Billing/portal" or "/API/V1/billing/portal") must
   * still match the ALWAYS_ALLOWED_PREFIXES allowlist and the /api/vN strip
   * regex, not bypass it and fall through to the suspended-tenant block.
   */
  it('find-0837dbc3/cf172810: allowlist e o strip de /api/vN sao case-insensitive', async () => {
    const { guard } = setup('suspended');
    await expect(guard.canActivate(context('POST', '/API/V1/billing/portal'))).resolves.toBe(true);
    await expect(guard.canActivate(context('GET', '/api/v1/Billing/status'))).resolves.toBe(true);
    await expect(guard.canActivate(context('GET', '/API/v1/HEALTH'))).resolves.toBe(true);
  });
});
