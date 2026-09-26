import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260824000001_AddBillingPlanIntegrationEntitlements
 *
 * Per-plan integration entitlements, in the CANONICAL plans TABLE.
 *
 * WHY NOT `billing_plans.features`:
 * `features` is, by this project's contract, a LIST OF LABELS displayed on the
 * plan card — "never a map of flags" (see the comment in BillingPlanEntity). The
 * admin form, billing and landing do `.map/.push/.filter` on it, and a persisted `{}`
 * there already caused the real bug "features.map is not a function"
 * (Part 84), with defensive normalization in BillingPlansService.list()/get().
 * Storing `{integrations:[…]}` in `features` would reintroduce exactly that bug.
 *
 * WHY NOT A NEW TABLE:
 * It would be a second plans system — forbidden. This column lives in the same
 * table, is read/written by the same plans service and takes part in the same
 * lifecycle. It is the smallest schema evolution that solves the requirement.
 *
 * Format: a DYNAMIC list of commercial slugs.
 *   billing_plans.integrations = ["docusign","whatsapp"]
 * No per-provider key, no plan name in code — adding a new commercial
 * integration requires neither schema nor code.
 */
export class AddBillingPlanIntegrationEntitlements20260824000001 implements MigrationInterface {
  name = 'AddBillingPlanIntegrationEntitlements20260824000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "billing_plans"
        ADD COLUMN IF NOT EXISTS "integrations" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    // Initial state coherent with the modules each plan already advertises.
    // Only COMMERCIAL providers with a real adapter go in — nothing aspirational.
    const seed: Array<[string, string[]]> = [
      ['starter',      []],
      ['professional', ['autentique', 'whatsapp', 'google_ads']],
      ['enterprise',   ['autentique', 'whatsapp', 'google_ads', 'meta_business', 'abramus', 'docusign']],
    ];
    for (const [slug, list] of seed) {
      await queryRunner.query(
        `UPDATE "billing_plans" SET "integrations" = $1::jsonb, "updated_at" = now() WHERE "slug" = $2`,
        [JSON.stringify(list), slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "billing_plans" DROP COLUMN IF EXISTS "integrations"`);
  }
}
