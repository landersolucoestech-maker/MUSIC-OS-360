import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260927000001_CanonicalizeFinancialRulesToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the last
 * Portuguese technical names on `financial_rules`.
 *
 * Columns:
 *   calculo   -> calculation_method
 *   condicoes -> conditions
 *
 * Persisted technical values (their PT-BR labels live in the web UI):
 *   calculation_method: percentual -> percentage, fixo -> fixed, faixa -> tiered
 *   type:               imposto -> tax, comissao -> commission, desconto -> discount,
 *                       taxa -> fee, outros -> other   (external_rights_fee unchanged)
 *
 * Indexes created by 20260521000060 under the old column names are renamed
 * to match (idx_financial_rules_tenant_tipo/_ativo -> _type/_active).
 *
 * Not touched here: conditions->>'type' holds a transaction type value and
 * migrates together with transactions.type.
 *
 * RENAME COLUMN / RENAME INDEX are metadata-only; the value UPDATEs touch
 * only rows holding a legacy value. Every step is guarded so the migration
 * is idempotent, and down() restores the previous names and values.
 */
const CALCULATION_METHODS: ReadonlyArray<[string, string]> = [
  ['percentual', 'percentage'],
  ['fixo', 'fixed'],
  ['faixa', 'tiered'],
];

const RULE_TYPES: ReadonlyArray<[string, string]> = [
  ['imposto', 'tax'],
  ['comissao', 'commission'],
  ['desconto', 'discount'],
  ['taxa', 'fee'],
  ['outros', 'other'],
];

const COLUMNS: ReadonlyArray<[string, string]> = [
  ['calculo', 'calculation_method'],
  ['condicoes', 'conditions'],
];

const INDEXES: ReadonlyArray<[string, string]> = [
  ['idx_financial_rules_tenant_tipo', 'idx_financial_rules_tenant_type'],
  ['idx_financial_rules_tenant_ativo', 'idx_financial_rules_tenant_active'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_rules' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_rules' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "financial_rules" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

function remapValues(column: string, pairs: ReadonlyArray<[string, string]>): string {
  const cases = pairs.map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
  const sources = pairs.map(([from]) => `'${from}'`).join(', ');
  return `UPDATE "financial_rules" SET "${column}" = CASE "${column}" ${cases} END WHERE "${column}" IN (${sources});`;
}

function swap(pairs: ReadonlyArray<[string, string]>): Array<[string, string]> {
  return pairs.map(([a, b]) => [b, a]);
}

export class CanonicalizeFinancialRulesToEnglish20260927000001 implements MigrationInterface {
  name = 'CanonicalizeFinancialRulesToEnglish20260927000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    for (const [from, to] of INDEXES) await queryRunner.query(renameIndex(from, to));
    await queryRunner.query(remapValues('calculation_method', CALCULATION_METHODS));
    await queryRunner.query(remapValues('type', RULE_TYPES));
    await queryRunner.query(`ALTER TABLE "financial_rules" ALTER COLUMN "calculation_method" SET DEFAULT 'percentage';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "financial_rules" ALTER COLUMN "calculation_method" SET DEFAULT 'percentual';`);
    await queryRunner.query(remapValues('type', swap(RULE_TYPES)));
    await queryRunner.query(remapValues('calculation_method', swap(CALCULATION_METHODS)));
    for (const [from, to] of swap(INDEXES)) await queryRunner.query(renameIndex(from, to));
    for (const [from, to] of swap(COLUMNS)) await queryRunner.query(renameColumn(from, to));
  }
}
