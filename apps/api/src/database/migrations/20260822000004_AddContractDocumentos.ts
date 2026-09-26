import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260822000004_AddContractDocumentos
 *
 * REM-01/REM-02 (Remaining Product Completion Backlog) — "Documentos Anexos"
 * in ContratoFormModal did a real upload to R2 (via FileUpload/useUploadToR2,
 * already existing), but the resulting array was never included in the saved payload —
 * a false success: the upload worked, but the reference never survived a
 * reload. Adds `documentos` as a dedicated jsonb column in `contracts`,
 * following the same pattern already used by `versoes`/`signers` in the same table
 * (1 jsonb array per structured field — does not reuse the `metadata` column).
 *
 * ADDITIVE and NON-DESTRUCTIVE: only ADD COLUMN with a DEFAULT, IF NOT EXISTS.
 */
export class AddContractDocumentos20260822000004 implements MigrationInterface {
  name = 'AddContractDocumentos20260822000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "documentos" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN IF EXISTS "documentos"`);
  }
}
