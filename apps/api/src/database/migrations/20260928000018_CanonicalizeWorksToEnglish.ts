import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000018_CanonicalizeWorksToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `works` and
 * `work_participants` (CZ-039).
 *
 * works — renames:
 *   compositor -> composer_name, compositores -> composer_names,
 *   editora -> publisher_name, cod_entidade -> society_code,
 *   cod_ecad -> ecad_code, tipo_ia -> ai_usage_level,
 *   ia_harmonia/ia_melodia/ia_letra -> ai_harmony/ai_melody/ai_lyrics,
 *   referencias_conexas -> related_references,
 *   letristas -> translator_names (it only ever held the names of the
 *     participants whose role is "Tradutor"), tipo_obra -> work_origin.
 * works — one source of truth: five Portuguese form columns duplicated an
 *   English registry column (NC-027 derivation layer). The English column is
 *   backfilled where empty and becomes the only one written/read; the
 *   Portuguese one keeps its data under a `legacy_` name (no longer written,
 *   drop needs explicit authorization — canonical map blocker):
 *     idioma (PT language label) -> language (ISO code) | legacy_language_label
 *     instrumental ('sim'/'nao') -> is_instrumental     | legacy_instrumental_flag
 *     criada_por_ia              -> ai_used             | legacy_ai_used
 *     outros_titulos             -> alternative_titles  | legacy_alternative_titles
 *     letra_completa             -> lyrics              | legacy_lyrics
 * works — values: ai_usage_level totalmente/parcialmente -> full/partial;
 *   work_origin autoral/referencia -> original/reference; type composicao ->
 *   composition, outro -> other; ai_* jsonb key ferramenta -> tool.
 *   `language` gains 'zxx' (ISO 639-2 "no linguistic content") for
 *   "Instrumental (Sem Letra)" and 'und' (undetermined) for "Outro", which the
 *   old label map dropped to NULL.
 * work_participants: classe_funcao -> role, percentual -> percentage,
 *   chk_work_participants_percentual -> chk_work_participants_percentage;
 *   role values editor -> publisher, administrador -> administrator,
 *   compositor/autor -> composer_author (the CWR "CA" role: one value, not
 *   merged into composer), tradutor -> translator, não_informado -> unspecified.
 *
 * origem_externa* stay (canonical map NC-043..045 BLOCKED_PRODUCT_DECISION).
 * Society payload snapshots already stored are history and are not touched.
 * No index, view, function or policy references the renamed columns. Every
 * step is guarded (idempotent). down() reverses renames and value/key remaps;
 * the backfill of the English columns is forward-only (nothing overwritten).
 */
const WORK_COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['compositor', 'composer_name'],
  ['compositores', 'composer_names'],
  ['editora', 'publisher_name'],
  ['cod_entidade', 'society_code'],
  ['cod_ecad', 'ecad_code'],
  ['tipo_ia', 'ai_usage_level'],
  ['ia_harmonia', 'ai_harmony'],
  ['ia_melodia', 'ai_melody'],
  ['ia_letra', 'ai_lyrics'],
  ['referencias_conexas', 'related_references'],
  ['letristas', 'translator_names'],
  ['tipo_obra', 'work_origin'],
  ['idioma', 'legacy_language_label'],
  ['instrumental', 'legacy_instrumental_flag'],
  ['criada_por_ia', 'legacy_ai_used'],
  ['outros_titulos', 'legacy_alternative_titles'],
  ['letra_completa', 'legacy_lyrics'],
];

const PARTICIPANT_COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['classe_funcao', 'role'],
  ['percentual', 'percentage'],
];

const WORK_VALUES: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['ai_usage_level', 'totalmente', 'full'],
  ['ai_usage_level', 'parcialmente', 'partial'],
  ['work_origin', 'autoral', 'original'],
  ['work_origin', 'referencia', 'reference'],
  ['type', 'composicao', 'composition'],
  ['type', 'outro', 'other'],
];

const ROLE_VALUES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['editor', 'publisher'],
  ['administrador', 'administrator'],
  ['compositor/autor', 'composer_author'],
  ['tradutor', 'translator'],
  ['não_informado', 'unspecified'],
];

// Frozen copy of the PT-BR language label -> ISO 639 map the application used
// to derive `language` (work-registry-fields.util.ts before CZ-039).
const LANGUAGE_LABEL_TO_CODE: ReadonlyArray<[label: string, code: string]> = [
  ['Alemão', 'de'], ['Amárico', 'am'], ['Árabe', 'ar'], ['Bengali', 'bn'], ['Chinês Mandarim', 'zh'],
  ['Coreano', 'ko'], ['Dinamarquês', 'da'], ['Espanhol', 'es'], ['Finlandês', 'fi'], ['Francês', 'fr'],
  ['Grego', 'el'], ['Hebraico', 'he'], ['Hindi', 'hi'], ['Holandês', 'nl'], ['Indonésio', 'id'],
  ['Inglês', 'en'], ['Iorubá', 'yo'], ['Italiano', 'it'], ['Japonês', 'ja'], ['Latim', 'la'],
  ['Malaio', 'ms'], ['Norueguês', 'no'], ['Persa', 'fa'], ['Polonês', 'pl'], ['Português', 'pt'],
  ['Punjabi', 'pa'], ['Russo', 'ru'], ['Suaíli', 'sw'], ['Sueco', 'sv'], ['Tailandês', 'th'],
  ['Tamil', 'ta'], ['Telugu', 'te'], ['Turco', 'tr'], ['Ucraniano', 'uk'], ['Urdu', 'ur'],
  ['Vietnamita', 'vi'], ['Zulu', 'zu'], ['Cantonês', 'yue'], ['Filipino', 'fil'], ['Multilíngue', 'mul'],
  ['Instrumental (Sem Letra)', 'zxx'], ['Outro', 'und'],
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

function renameConstraint(table: string, from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND conname = '${from}')
         AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND conname = '${to}') THEN
        ALTER TABLE "${table}" RENAME CONSTRAINT "${from}" TO "${to}";
      END IF;
    END $$;`;
}

/** Renames one key inside a jsonb object column (other keys kept). */
function renameJsonKey(column: string, from: string, to: string): string {
  return `
    UPDATE "works" SET "${column}" = ("${column}" - '${from}') || jsonb_build_object('${to}', "${column}"->'${from}')
    WHERE jsonb_typeof("${column}") = 'object' AND "${column}" ? '${from}' AND NOT "${column}" ? '${to}'`;
}

const AI_COLUMNS = ['ai_harmony', 'ai_melody', 'ai_lyrics'];

export class CanonicalizeWorksToEnglish20260928000018 implements MigrationInterface {
  name = 'CanonicalizeWorksToEnglish20260928000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of WORK_COLUMNS) await queryRunner.query(renameColumn('works', from, to));
    for (const [from, to] of PARTICIPANT_COLUMNS) await queryRunner.query(renameColumn('work_participants', from, to));
    await queryRunner.query(renameConstraint('work_participants', 'chk_work_participants_percentual', 'chk_work_participants_percentage'));

    // One source of truth: fill the English registry columns from the legacy
    // Portuguese form columns where they are still empty (never overwrite).
    const labels = LANGUAGE_LABEL_TO_CODE.map(([label, code]) => `('${label}', '${code}')`).join(', ');
    await queryRunner.query(`
      UPDATE "works" w SET "language" = m.code
      FROM (VALUES ${labels}) AS m(label, code)
      WHERE w."language" IS NULL AND w."legacy_language_label" = m.label`);
    // Rows whose language was derived to NULL for these two labels get the ISO code now.
    await queryRunner.query(`
      UPDATE "works" SET "language" = CASE "legacy_language_label" WHEN 'Instrumental (Sem Letra)' THEN 'zxx' ELSE 'und' END
      WHERE "language" IS NULL AND "legacy_language_label" IN ('Instrumental (Sem Letra)', 'Outro')`);
    await queryRunner.query(`
      UPDATE "works" SET "is_instrumental" = ("legacy_instrumental_flag" = 'sim')
      WHERE "is_instrumental" IS NULL AND "legacy_instrumental_flag" IN ('sim', 'nao')`);
    await queryRunner.query(`
      UPDATE "works" SET "ai_used" = "legacy_ai_used" WHERE "ai_used" IS NULL AND "legacy_ai_used" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "works" SET "alternative_titles" = "legacy_alternative_titles"
      WHERE "alternative_titles" IS NULL AND "legacy_alternative_titles" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "works" SET "lyrics" = "legacy_lyrics" WHERE "lyrics" IS NULL AND "legacy_lyrics" IS NOT NULL`);

    for (const [column, legacy, canonical] of WORK_VALUES) {
      await queryRunner.query(`UPDATE "works" SET "${column}" = $1 WHERE "${column}" = $2`, [canonical, legacy]);
    }
    for (const column of AI_COLUMNS) await queryRunner.query(renameJsonKey(column, 'ferramenta', 'tool'));
    for (const [legacy, canonical] of ROLE_VALUES) {
      await queryRunner.query(`UPDATE "work_participants" SET "role" = $1 WHERE lower("role") = $2`, [canonical, legacy]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [legacy, canonical] of ROLE_VALUES) {
      await queryRunner.query(`UPDATE "work_participants" SET "role" = $1 WHERE "role" = $2`, [legacy, canonical]);
    }
    for (const column of AI_COLUMNS) await queryRunner.query(renameJsonKey(column, 'tool', 'ferramenta'));
    for (const [column, legacy, canonical] of WORK_VALUES) {
      await queryRunner.query(`UPDATE "works" SET "${column}" = $1 WHERE "${column}" = $2`, [legacy, canonical]);
    }
    await queryRunner.query(renameConstraint('work_participants', 'chk_work_participants_percentage', 'chk_work_participants_percentual'));
    for (const [from, to] of [...PARTICIPANT_COLUMNS].reverse()) await queryRunner.query(renameColumn('work_participants', to, from));
    for (const [from, to] of [...WORK_COLUMNS].reverse()) await queryRunner.query(renameColumn('works', to, from));
  }
}
