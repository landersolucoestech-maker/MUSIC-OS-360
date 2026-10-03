import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { archiveTableOf } from './legacy-column-drop.base';
import { PLANS as EMPLOYEES_PII } from './20260930000053_DropEmployeesLegacyPiiColumns';
import { ARTISTS_ARCHIVE, CLIENTS_ARCHIVE } from './20261002000002_EncryptArtistsAndClientsPiiInPlace';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1 D3). Retires the *_legacy_archive_20260930 tables written by the legacy
 * column drop drafts (20260930000040-45, 49, 53) and the PII backfill archives (20261002000002). Retention rule and per-tenant erasure SQL:
 * docs/engineering/backfill-side-tables-retention.md; order and gates: docs/engineering/legacy-column-drop-plan.md.
 *
 * The archives hold the only copy of the dropped legacy values (some third-party PII), so they are retired only
 * after the rollback window is over and the restore of the drops is no longer needed in any environment. This
 * is a later, separate release from the drops. The migration is irreversible (down() refuses). Second lock:
 * up() and down() throw unless the operator exports LEGACY_ARCHIVE_RETIRE_CONFIRM=<CONFIRM_TOKEN> (distinct
 * from LEGACY_DROP_CONFIRM, so confirming a drop never confirms the retirement).
 *
 * ORDERING: this draft also retires the PII backfill archives (artists_pii_archive_20261002 / clients_pii_archive_20261002),
 * so it must run AFTER the backfill draft 20261002000002. Its timestamp is earlier, so when it is registered it MUST be
 * re-timestamped after the backfill; run in timestamp order before the backfill it would be a no-op (DROP IF EXISTS) and the
 * plaintext PII archives created later would never be retired.
 */
export const CONFIRM_ENV = 'LEGACY_ARCHIVE_RETIRE_CONFIRM';
export const CONFIRM_TOKEN = 'retire-legacy-archives-window-over';

/** Tables that own an archive (one per DropTablePlan of the drop drafts). */
export const ARCHIVED_TABLES: readonly string[] = [
  'works', 'phonograms', 'transactions', 'clients', 'shares',
  'employees', 'payroll_entries', 'leave_requests', 'invoices',
];
/** Archive tables with an explicit name (draft 53: employees PII, kept apart from draft 45's employees archive). */
export const ARCHIVE_TABLES: readonly string[] = [
  ...ARCHIVED_TABLES.map(archiveTableOf),
  ...EMPLOYEES_PII.map((p) => p.archiveTable ?? archiveTableOf(p.table)),
  // Plaintext originals kept by the PII encryption backfill (20261002000002): retired on the same later release.
  ARTISTS_ARCHIVE,
  CLIENTS_ARCHIVE,
];

function assertConfirmed(migrationName: string): void {
  if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
    throw new Error(`${migrationName}: gated draft. Set ${CONFIRM_ENV} only after the rollback window of the legacy column drops is over and the gates of docs/engineering/legacy-column-drop-plan.md are evidenced.`);
  }
}

export class RetireLegacyColumnDropArchives20260930000052 implements MigrationInterface {
  name = 'RetireLegacyColumnDropArchives20260930000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const table of ARCHIVE_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    throw new Error(`${this.name}: irreversible. The archives were retired on purpose; restore from a backup if ever needed.`);
  }
}
