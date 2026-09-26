import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync: Audiovisual Productions (audiovisual_projects).
 *
 * CRITICAL finding confirmed (2026-07-18 audit): the real, active form
 * (AudiovisualProjectFormModal.tsx) sends, without ANY intermediate mapper
 * (audiovisual.service.ts calls `api.post`/`api.patch` with the raw payload),
 * fields that CreateAudiovisualProjectDto/UpdateAudiovisualProjectDto did not
 * declare. With the global ValidationPipe (whitelist + forbidNonWhitelisted),
 * EVERY audiovisual production create/edit returned 400 — a real bug, not a
 * hypothetical one. This migration creates the missing columns.
 *
 * Two name divergences were resolved WITHOUT creating a new column, because the
 * evidence proves they are already the same concept as an existing column:
 *   - `music_id` (form) → the UI already reads/writes through the existing FK
 *     `phonogram_id`; the form was fixed to use the real name
 *     (no new column).
 *   - `budget`/`real_cost` (form) → every place in the frontend that displays these
 *     values uses the labels "Orçamento Previsto"/"Custo Real", and the dashboard
 *     (`projects.service.ts::dashboard`) already sums `budget_estimated`/
 *     `budget_actual` of this same table — had the form kept writing into
 *     new columns, the financial dashboard would silently show zero.
 *     Form fixed to use the real names (no new column).
 *
 * `shooting_date` is added as a NEW column (not a rename of
 * `recording_date`): every frontend read point already does
 * `project.shooting_date ?? project.recording_date` — i.e. the product already
 * treats `shooting_date` as the new canonical name and `recording_date` as the
 * legacy fallback, with no need for a backend dual-write (the frontend already
 * does the fallback on read).
 *
 * `release_date` is kept as a new column DISTINCT from `publish_date`
 * (which is still written automatically by the status transition to
 * "published" in `transitionStatus()`) — there is no evidence that they are the
 * same concept; `release_date` is the planned date, `publish_date` is the actual
 * publication date.
 */
export class AudiovisualProjectsFormFieldColumns20260718000012 implements MigrationInterface {
  name = 'AudiovisualProjectsFormFieldColumns20260718000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audiovisual_projects"
        ADD COLUMN IF NOT EXISTS "music_title" varchar(500),
        ADD COLUMN IF NOT EXISTS "artist_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "format" varchar(20),
        ADD COLUMN IF NOT EXISTS "videomaker" varchar(255),
        ADD COLUMN IF NOT EXISTS "editor" varchar(255),
        ADD COLUMN IF NOT EXISTS "shooting_date" date,
        ADD COLUMN IF NOT EXISTS "location" varchar(255),
        ADD COLUMN IF NOT EXISTS "capture_status" varchar(30),
        ADD COLUMN IF NOT EXISTS "editing_status" varchar(30),
        ADD COLUMN IF NOT EXISTS "approval_status" varchar(30),
        ADD COLUMN IF NOT EXISTS "pre_release_date" date,
        ADD COLUMN IF NOT EXISTS "release_date" date,
        ADD COLUMN IF NOT EXISTS "concept" text,
        ADD COLUMN IF NOT EXISTS "observations" text,
        ADD COLUMN IF NOT EXISTS "final_status" varchar(30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audiovisual_projects"
        DROP COLUMN IF EXISTS "music_title",
        DROP COLUMN IF EXISTS "artist_name",
        DROP COLUMN IF EXISTS "format",
        DROP COLUMN IF EXISTS "videomaker",
        DROP COLUMN IF EXISTS "editor",
        DROP COLUMN IF EXISTS "shooting_date",
        DROP COLUMN IF EXISTS "location",
        DROP COLUMN IF EXISTS "capture_status",
        DROP COLUMN IF EXISTS "editing_status",
        DROP COLUMN IF EXISTS "approval_status",
        DROP COLUMN IF EXISTS "pre_release_date",
        DROP COLUMN IF EXISTS "release_date",
        DROP COLUMN IF EXISTS "concept",
        DROP COLUMN IF EXISTS "observations",
        DROP COLUMN IF EXISTS "final_status"
    `);
  }
}
