import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000009_CanonicalizeProjectTracksToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for the tracks
 * of a project (normalized in 20260718000013):
 *
 *   project_tracks.duracao_min -> duration_minutes, duracao_seg -> duration_seconds,
 *     idioma -> language, letra -> lyrics
 *   project_track_participants.role values: compositor -> composer,
 *     interprete -> performer, produtor -> producer (PT-BR labels live in the UI);
 *     the CHECK constraint is recreated with the canonical values.
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() restores the previous names, values and constraint.
 */
const COLUMNS: ReadonlyArray<[table: string, from: string, to: string]> = [
  ['project_tracks', 'duracao_min', 'duration_minutes'],
  ['project_tracks', 'duracao_seg', 'duration_seconds'],
  ['project_tracks', 'idioma', 'language'],
  ['project_tracks', 'letra', 'lyrics'],
];

const ROLES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['compositor', 'composer'],
  ['interprete', 'performer'],
  ['produtor', 'producer'],
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

async function replaceRoleConstraint(queryRunner: QueryRunner, values: string[]): Promise<void> {
  await queryRunner.query(
    `ALTER TABLE "project_track_participants" DROP CONSTRAINT IF EXISTS "chk_project_track_participants_role"`,
  );
  await queryRunner.query(
    `ALTER TABLE "project_track_participants" ADD CONSTRAINT "chk_project_track_participants_role"
       CHECK ("role" IN (${values.map((v) => `'${v}'`).join(', ')}))`,
  );
}

export class CanonicalizeProjectTracksToEnglish20260928000009 implements MigrationInterface {
  name = 'CanonicalizeProjectTracksToEnglish20260928000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of COLUMNS) await queryRunner.query(renameColumn(table, from, to));
    await queryRunner.query(
      `ALTER TABLE "project_track_participants" DROP CONSTRAINT IF EXISTS "chk_project_track_participants_role"`,
    );
    for (const [legacy, canonical] of ROLES) {
      await queryRunner.query(`UPDATE "project_track_participants" SET "role" = $1 WHERE "role" = $2`, [canonical, legacy]);
    }
    await replaceRoleConstraint(queryRunner, ROLES.map(([, canonical]) => canonical));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_track_participants" DROP CONSTRAINT IF EXISTS "chk_project_track_participants_role"`,
    );
    for (const [legacy, canonical] of ROLES) {
      await queryRunner.query(`UPDATE "project_track_participants" SET "role" = $1 WHERE "role" = $2`, [legacy, canonical]);
    }
    await replaceRoleConstraint(queryRunner, ROLES.map(([legacy]) => legacy));
    for (const [table, from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(table, to, from));
  }
}
