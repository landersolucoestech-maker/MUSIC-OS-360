import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000011_RenameNomeToNameOnCampaigns
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * campaigns.nome is the campaign's own name. Two services share this
 * physical table: CampaignsService (the /campaigns route — its own
 * CreateCampaignDto uses `title`, mapped onto this column in
 * dtoToEntity()) and MarketingCampaignBuilderService (the live,
 * frontend-consumed /marketing/campaigns route — already establishes
 * `name` as its canonical field via `toStored()`'s
 * `name: builder.payload?.name ?? row.name`). `name` was chosen as the
 * physical column name to match the actually-consumed contract.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnCampaigns20260918000011 implements MigrationInterface {
  name = 'RenameNomeToNameOnCampaigns20260918000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "campaigns" RENAME COLUMN "nome" TO "name";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'name'
        ) THEN
          ALTER TABLE "campaigns" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
