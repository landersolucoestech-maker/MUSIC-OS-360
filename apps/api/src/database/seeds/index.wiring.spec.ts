/**
 * Wiring of the seed runner: run() executes at import and MUST call seedRbac(AppDataSource)
 * (the global RBAC seed that carries the persisted legacy role slugs) between the operational
 * seed and the org-structure seed, and report the counts it returned.
 */
const calls: string[] = [];
const fakeDs = { isInitialized: true, destroy: jest.fn(async () => undefined) };

jest.mock('../datasource', () => ({ AppDataSource: fakeDs }));
jest.mock('./01_default_tenant', () => ({ seedDefaultTenant: jest.fn(async () => { calls.push('tenant'); return { id: 't1' }; }) }));
jest.mock('./02_admin_user', () => ({ seedAdminUser: jest.fn(async () => { calls.push('admin'); }) }));
jest.mock('./03_operational_seed', () => ({ seedOperational: jest.fn(async () => { calls.push('operational'); }) }));
jest.mock('./04_rbac_seed', () => ({
  seedRbac: jest.fn(async (ds: unknown) => {
    calls.push('rbac');
    expect(ds).toBe(fakeDs);
    return { permissions: 111, roles: 22, rolePermissions: 3333 };
  }),
}));
jest.mock('./05_org_structure_seed', () => ({
  seedOrgStructure: jest.fn(async () => {
    calls.push('org');
    return { tenants: 1, perTenant: { departments: 1, positions: 1, jobFunctions: 1 } };
  }),
}));

describe('seeds/index run()', () => {
  it('calls seedRbac(AppDataSource) after operational and before org structure, and prints its counts', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const prevUrl = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      await jest.isolateModulesAsync(async () => {
        await import('./index');
        // run() is not awaited by the module: wait for the final destroy() in its finally block
        for (let i = 0; i < 50 && fakeDs.destroy.mock.calls.length === 0; i++) await new Promise((r) => setImmediate(r));
      });
      expect(err).not.toHaveBeenCalled();
      expect(calls).toEqual(['tenant', 'admin', 'operational', 'rbac', 'org']);
      const lines = log.mock.calls.map((c) => String(c[0]));
      expect(lines).toContain('  ✓ RBAC: 111 permissions, 22 roles, 3333 role_permissions');
    } finally {
      if (prevUrl !== undefined) process.env['DATABASE_URL'] = prevUrl;
      log.mockRestore();
      err.mockRestore();
    }
  });
});
