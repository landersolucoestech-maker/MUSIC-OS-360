import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';

/**
 * 20260930000010_BackfillAndRestrictInvoicePaymentMethodToEnglish (S6)
 *
 * `invoices.payment_method` (varchar(50), no CHECK) still stores the Portuguese
 * values written by the invoice form (dinheiro, cartao_credito, cartao_debito,
 * cheque; pix/boleto/transferencia). Migration 20260928000014 renamed the
 * column (forma_pagamento -> payment_method) but deliberately did not remap the
 * values. `transactions.payment_method` already uses the English vocabulary
 * (cash, credit_card, debit_card, check, pix, ted, boleto -- 20260928000021);
 * one concept, one vocabulary, so the invoice values are mapped onto it.
 *
 * Same single-migration Backfill-and-Restrict shape as the 20260910* series and
 * 20260929000002. The expand step is unnecessary (same column type/width); the
 * compatibility layer for a web build that still sends Portuguese values lives
 * in the API (invoice-legacy-fields.ts, canonicalInvoicePaymentMethod), not in
 * the database. Deploy the API (which maps deprecated input) before or together
 * with this migration: an OLD API build writing `dinheiro` fails the CHECK.
 *
 *   1. Backfill (case/space-insensitive, idempotent -- a row already holding a
 *      canonical value never matches): dinheiro -> cash, cartao_credito ->
 *      credit_card, cartao_debito -> debit_card, cheque -> check; spelling
 *      variants of already-canonical values (e.g. 'PIX') are lower-cased; a
 *      blank string becomes NULL. `updated_at` is left alone: this is a
 *      vocabulary rewrite, not a user edit (bumping it would make every open
 *      editor fail its optimistic-concurrency check). Matching normalizes
 *      case, leading/trailing whitespace and inner whitespace runs (tab,
 *      NBSP): 'CASH', 'Credit_Card', ' cheque ' are handled; accented or
 *      otherwise free text is NOT guessed and aborts in step 2. Stripe SaaS
 *      subscription rows (type = 'stripe_subscription') carry no payment
 *      method (upsertStripeInvoice never writes it: NULL), so they need no
 *      special case: backfill, verification and CHECK treat every row alike
 *      (NULL passes the CHECK).
 *   2. Verify: any remaining value outside the allowed set aborts the migration
 *      with the offending values listed (at most 20, each truncated to 40
 *      characters), BEFORE the constraint is added (nothing is guessed or
 *      coerced).
 *   3. Restrict: chk_invoices_payment_method.
 *
 * `transferencia` (the form default) has NO unambiguous canonical equivalent:
 * `ted` is one specific rail, and a generic bank-transfer value is a canonical
 * map decision that has not been taken. It is not mapped and not guessed: it
 * stays a valid stored value and is listed explicitly in the CHECK. A follow-up
 * migration replaces the CHECK once the decision exists.
 *
 * down(): drops the CHECK and maps cash/credit_card/debit_card/check back to
 * the Portuguese spellings (one-to-one). Rows written canonical after up() are
 * therefore also rewritten, which is what the previous build reads. `ted` has
 * no Portuguese spelling and is left as-is.
 */
type Pair = readonly [legacy: string, canonical: string];

const LEGACY_TO_CANONICAL: ReadonlyArray<Pair> = [
  ['dinheiro', 'cash'],
  ['cartao_credito', 'credit_card'],
  ['cartao_debito', 'debit_card'],
  ['cheque', 'check'],
];

/** Already-canonical values (their spelling is normalized, not remapped). */
const CANONICAL_UNCHANGED = ['pix', 'ted', 'boleto'];

/** Persisted value with no canonical equivalent yet -- kept, see the class comment. */
const PENDING_DECISION = 'transferencia';

const ALLOWED = [...LEGACY_TO_CANONICAL.map(([, canonical]) => canonical), ...CANONICAL_UNCHANGED, PENDING_DECISION];

const CONSTRAINT = 'chk_invoices_payment_method';
/** Case/whitespace-normalized cell: tab, newline, NBSP and space runs collapse to one space, then trimmed and lower-cased. */
const NORMALIZED = `lower(btrim(regexp_replace("payment_method", '[[:space:]' || chr(160) || ']+', ' ', 'g')))`;
const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

export class BackfillAndRestrictInvoicePaymentMethodToEnglish20260930000010 implements MigrationInterface {
  name = 'BackfillAndRestrictInvoicePaymentMethodToEnglish20260930000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const [legacy, canonical] of LEGACY_TO_CANONICAL) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE "invoices" SET "payment_method" = $2
           WHERE ${NORMALIZED} = $1 AND "payment_method" <> $2
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [legacy, canonical],
      );
      console.log(`[BackfillAndRestrictInvoicePaymentMethodToEnglish] invoices.payment_method '${legacy}' -> '${canonical}': ${affected} row(s)`);
    }

    for (const value of [...CANONICAL_UNCHANGED, PENDING_DECISION]) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE "invoices" SET "payment_method" = $1
           WHERE ${NORMALIZED} = $1 AND "payment_method" <> $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [value],
      );
      console.log(`[BackfillAndRestrictInvoicePaymentMethodToEnglish] invoices.payment_method '${value}' spelling normalized: ${affected} row(s)`);
    }

    const [{ affected: blanks }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "invoices" SET "payment_method" = NULL
         WHERE ${NORMALIZED} = ''
         RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
    );
    console.log(`[BackfillAndRestrictInvoicePaymentMethodToEnglish] invoices.payment_method blank -> NULL: ${blanks} row(s)`);

    const invalidRows: Array<{ value: string }> = await queryRunner.query(
      `SELECT DISTINCT "payment_method" AS value
       FROM "invoices"
       WHERE "payment_method" NOT IN (${quote(ALLOWED)})
       ORDER BY 1
       LIMIT 21`,
    );
    if (invalidRows.length > 0) {
      throw new Error(
        `${this.name}: cannot add CHECK constraint, "invoices"."payment_method" contains ` +
          `unexpected values after backfill: [${formatAuditValues(invalidRows.map((row) => row.value))}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "${CONSTRAINT}" CHECK ("payment_method" IN (${quote(ALLOWED)}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
    for (const [legacy, canonical] of LEGACY_TO_CANONICAL) {
      await queryRunner.query(
        `UPDATE "invoices" SET "payment_method" = $1 WHERE "payment_method" = $2`,
        [legacy, canonical],
      );
    }
  }
}
