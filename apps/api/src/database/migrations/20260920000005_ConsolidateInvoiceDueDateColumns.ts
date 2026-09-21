import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-mission audit found `invoices` carrying the same "due date" concept
 * in three places: `due_date` (Stripe-owned, populated only by billing.service.ts's
 * upsertStripeInvoice for type='stripe_subscription' rows -- untouched by
 * this migration, a distinct concept per that audit) and two internal
 * nota-fiscal columns, `data_vencimento` (original, from
 * 20240101000000_InitialSchema.ts) and `vencimento` (added later by
 * 20260712000005_CrmFinanceOpsFormFieldColumns.ts under a "one physical
 * column per form field" rule that didn't check `data_vencimento` already
 * existed for the same concept). invoices.service.ts's normalizePayload()
 * wrote both from the single `vencimento` DTO/form field on every
 * create/update -- a live dual-write, not merely a naming duplicate: the
 * two columns have different types (timestamp vs date) and every UI read
 * used `vencimento` while the overdue scheduler read `data_vencimento`,
 * so any writer that touched one without the other silently desynced them.
 *
 * Consolidates onto `data_vencimento` (canonical -- already read by
 * invoice-overdue.scheduler.ts; the DTO/form-facing name `vencimento`
 * remains as a documented API alias, see report-form-contracts.ts's
 * INVOICES_CONTRACT.formFieldAliases and invoices.service.ts's
 * normalizePayload(), both updated in the same commit as this migration).
 *
 * Precondition-checked: for any row where `vencimento` is set and
 * `data_vencimento` is NOT already set to the same value, backfill
 * data_vencimento from vencimento first (safe -- vencimento's value is
 * simply moving to the already-canonical column, not being invented). Then
 * verify no row has both set to DIFFERENT values (a genuine conflict this
 * migration must not silently resolve) before dropping `vencimento`.
 */
export class ConsolidateInvoiceDueDateColumns20260920000005 implements MigrationInterface {
  name = 'ConsolidateInvoiceDueDateColumns20260920000005';

  public async up(qr: QueryRunner): Promise<void> {
    const col = await qr.query(`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'vencimento'
    `);
    if (col.length === 0) return; // already absent on this environment

    const conflicts = await qr.query(`
      SELECT id, vencimento, data_vencimento FROM "invoices"
       WHERE "vencimento" IS NOT NULL
         AND "data_vencimento" IS NOT NULL
         AND "data_vencimento"::date != "vencimento"::date
    `);
    if (conflicts.length > 0) {
      throw new Error(
        `ConsolidateInvoiceDueDateColumns: ${conflicts.length} invoice(s) have "vencimento" and ` +
          `"data_vencimento" set to DIFFERENT dates. Aborting before any write -- this migration only ` +
          `auto-backfills when the two columns agree or one is empty. Investigate which value is ` +
          `correct per row before proceeding. Example row(s): ${JSON.stringify(conflicts.slice(0, 5))}`,
      );
    }

    await qr.query(`
      UPDATE "invoices"
         SET "data_vencimento" = "vencimento"::timestamp
       WHERE "vencimento" IS NOT NULL
         AND "data_vencimento" IS NULL
    `);

    await qr.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "vencimento"`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "vencimento" date`);
  }
}
