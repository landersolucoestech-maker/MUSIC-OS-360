import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000037_RenameValorToFixedValueOnContracts
 *
 * Cluster G (naming-normalization mandate, `valor` -> `fixed_value`):
 * contracts.valor is the contract's canonical monetary value ("Valor
 * Fixo do Serviço" / "Valor do Contrato" in ContractFormModal.tsx,
 * whose local form field is already named `fixed_value`).
 *
 * Unlike most Cluster F/G renames, this column already had a legacy
 * English alias contract in place (contract-legacy-alias.util.ts's
 * VALOR_SPEC: canonical `valor`, legacy `value` — the DTO's original
 * English name, deprecated in favor of the Portuguese one before this
 * mission's mandate existed). This migration and its paired DTO/service
 * change make `fixed_value` the new canonical name while keeping BOTH
 * `valor` and `value` as accepted deprecated aliases (VALOR_SPEC.legacy
 * is now `['value', 'valor']`), so no existing caller of either name
 * breaks.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameValorToFixedValueOnContracts20260918000037 implements MigrationInterface {
  name = 'RenameValorToFixedValueOnContracts20260918000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contracts' AND column_name = 'valor'
        ) THEN
          ALTER TABLE "contracts" RENAME COLUMN "valor" TO "fixed_value";
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
          WHERE table_name = 'contracts' AND column_name = 'fixed_value'
        ) THEN
          ALTER TABLE "contracts" RENAME COLUMN "fixed_value" TO "valor";
        END IF;
      END $$;
    `);
  }
}
