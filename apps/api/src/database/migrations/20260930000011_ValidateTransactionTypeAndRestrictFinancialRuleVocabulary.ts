import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';

/**
 * 20260930000011_ValidateTransactionTypeAndRestrictFinancialRuleVocabulary (S5)
 *
 * Restrict phase of the vocabularies that were already canonicalized to English
 * by 20260928000021 (transactions.type) and 20260927000001
 * (financial_rules.type / calculation_method), for the columns whose every
 * writer is proven to stay inside the set:
 *
 *   - transactions.type: chk_transactions_type was created NOT VALID by
 *     20260928000021 (enforced for new writes only) and never VALIDATEd. Every
 *     writer is inside the set: the transaction zod schema (TRANSACTION_TYPES),
 *     the contract.signed handler (TransactionType.REVENUE), the demo seed
 *     ('revenue'), and the reports import, whose raw INSERT is itself checked by
 *     the NOT VALID constraint. Only rows written BEFORE that migration and
 *     holding a value it did not remap could violate it.
 *   - financial_rules.type / calculation_method: the only writer is
 *     FinancialRulesService (DTO @IsIn + normalizeFinancialRuleInput map the
 *     deprecated Portuguese values before persistence); the table is
 *     NOT_REPORTABLE, so the reports import cannot write it.
 *
 * NOT covered here (plan only): transactions.counterparty_type / payment_method /
 * payment_type / installment_interval. The reports import (import-commit.service.ts
 * insertGroup) writes those varchar columns with free text -- only the known
 * legacy spellings are mapped, an unknown cell is inserted as-is -- so a CHECK
 * would turn an unvalidated spreadsheet cell into a database error that rolls
 * back the whole import. The import needs value validation first.
 *
 * Steps (purely additive, no data is rewritten):
 *   1. Audit: any row outside the canonical set aborts the migration with the
 *      offending values listed, before any constraint is touched (nothing is
 *      guessed or coerced). Runs under a role that bypasses RLS (guard), so the
 *      audit sees every tenant.
 *      The message lists at most 20 values per column, each truncated to 40
 *      characters.
 *   2. Add the missing constraints NOT VALID (guarded -- idempotent), then
 *      VALIDATE them all. Locking: ADD CONSTRAINT ... NOT VALID takes ACCESS
 *      EXCLUSIVE on the table (brief, no scan; lock_timeout bounds the wait);
 *      VALIDATE CONSTRAINT itself only needs SHARE UPDATE EXCLUSIVE, so
 *      concurrent reads/writes continue during the scan. Because the whole
 *      migration is one transaction, the ACCESS EXCLUSIVE lock taken on
 *      financial_rules by its ADD is HELD UNTIL COMMIT, i.e. through the
 *      validation scans of that table (blocking its readers/writers; the table
 *      is small and low-traffic). `transactions` only gets the VALIDATE (its
 *      constraint already exists), so it stays at SHARE UPDATE EXCLUSIVE.
 *
 * down(): drops the two financial_rules constraints and restores
 * chk_transactions_type to its previous NOT VALID state (a validated constraint
 * cannot be un-validated, so it is dropped and re-added NOT VALID). No data was
 * changed, so no data is restored.
 */
const TRANSACTION_TYPES = ['revenue', 'expense', 'investment', 'tax', 'transfer'] as const;
const FINANCIAL_RULE_TYPES = ['tax', 'commission', 'external_rights_fee', 'discount', 'fee', 'other'] as const;
const CALCULATION_METHODS = ['percentage', 'fixed', 'tiered'] as const;

const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

interface Spec {
  table: string;
  column: string;
  constraint: string;
  values: readonly string[];
}

const SPECS: ReadonlyArray<Spec> = [
  { table: 'transactions', column: 'type', constraint: 'chk_transactions_type', values: TRANSACTION_TYPES },
  { table: 'financial_rules', column: 'type', constraint: 'chk_financial_rules_type', values: FINANCIAL_RULE_TYPES },
  { table: 'financial_rules', column: 'calculation_method', constraint: 'chk_financial_rules_calculation_method', values: CALCULATION_METHODS },
];

const addNotValid = (spec: Spec): string => `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.${spec.table}'::regclass AND conname = '${spec.constraint}') THEN
      ALTER TABLE "${spec.table}" ADD CONSTRAINT "${spec.constraint}"
        CHECK ("${spec.column}" IN (${quote(spec.values)})) NOT VALID;
    END IF;
  END $$;`;

export class ValidateTransactionTypeAndRestrictFinancialRuleVocabulary20260930000011 implements MigrationInterface {
  name = 'ValidateTransactionTypeAndRestrictFinancialRuleVocabulary20260930000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const spec of SPECS) {
      const invalidRows: Array<{ value: string }> = await queryRunner.query(
        `SELECT DISTINCT "${spec.column}" AS value
         FROM "${spec.table}"
         WHERE "${spec.column}" NOT IN (${quote(spec.values)})
         ORDER BY 1
         LIMIT 21`,
      );
      if (invalidRows.length > 0) {
        throw new Error(
          `${this.name}: cannot validate CHECK constraint ${spec.constraint}, "${spec.table}"."${spec.column}" ` +
            `contains unexpected values: [${formatAuditValues(invalidRows.map((row) => row.value))}]. ` +
            `Migrate this data (nothing is guessed here) before re-running this migration.`,
        );
      }
    }

    for (const spec of SPECS) await queryRunner.query(addNotValid(spec));
    for (const spec of SPECS) {
      await queryRunner.query(`ALTER TABLE "${spec.table}" VALIDATE CONSTRAINT "${spec.constraint}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const spec of SPECS.filter((s) => s.table === 'financial_rules')) {
      await queryRunner.query(`ALTER TABLE "${spec.table}" DROP CONSTRAINT IF EXISTS "${spec.constraint}"`);
    }
    const [transactionsType] = SPECS;
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "${transactionsType.constraint}"`);
    await queryRunner.query(addNotValid(transactionsType));
  }
}
