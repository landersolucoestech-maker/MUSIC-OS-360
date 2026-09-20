import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000043_RenameValorBrutoValorLiquidoOnEcadReports
 *
 * Cluster G (naming-normalization mandate):
 * ecad_reports.valor_bruto -> gross_amount, ecad_reports.valor_liquido
 * -> net_amount. Direct DTO passthrough (EcadReportsService.create/
 * update spread `...rest`/dto straight onto the entity).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the columns are already renamed or absent.
 */
export class RenameValorBrutoValorLiquidoOnEcadReports20260918000043 implements MigrationInterface {
  name = 'RenameValorBrutoValorLiquidoOnEcadReports20260918000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ecad_reports' AND column_name = 'valor_bruto'
        ) THEN
          ALTER TABLE "ecad_reports" RENAME COLUMN "valor_bruto" TO "gross_amount";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ecad_reports' AND column_name = 'valor_liquido'
        ) THEN
          ALTER TABLE "ecad_reports" RENAME COLUMN "valor_liquido" TO "net_amount";
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
          WHERE table_name = 'ecad_reports' AND column_name = 'gross_amount'
        ) THEN
          ALTER TABLE "ecad_reports" RENAME COLUMN "gross_amount" TO "valor_bruto";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ecad_reports' AND column_name = 'net_amount'
        ) THEN
          ALTER TABLE "ecad_reports" RENAME COLUMN "net_amount" TO "valor_liquido";
        END IF;
      END $$;
    `);
  }
}
