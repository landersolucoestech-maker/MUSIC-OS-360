import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forensic audit (2026-09-20) found live duplicate rows in billing_subscriptions
 * (multiple rows sharing the same org_id) caused by seedDefaultTenant()
 * (01_default_tenant.ts) and the (now-removed, see 20260920000001's sibling
 * commit 57c34f27) duplicate insert in 03_operational_seed.ts both inserting
 * for the same org with `ON CONFLICT DO NOTHING` -- a no-op guard, since
 * billing_subscriptions has no UNIQUE(org_id)/UNIQUE(tenant_id), only
 * PK(id) and UNIQUE(stripe_customer_id)/UNIQUE(stripe_sub_id) (always NULL
 * on seed-created rows, so NULL != NULL never conflicts).
 *
 * Traced the real domain invariant from application code, not guessed:
 * billing.service.ts's onCheckoutCompleted does `UPDATE billing_subscriptions
 * ... WHERE org_id = :orgId` (never INSERT) and a `.getOne()` read on the
 * same org_id filter -- both assume exactly one row per org_id already
 * exists; with duplicates present, `.getOne()` picks an arbitrary one.
 * Separately, upsertStripeSubscription (the real Stripe subscription-sync
 * webhook handler) does `INSERT ... ON CONFLICT (tenant_id) DO UPDATE`,
 * which requires a UNIQUE(tenant_id) constraint to exist at all -- it does
 * not, so that code path currently errors at runtime
 * ("no unique or exclusion constraint matching the ON CONFLICT
 * specification") whenever a real Stripe webhook fires. Both invariants are
 * therefore code-proven, not assumed: exactly one row per org_id (billing is
 * an org-level concept: checkout/portal/enforcement are all org_id-keyed),
 * and tenant_id must be unique where populated (a plain UNIQUE constraint
 * already permits multiple NULLs, so this doesn't reject today's
 * seed-created NULL-tenant_id rows).
 *
 * Cleanup is precondition-checked, not a blind dedupe: for any org_id with
 * more than one row, if MORE THAN ONE of them has any Stripe linkage
 * (stripe_customer_id/stripe_sub_id/stripe_subscription_id not null), this
 * migration ABORTS for that org_id -- an ambiguous case an automated
 * migration must not resolve by guessing. If exactly one has Stripe
 * linkage, that row is kept (it represents real billing state) and the
 * pure-placeholder duplicates are removed. If none do (this session's
 * actual observed case: every duplicate row has all-null Stripe fields,
 * status='active' literal not derived from any webhook, seats matching a
 * hardcoded seed constant), the oldest row by created_at is kept.
 *
 * No FK anywhere in the schema references billing_subscriptions.id
 * (confirmed live via information_schema before writing this migration),
 * so deleting superseded rows is safe with respect to referential
 * integrity.
 */
export class ReconcileDuplicateBillingSubscriptions20260920000004 implements MigrationInterface {
  name = 'ReconcileDuplicateBillingSubscriptions20260920000004';

  public async up(qr: QueryRunner): Promise<void> {
    const dupOrgs: Array<{ org_id: string; total: number; stripe_linked: number }> = await qr.query(`
      SELECT org_id, count(*)::int AS total,
             count(*) FILTER (
               WHERE stripe_customer_id IS NOT NULL
                  OR stripe_sub_id IS NOT NULL
                  OR stripe_subscription_id IS NOT NULL
             )::int AS stripe_linked
        FROM billing_subscriptions
       GROUP BY org_id
      HAVING count(*) > 1
    `);

    for (const { org_id, stripe_linked } of dupOrgs) {
      if (stripe_linked > 1) {
        throw new Error(
          `ReconcileDuplicateBillingSubscriptions: org_id ${org_id} has ${stripe_linked} rows with ` +
            'real Stripe linkage. Aborting -- this migration only auto-resolves duplicates where at ' +
            'most one row represents real billing state; this case needs manual investigation.',
        );
      }

      if (stripe_linked === 1) {
        await qr.query(
          `
          DELETE FROM billing_subscriptions
           WHERE org_id = $1
             AND stripe_customer_id IS NULL
             AND stripe_sub_id IS NULL
             AND stripe_subscription_id IS NULL
          `,
          [org_id],
        );
      } else {
        await qr.query(
          `
          DELETE FROM billing_subscriptions
           WHERE org_id = $1
             AND id NOT IN (
               SELECT id FROM billing_subscriptions
                WHERE org_id = $1
                ORDER BY created_at ASC, id ASC
                LIMIT 1
             )
          `,
          [org_id],
        );
      }
    }

    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'billing_subscriptions_org_id_key'
        ) THEN
          ALTER TABLE billing_subscriptions ADD CONSTRAINT billing_subscriptions_org_id_key UNIQUE (org_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'billing_subscriptions_tenant_id_key'
        ) THEN
          ALTER TABLE billing_subscriptions ADD CONSTRAINT billing_subscriptions_tenant_id_key UNIQUE (tenant_id);
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_subscriptions_org_id_key') THEN
          ALTER TABLE billing_subscriptions DROP CONSTRAINT billing_subscriptions_org_id_key;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_subscriptions_tenant_id_key') THEN
          ALTER TABLE billing_subscriptions DROP CONSTRAINT billing_subscriptions_tenant_id_key;
        END IF;
      END $$;
    `);
    // Deleted duplicate rows are intentionally not resurrected -- they held no
    // unique business data (see this migration's own docstring: pure seed
    // placeholders, verified Stripe-unlinked before removal).
  }
}
