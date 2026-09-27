import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000002_RenamePortugueseColumnsOnBriefingsCampaignsProjects
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the last
 * Portuguese column names on four marketing/production tables.
 *
 *   briefings.prazo                  -> due_at        (the DTO already called it dueAt)
 *   campaigns.objetivo               -> objective
 *   campaigns.orcamento              -> budget        (the DTO already called it budget)
 *   projects.orcamento               -> budget
 *   audiovisual_projects.videomaker  -> videographer
 *
 * None of these columns holds an enumerated value, and no index, constraint,
 * view, function or policy references them (checked against a freshly migrated
 * catalog), so the change is RENAME COLUMN only: metadata-only, no table
 * rewrite. Each step is guarded, so the migration is idempotent, and down()
 * restores the previous names.
 */
const COLUMNS: ReadonlyArray<[table: string, from: string, to: string]> = [
  ['briefings', 'prazo', 'due_at'],
  ['campaigns', 'objetivo', 'objective'],
  ['campaigns', 'orcamento', 'budget'],
  ['projects', 'orcamento', 'budget'],
  ['audiovisual_projects', 'videomaker', 'videographer'],
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
      END IF;
    END $$;`;
}

export class RenamePortugueseColumnsOnBriefingsCampaignsProjects20260928000002 implements MigrationInterface {
  name = 'RenamePortugueseColumnsOnBriefingsCampaignsProjects20260928000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of COLUMNS) await queryRunner.query(renameColumn(table, from, to));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(table, to, from));
  }
}
