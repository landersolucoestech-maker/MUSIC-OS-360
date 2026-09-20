import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000039_RenameValorEstimadoToEstimatedValueOnLeads
 *
 * Cluster G (naming-normalization mandate, `valor_estimado` -> `estimated_value`):
 * leads.valor_estimado is a dead/orphaned top-level column — the active
 * "estimated value" concept for leads lives in the
 * dados_internos_crm.valorEstimado JSONB key instead (LeadsPage.tsx's
 * leadToFormInitial()/onSubmit mapping, report-form-contracts.ts's
 * `meta('valorEstimado', 'dados_internos_crm')`). No DTO declares this
 * column, no service reads or writes it — confirmed via repo-wide search.
 * Renamed anyway for schema consistency, per this mission's no-deferral
 * mandate for dead columns (same treatment as invoices.descricao before
 * it, commit 34dbc3b2).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameValorEstimadoToEstimatedValueOnLeads20260918000039 implements MigrationInterface {
  name = 'RenameValorEstimadoToEstimatedValueOnLeads20260918000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'valor_estimado'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "valor_estimado" TO "estimated_value";
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
          WHERE table_name = 'leads' AND column_name = 'estimated_value'
        ) THEN
          ALTER TABLE "leads" RENAME COLUMN "estimated_value" TO "valor_estimado";
        END IF;
      END $$;
    `);
  }
}
