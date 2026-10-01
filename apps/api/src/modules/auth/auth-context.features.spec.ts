import { AuthContextService } from './auth-context.service';
import { PLAN_FEATURES } from '../billing/billing.service';

describe('AuthContextService — workspace.features canonical keys (dual-read of moduleRh)', () => {
  const rbac = { getEffectivePermissions: jest.fn().mockResolvedValue([]), getHierarchyLevel: jest.fn().mockReturnValue(1) };
  const auth = { userId: 'u1', orgId: 'o1', orgRole: 'owner', claims: {} };

  it('returns moduleHr for a tenant row that still stores the legacy moduleRh key', async () => {
    const svc = new AuthContextService(rbac as never, null);
    const ctx = await svc.build(auth, { id: 't1', features: { moduleRh: true, moduleCrm: true, integrations: { a: 1 } } }, {});
    expect(ctx.workspace.features).toEqual({ moduleHr: true, moduleRh: true, moduleCrm: true, integrations: { a: 1 } });
  });

  it('canonical wins when a row carries both', async () => {
    const svc = new AuthContextService(rbac as never, null);
    const ctx = await svc.build(auth, { id: 't1', features: { moduleRh: true, moduleHr: false } }, {});
    expect(ctx.workspace.features).toEqual({ moduleHr: false, moduleRh: false }); // moduleRh is the deprecated echo of the canonical value
  });
});

describe('PLAN_FEATURES (written to tenants.features at checkout)', () => {
  it('uses the canonical moduleHr key and no legacy moduleRh', () => {
    for (const features of Object.values(PLAN_FEATURES)) {
      expect(features).toHaveProperty('moduleHr');
      expect(features).not.toHaveProperty('moduleRh');
    }
    expect(PLAN_FEATURES.starter.moduleHr).toBe(false);
    expect(PLAN_FEATURES.professional.moduleHr).toBe(true);
    expect(PLAN_FEATURES.enterprise.moduleHr).toBe(true);
  });
});
