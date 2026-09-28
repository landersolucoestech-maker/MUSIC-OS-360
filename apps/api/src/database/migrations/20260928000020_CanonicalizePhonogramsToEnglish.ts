import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000020_CanonicalizePhonogramsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for
 * `phonograms` (CZ-040).
 *
 * Renames: gravadora -> record_label_name, cod_entidade -> society_code,
 *   cod_ecad -> ecad_code, agregadora -> aggregator, isrc_pais ->
 *   isrc_country_code, isrc_registrante -> isrc_registrant_code, isrc_ano ->
 *   isrc_year, isrc_designacao -> isrc_designation_code (ISO 3901 parts),
 *   criada_por_ia -> ai_used, nacional -> is_national, pub_simultanea ->
 *   is_simultaneous_publication, emissao -> issue_date, midia -> media_type,
 *   classificacao -> recording_classification, pais_publicacao ->
 *   publication_country, participacao -> participation, arquivo_audio ->
 *   audio_file.
 * One source of truth: four Portuguese form columns duplicated an English
 *   registry column (derivation layer). The English column is backfilled where
 *   empty and becomes the only one written/read; the Portuguese one keeps its
 *   data under a `legacy_` name (drop needs explicit authorization — canonical
 *   map blocker BLK-PHONOGRAMS-LEGACY-DUPLICATES):
 *     gravacao_original -> recording_date       | legacy_recording_date
 *     data_lancamento   -> release_date         | legacy_release_date
 *     duracao_min/_seg  -> duration_seconds     | legacy_duration_minutes / legacy_duration_seconds_part
 *     pais_origem       -> country_of_recording | legacy_origin_country
 * Values: media_type todos/físico -> all/physical; recording_classification,
 *   aggregator outro -> other; country codes brazil/usa/uk/portugal/argentina
 *   -> BR/US/GB/PT/AR (ISO 3166-1 alpha-2) and outro -> ZZ (unknown region)
 *   in country_of_recording and publication_country.
 * participation jsonb keys: produtorFonografico -> phonographic_producers,
 *   interprete -> performers, musicoAcompanhante -> session_musicians; item key
 *   percentual -> percentage.
 *
 * origem_externa* stay (canonical map NC-046..048 BLOCKED_PRODUCT_DECISION).
 * No index, view, function or policy references the renamed columns. Every
 * step is guarded (idempotent). down() reverses renames, values and keys; the
 * backfill of the English columns is forward-only (nothing overwritten).
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['gravadora', 'record_label_name'],
  ['cod_entidade', 'society_code'],
  ['cod_ecad', 'ecad_code'],
  ['agregadora', 'aggregator'],
  ['isrc_pais', 'isrc_country_code'],
  ['isrc_registrante', 'isrc_registrant_code'],
  ['isrc_ano', 'isrc_year'],
  ['isrc_designacao', 'isrc_designation_code'],
  ['criada_por_ia', 'ai_used'],
  ['nacional', 'is_national'],
  ['pub_simultanea', 'is_simultaneous_publication'],
  ['emissao', 'issue_date'],
  ['midia', 'media_type'],
  ['classificacao', 'recording_classification'],
  ['pais_publicacao', 'publication_country'],
  ['participacao', 'participation'],
  ['arquivo_audio', 'audio_file'],
  ['gravacao_original', 'legacy_recording_date'],
  ['data_lancamento', 'legacy_release_date'],
  ['duracao_min', 'legacy_duration_minutes'],
  ['duracao_seg', 'legacy_duration_seconds_part'],
  ['pais_origem', 'legacy_origin_country'],
];

const VALUES: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['media_type', 'todos', 'all'],
  ['media_type', 'físico', 'physical'],
  ['media_type', 'fisico', 'physical'],
  ['recording_classification', 'outro', 'other'],
  ['aggregator', 'outro', 'other'],
];

const COUNTRIES: ReadonlyArray<[legacy: string, iso: string]> = [
  ['brazil', 'BR'], ['usa', 'US'], ['uk', 'GB'], ['portugal', 'PT'], ['argentina', 'AR'], ['outro', 'ZZ'],
];

const PARTICIPATION_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['produtorFonografico', 'phonographic_producers'],
  ['interprete', 'performers'],
  ['musicoAcompanhante', 'session_musicians'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "phonograms" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

/**
 * Renames the category keys of `participation` and the `from`/`to` item key
 * inside every category array (element order preserved).
 */
function remapParticipation(categories: ReadonlyArray<[string, string]>, itemFrom: string, itemTo: string): string {
  const mapping = categories.map(([from, to]) => `('${from}', '${to}')`).join(', ');
  return `
    UPDATE "phonograms" p SET "participation" = (
      SELECT COALESCE(jsonb_object_agg(
        COALESCE(m.to_key, cat.key),
        CASE WHEN jsonb_typeof(cat.value) = 'array' THEN (
          SELECT COALESCE(jsonb_agg(
            CASE WHEN jsonb_typeof(item.elem) = 'object' AND item.elem ? '${itemFrom}' AND NOT item.elem ? '${itemTo}'
              THEN (item.elem - '${itemFrom}') || jsonb_build_object('${itemTo}', item.elem->'${itemFrom}')
              ELSE item.elem END
            ORDER BY item.ord), '[]'::jsonb)
          FROM jsonb_array_elements(cat.value) WITH ORDINALITY AS item(elem, ord)
        ) ELSE cat.value END
      ), '{}'::jsonb)
      FROM jsonb_each(p."participation") AS cat
      LEFT JOIN (VALUES ${mapping}) AS m(from_key, to_key) ON m.from_key = cat.key
    )
    WHERE jsonb_typeof(p."participation") = 'object'`;
}

export class CanonicalizePhonogramsToEnglish20260928000020 implements MigrationInterface {
  name = 'CanonicalizePhonogramsToEnglish20260928000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));

    // One source of truth: fill the registry columns from the legacy form
    // columns where they are still empty (never overwrite).
    await queryRunner.query(`
      UPDATE "phonograms" SET "recording_date" = "legacy_recording_date"::timestamp
      WHERE "recording_date" IS NULL AND "legacy_recording_date" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "phonograms" SET "release_date" = "legacy_release_date"::timestamp
      WHERE "release_date" IS NULL AND "legacy_release_date" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "phonograms"
      SET "duration_seconds" = COALESCE("legacy_duration_minutes", 0) * 60 + COALESCE("legacy_duration_seconds_part", 0)
      WHERE "duration_seconds" IS NULL AND ("legacy_duration_minutes" IS NOT NULL OR "legacy_duration_seconds_part" IS NOT NULL)`);
    const countries = COUNTRIES.map(([legacy, iso]) => `('${legacy}', '${iso}')`).join(', ');
    await queryRunner.query(`
      UPDATE "phonograms" p SET "country_of_recording" = m.iso
      FROM (VALUES ${countries}) AS m(legacy, iso)
      WHERE p."country_of_recording" IS NULL AND lower(p."legacy_origin_country") = m.legacy`);
    await queryRunner.query(`
      UPDATE "phonograms" p SET "publication_country" = m.iso
      FROM (VALUES ${countries}) AS m(legacy, iso)
      WHERE lower(p."publication_country") = m.legacy`);

    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "phonograms" SET "${column}" = $1 WHERE lower("${column}") = $2`, [canonical, legacy]);
    }
    await queryRunner.query(remapParticipation(PARTICIPATION_KEYS, 'percentual', 'percentage'));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      remapParticipation(PARTICIPATION_KEYS.map(([legacy, canonical]) => [canonical, legacy] as [string, string]), 'percentage', 'percentual'),
    );
    for (const [column, legacy, canonical] of VALUES) {
      if (legacy === 'fisico') continue; // both spellings map to physical; restore the accented one
      await queryRunner.query(`UPDATE "phonograms" SET "${column}" = $1 WHERE "${column}" = $2`, [legacy, canonical]);
    }
    for (const [legacy, iso] of COUNTRIES) {
      await queryRunner.query(`UPDATE "phonograms" SET "publication_country" = $1 WHERE "publication_country" = $2`, [legacy, iso]);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
