import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000003_CanonicalizeContentDetectionsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the last
 * Portuguese technical names on `content_detections`.
 *
 * Columns:
 *   plataforma       -> platform
 *   titulo_detectado -> detected_title
 *   detectado_em     -> detected_at
 *
 * Persisted technical value (its PT-BR label lives in the web UI):
 *   type: uso_nao_autorizado -> unauthorized_use   (column default too)
 *
 * No index, constraint, view, function or policy references the renamed
 * columns (checked against a freshly migrated catalog). RENAME COLUMN is
 * metadata-only; the UPDATE touches only rows still holding the legacy value.
 * Every step is guarded, so the migration is idempotent, and down() restores
 * the previous names, value and default.
 */
const COLUMNS: ReadonlyArray<[string, string]> = [
  ['plataforma', 'platform'],
  ['titulo_detectado', 'detected_title'],
  ['detectado_em', 'detected_at'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'content_detections' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'content_detections' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "content_detections" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class CanonicalizeContentDetectionsToEnglish20260928000003 implements MigrationInterface {
  name = 'CanonicalizeContentDetectionsToEnglish20260928000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(`UPDATE "content_detections" SET "type" = 'unauthorized_use' WHERE "type" = 'uso_nao_autorizado';`);
    await queryRunner.query(`ALTER TABLE "content_detections" ALTER COLUMN "type" SET DEFAULT 'unauthorized_use';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_detections" ALTER COLUMN "type" SET DEFAULT 'uso_nao_autorizado';`);
    await queryRunner.query(`UPDATE "content_detections" SET "type" = 'uso_nao_autorizado' WHERE "type" = 'unauthorized_use';`);
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
