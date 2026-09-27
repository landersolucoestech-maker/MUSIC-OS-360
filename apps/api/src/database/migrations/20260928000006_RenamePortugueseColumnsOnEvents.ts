import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000006_RenamePortugueseColumnsOnEvents
 *
 * Technical-language mandate (technical = English, UX = PT-BR): Portuguese
 * column names on `events`.
 *
 *   local            -> venue                (the DTO already called it venue)
 *   contato_local    -> venue_contact
 *   endereco         -> address
 *   publico_esperado -> expected_attendance
 *   participantes    -> participants
 *
 * `data` (event start) is not renamed here: it is the legacy half of the
 * data -> starts_at migration (C3, dual-written since E2) and is retired by
 * that plan, not by a rename.
 *
 * No index, constraint, view, function or policy references the renamed
 * columns (checked against a freshly migrated catalog). RENAME COLUMN is
 * metadata-only; every step is guarded, so the migration is idempotent, and
 * down() restores the previous names.
 */
const COLUMNS: ReadonlyArray<[string, string]> = [
  ['local', 'venue'],
  ['contato_local', 'venue_contact'],
  ['endereco', 'address'],
  ['publico_esperado', 'expected_attendance'],
  ['participantes', 'participants'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "events" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class RenamePortugueseColumnsOnEvents20260928000006 implements MigrationInterface {
  name = 'RenamePortugueseColumnsOnEvents20260928000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
