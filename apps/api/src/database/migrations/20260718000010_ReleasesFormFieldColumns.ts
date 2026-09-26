import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync: Releases (releases).
 *
 * PRODUCT RULE (2026-07-12): each form field has ITS OWN physical
 * column with the EXACT name of the key sent by the form. `releases` was left
 * out of the original rollout (2026-07-12) — the frontend read mapper
 * (entity-to-form.mapper.ts) already reads these fields as top-level columns
 * (l?.genero, l?.copyright, l?.isrc_global, etc.) with a fallback to
 * `metadata`, but the write mapper (form-to-payload.mapper.ts) still
 * wrote everything inside `metadata` because no dedicated DTO/column existed.
 * This migration closes that gap.
 *
 * `assets` and `cronograma` stay dedicated (not generic) jsonb: each one
 * has a fixed, known set of subkeys (7 and 3, respectively),
 * already used today as `metadata.assets` / `metadata.cronograma` — it is not
 * dynamic/unpredictable data, it is a structured sub-record with its own name,
 * following the same pattern as `plataformas` (jsonb already existing on this entity).
 */
export class ReleasesFormFieldColumns20260718000010 implements MigrationInterface {
  name = 'ReleasesFormFieldColumns20260718000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "releases"
        ADD COLUMN IF NOT EXISTS "isrc_global" varchar(50),
        ADD COLUMN IF NOT EXISTS "notas_internas" text,
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "gravadora" varchar(255),
        ADD COLUMN IF NOT EXISTS "copyright" varchar(255),
        ADD COLUMN IF NOT EXISTS "genero" varchar(100),
        ADD COLUMN IF NOT EXISTS "idioma" varchar(50),
        ADD COLUMN IF NOT EXISTS "assets" jsonb,
        ADD COLUMN IF NOT EXISTS "cronograma" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "releases"
        DROP COLUMN IF EXISTS "isrc_global",
        DROP COLUMN IF EXISTS "notas_internas",
        DROP COLUMN IF EXISTS "observacoes",
        DROP COLUMN IF EXISTS "gravadora",
        DROP COLUMN IF EXISTS "copyright",
        DROP COLUMN IF EXISTS "genero",
        DROP COLUMN IF EXISTS "idioma",
        DROP COLUMN IF EXISTS "assets",
        DROP COLUMN IF EXISTS "cronograma"
    `);
  }
}
