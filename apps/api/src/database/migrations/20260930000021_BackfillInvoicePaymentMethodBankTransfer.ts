import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000021_BackfillInvoicePaymentMethodBankTransfer (PJ1)
 *
 * Decision: the canonical payment-rail value for a generic bank transfer is
 * `bank_transfer` (`transfer` is already the transaction TYPE and `ted` is one
 * specific rail). Migration 20260930000010 deliberately kept the Portuguese
 * `transferencia` as a valid stored value until this decision existed.
 *
 * Expand/contract, expand + backfill step:
 *   1. Replace chk_invoices_payment_method with a WIDER list: the previous
 *      values PLUS `bank_transfer` (`transferencia` stays tolerated so an old
 *      API build / web bundle running during the deploy window does not fail
 *      the CHECK). Every existing row already satisfies the wider list (strict
 *      superset), so the validation scan cannot fail.
 *   2. Backfill invoices.payment_method 'transferencia' -> 'bank_transfer'
 *      (EXACT match: migration 20260930000010 already normalized spelling;
 *      idempotent: a canonical row never matches again). `updated_at` is left
 *      alone (vocabulary rewrite, not a user edit; bumping it would break
 *      optimistic concurrency of open editors). One bounded log line (count).
 * The code that ships with this migration writes `bank_transfer` and keeps
 * READING/accepting `transferencia` (invoice-legacy-fields.ts). Contract step
 * (drop `transferencia` from the CHECK and the legacy map) is a later migration
 * gated on the preflight census returning 0.
 *
 * down(): drop the CHECK, map bank_transfer back to transferencia (one-to-one;
 * the previous build only knows the latter) and restore the 20260930000010
 * CHECK. Idempotent.
 *
 * Preflight (read-only):
 *   SELECT payment_method, count(*) FROM invoices
 *   WHERE payment_method IN ('transferencia','bank_transfer') GROUP BY 1;
 */
const CONSTRAINT = 'chk_invoices_payment_method';
const BASE = ['pix', 'ted', 'boleto', 'credit_card', 'debit_card', 'cash', 'check'];
const LEGACY = 'transferencia';
const CANONICAL = 'bank_transfer';
const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export class BackfillInvoicePaymentMethodBankTransfer20260930000021 implements MigrationInterface {
  name = 'BackfillInvoicePaymentMethodBankTransfer20260930000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "${CONSTRAINT}" CHECK ("payment_method" IN (${quote([...BASE, CANONICAL, LEGACY])}))`,
    );
    const [{ affected }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "invoices" SET "payment_method" = $2 WHERE "payment_method" = $1 RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
      [LEGACY, CANONICAL],
    );
    console.log(`[${this.name}] invoices.payment_method legacy -> '${CANONICAL}': ${affected} row(s)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
    const [{ affected }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "invoices" SET "payment_method" = $2 WHERE "payment_method" = $1 RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
      [CANONICAL, LEGACY],
    );
    console.log(`[${this.name}] invoices.payment_method '${CANONICAL}' -> legacy: ${affected} row(s) restored`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "${CONSTRAINT}" CHECK ("payment_method" IN (${quote([...BASE, LEGACY])}))`,
    );
  }
}
