import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000022_CanonicalizeArtistsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `artists`
 * (CZ-042). Contract: every form field has its own physical column (product
 * rule of 20260712000001_ArtistsFormFieldColumns) — the API never switched and
 * kept writing `metadata`, so the columns went stale. This migration renames
 * the columns to English and makes them the single source of truth:
 *
 * 1. Renames (see COLUMNS): nome_artistico -> stage_name, nome_civil ->
 *    full_name, status_cadastro -> registration_status (+ constraint),
 *    telefone_encrypted -> phone_encrypted, foto_url -> photo_url, form columns
 *    (banco -> bank_name, empresario_* -> agent_*, gravadora_* ->
 *    record_label_*, distribuidoras_* -> *_distributors, ...). rg and
 *    cpf_cnpj_encrypted stay (legal-domain exceptions).
 * 2. Backfill metadata -> column for every column-backed form field: the
 *    metadata value (the live copy the API kept writing) wins when present;
 *    over-long text and invalid dates are skipped. metadata keeps the old keys
 *    as historical data (never read again).
 * 3. metadata-only fields get English keys (genero -> gender with values
 *    Masculino/Feminino -> male/female; platform metrics).
 * 4. Values: specialties, profile_type, relationships[].type; nested jsonb
 *    keys (nome/telefone/escritorio/responsaveis/distribuidoras/nomeCustom/
 *    categoria) in relationships, linked_contacts, team_contacts,
 *    general_distributors and documents.
 *
 * Every step is guarded (idempotent). down() reverses renames, keys and values;
 * the backfill is forward-only. idx_artists_name_trgm follows the renamed
 * column. RLS policies reference tenant_id only.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['foto_url', 'photo_url'],
  ['nome_artistico', 'stage_name'],
  ['especialidades', 'specialties'],
  ['documentos_pessoais_url', 'personal_documents_url'],
  ['presskit_url', 'press_kit_url'],
  ['nome_civil', 'full_name'],
  ['data_nascimento', 'birth_date'],
  ['endereco', 'address'],
  ['telefone_encrypted', 'phone_encrypted'],
  ['banco', 'bank_name'],
  ['agencia', 'bank_branch'],
  ['conta', 'bank_account'],
  ['chave_pix', 'pix_key'],
  ['titular_conta', 'account_holder'],
  ['tipo_perfil', 'profile_type'],
  ['contatos_vinculados', 'linked_contacts'],
  ['distribuidoras_gerais', 'general_distributors'],
  ['notas_internas', 'internal_notes'],
  ['contrato_id', 'contract_id'],
  ['slug_artistico', 'artist_slug'],
  ['tags_musicais', 'music_tags'],
  ['fase_carreira', 'career_stage'],
  ['status_cadastro', 'registration_status'],
  ['relacionamentos', 'relationships'],
  ['empresario_id', 'agent_id'],
  ['empresario_nome', 'agent_name'],
  ['empresario_telefone', 'agent_phone'],
  ['empresario_email', 'agent_email'],
  ['gravadora_id', 'record_label_id'],
  ['gravadora_nome', 'record_label_name'],
  ['gravadora_telefone', 'record_label_phone'],
  ['gravadora_email', 'record_label_email'],
  ['gravadora_responsavel_id', 'record_label_contact_id'],
  ['gravadora_responsavel_nome', 'record_label_contact_name'],
  ['gravadora_responsavel_telefone', 'record_label_contact_phone'],
  ['gravadora_responsavel_email', 'record_label_contact_email'],
  ['distribuidoras_selecionadas', 'selected_distributors'],
  ['distribuidoras_emails', 'distributor_emails'],
  ['distribuidoras_empresa_selecionadas', 'company_selected_distributors'],
  ['distribuidoras_empresa_emails', 'company_distributor_emails'],
  ['contatos_equipe', 'team_contacts'],
  ['manager_nome', 'manager_name'],
  ['manager_contato_encrypted', 'manager_contact_encrypted'],
  ['produtor_executivo', 'executive_producer'],
  ['agencia_booking', 'booking_agency'],
  ['label_parceira', 'partner_label'],
  ['galeria_urls', 'gallery_urls'],
];

/** Legacy metadata key -> canonical column, with its kind (varchar length / date / jsonb / text). */
type ColumnKind = number | 'date' | 'jsonb' | 'text';
const METADATA_TO_COLUMN: ReadonlyArray<[key: string, column: string, kind: ColumnKind]> = [
  ['slug_artistico', 'artist_slug', 160],
  ['tags_musicais', 'music_tags', 'jsonb'],
  ['fase_carreira', 'career_stage', 60],
  ['data_nascimento', 'birth_date', 'date'],
  ['rg', 'rg', 30],
  ['endereco', 'address', 300],
  ['banco', 'bank_name', 100],
  ['agencia', 'bank_branch', 30],
  ['conta', 'bank_account', 40],
  ['chave_pix', 'pix_key', 150],
  ['titular_conta', 'account_holder', 150],
  ['presskit_url', 'press_kit_url', 'text'],
  ['documentos_pessoais_url', 'personal_documents_url', 'text'],
  ['tipo_perfil', 'profile_type', 30],
  ['empresario_id', 'agent_id', 64],
  ['empresario_nome', 'agent_name', 150],
  ['empresario_telefone', 'agent_phone', 30],
  ['empresario_email', 'agent_email', 150],
  ['gravadora_id', 'record_label_id', 64],
  ['gravadora_nome', 'record_label_name', 150],
  ['gravadora_telefone', 'record_label_phone', 30],
  ['gravadora_email', 'record_label_email', 150],
  ['gravadora_responsavel_id', 'record_label_contact_id', 64],
  ['gravadora_responsavel_nome', 'record_label_contact_name', 150],
  ['gravadora_responsavel_telefone', 'record_label_contact_phone', 30],
  ['gravadora_responsavel_email', 'record_label_contact_email', 150],
  ['relacionamentos', 'relationships', 'jsonb'],
  ['distribuidoras_selecionadas', 'selected_distributors', 'jsonb'],
  ['distribuidoras_emails', 'distributor_emails', 'jsonb'],
  ['distribuidoras_empresa_selecionadas', 'company_selected_distributors', 'jsonb'],
  ['distribuidoras_empresa_emails', 'company_distributor_emails', 'jsonb'],
  ['distribuidoras_gerais', 'general_distributors', 'jsonb'],
  ['contatos_vinculados', 'linked_contacts', 'jsonb'],
  ['contatos_equipe', 'team_contacts', 'jsonb'],
  ['notas_internas', 'internal_notes', 'text'],
];

/** metadata-only fields (no column): legacy key -> canonical key. */
const METADATA_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['genero', 'gender'],
  ['spotify_ouvintes', 'spotify_listeners'],
  ['youtube_inscritos', 'youtube_subscribers'],
  ['deezer_fas', 'deezer_fans'],
  ['apple_music_albuns_url', 'apple_music_albums'],
  ['soundcloud_seguidores_url', 'soundcloud_followers'],
  ['instagram_seguidores', 'instagram_followers'],
  ['tiktok_seguidores', 'tiktok_followers'],
];

const GENDERS: ReadonlyArray<[legacy: string, canonical: string]> = [['Masculino', 'male'], ['Feminino', 'female']];
const SPECIALTIES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['dj_produtor', 'dj_producer'], ['compositor_autor', 'songwriter'], ['interprete', 'performer'], ['produtor', 'producer'],
];
const PROFILE_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['independente', 'independent'], ['com_empresario', 'managed'], ['gravadora', 'record_label'], ['editora', 'publisher'],
];
const RELATIONSHIP_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['empresario', 'agent'], ['gravadora', 'record_label'], ['editora', 'publisher'], ['juridico', 'legal'],
  ['financeiro', 'finance'], ['contador', 'accountant'], ['assessoria', 'press_office'],
];
/** Nested keys inside relationships / linked_contacts / team_contacts / general_distributors / documents. */
const NESTED_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['nome', 'name'], ['telefone', 'phone'], ['escritorio', 'office'], ['responsaveis', 'responsibles'],
  ['distribuidoras', 'distributors'], ['nomeCustom', 'customName'], ['categoria', 'category'],
];
const NESTED_COLUMNS = ['relationships', 'linked_contacts', 'team_contacts', 'general_distributors', 'documents'];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "artists" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameConstraint(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${from}' AND conrelid = 'public.artists'::regclass)
        AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${to}' AND conrelid = 'public.artists'::regclass) THEN
        ALTER TABLE "artists" RENAME CONSTRAINT "${from}" TO "${to}";
      END IF;
    END $$;`;
}

const pairsJson = (pairs: ReadonlyArray<[string, string]>, reverse = false): string =>
  JSON.stringify(Object.fromEntries(pairs.map(([a, b]) => (reverse ? [b, a] : [a, b]))));

/** Session-local helpers (pg_temp): deep key rename and a date parse that never aborts. */
const HELPERS = `
  CREATE OR REPLACE FUNCTION pg_temp.cz042_rename_keys(j jsonb, mapping jsonb) RETURNS jsonb
  LANGUAGE plpgsql IMMUTABLE AS $fn$
  DECLARE result jsonb; k text; v jsonb;
  BEGIN
    IF j IS NULL THEN RETURN NULL; END IF;
    IF jsonb_typeof(j) = 'object' THEN
      result := '{}'::jsonb;
      FOR k, v IN SELECT * FROM jsonb_each(j) LOOP
        IF mapping ? k AND NOT j ? (mapping->>k) THEN
          result := result || jsonb_build_object(mapping->>k, pg_temp.cz042_rename_keys(v, mapping));
        ELSE
          result := result || jsonb_build_object(k, pg_temp.cz042_rename_keys(v, mapping));
        END IF;
      END LOOP;
      RETURN result;
    ELSIF jsonb_typeof(j) = 'array' THEN
      RETURN (SELECT COALESCE(jsonb_agg(pg_temp.cz042_rename_keys(e, mapping) ORDER BY o), '[]'::jsonb)
              FROM jsonb_array_elements(j) WITH ORDINALITY AS t(e, o));
    END IF;
    RETURN j;
  END $fn$;

  CREATE OR REPLACE FUNCTION pg_temp.cz042_try_date(t text) RETURNS date
  LANGUAGE plpgsql IMMUTABLE AS $fn$
  BEGIN
    IF t IS NULL OR t !~ '^\\d{4}-\\d{2}-\\d{2}' THEN RETURN NULL; END IF;
    RETURN substr(t, 1, 10)::date;
  EXCEPTION WHEN others THEN RETURN NULL;
  END $fn$;

  CREATE OR REPLACE FUNCTION pg_temp.cz042_map_array(j jsonb, mapping jsonb) RETURNS jsonb
  LANGUAGE sql IMMUTABLE AS $fn$
    SELECT CASE WHEN jsonb_typeof(j) = 'array' THEN (
      SELECT COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(e) = 'string' AND mapping ? (e #>> '{}')
                                     THEN mapping->(e #>> '{}') ELSE e END ORDER BY o), '[]'::jsonb)
      FROM jsonb_array_elements(j) WITH ORDINALITY AS t(e, o)) ELSE j END
  $fn$;

  CREATE OR REPLACE FUNCTION pg_temp.cz042_map_item_type(j jsonb, mapping jsonb) RETURNS jsonb
  LANGUAGE sql IMMUTABLE AS $fn$
    SELECT CASE WHEN jsonb_typeof(j) = 'array' THEN (
      SELECT COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(e) = 'object' AND mapping ? (e->>'type')
                                     THEN e || jsonb_build_object('type', mapping->(e->>'type')) ELSE e END ORDER BY o), '[]'::jsonb)
      FROM jsonb_array_elements(j) WITH ORDINALITY AS t(e, o)) ELSE j END
  $fn$;`;

function backfill(key: string, column: string, kind: ColumnKind): string {
  const guard = `"metadata" ? '${key}' AND jsonb_typeof("metadata"->'${key}') <> 'null'`;
  if (kind === 'jsonb') {
    return `UPDATE "artists" SET "${column}" = "metadata"->'${key}' WHERE ${guard}`;
  }
  if (kind === 'date') {
    return `UPDATE "artists" SET "${column}" = pg_temp.cz042_try_date("metadata"->>'${key}')
            WHERE ${guard} AND pg_temp.cz042_try_date("metadata"->>'${key}') IS NOT NULL`;
  }
  const lengthGuard = typeof kind === 'number' ? ` AND length("metadata"->>'${key}') <= ${kind}` : '';
  return `UPDATE "artists" SET "${column}" = "metadata"->>'${key}'
          WHERE ${guard} AND "metadata"->>'${key}' <> ''${lengthGuard}`;
}

function renameMetadataKey(from: string, to: string): string {
  return `UPDATE "artists" SET "metadata" = ("metadata" - '${from}') || jsonb_build_object('${to}', "metadata"->'${from}')
          WHERE "metadata" ? '${from}' AND NOT "metadata" ? '${to}'`;
}

function columnExists(column: string): string {
  return `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = '${column}'`;
}

export class CanonicalizeArtistsToEnglish20260928000022 implements MigrationInterface {
  name = 'CanonicalizeArtistsToEnglish20260928000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(renameConstraint('chk_artists_status_cadastro', 'chk_artists_registration_status'));
    await queryRunner.query(HELPERS);

    // The metadata copy is the live one (the API wrote only metadata since 2026-07-12).
    for (const [key, column, kind] of METADATA_TO_COLUMN) {
      if ((await queryRunner.query(columnExists(column))).length === 0) continue;
      await queryRunner.query(backfill(key, column, kind));
    }

    for (const [from, to] of METADATA_KEYS) await queryRunner.query(renameMetadataKey(from, to));
    await queryRunner.query(
      `UPDATE "artists" SET "metadata" = jsonb_set("metadata", '{gender}', to_jsonb(m.canonical))
       FROM (VALUES ${GENDERS.map(([l, c]) => `('${l}', '${c}')`).join(', ')}) AS m(legacy, canonical)
       WHERE "metadata"->>'gender' = m.legacy`,
    );

    await queryRunner.query(`UPDATE "artists" SET "specialties" = pg_temp.cz042_map_array("specialties", $1::jsonb)`, [pairsJson(SPECIALTIES)]);
    await queryRunner.query(
      `UPDATE "artists" p SET "profile_type" = m.canonical
       FROM (VALUES ${PROFILE_TYPES.map(([l, c]) => `('${l}', '${c}')`).join(', ')}) AS m(legacy, canonical)
       WHERE p."profile_type" = m.legacy`,
    );
    for (const column of NESTED_COLUMNS) {
      await queryRunner.query(
        `UPDATE "artists" SET "${column}" = pg_temp.cz042_rename_keys("${column}", $1::jsonb) WHERE "${column}" IS NOT NULL`,
        [pairsJson(NESTED_KEYS)],
      );
    }
    await queryRunner.query(
      `UPDATE "artists" SET "relationships" = pg_temp.cz042_map_item_type("relationships", $1::jsonb) WHERE "relationships" IS NOT NULL`,
      [pairsJson(RELATIONSHIP_TYPES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(HELPERS);
    await queryRunner.query(
      `UPDATE "artists" SET "relationships" = pg_temp.cz042_map_item_type("relationships", $1::jsonb) WHERE "relationships" IS NOT NULL`,
      [pairsJson(RELATIONSHIP_TYPES, true)],
    );
    for (const column of NESTED_COLUMNS) {
      await queryRunner.query(
        `UPDATE "artists" SET "${column}" = pg_temp.cz042_rename_keys("${column}", $1::jsonb) WHERE "${column}" IS NOT NULL`,
        [pairsJson(NESTED_KEYS, true)],
      );
    }
    await queryRunner.query(
      `UPDATE "artists" p SET "profile_type" = m.legacy
       FROM (VALUES ${PROFILE_TYPES.map(([l, c]) => `('${l}', '${c}')`).join(', ')}) AS m(legacy, canonical)
       WHERE p."profile_type" = m.canonical`,
    );
    await queryRunner.query(`UPDATE "artists" SET "specialties" = pg_temp.cz042_map_array("specialties", $1::jsonb)`, [pairsJson(SPECIALTIES, true)]);
    await queryRunner.query(
      `UPDATE "artists" SET "metadata" = jsonb_set("metadata", '{gender}', to_jsonb(m.legacy))
       FROM (VALUES ${GENDERS.map(([l, c]) => `('${l}', '${c}')`).join(', ')}) AS m(legacy, canonical)
       WHERE "metadata"->>'gender' = m.canonical`,
    );
    for (const [from, to] of METADATA_KEYS) await queryRunner.query(renameMetadataKey(to, from));

    await queryRunner.query(renameConstraint('chk_artists_registration_status', 'chk_artists_status_cadastro'));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
