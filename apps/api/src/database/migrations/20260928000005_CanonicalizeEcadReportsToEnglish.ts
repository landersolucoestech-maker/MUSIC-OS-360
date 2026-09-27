import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000005_CanonicalizeEcadReportsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the last
 * Portuguese technical names on `ecad_reports`.
 *
 * Columns:  periodo -> period, arquivo_url -> file_url
 * Index:    idx_ecad_reports_periodo -> idx_ecad_reports_period
 * Persisted status (EcadReportStatus; PT-BR labels in packages/types):
 *           pendente -> pending, importado -> imported, concluido -> completed,
 *           erro -> error   (column default 'pendente' -> 'pending')
 *
 * No constraint, view, function or policy references the renamed columns
 * (checked against a freshly migrated catalog). RENAME is metadata-only; the
 * UPDATE touches only rows holding a legacy status. Every step is guarded, so
 * the migration is idempotent, and down() restores names, values and default.
 */
const COLUMNS: ReadonlyArray<[string, string]> = [
  ['periodo', 'period'],
  ['arquivo_url', 'file_url'],
];

const STATUSES: ReadonlyArray<[string, string]> = [
  ['pendente', 'pending'],
  ['importado', 'imported'],
  ['concluido', 'completed'],
  ['erro', 'error'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ecad_reports' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ecad_reports' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "ecad_reports" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

function remapStatus(pairs: ReadonlyArray<[string, string]>): string {
  const cases = pairs.map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
  const sources = pairs.map(([from]) => `'${from}'`).join(', ');
  return `UPDATE "ecad_reports" SET "status" = CASE "status" ${cases} END WHERE "status" IN (${sources});`;
}

export class CanonicalizeEcadReportsToEnglish20260928000005 implements MigrationInterface {
  name = 'CanonicalizeEcadReportsToEnglish20260928000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(renameIndex('idx_ecad_reports_periodo', 'idx_ecad_reports_period'));
    await queryRunner.query(remapStatus(STATUSES));
    await queryRunner.query(`ALTER TABLE "ecad_reports" ALTER COLUMN "status" SET DEFAULT 'pending';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ecad_reports" ALTER COLUMN "status" SET DEFAULT 'pendente';`);
    await queryRunner.query(remapStatus(STATUSES.map(([a, b]) => [b, a])));
    await queryRunner.query(renameIndex('idx_ecad_reports_period', 'idx_ecad_reports_periodo'));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
