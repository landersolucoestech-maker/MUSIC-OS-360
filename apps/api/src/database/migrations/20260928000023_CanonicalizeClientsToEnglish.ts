import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260928000023_CanonicalizeClientsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `clients`
 * (CRM contacts — CZ-043). Same single-source rule as artists (CZ-042): every
 * form field has its own column; the web kept a Portuguese copy of most fields
 * in `metadata` ("payloadOperacional") that the API never moved to columns.
 *
 * 1. Renames: tipo_pessoa -> person_type (default 'company'), categoria ->
 *    category, perfil -> profile, nome -> name, foto -> photo_url,
 *    razao_social -> legal_name, telefone_encrypted -> phone_encrypted,
 *    funcao -> job_title, logradouro -> street, numero -> street_number,
 *    complemento -> address_complement, bairro -> neighborhood, cep ->
 *    zip_code, endereco_completo -> address, prioridade_contato -> priority,
 *    responsavel_nome/_cargo/_email/_telefone -> responsible_name /
 *    responsible_job_title / responsible_email / responsible_phone,
 *    interacoes -> interactions. status_contato duplicated `status` with no
 *    reader -> legacy_contact_status (drop blocked: BLK-CLIENTS-LEGACY-DUPLICATES).
 *    cpf_cnpj_encrypted stays (legal-domain exception).
 * 2. Backfill metadata -> column for the form fields the API never persisted.
 *    The metadata key, when present, is the live copy and wins (null/'' clears
 *    the column) — also on a re-apply after a rollback, when the pre-CZ-043 web
 *    wrote these fields to metadata again. A copied key leaves metadata (the
 *    column is the single copy — no stale plaintext duplicate of responsible
 *    e-mail/phone); a value that does not fit stays as historical data. The
 *    legacy `cargo_responsavel` key only fills a responsible_job_title that
 *    `responsavel_cargo` left empty; otherwise it is parked as
 *    `legacy_cargo_responsavel` (never read). interacoes stored as JSON text
 *    is parsed like the artists' arrays. The plaintext cpf/cnpj copies in metadata are
 *    NOT touched here (BLK-CRM-PII-PLAINTEXT: needs an encryption backfill).
 * 3. Values: person_type pessoa_fisica/person -> individual, pessoa_juridica
 *    -> company; interactions item keys data/horario/descricao ->
 *    date/time/description and types ligacao/reuniao/proposta/observacao ->
 *    call/meeting/proposal/note (the lead vocabulary); client timeline
 *    activity_logs actions nota/ligacao/reuniao/outro -> note/call/meeting/other.
 *    profile values (70 PT slugs) are unchanged — taxonomy decision
 *    (BLK-CLIENT-PROFILE-TAXONOMY).
 *
 * Every step is guarded. down() reverses renames, default, keys and values and
 * writes each backfilled column back to its legacy metadata key (the pre-CZ-043
 * web reads the form from metadata), so rollback + re-apply loses nothing. A
 * rename finding both the legacy and the canonical column raises.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['tipo_pessoa', 'person_type'],
  ['categoria', 'category'],
  ['perfil', 'profile'],
  ['nome', 'name'],
  ['foto', 'photo_url'],
  ['razao_social', 'legal_name'],
  ['telefone_encrypted', 'phone_encrypted'],
  ['funcao', 'job_title'],
  ['logradouro', 'street'],
  ['numero', 'street_number'],
  ['complemento', 'address_complement'],
  ['bairro', 'neighborhood'],
  ['cep', 'zip_code'],
  ['endereco_completo', 'address'],
  ['status_contato', 'legacy_contact_status'],
  ['prioridade_contato', 'priority'],
  ['responsavel_nome', 'responsible_name'],
  ['responsavel_cargo', 'responsible_job_title'],
  ['responsavel_email', 'responsible_email'],
  ['responsavel_telefone', 'responsible_phone'],
  ['interacoes', 'interactions'],
];

/** metadata ("payloadOperacional") key -> empty column, with its varchar limit (null = text/jsonb). */
const METADATA_TO_COLUMN: ReadonlyArray<[key: string, column: string, maxLength: number | 'jsonb' | null]> = [
  ['razao_social', 'legal_name', 255],
  ['nome_fantasia', 'trade_name', 255],
  ['nome_pf', 'individual_name', 255],
  ['funcao', 'job_title', 100],
  ['foto', 'photo_url', null],
  ['logradouro', 'street', 255],
  ['numero', 'street_number', 20],
  ['complemento', 'address_complement', 100],
  ['bairro', 'neighborhood', 120],
  ['cep', 'zip_code', 15],
  ['responsavel_nome', 'responsible_name', 150],
  ['responsavel_email', 'responsible_email', 150],
  ['responsavel_telefone', 'responsible_phone', 30],
  // The older alias runs first: it must see whether the current key is present.
  ['cargo_responsavel', 'responsible_job_title', 100],
  ['responsavel_cargo', 'responsible_job_title', 100],
  ['interacoes', 'interactions', 'jsonb'],
];

const PERSON_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['pessoa_fisica', 'individual'], ['person', 'individual'], ['pessoa_juridica', 'company'],
];
const INTERACTION_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['data', 'date'], ['horario', 'time'], ['descricao', 'description'],
];
const INTERACTION_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['ligacao', 'call'], ['reuniao', 'meeting'], ['proposta', 'proposal'], ['observacao', 'note'],
];
const TIMELINE_ACTIONS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['nota', 'note'], ['ligacao', 'call'], ['reuniao', 'meeting'], ['outro', 'other'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "clients" RENAME COLUMN "${from}" TO "${to}";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = '${from}'
      ) THEN
        RAISE EXCEPTION 'clients has both "${from}" and "${to}": resolve manually before migrating';
      END IF;
    END $$;`;
}

/** Renames item keys and maps item `type` values of the interactions array (order preserved). */
function remapInteractions(keys: ReadonlyArray<[string, string]>, types: ReadonlyArray<[string, string]>): string {
  const keyMap = JSON.stringify(Object.fromEntries(keys));
  const typeMap = JSON.stringify(Object.fromEntries(types));
  return `
    UPDATE "clients" c SET "interactions" = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN jsonb_typeof(item.elem) = 'object' THEN (
          SELECT COALESCE(jsonb_object_agg(
            CASE WHEN km.value IS NOT NULL AND NOT item.elem ? (km.value #>> '{}') THEN km.value #>> '{}' ELSE e.key END,
            CASE WHEN e.key = 'type' AND jsonb_typeof(e.value) = 'string' AND '${typeMap}'::jsonb ? (e.value #>> '{}')
              THEN '${typeMap}'::jsonb -> (e.value #>> '{}') ELSE e.value END)
          , '{}'::jsonb)
          FROM jsonb_each(item.elem) AS e
          LEFT JOIN LATERAL (SELECT '${keyMap}'::jsonb -> e.key AS value) km ON true
        ) ELSE item.elem END
        ORDER BY item.ord), '[]'::jsonb)
      FROM jsonb_array_elements(c."interactions") WITH ORDINALITY AS item(elem, ord)
    )
    WHERE jsonb_typeof(c."interactions") = 'array' AND jsonb_array_length(c."interactions") > 0`;
}

export class CanonicalizeClientsToEnglish20260928000023 implements MigrationInterface {
  name = 'CanonicalizeClientsToEnglish20260928000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pg_temp.cz043_try_jsonb_array(j jsonb) RETURNS jsonb
      LANGUAGE plpgsql IMMUTABLE AS $fn$
      DECLARE parsed jsonb;
      BEGIN
        IF j IS NULL THEN RETURN NULL; END IF;
        IF jsonb_typeof(j) = 'array' THEN RETURN j; END IF;
        IF jsonb_typeof(j) <> 'string' THEN RETURN NULL; END IF;
        parsed := (j #>> '{}')::jsonb;
        RETURN CASE WHEN jsonb_typeof(parsed) = 'array' THEN parsed END;
      EXCEPTION WHEN others THEN RETURN NULL;
      END $fn$`);

    for (const [key, column, maxLength] of METADATA_TO_COLUMN) {
      // The metadata key, when PRESENT, is the live copy (the pre-CZ-043 web wrote these
      // fields only to metadata, also while rolled back): it wins over the column and
      // null/'' clears it. A value that does not fit sets the column to NULL and stays
      // in metadata as historical data (same rule as artists, migration 22).
      // Older alias of responsible_job_title: it only fills a column the current key left
      // empty. When the column has a value, or the current key `responsavel_cargo` is still
      // in metadata (a value that did not fit, kept as historical data — database re-review
      // of b875241, LOW-2), the alias is parked under a key nothing reads, so it can never
      // refill a cleared job title nor let down() overwrite that newer value (LOW-C).
      const aliasBlocked = `("${column}" IS NOT NULL OR "metadata" ? 'responsavel_cargo')`;
      if (key === 'cargo_responsavel') {
        await queryRunner.query(`
          UPDATE "clients" SET "metadata" = ("metadata" - 'cargo_responsavel')
              || jsonb_build_object('legacy_cargo_responsavel', "metadata"->'cargo_responsavel')
          WHERE jsonb_typeof("metadata") = 'object' AND "metadata" ? 'cargo_responsavel'
            AND ${aliasBlocked} AND NOT "metadata" ? 'legacy_cargo_responsavel'`);
      }
      const onlyIfEmpty = key === 'cargo_responsavel' ? `AND NOT ${aliasBlocked}` : '';
      if (maxLength === 'jsonb') {
        // An array, or JSON text holding an array (as artists, migration 22), is copied;
        // null/'' clear the column; anything else stays in metadata as historical data.
        const parsed = `pg_temp.cz043_try_jsonb_array("metadata"->'${key}')`;
        const cleared = `(jsonb_typeof("metadata"->'${key}') = 'null' OR "metadata"->>'${key}' = '')`;
        await queryRunner.query(`
          UPDATE "clients" SET "${column}" = ${parsed},
            "metadata" = CASE WHEN ${parsed} IS NOT NULL OR ${cleared} THEN "metadata" - '${key}' ELSE "metadata" END
          WHERE jsonb_typeof("metadata") = 'object' AND "metadata" ? '${key}' ${onlyIfEmpty}`);
        continue;
      }
      const text = `NULLIF("metadata"->>'${key}', '')`;
      const fits = maxLength === null ? 'true' : `length(${text}) <= ${maxLength}`;
      await queryRunner.query(`
        UPDATE "clients" SET "${column}" = CASE WHEN ${text} IS NULL OR ${fits} THEN ${text} END,
          "metadata" = CASE WHEN ${text} IS NULL OR ${fits} THEN "metadata" - '${key}' ELSE "metadata" END
        WHERE jsonb_typeof("metadata") = 'object' AND "metadata" ? '${key}'
          AND jsonb_typeof("metadata"->'${key}') IN ('string', 'null') ${onlyIfEmpty}`);
    }
    // profile is NOT NULL (default fallback 'outros'): the form value wins over the fallback.
    await queryRunner.query(`
      UPDATE "clients" SET "profile" = "metadata"->>'perfil'
      WHERE "profile" = 'outros' AND jsonb_typeof("metadata"->'perfil') = 'string'
        AND "metadata"->>'perfil' <> '' AND length("metadata"->>'perfil') <= 100`);

    for (const [legacy, canonical] of PERSON_TYPES) {
      await queryRunner.query(`UPDATE "clients" SET "person_type" = $1 WHERE "person_type" = $2`, [canonical, legacy]);
    }
    await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "person_type" SET DEFAULT 'company'`);
    await queryRunner.query(remapInteractions(INTERACTION_KEYS, INTERACTION_TYPES));
    for (const [legacy, canonical] of TIMELINE_ACTIONS) {
      await queryRunner.query(
        `UPDATE "activity_logs" SET "action" = $1 WHERE "entity_type" = 'client' AND "action" = $2`,
        [canonical, legacy],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const [legacy, canonical] of TIMELINE_ACTIONS) {
      await queryRunner.query(
        `UPDATE "activity_logs" SET "action" = $1 WHERE "entity_type" = 'client' AND "action" = $2`,
        [legacy, canonical],
      );
    }
    const invert = (pairs: ReadonlyArray<[string, string]>) => pairs.map(([a, b]) => [b, a] as [string, string]);
    await queryRunner.query(remapInteractions(invert(INTERACTION_KEYS), invert(INTERACTION_TYPES)));
    await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "person_type" SET DEFAULT 'pessoa_juridica'`);
    await queryRunner.query(`UPDATE "clients" SET "person_type" = 'pessoa_fisica' WHERE "person_type" = 'individual'`);
    await queryRunner.query(`UPDATE "clients" SET "person_type" = 'pessoa_juridica' WHERE "person_type" = 'company'`);
    // The pre-CZ-043 web reads the form from metadata: give it the current column values
    // (interactions after the key/type reversal above, i.e. in the legacy vocabulary).
    for (const [key, column] of METADATA_TO_COLUMN) {
      // The job title goes back under its current key only; the alias is never rewritten.
      if (key === 'cargo_responsavel') continue;
      // A metadata value that is not an object (array/string) is left untouched: the
      // value still lives in its (renamed-back) column, and the document is never replaced.
      await queryRunner.query(`
        UPDATE "clients" SET "metadata" = COALESCE(CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" END, '{}'::jsonb)
          || jsonb_build_object('${key}', to_jsonb("${column}"))
        WHERE "${column}" IS NOT NULL AND ("metadata" IS NULL OR jsonb_typeof("metadata") IN ('object', 'null'))`);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
