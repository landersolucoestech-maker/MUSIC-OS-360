import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * DRAFT, GATED, NOT REGISTERED (SEC3 F-MG1). Purges the side tables of the 20260930 vocabulary backfills.
 * Retention rule, inventory and per-tenant erasure SQL: docs/engineering/backfill-side-tables-retention.md.
 *
 * Those tables keep the full BEFORE/AFTER jsonb of every rewritten row (third-party PII in artists, release
 * credits/lyrics, ...) with a tenant_id but no foreign key, so tenant deletion never reaches them. Once the
 * rollback window is over and the residue pre-flight is 0 in every environment, they are dropped. There is NO
 * archive: purging is the point. The migration is irreversible (down() refuses).
 *
 * Not part of ALL_MIGRATIONS (migrations/index.ts); nothing imports it except its own spec. Registering it is
 * a release decision. Second lock: up() and down() throw unless the operator exports
 * BACKFILL_PURGE_CONFIRM=<CONFIRM_TOKEN>.
 */
export const CONFIRM_ENV = 'BACKFILL_PURGE_CONFIRM';
export const CONFIRM_TOKEN = 'purge-backfill-side-tables-window-over';

/** Every side table created by the 20260930 backfills (migration number in the comment). */
export const SIDE_TABLES: readonly string[] = [
  'contract_service_types_taxonomy_backup_20260930', // 20260930000002
  'external_rights_receipts_backfill_20260930', // 20260930000017
  'transaction_taxonomy_backfill_20260930', // 20260930000018
  'release_metadata_backfill_20260930', // 20260930000019
  'invoices_service_amount_backfill_20260930', // 20260930000022
  'takedowns_infringing_url_backfill_20260930', // 20260930000022
  'contracts_last_payment_backfill_20260930', // 20260930000023
  'plan_features_backfill_20260930', // 20260930000024
  'assets_asset_type_backfill_20260930', // 20260930000025
  'marketing_vocabulary_backfill_20260930', // 20260930000026
  'artist_distributor_id_backfill_20260930', // 20260930000027
];

function assertConfirmed(migrationName: string): void {
  if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
    throw new Error(`${migrationName}: gated draft. Set ${CONFIRM_ENV} only after the rollback window is over and the gates of docs/engineering/backfill-side-tables-retention.md are evidenced.`);
  }
}

export class PurgeBackfillSideTables20260930000050 implements MigrationInterface {
  name = 'PurgeBackfillSideTables20260930000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const table of SIDE_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    throw new Error(`${this.name}: irreversible. The side tables were purged on purpose (no archive); restore from a backup if ever needed.`);
  }
}
