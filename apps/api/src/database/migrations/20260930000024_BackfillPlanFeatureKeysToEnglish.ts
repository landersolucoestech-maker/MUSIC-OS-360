import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000024_BackfillPlanFeatureKeysToEnglish (PJ1)
 *
 * Platform-owned feature-flag jsonb key `moduleRh` -> `moduleHr`, in the two places the platform
 * persists it:
 *   - tenants.features        (written from PLAN_FEATURES at checkout, read by /auth/context -> web)
 *   - billing_plans.features  (migration 20260701000002 seeded OBJECTS carrying moduleRh; rows the admin
 *                              edited hold the `{labels, ...}` shape and are not candidates)
 * (Stripe metadata does not carry feature keys -- checkout metadata is {tenant_id, org_id, plan, ...}.)
 * The RBAC module key `rh` and role slug `rh_manager` are the RBAC slice's.
 *
 * Expand/contract, backfill step (code that ships with it writes moduleHr and keeps reading
 * moduleRh: common/compat/plan-features.ts, web feature-flags). Same rules as 20260930000019 (see
 * jsonb-row-backfill.ts): only rows holding a `moduleRh` key and a jsonb OBJECT are candidates, exact
 * key match, other keys preserved, canonical wins when both exist (conflict counted), `updated_at`
 * untouched, guarded UPDATE, BEFORE/AFTER kept in the locked-down side table
 * `plan_features_backfill_20260930` (kept by down()), counts-only logs. billing_plans is global (no
 * tenant): its side-table rows use the nil tenant id.
 * down(): restores BEFORE only for rows still holding AFTER.
 */
const MIGRATION = 'BackfillPlanFeatureKeysToEnglish20260930000024';
const LOG_TABLE = 'plan_features_backfill_20260930';
const LEGACY = 'moduleRh';
const CANONICAL = 'moduleHr';
const NIL_UUID = `'00000000-0000-0000-0000-000000000000'::uuid`;

/** Exported for the unit spec only. */
export function canonicalFeaturesForBackfill(features: unknown): { value: unknown; changed: boolean; conflicts: number } {
  if (features === null || typeof features !== 'object' || Array.isArray(features)) return { value: features, changed: false, conflicts: 0 };
  const source = features as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(source, LEGACY)) return { value: features, changed: false, conflicts: 0 };
  const out: Record<string, unknown> = {};
  let conflicts = 0;
  for (const [key, value] of Object.entries(source)) {
    if (key === '__proto__') continue;
    if (key !== LEGACY) {
      out[key] = value;
    } else if (Object.prototype.hasOwnProperty.call(source, CANONICAL)) {
      conflicts += 1;
    } else {
      out[CANONICAL] = value;
    }
  }
  return { value: out, changed: true, conflicts };
}

const specFor = (table: 'tenants' | 'billing_plans', tenantIdSql: string): RowBackfillSpec => ({
  migration: MIGRATION,
  table,
  logTable: LOG_TABLE,
  tenantIdSql,
  columns: ['features'],
  jsonbColumns: ['features'],
  candidatePredicate: `jsonb_typeof("features") = 'object' AND "features" ? '${LEGACY}'`,
  transform(row) {
    const { value, changed, conflicts } = canonicalFeaturesForBackfill(row['features']);
    return changed ? { set: { features: value }, conflicts } : null;
  },
});

const SPECS = [specFor('tenants', '"id"'), specFor('billing_plans', NIL_UUID)];

export class BackfillPlanFeatureKeysToEnglish20260930000024 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    for (const spec of SPECS) await backfillRows(queryRunner, spec);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const spec of [...SPECS].reverse()) await restoreRows(queryRunner, spec);
  }
}
