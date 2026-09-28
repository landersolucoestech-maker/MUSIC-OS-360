import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000016_CanonicalizeReleasesToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `releases`
 * (CZ-038).
 *
 * Columns: distribuidora -> distributor, data_lancamento -> release_date
 *   (same name as phonograms.release_date), plataformas -> platforms,
 *   capa_url -> cover_url, notas_internas -> internal_notes (distinct from
 *   `notes`, the distribution notes), gravadora -> record_label,
 *   idioma -> language (values are already language codes), cronograma -> schedule.
 * type values: compilacao -> compilation, outro -> other (PT-BR labels live in
 *   the web UI).
 * schedule keys: data_gravacao -> recording_date, data_mix_master ->
 *   mix_master_date, data_entrega_distribuidora -> distributor_delivery_date.
 * assets keys: capa_url -> cover_url, video_clipe_url -> music_video_url,
 *   letra -> lyrics, ficha_tecnica -> credits.
 *
 * Before migration 20260718000010 these form fields lived only in `metadata`
 *   (and that migration did not backfill), so the web kept reading
 *   metadata.notas_internas/gravadora/idioma/genero/copyright/isrc_global/
 *   observacoes/cronograma/assets as fallbacks. They are copied into the empty
 *   dedicated columns here (forward-only, nothing overwritten, values longer than the
 *   column are skipped, metadata left untouched as historical data), so the columns are the single source of truth.
 *
 * No index, constraint, view, function or policy references the renamed
 * columns (checked against a freshly migrated catalog). Every step is guarded,
 * so the migration is idempotent; down() reverses every step except the
 * metadata backfill.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['distribuidora', 'distributor'],
  ['data_lancamento', 'release_date'],
  ['plataformas', 'platforms'],
  ['capa_url', 'cover_url'],
  ['notas_internas', 'internal_notes'],
  ['gravadora', 'record_label'],
  ['idioma', 'language'],
  ['cronograma', 'schedule'],
];

const TYPE_VALUES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['compilacao', 'compilation'],
  ['outro', 'other'],
];

const SCHEDULE_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['data_gravacao', 'recording_date'],
  ['data_mix_master', 'mix_master_date'],
  ['data_entrega_distribuidora', 'distributor_delivery_date'],
];

const ASSET_KEYS: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['capa_url', 'cover_url'],
  ['video_clipe_url', 'music_video_url'],
  ['letra', 'lyrics'],
  ['ficha_tecnica', 'credits'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'releases' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'releases' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "releases" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

/** Renames the keys of a jsonb object column (keys not listed are kept as-is). */
function remapObjectKeys(column: string, pairs: ReadonlyArray<[from: string, to: string]>): string {
  const mapping = pairs.map(([from, to]) => `('${from}', '${to}')`).join(', ');
  return `
    UPDATE "releases" r SET "${column}" = (
      SELECT COALESCE(jsonb_object_agg(COALESCE(m.to_key, kv.key), kv.value), '{}'::jsonb)
      FROM jsonb_each(r."${column}") AS kv
      LEFT JOIN (VALUES ${mapping}) AS m(from_key, to_key) ON m.from_key = kv.key
    )
    WHERE jsonb_typeof(r."${column}") = 'object'
      AND r."${column}" ?| ARRAY[${pairs.map(([from]) => `'${from}'`).join(', ')}]`;
}

export class CanonicalizeReleasesToEnglish20260928000016 implements MigrationInterface {
  name = 'CanonicalizeReleasesToEnglish20260928000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(`
      UPDATE "releases" SET
        "internal_notes" = COALESCE("internal_notes", NULLIF("metadata"->>'notas_internas', '')),
        "record_label"   = COALESCE("record_label",   CASE WHEN length("metadata"->>'gravadora') <= 255 THEN NULLIF("metadata"->>'gravadora', '') END),
        "language"       = COALESCE("language",       CASE WHEN length("metadata"->>'idioma') <= 50 THEN NULLIF("metadata"->>'idioma', '') END),
        "music_genre"    = COALESCE("music_genre",    CASE WHEN length("metadata"->>'genero') <= 100 THEN NULLIF("metadata"->>'genero', '') END),
        "copyright"      = COALESCE("copyright",      CASE WHEN length("metadata"->>'copyright') <= 255 THEN NULLIF("metadata"->>'copyright', '') END),
        "isrc_global"    = COALESCE("isrc_global",    CASE WHEN length("metadata"->>'isrc_global') <= 50 THEN NULLIF("metadata"->>'isrc_global', '') END),
        "notes"          = COALESCE("notes",          NULLIF("metadata"->>'observacoes', '')),
        "schedule"       = COALESCE("schedule", CASE WHEN jsonb_typeof("metadata"->'cronograma') = 'object' THEN "metadata"->'cronograma' END),
        "assets"         = COALESCE("assets",   CASE WHEN jsonb_typeof("metadata"->'assets') = 'object' THEN "metadata"->'assets' END)
      WHERE jsonb_typeof("metadata") = 'object'
        AND "metadata" ?| ARRAY['notas_internas', 'gravadora', 'idioma', 'genero', 'copyright', 'isrc_global', 'observacoes', 'cronograma', 'assets']`);
    for (const [legacy, canonical] of TYPE_VALUES) {
      await queryRunner.query(`UPDATE "releases" SET "type" = $1 WHERE "type" = $2`, [canonical, legacy]);
    }
    await queryRunner.query(remapObjectKeys('schedule', SCHEDULE_KEYS));
    await queryRunner.query(remapObjectKeys('assets', ASSET_KEYS));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const reverse = (pairs: ReadonlyArray<[string, string]>) =>
      pairs.map(([legacy, canonical]) => [canonical, legacy] as [string, string]);
    await queryRunner.query(remapObjectKeys('assets', reverse(ASSET_KEYS)));
    await queryRunner.query(remapObjectKeys('schedule', reverse(SCHEDULE_KEYS)));
    for (const [legacy, canonical] of TYPE_VALUES) {
      await queryRunner.query(`UPDATE "releases" SET "type" = $1 WHERE "type" = $2`, [legacy, canonical]);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
