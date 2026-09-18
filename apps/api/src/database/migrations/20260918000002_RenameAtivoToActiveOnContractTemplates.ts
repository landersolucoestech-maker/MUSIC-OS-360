import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000002_RenameAtivoToActiveOnContractTemplates
 *
 * Naming-normalization mandate (generic-noun sub-concept `ativo` ->
 * `active`): `contract_templates` is one of the two outlier tables still
 * using the Portuguese boolean-flag name — the rest of the schema already
 * uses English `active`/`is_active` for the identical concept. The sibling
 * outlier (`financial_rules.ativo`) is deliberately NOT touched by this
 * migration — that table's `categoria` field is entangled with the shared
 * accounting frontend module (transactions + financial rules share
 * components/hooks around category filtering), and `ativo` on that same
 * entity is deferred alongside it to keep both fields' normalization
 * coordinated in one future batch rather than leaving the entity half
 * English/half Portuguese in a way that could confuse that shared UI.
 *
 * Verified before this migration: `contract_templates` has no pre-existing
 * `active`/`is_active` column (no collision), and `ativo` here is a plain
 * DTO passthrough field with no dedicated alias-resolver. Frontend
 * `ContractLifecycleState`'s `"ativo"` string literal (contract lifecycle
 * status enum, in ContractStatusBadge.tsx) is a DIFFERENT, unrelated
 * concept sharing only the word — not touched by this migration.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameAtivoToActiveOnContractTemplates20260918000002 implements MigrationInterface {
  name = 'RenameAtivoToActiveOnContractTemplates20260918000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contract_templates' AND column_name = 'ativo'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "ativo" TO "active";
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
          WHERE table_name = 'contract_templates' AND column_name = 'active'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "active" TO "ativo";
        END IF;
      END $$;
    `);
  }
}
