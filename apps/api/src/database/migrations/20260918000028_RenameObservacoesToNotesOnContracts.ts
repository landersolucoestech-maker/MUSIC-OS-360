import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000028_RenameObservacoesToNotesOnContracts
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * contracts.observacoes is a plain optional free-text field, "1 form
 * field = 1 physical column" passthrough (ContractsService.buildEntityPayload
 * — no mapping beyond the alias-resolved title/type/artist_id/dates/
 * arquivo_url/valor trio). Also doubles as storage for the Contract
 * Wizard's serialized parties/variables blob (ContractWizard.tsx) when
 * the value starts with "{" — an existing overload of this one column,
 * unaffected by the rename.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnContracts20260918000028 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnContracts20260918000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contracts' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "contracts" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'contracts' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "contracts" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
