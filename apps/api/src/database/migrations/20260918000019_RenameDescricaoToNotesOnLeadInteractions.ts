import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000019_RenameDescricaoToNotesOnLeadInteractions
 *
 * Cluster E/F (naming-normalization mandate, `descricao` -> semantic
 * English decomposition): lead_interactions.descricao is a free-text
 * note attached to a CRM interaction log entry. CreateLeadInteractionDto
 * already accepted this as `notes` (LeadInteractionsService.create()
 * explicitly mapped `descricao: dto.notes ?? null`) — this migration
 * renames the physical column to match the term already established
 * at the DTO boundary, closing the remaining read-side (list()) gap
 * where the raw entity still exposed `descricao`.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToNotesOnLeadInteractions20260918000019 implements MigrationInterface {
  name = 'RenameDescricaoToNotesOnLeadInteractions20260918000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lead_interactions' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "lead_interactions" RENAME COLUMN "descricao" TO "notes";
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
          WHERE table_name = 'lead_interactions' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "lead_interactions" RENAME COLUMN "notes" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
