import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync (Catalog: Works and Phonograms).
 *
 * PRODUCT RULE (2026-07-12): each form field has ITS OWN physical
 * column with the EXACT name of the key sent by the form (formToObraPayload /
 * FonogramaFormModal's buildPayload). Composite fields of the form itself
 * (participantes, ia_*, participacao, arquivo_audio) are jsonb — one per column.
 *
 * `works.compositores` was text; the form sends string[] (derived from
 * participantes) — converted to jsonb preserving legacy values.
 */
export class CatalogFormFieldColumns20260712000002 implements MigrationInterface {
  name = 'CatalogFormFieldColumns20260712000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Obras ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "works"
        ADD COLUMN IF NOT EXISTS "idioma" varchar(20),
        ADD COLUMN IF NOT EXISTS "instrumental" varchar(10),
        ADD COLUMN IF NOT EXISTS "criada_por_ia" boolean,
        ADD COLUMN IF NOT EXISTS "tipo_ia" varchar(50),
        ADD COLUMN IF NOT EXISTS "ia_harmonia" jsonb,
        ADD COLUMN IF NOT EXISTS "ia_melodia" jsonb,
        ADD COLUMN IF NOT EXISTS "ia_letra" jsonb,
        ADD COLUMN IF NOT EXISTS "outros_titulos" jsonb,
        ADD COLUMN IF NOT EXISTS "referencias_conexas" jsonb,
        ADD COLUMN IF NOT EXISTS "letra_completa" text,
        ADD COLUMN IF NOT EXISTS "participantes" jsonb,
        ADD COLUMN IF NOT EXISTS "letristas" jsonb,
        ADD COLUMN IF NOT EXISTS "projeto_id" uuid,
        ADD COLUMN IF NOT EXISTS "tipo_obra" varchar(50)
    `);
    // compositores text → jsonb (a string becomes a one-item array; 'A, B' becomes ["A","B"])
    await queryRunner.query(`
      ALTER TABLE "works"
        ALTER COLUMN "compositores" TYPE jsonb
        USING CASE
          WHEN "compositores" IS NULL OR btrim("compositores") = '' THEN NULL
          WHEN left(btrim("compositores"), 1) = '[' THEN "compositores"::jsonb
          ELSE to_jsonb(string_to_array("compositores", ', '))
        END
    `);

    // ── Fonogramas ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "phonograms"
        ADD COLUMN IF NOT EXISTS "agregadora" varchar(100),
        ADD COLUMN IF NOT EXISTS "isrc_pais" varchar(5),
        ADD COLUMN IF NOT EXISTS "isrc_registrante" varchar(10),
        ADD COLUMN IF NOT EXISTS "isrc_ano" varchar(4),
        ADD COLUMN IF NOT EXISTS "isrc_designacao" varchar(10),
        ADD COLUMN IF NOT EXISTS "criada_por_ia" boolean,
        ADD COLUMN IF NOT EXISTS "instrumental" boolean,
        ADD COLUMN IF NOT EXISTS "nacional" boolean,
        ADD COLUMN IF NOT EXISTS "pub_simultanea" boolean,
        ADD COLUMN IF NOT EXISTS "emissao" date,
        ADD COLUMN IF NOT EXISTS "gravacao_original" date,
        ADD COLUMN IF NOT EXISTS "data_lancamento" date,
        ADD COLUMN IF NOT EXISTS "duracao_min" integer,
        ADD COLUMN IF NOT EXISTS "duracao_seg" integer,
        ADD COLUMN IF NOT EXISTS "midia" varchar(50),
        ADD COLUMN IF NOT EXISTS "classificacao" varchar(50),
        ADD COLUMN IF NOT EXISTS "pais_origem" varchar(100),
        ADD COLUMN IF NOT EXISTS "pais_publicacao" varchar(100),
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "participacao" jsonb,
        ADD COLUMN IF NOT EXISTS "arquivo_audio" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "phonograms"
        DROP COLUMN IF EXISTS "agregadora",
        DROP COLUMN IF EXISTS "isrc_pais",
        DROP COLUMN IF EXISTS "isrc_registrante",
        DROP COLUMN IF EXISTS "isrc_ano",
        DROP COLUMN IF EXISTS "isrc_designacao",
        DROP COLUMN IF EXISTS "criada_por_ia",
        DROP COLUMN IF EXISTS "instrumental",
        DROP COLUMN IF EXISTS "nacional",
        DROP COLUMN IF EXISTS "pub_simultanea",
        DROP COLUMN IF EXISTS "emissao",
        DROP COLUMN IF EXISTS "gravacao_original",
        DROP COLUMN IF EXISTS "data_lancamento",
        DROP COLUMN IF EXISTS "duracao_min",
        DROP COLUMN IF EXISTS "duracao_seg",
        DROP COLUMN IF EXISTS "midia",
        DROP COLUMN IF EXISTS "classificacao",
        DROP COLUMN IF EXISTS "pais_origem",
        DROP COLUMN IF EXISTS "pais_publicacao",
        DROP COLUMN IF EXISTS "observacoes",
        DROP COLUMN IF EXISTS "participacao",
        DROP COLUMN IF EXISTS "arquivo_audio"
    `);
    await queryRunner.query(`
      ALTER TABLE "works"
        ALTER COLUMN "compositores" TYPE text
        USING CASE
          WHEN "compositores" IS NULL THEN NULL
          ELSE array_to_string(ARRAY(SELECT jsonb_array_elements_text("compositores")), ', ')
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "works"
        DROP COLUMN IF EXISTS "idioma",
        DROP COLUMN IF EXISTS "instrumental",
        DROP COLUMN IF EXISTS "criada_por_ia",
        DROP COLUMN IF EXISTS "tipo_ia",
        DROP COLUMN IF EXISTS "ia_harmonia",
        DROP COLUMN IF EXISTS "ia_melodia",
        DROP COLUMN IF EXISTS "ia_letra",
        DROP COLUMN IF EXISTS "outros_titulos",
        DROP COLUMN IF EXISTS "referencias_conexas",
        DROP COLUMN IF EXISTS "letra_completa",
        DROP COLUMN IF EXISTS "participantes",
        DROP COLUMN IF EXISTS "letristas",
        DROP COLUMN IF EXISTS "projeto_id",
        DROP COLUMN IF EXISTS "tipo_obra"
    `);
  }
}
