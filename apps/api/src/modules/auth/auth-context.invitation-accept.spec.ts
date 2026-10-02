import { Logger } from '@nestjs/common';
import { AuthContextService } from './auth-context.service';

describe('AuthContextService.build — tenant_invitations accept is best-effort but logged', () => {
  const rbac = {
    getEffectivePermissions: jest.fn().mockResolvedValue(['contracts:read']),
    getHierarchyLevel: jest.fn().mockReturnValue(1),
  };
  const auth = {
    userId: 'user-sensitive-id',
    orgId: 'org-1',
    orgRole: 'viewer',
    claims: { email: 'person@example.test' } as Record<string, unknown>,
  };
  const tenant = { id: 'tenant-1', org_id: 'org-1' };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warnSpy.mockRestore());

  it('logs the failure (no ids, no e-mail) and still returns the same auth context', async () => {
    const ds = { query: jest.fn().mockRejectedValue(new Error('relation does not exist')) };
    const svc = new AuthContextService(rbac as never, ds as never);

    const ctx = await svc.build(auth, tenant, undefined);

    expect(ds.query).toHaveBeenCalledTimes(1);
    expect(ctx.workspace.id).toBe('tenant-1');
    expect(ctx.membership.permissions).toEqual(['contracts:read']);
    const logged = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('relation does not exist');
    expect(logged).not.toContain('user-sensitive-id');
    expect(logged).not.toContain('person@example.test');
  });

  it('does not log when the update succeeds', async () => {
    const ds = { query: jest.fn().mockResolvedValue([]) };
    const svc = new AuthContextService(rbac as never, ds as never);

    await svc.build(auth, tenant, undefined);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
