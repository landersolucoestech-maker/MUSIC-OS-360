import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000024_RenameExternalSourceColumnsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for the
 * scaffolded external-catalog-sync columns of `works` and `phonograms`
 * (NC-043..NC-048): origem_externa -> external_source, origem_externa_id ->
 * external_source_id, origem_externa_sincronizado_em -> external_source_synced_at.
 *
 * Zero writers and zero populated rows were found (canonical map NC-043..048);
 * the only readers are the report contracts (read-only export fields), renamed
 * in the same change. Whether the columns are kept or dropped remains a product
 * decision (BLOCKED_PRODUCT_DECISION) — this rename is independent of it and
 * non-destructive. Guarded and reversible; a table holding both the legacy and
 * the canonical column raises (never a silent skip).
 */
const TABLES = ['works', 'phonograms'] as const;
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['origem_externa', 'external_source'],
  ['origem_externa_id', 'external_source_id'],
  ['origem_externa_sincronizado_em', 'external_source_synced_at'],
];

function renameColumn(table: string, from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${from}'
      ) THEN
        RAISE EXCEPTION '${table} has both "${from}" and "${to}": resolve manually before migrating';
      END IF;
    END $$;`;
}

export class RenameExternalSourceColumnsToEnglish20260928000024 implements MigrationInterface {
  name = 'RenameExternalSourceColumnsToEnglish20260928000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const table of TABLES) {
      for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(table, from, to));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const table of TABLES) {
      for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(table, to, from));
    }
  }
}
