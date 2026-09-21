import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-mission audit resolved this session's own prior REQUIRES_REVIEW
 * (NAMING_NORMALIZATION_DISCOVERY_LOG.md §4): shares.fonograma_id is the
 * last Portuguese FK column referencing `phonograms`. Three other live
 * columns already FK to the same table using exactly `phonogram_id`
 * (transaction_allocations, performance_metric_entries,
 * audiovisual_projects, confirmed live) -- the <table_singular>_id
 * convention (artist_id->artists, campaign_id->campaigns, work_id->works,
 * all live-verified) settles this decisively in favor of `phonogram_id`
 * over the alternative `recording_id` the discovery log tentatively
 * floated (which has zero precedent anywhere in this schema -- there is
 * no `recordings` table). No third-party contract constrains this name:
 * the registry module's own "recording" vocabulary
 * (buildRecordingPayload/loadRecordingWithShares) is an external-facing
 * synonym layered over PhonogramEntity, never serialized as a literal
 * column name.
 */
export class RenameSharesFonogramaIdToPhonogramId20260920000006 implements MigrationInterface {
  name = 'RenameSharesFonogramaIdToPhonogramId20260920000006';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'shares' AND column_name = 'fonograma_id'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "fonograma_id" TO "phonogram_id";
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'shares' AND column_name = 'phonogram_id'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "phonogram_id" TO "fonograma_id";
        END IF;
      END $$;
    `);
  }
}
