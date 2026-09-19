import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000033_RenameObservacoesToNotesOnShares
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * shares.observacoes is a plain optional free-text field, direct DTO
 * passthrough (SharesService.toColumns spreads `{ ...d }` — not among
 * the EN-legacy aliases it explicitly remaps).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnShares20260918000033 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnShares20260918000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'shares' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'shares' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
