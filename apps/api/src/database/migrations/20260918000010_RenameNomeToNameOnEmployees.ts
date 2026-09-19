import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000010_RenameNomeToNameOnEmployees
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * employees.nome is the employee's own name, a plain varchar
 * passthrough with no boundary mapper — `HrService.mapEmployee()` only
 * decrypts email/telefone/cpf and spreads the rest of the entity
 * through, `nome` is not touched by it.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnEmployees20260918000010 implements MigrationInterface {
  name = 'RenameNomeToNameOnEmployees20260918000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'employees' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "employees" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'employees' AND column_name = 'name'
        ) THEN
          ALTER TABLE "employees" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
