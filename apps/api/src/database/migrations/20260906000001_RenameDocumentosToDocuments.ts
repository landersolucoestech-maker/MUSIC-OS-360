import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260906000001_RenameDocumentosToDocuments
 *
 * Naming-normalization mandate (Batch 5, fourth generic-noun sub-concept):
 * `documentos` (Portuguese) -> `documents` across 4 tables that each own
 * an independent attachments field (artists, contracts, shares,
 * employees) — not a shared FK, no cross-table relationship affected.
 * No dual PT/EN alias mechanism existed for this field on any of the 4
 * tables (unlike title/type/start_date/end_date on contracts) — a plain
 * 1:1 rename.
 *
 * Discovery for this sub-concept found the same UI-text-corruption risk
 * already known from `tipo`: "documentos" is a common Portuguese noun
 * that appears in ordinary lowercase prose ("Envie documentos usando o
 * formulário...", "Gerencie contratos, documentos..."). The blind sed
 * corrupted ~15 real UI strings (labels, tab titles, Swagger
 * descriptions, an error message, a field-labels.pt-br.ts dictionary
 * VALUE) into broken PT/EN mixes; all found via the same sweep technique
 * used for `tipo` and fixed in place before this migration was written.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if a table doesn't have the column.
 */
export class RenameDocumentosToDocuments20260906000001 implements MigrationInterface {
  name = 'RenameDocumentosToDocuments20260906000001';

  private readonly tables = ['artists', 'contracts', 'shares', 'employees'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'documentos'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "documentos" TO "documents";
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'documents'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "documents" TO "documentos";
          END IF;
        END $$;
      `);
    }
  }
}
