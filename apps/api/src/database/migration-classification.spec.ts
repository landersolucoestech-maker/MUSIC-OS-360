import { getMigrationCategory, isApplicationMigration, listExternalManagedMigrationNames, MigrationCategory } from './migration-classification';
import { ALL_MIGRATIONS } from './migrations/index';

describe('migration-classification', () => {
  it('classifies the Realtime migration as EXTERNAL_MANAGED', () => {
    expect(getMigrationCategory('RealtimeBroadcastAuthorization20260801000001')).toBe(MigrationCategory.EXTERNAL_MANAGED);
    expect(isApplicationMigration('RealtimeBroadcastAuthorization20260801000001')).toBe(false);
  });

  it('classifies the tenant-zero migration as APPLICATION (default)', () => {
    expect(getMigrationCategory('TenantZeroFormalization20260801000002')).toBe(MigrationCategory.APPLICATION);
    expect(isApplicationMigration('TenantZeroFormalization20260801000002')).toBe(true);
  });

  it('any unknown name is APPLICATION by default — never EXTERNAL/PRIVILEGED by mistake', () => {
    expect(getMigrationCategory('AlgumaMigrationQueNuncaExistiu99999999999999')).toBe(MigrationCategory.APPLICATION);
  });

  it('listExternalManagedMigrationNames exposes exactly the known EXTERNAL_MANAGED migrations', () => {
    expect(listExternalManagedMigrationNames()).toEqual(['RealtimeBroadcastAuthorization20260801000001']);
  });

  it('regression: every real migration registered in ALL_MIGRATIONS resolves to a valid category', () => {
    const validCategories = new Set(Object.values(MigrationCategory));
    for (const MigrationClass of ALL_MIGRATIONS) {
      const instance = new MigrationClass();
      expect(validCategories.has(getMigrationCategory(instance.name))).toBe(true);
    }
  });

  it('regression: exactly one real migration is EXTERNAL_MANAGED today (the Realtime one) — no other was misclassified', () => {
    const externalNames = ALL_MIGRATIONS
      .map((MigrationClass) => new MigrationClass())
      .filter((instance) => getMigrationCategory(instance.name) === MigrationCategory.EXTERNAL_MANAGED)
      .map((instance) => instance.name);
    expect(externalNames).toEqual(['RealtimeBroadcastAuthorization20260801000001']);
  });
});
