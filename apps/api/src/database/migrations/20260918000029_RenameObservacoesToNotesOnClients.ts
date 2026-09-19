import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000029_RenameObservacoesToNotesOnClients
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * clients.observacoes was already inconsistent across the write/read
 * boundary — ClientsService.normalizeClientPayload() (write) already
 * accepted an English `notes` DTO field and mapped it onto this column,
 * but ClientsService.mapClient() (read) never remapped it, so GET
 * responses leaked the raw Portuguese physical key unmapped. Renaming
 * the column closes that gap: the DTO's existing `notes` field now
 * matches the physical name 1:1 on both sides, no mapper needed.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnClients20260918000029 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnClients20260918000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'clients' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'clients' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "clients" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
