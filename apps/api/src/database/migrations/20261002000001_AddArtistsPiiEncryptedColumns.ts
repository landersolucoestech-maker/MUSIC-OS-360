import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20261002000001_AddArtistsPiiEncryptedColumns (BLK-CRM-PII-PLAINTEXT, expand phase)
 *
 * Adds the ciphertext columns for the artist personal/bank data that CZ-042 left in plaintext columns
 * (birth_date, rg, address, bank_name, bank_branch, bank_account, pix_key, account_holder). Values are
 * AES-256-GCM field-level ciphertext written by the API (EncryptionService, 'enc:v1:' prefix); the database never
 * sees the key.
 *
 * ADDITIVE ONLY: nullable text columns, no default, no index, no data copied or rewritten, plaintext columns
 * untouched (dual-read window). The API releases that write these columns require this migration first
 * (migrations -> API release). The backfill + scrub of the existing rows is NOT here: it is the gated draft
 * migration-drafts/20261002000002_EncryptArtistsAndClientsPiiBackfill.ts (backfill) and 20261002000003_ScrubArtistsAndClientsPlaintext.ts (scrub)
 * (docs/engineering/data-governance-pii-backfill.md).
 *
 * down(): refuses while any ciphertext exists in these columns (dropping them would destroy the only copy of
 * values written after up()); otherwise drops the empty columns.
 */
export const ARTISTS_PII_ENCRYPTED_COLUMNS = [
  'birth_date_encrypted',
  'rg_encrypted',
  'address_encrypted',
  'bank_name_encrypted',
  'bank_branch_encrypted',
  'bank_account_encrypted',
  'pix_key_encrypted',
  'account_holder_encrypted',
] as const;

export class AddArtistsPiiEncryptedColumns20261002000001 implements MigrationInterface {
  name = 'AddArtistsPiiEncryptedColumns20261002000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "artists" ${ARTISTS_PII_ENCRYPTED_COLUMNS.map((c) => `ADD COLUMN IF NOT EXISTS "${c}" text`).join(', ')}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const present: Array<{ column_name: string }> = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = ANY($1::text[])`,
      [[...ARTISTS_PII_ENCRYPTED_COLUMNS]],
    );
    if (present.length === 0) return;
    const anyValue = present.map((c) => `"${c.column_name}" IS NOT NULL`).join(' OR ');
    const rows: Array<{ n: number }> = await queryRunner.query(`SELECT count(*)::int AS n FROM "artists" WHERE ${anyValue}`);
    if ((rows[0]?.n ?? 0) > 0) {
      throw new Error(
        `${this.name}: refusing down(), ${rows[0].n} artist row(s) hold ciphertext in these columns (the only copy of values written after up()). Nothing was changed.`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "artists" ${present.map((c) => `DROP COLUMN IF EXISTS "${c.column_name}"`).join(', ')}`,
    );
  }
}
