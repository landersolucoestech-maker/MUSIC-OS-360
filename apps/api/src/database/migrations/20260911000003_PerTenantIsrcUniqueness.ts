import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * find-8d970d80 (Wave 7): works.isrc/phonograms.isrc had no uniqueness
 * constraint at all — not even per-tenant — only plain lookup indexes
 * (idx_works_isrc/idx_phonograms_isrc). ISRC is a real-world globally-unique
 * industry identifier; nothing here enforced even the weakest, uncontroversial
 * version of that (one tenant's own catalog should never contain the same
 * ISRC twice — that's always a data-entry error, never a legitimate case).
 *
 * SCOPE DECISION: this migration deliberately enforces PER-TENANT uniqueness
 * only, not global. Whether two DIFFERENT tenants may legitimately hold
 * catalog referencing the same real-world ISRC (e.g. two labels distributing
 * shared classical-music/public-domain material, or back-catalog/admin
 * scenarios) is a genuine product decision this migration does not make —
 * see find-8d970d80's DIVIDA_ACEITA disposition for the deferred
 * global-uniqueness question. A per-tenant constraint is the safe subset:
 * it can never reject a legitimate cross-tenant scenario, only an
 * accidental intra-tenant duplicate.
 *
 * SAFETY: partial UNIQUE index (isrc IS NOT NULL AND deleted_at IS NULL) —
 * NULL/blank ISRCs and soft-deleted rows never participate. Non-destructive:
 * no existing row is altered. If duplicate (tenant_id, isrc) pairs already
 * exist among active rows, index creation FAILS CLOSED at migration time
 * (deploy blocked, no data touched) rather than silently succeeding over
 * bad data — an operator must resolve the duplicates first. This migration
 * was written and registered but NOT executed against any real database in
 * this session (per this repo's migration-safety convention); running it
 * against production/staging requires the standard db:migrate authorization
 * flow, and a duplicate-check audit query first is recommended:
 *   SELECT tenant_id, isrc, COUNT(*) FROM works
 *    WHERE isrc IS NOT NULL AND deleted_at IS NULL
 *    GROUP BY tenant_id, isrc HAVING COUNT(*) > 1;
 *   (same query against "phonograms")
 */
export class PerTenantIsrcUniqueness20260911000003 implements MigrationInterface {
  name = 'PerTenantIsrcUniqueness20260911000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_works_tenant_isrc"
        ON "works" ("tenant_id", "isrc")
        WHERE "isrc" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_phonograms_tenant_isrc"
        ON "phonograms" ("tenant_id", "isrc")
        WHERE "isrc" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_phonograms_tenant_isrc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_works_tenant_isrc"`);
  }
}
