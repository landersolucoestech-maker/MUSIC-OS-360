import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `artist_platform_profiles.sync_status` (created in
 * `20260612000003_CreateArtistPlatformProfiles.ts`) is a plain
 * `varchar NOT NULL DEFAULT 'pending'` with no enum/CHECK constraint. Only
 * 'pending' | 'success' | 'failed' are ever written by
 * `artist-platform-profiles.service.ts`, but nothing in the database stops a
 * future typo from persisting an invalid value silently. This migration adds
 * the missing CHECK constraint, following the same pattern as
 * `chk_society_sync_status` in `20260601000003_SocietyIntegration.ts`.
 *
 * Before adding the CHECK, it audits existing rows for values outside the
 * allowed set. If any are found, it raises an explicit exception listing
 * them instead of letting the ALTER TABLE fail with a generic constraint
 * violation.
 */
export class AddArtistPlatformProfilesSyncStatusCheck20260910000002
  implements MigrationInterface
{
  name = 'AddArtistPlatformProfilesSyncStatusCheck20260910000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalidRows: Array<{ sync_status: string }> = await queryRunner.query(`
      SELECT DISTINCT sync_status
      FROM "artist_platform_profiles"
      WHERE sync_status NOT IN ('pending', 'success', 'failed')
    `);

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.sync_status).join(', ');
      throw new Error(
        `AddArtistPlatformProfilesSyncStatusCheck20260910000002: cannot add CHECK constraint, ` +
          `"artist_platform_profiles" contains rows with unexpected sync_status values: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "artist_platform_profiles"
      ADD CONSTRAINT "chk_artist_platform_profiles_sync_status"
      CHECK ("sync_status" IN ('pending', 'success', 'failed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artist_platform_profiles"
      DROP CONSTRAINT IF EXISTS "chk_artist_platform_profiles_sync_status"
    `);
  }
}
