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

describe('data migrations call the RLS-bypass guard before any other SQL', () => {
  const migrations = [
    ['./migrations/20260928000019_CanonicalizeLegacyReleaseStatuses', 'CanonicalizeLegacyReleaseStatuses20260928000019'],
    ['./migrations/20260928000022_CanonicalizeArtistsToEnglish', 'CanonicalizeArtistsToEnglish20260928000022'],
    ['./migrations/20260928000023_CanonicalizeClientsToEnglish', 'CanonicalizeClientsToEnglish20260928000023'],
    ['./migrations/20260928000025_RenameOrgStructureSlugsToEnglish', 'RenameOrgStructureSlugsToEnglish20260928000025'],
    ['./migrations/20260928000026_CanonicalizeMusicChatValuesToEnglish', 'CanonicalizeMusicChatValuesToEnglish20260928000026'],
    ['./migrations/20260929000002_BackfillAndRestrictMarketingContentVocabularyToEnglish', 'BackfillAndRestrictMarketingContentVocabularyToEnglish20260929000002'],
  ] as const;

  it.each(migrations)('%s up() and down() stop at the guard without a bypassing role', async (path, className) => {
    const Migration = (await import(path))[className] as new () => { up(q: unknown): Promise<void>; down(q: unknown): Promise<void> };
    for (const direction of ['up', 'down'] as const) {
      const query = jest.fn().mockResolvedValue([{ bypass: false }]);
      await expect(new Migration()[direction]({ query })).rejects.toThrow(/BYPASSRLS/);
      expect(query).toHaveBeenCalledTimes(1);
      expect(String(query.mock.calls[0][0])).toContain('rolbypassrls');
    }
  });
});
