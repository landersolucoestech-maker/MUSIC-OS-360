import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000012_RenameNomeToNameOnWorkParticipants
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * work_participants.nome is a participant's own name (composer/author),
 * a plain varchar passthrough with no boundary mapper.
 * WorksService.hydrateParticipantes()/replaceParticipantes() previously
 * documented "para que o contrato de API não mude" — that note was
 * about not breaking the frontend DURING the prior JSONB->table
 * normalization (20260718000011), not a mandate to keep the Portuguese
 * name forever. This migration renames the physical column; the API
 * response field and every frontend consumer are updated in the same
 * commit.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnWorkParticipants20260918000012 implements MigrationInterface {
  name = 'RenameNomeToNameOnWorkParticipants20260918000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'work_participants' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "work_participants" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'work_participants' AND column_name = 'name'
        ) THEN
          ALTER TABLE "work_participants" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
