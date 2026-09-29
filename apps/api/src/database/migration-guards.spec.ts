import { assertMigrationRoleBypassesRls } from './migration-guards';

/**
 * Data migrations on FORCE RLS tables must fail, not "succeed" with zero rows
 * updated, when the migration role cannot bypass RLS (database re-review of
 * 48de4bb, INFO-D).
 */
describe('assertMigrationRoleBypassesRls', () => {
  const runner = (rows: unknown[]) => ({ query: jest.fn().mockResolvedValue(rows) }) as never;

  it('passes for a superuser or BYPASSRLS role', async () => {
    await expect(assertMigrationRoleBypassesRls(runner([{ bypass: true }]), 'M')).resolves.toBeUndefined();
  });

  it('fails for a role that does not bypass RLS, or when the role cannot be read', async () => {
    await expect(assertMigrationRoleBypassesRls(runner([{ bypass: false }]), 'M')).rejects.toThrow(/BYPASSRLS/);
    await expect(assertMigrationRoleBypassesRls(runner([]), 'M')).rejects.toThrow(/BYPASSRLS/);
  });
});
