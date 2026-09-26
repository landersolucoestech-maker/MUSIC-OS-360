import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3V-A — Harmonizes the 21 legacy `tenant_isolation` policies that used
 * `tenant_id = current_setting('app.current_tenant_id', true)::uuid` WITHOUT an explicit
 * WITH CHECK (classified HIGH_RISK in PHASE 3U):
 *
 *   - the `::uuid` cast breaks when the custom GUC goes back to '' on a reused connection;
 *   - it ignores the JWT fallback of the portable pattern;
 *   - WITH CHECK only existed implicitly (= USING).
 *
 * Replaces them with the official pattern, functionally identical (same tenant_id),
 * but portable and null-safe, with an EXPLICIT WITH CHECK:
 *
 *   USING      (tenant_id = private_get_tenant_id())
 *   WITH CHECK (tenant_id = private_get_tenant_id())
 *
 * Does NOT change schema, data, enabled RLS nor FORCE. Does NOT touch other policies
 * (super_admin_full_access, org_isolation, roles_visibility) nor the 3V-B batches
 * (financial_*, marketing_projects/strategies/tasks…). Idempotent (DROP+CREATE)
 * and reversible (down recreates the original RAW ::uuid form, without WITH CHECK).
 */
export class HarmonizeRawUuidPolicies20260613000014 implements MigrationInterface {
  name = 'HarmonizeRawUuidPolicies20260613000014';

  private static readonly TABLES = [
    'conversations', 'conversation_messages', 'conversation_notes',
    'conversation_audit_events', 'conversation_auto_messages', 'conversation_business_hours',
    'conversation_channel_accounts', 'conversation_closures', 'conversation_protocol_settings',
    'conversation_queues', 'conversation_quick_replies', 'conversation_sectors',
    'conversation_service_statuses', 'conversation_sla_policies', 'conversation_tags',
    'conversation_transfers',
    'forms', 'form_submissions',
    'marketing_assets', 'marketing_asset_versions', 'marketing_asset_approvals',
  ] as const;
  private static readonly POLICY = 'tenant_isolation';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of HarmonizeRawUuidPolicies20260613000014.TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${HarmonizeRawUuidPolicies20260613000014.POLICY}" ON "${table}"`,
      );
      await queryRunner.query(
        `CREATE POLICY "${HarmonizeRawUuidPolicies20260613000014.POLICY}" ON "${table}" ` +
        `USING (tenant_id = private_get_tenant_id()) ` +
        `WITH CHECK (tenant_id = private_get_tenant_id())`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts to the original RAW ::uuid form (USING only, without WITH CHECK).
    for (const table of HarmonizeRawUuidPolicies20260613000014.TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${HarmonizeRawUuidPolicies20260613000014.POLICY}" ON "${table}"`,
      );
      await queryRunner.query(
        `CREATE POLICY "${HarmonizeRawUuidPolicies20260613000014.POLICY}" ON "${table}" ` +
        `USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)`,
      );
    }
  }
}
