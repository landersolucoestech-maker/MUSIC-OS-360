import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync (Artists module).
 *
 * PRODUCT RULE: each artist form field has ITS OWN physical column,
 * with the EXACT name of the key sent by the form (formValuesToArtistaPayload).
 * No aggregating fields into the jsonb `metadata`.
 *
 * Composite fields (arrays/objects of the form itself — relationships,
 * distributors, linked contacts) are jsonb, but each in ITS OWN column.
 * PII (email/telefone/cpf_cnpj/manager_contato) stays in the already existing
 * encrypted columns (*_encrypted) — one column per field.
 */
export class ArtistsFormFieldColumns20260712000001 implements MigrationInterface {
  name = 'ArtistsFormFieldColumns20260712000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artists"
        ADD COLUMN IF NOT EXISTS "slug_artistico" varchar(160),
        ADD COLUMN IF NOT EXISTS "tags_musicais" jsonb,
        ADD COLUMN IF NOT EXISTS "fase_carreira" varchar(60),
        ADD COLUMN IF NOT EXISTS "data_nascimento" date,
        ADD COLUMN IF NOT EXISTS "rg" varchar(30),
        ADD COLUMN IF NOT EXISTS "genero" varchar(30),
        ADD COLUMN IF NOT EXISTS "endereco" varchar(300),
        ADD COLUMN IF NOT EXISTS "banco" varchar(100),
        ADD COLUMN IF NOT EXISTS "agencia" varchar(30),
        ADD COLUMN IF NOT EXISTS "conta" varchar(40),
        ADD COLUMN IF NOT EXISTS "chave_pix" varchar(150),
        ADD COLUMN IF NOT EXISTS "titular_conta" varchar(150),
        ADD COLUMN IF NOT EXISTS "instagram" text,
        ADD COLUMN IF NOT EXISTS "tiktok" text,
        ADD COLUMN IF NOT EXISTS "spotify_ouvintes" integer,
        ADD COLUMN IF NOT EXISTS "youtube_inscritos" integer,
        ADD COLUMN IF NOT EXISTS "deezer_fas" integer,
        ADD COLUMN IF NOT EXISTS "apple_music_albuns" integer,
        ADD COLUMN IF NOT EXISTS "soundcloud_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "instagram_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "tiktok_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "relacionamentos" jsonb,
        ADD COLUMN IF NOT EXISTS "tipo_perfil" varchar(30),
        ADD COLUMN IF NOT EXISTS "empresario_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "empresario_nome" varchar(150),
        ADD COLUMN IF NOT EXISTS "empresario_telefone" varchar(30),
        ADD COLUMN IF NOT EXISTS "empresario_email" varchar(150),
        ADD COLUMN IF NOT EXISTS "gravadora_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "gravadora_nome" varchar(150),
        ADD COLUMN IF NOT EXISTS "gravadora_telefone" varchar(30),
        ADD COLUMN IF NOT EXISTS "gravadora_email" varchar(150),
        ADD COLUMN IF NOT EXISTS "gravadora_responsavel_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "gravadora_responsavel_nome" varchar(150),
        ADD COLUMN IF NOT EXISTS "gravadora_responsavel_telefone" varchar(30),
        ADD COLUMN IF NOT EXISTS "gravadora_responsavel_email" varchar(150),
        ADD COLUMN IF NOT EXISTS "distribuidoras_selecionadas" jsonb,
        ADD COLUMN IF NOT EXISTS "distribuidoras_emails" jsonb,
        ADD COLUMN IF NOT EXISTS "distribuidoras_empresa_selecionadas" jsonb,
        ADD COLUMN IF NOT EXISTS "distribuidoras_empresa_emails" jsonb,
        ADD COLUMN IF NOT EXISTS "distribuidoras_gerais" jsonb,
        ADD COLUMN IF NOT EXISTS "contatos_vinculados" jsonb,
        ADD COLUMN IF NOT EXISTS "contatos_equipe" jsonb,
        ADD COLUMN IF NOT EXISTS "notas_internas" text,
        ADD COLUMN IF NOT EXISTS "documentos_pessoais_url" text,
        ADD COLUMN IF NOT EXISTS "presskit_url" text
    `);

    // Legacy data: old rows kept these fields inside metadata.
    // Migrates each key to its column (once), without deleting the original metadata.
    await queryRunner.query(`
      UPDATE "artists" SET
        "slug_artistico" = COALESCE("slug_artistico", metadata->>'slug_artistico'),
        "tags_musicais" = COALESCE("tags_musicais", metadata->'tags_musicais'),
        "fase_carreira" = COALESCE("fase_carreira", metadata->>'fase_carreira'),
        "data_nascimento" = COALESCE("data_nascimento", NULLIF(metadata->>'data_nascimento','')::date),
        "rg" = COALESCE("rg", metadata->>'rg'),
        "genero" = COALESCE("genero", metadata->>'genero'),
        "endereco" = COALESCE("endereco", metadata->>'endereco'),
        "banco" = COALESCE("banco", metadata->>'banco'),
        "agencia" = COALESCE("agencia", metadata->>'agencia'),
        "conta" = COALESCE("conta", metadata->>'conta'),
        "chave_pix" = COALESCE("chave_pix", metadata->>'chave_pix'),
        "titular_conta" = COALESCE("titular_conta", metadata->>'titular_conta'),
        "instagram" = COALESCE("instagram", metadata->>'instagram_url'),
        "tiktok" = COALESCE("tiktok", metadata->>'tiktok_url'),
        "spotify_ouvintes" = COALESCE("spotify_ouvintes", NULLIF(metadata->>'spotify_ouvintes','')::integer),
        "youtube_inscritos" = COALESCE("youtube_inscritos", NULLIF(metadata->>'youtube_inscritos','')::integer),
        "deezer_fas" = COALESCE("deezer_fas", NULLIF(metadata->>'deezer_fas','')::integer),
        "apple_music_albuns" = COALESCE("apple_music_albuns", NULLIF(metadata->>'apple_music_albuns_url','')::integer),
        "soundcloud_seguidores" = COALESCE("soundcloud_seguidores", NULLIF(metadata->>'soundcloud_seguidores_url','')::integer),
        "instagram_seguidores" = COALESCE("instagram_seguidores", NULLIF(metadata->>'instagram_seguidores','')::integer),
        "tiktok_seguidores" = COALESCE("tiktok_seguidores", NULLIF(metadata->>'tiktok_seguidores','')::integer),
        "relacionamentos" = COALESCE("relacionamentos", metadata->'relacionamentos'),
        "tipo_perfil" = COALESCE("tipo_perfil", metadata->>'tipo_perfil'),
        "empresario_id" = COALESCE("empresario_id", metadata->>'empresario_id'),
        "empresario_nome" = COALESCE("empresario_nome", metadata->>'empresario_nome'),
        "empresario_telefone" = COALESCE("empresario_telefone", metadata->>'empresario_telefone'),
        "empresario_email" = COALESCE("empresario_email", metadata->>'empresario_email'),
        "gravadora_id" = COALESCE("gravadora_id", metadata->>'gravadora_id'),
        "gravadora_nome" = COALESCE("gravadora_nome", metadata->>'gravadora_nome'),
        "gravadora_telefone" = COALESCE("gravadora_telefone", metadata->>'gravadora_telefone'),
        "gravadora_email" = COALESCE("gravadora_email", metadata->>'gravadora_email'),
        "gravadora_responsavel_id" = COALESCE("gravadora_responsavel_id", metadata->>'gravadora_responsavel_id'),
        "gravadora_responsavel_nome" = COALESCE("gravadora_responsavel_nome", metadata->>'gravadora_responsavel_nome'),
        "gravadora_responsavel_telefone" = COALESCE("gravadora_responsavel_telefone", metadata->>'gravadora_responsavel_telefone'),
        "gravadora_responsavel_email" = COALESCE("gravadora_responsavel_email", metadata->>'gravadora_responsavel_email'),
        "distribuidoras_selecionadas" = COALESCE("distribuidoras_selecionadas", metadata->'distribuidoras_selecionadas'),
        "distribuidoras_emails" = COALESCE("distribuidoras_emails", metadata->'distribuidoras_emails'),
        "distribuidoras_empresa_selecionadas" = COALESCE("distribuidoras_empresa_selecionadas", metadata->'distribuidoras_empresa_selecionadas'),
        "distribuidoras_empresa_emails" = COALESCE("distribuidoras_empresa_emails", metadata->'distribuidoras_empresa_emails'),
        "distribuidoras_gerais" = COALESCE("distribuidoras_gerais", metadata->'distribuidoras_gerais'),
        "contatos_vinculados" = COALESCE("contatos_vinculados", metadata->'contatos_vinculados'),
        "contatos_equipe" = COALESCE("contatos_equipe", metadata->'contatos_equipe'),
        "notas_internas" = COALESCE("notas_internas", metadata->>'notas_internas'),
        "documentos_pessoais_url" = COALESCE("documentos_pessoais_url", metadata->>'documentos_pessoais_url'),
        "presskit_url" = COALESCE("presskit_url", metadata->>'presskit_url')
      WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artists"
        DROP COLUMN IF EXISTS "slug_artistico",
        DROP COLUMN IF EXISTS "tags_musicais",
        DROP COLUMN IF EXISTS "fase_carreira",
        DROP COLUMN IF EXISTS "data_nascimento",
        DROP COLUMN IF EXISTS "rg",
        DROP COLUMN IF EXISTS "genero",
        DROP COLUMN IF EXISTS "endereco",
        DROP COLUMN IF EXISTS "banco",
        DROP COLUMN IF EXISTS "agencia",
        DROP COLUMN IF EXISTS "conta",
        DROP COLUMN IF EXISTS "chave_pix",
        DROP COLUMN IF EXISTS "titular_conta",
        DROP COLUMN IF EXISTS "instagram",
        DROP COLUMN IF EXISTS "tiktok",
        DROP COLUMN IF EXISTS "spotify_ouvintes",
        DROP COLUMN IF EXISTS "youtube_inscritos",
        DROP COLUMN IF EXISTS "deezer_fas",
        DROP COLUMN IF EXISTS "apple_music_albuns",
        DROP COLUMN IF EXISTS "soundcloud_seguidores",
        DROP COLUMN IF EXISTS "instagram_seguidores",
        DROP COLUMN IF EXISTS "tiktok_seguidores",
        DROP COLUMN IF EXISTS "relacionamentos",
        DROP COLUMN IF EXISTS "tipo_perfil",
        DROP COLUMN IF EXISTS "empresario_id",
        DROP COLUMN IF EXISTS "empresario_nome",
        DROP COLUMN IF EXISTS "empresario_telefone",
        DROP COLUMN IF EXISTS "empresario_email",
        DROP COLUMN IF EXISTS "gravadora_id",
        DROP COLUMN IF EXISTS "gravadora_nome",
        DROP COLUMN IF EXISTS "gravadora_telefone",
        DROP COLUMN IF EXISTS "gravadora_email",
        DROP COLUMN IF EXISTS "gravadora_responsavel_id",
        DROP COLUMN IF EXISTS "gravadora_responsavel_nome",
        DROP COLUMN IF EXISTS "gravadora_responsavel_telefone",
        DROP COLUMN IF EXISTS "gravadora_responsavel_email",
        DROP COLUMN IF EXISTS "distribuidoras_selecionadas",
        DROP COLUMN IF EXISTS "distribuidoras_emails",
        DROP COLUMN IF EXISTS "distribuidoras_empresa_selecionadas",
        DROP COLUMN IF EXISTS "distribuidoras_empresa_emails",
        DROP COLUMN IF EXISTS "distribuidoras_gerais",
        DROP COLUMN IF EXISTS "contatos_vinculados",
        DROP COLUMN IF EXISTS "contatos_equipe",
        DROP COLUMN IF EXISTS "notas_internas",
        DROP COLUMN IF EXISTS "documentos_pessoais_url",
        DROP COLUMN IF EXISTS "presskit_url"
    `);
  }
}
