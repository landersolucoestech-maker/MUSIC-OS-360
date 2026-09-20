import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000045_RenameValorFieldsOnInvoices
 *
 * Cluster G (naming-normalization mandate) — final table, closes the
 * cluster. Renames every `valor*` column on `invoices`:
 *
 *  - valor           -> legacy_amount  ("Coluna legada ainda usada por
 *                       eventos e telas antigas; espelha service_amount"
 *                       — a deliberate mirror of valor_servicos kept for
 *                       backward compat, InvoicesService.normalizePayload)
 *  - valor_servicos   -> service_amount
 *  - valor_deducoes   -> deductions_amount
 *  - valor_iss        -> iss_amount   (ISS = Imposto sobre Serviços,
 *                       Brazilian tax code — kept as a LEGAL_PROPER_NOUN,
 *                       only the generic "valor" token is translated)
 *  - valor_pis        -> pis_amount   (PIS)
 *  - valor_cofins     -> cofins_amount (COFINS)
 *  - valor_inss       -> inss_amount  (INSS)
 *  - valor_ir         -> ir_amount    (IR)
 *  - valor_csll       -> csll_amount  (CSLL)
 *  - valor_liquido    -> net_amount
 *
 * base_calculo/aliquota_iss/iss_retido are untouched — they don't
 * contain the `valor` token this cluster targets.
 *
 * Direct DTO passthrough (InvoicesService.normalizePayload spreads
 * `{ ...input }`, with one explicit `valor_servicos -> valor` mirror
 * line — renamed to `service_amount -> legacy_amount` alongside).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` per column so this is safe to
 * re-run and a no-op if a column is already renamed or absent.
 */
export class RenameValorFieldsOnInvoices20260918000045 implements MigrationInterface {
  name = 'RenameValorFieldsOnInvoices20260918000045';

  private static readonly RENAMES: Array<[string, string]> = [
    ['valor', 'legacy_amount'],
    ['valor_servicos', 'service_amount'],
    ['valor_deducoes', 'deductions_amount'],
    ['valor_iss', 'iss_amount'],
    ['valor_pis', 'pis_amount'],
    ['valor_cofins', 'cofins_amount'],
    ['valor_inss', 'inss_amount'],
    ['valor_ir', 'ir_amount'],
    ['valor_csll', 'csll_amount'],
    ['valor_liquido', 'net_amount'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of RenameValorFieldsOnInvoices20260918000045.RENAMES) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'invoices' AND column_name = '${from}'
          ) THEN
            ALTER TABLE "invoices" RENAME COLUMN "${from}" TO "${to}";
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of [...RenameValorFieldsOnInvoices20260918000045.RENAMES].reverse()) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'invoices' AND column_name = '${to}'
          ) THEN
            ALTER TABLE "invoices" RENAME COLUMN "${to}" TO "${from}";
          END IF;
        END $$;
      `);
    }
  }
}
