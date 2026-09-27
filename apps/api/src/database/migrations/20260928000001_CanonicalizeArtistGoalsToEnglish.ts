import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000001_CanonicalizeArtistGoalsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the last
 * Portuguese technical names on `artist_goals`.
 *
 * Column:
 *   periodo -> period            (default 'mensal' -> 'monthly')
 *
 * Persisted technical values (their PT-BR labels live in the web UI):
 *   period:  mensal -> monthly, semanal -> weekly, trimestral -> quarterly,
 *            semestral -> semiannual, anual -> yearly
 *   type:    seguidores -> followers, receita -> revenue, engajamento -> engagement,
 *            lancamentos -> releases, eventos -> shows, outros / personalizada -> other
 *            (streams, shows and followers were already English)
 *
 * metadata (jsonb) keys written by the web goal form:
 *   descricao -> description, categoria -> category, unidade -> unit,
 *   responsavel -> owner, cor -> color, icone -> icon
 * metadata.category values:
 *   crescimento -> growth, financeiro -> financial, producao -> production,
 *   carreira -> career   (marketing unchanged)
 *
 * status is already English and CHECK-restricted (20260910000003).
 *
 * RENAME COLUMN is metadata-only; every UPDATE touches only rows still holding
 * a legacy name/value, so the migration is idempotent. down() restores the
 * column, default and the values that only ever existed in Portuguese; values
 * the previous code also wrote in English (followers, shows) stay English and
 * 'other' returns as 'outros'.
 */
const PERIODS: ReadonlyArray<[string, string]> = [
  ['mensal', 'monthly'],
  ['semanal', 'weekly'],
  ['trimestral', 'quarterly'],
  ['semestral', 'semiannual'],
  ['anual', 'yearly'],
];

const GOAL_TYPES: ReadonlyArray<[string, string]> = [
  ['seguidores', 'followers'],
  ['receita', 'revenue'],
  ['engajamento', 'engagement'],
  ['lancamentos', 'releases'],
  ['eventos', 'shows'],
  ['outros', 'other'],
  ['personalizada', 'other'],
];

/** Reverse of GOAL_TYPES for down(): only values that never existed in English before. */
const GOAL_TYPES_DOWN: ReadonlyArray<[string, string]> = [
  ['revenue', 'receita'],
  ['engagement', 'engajamento'],
  ['releases', 'lancamentos'],
  ['other', 'outros'],
];

const METADATA_KEYS: ReadonlyArray<[string, string]> = [
  ['descricao', 'description'],
  ['categoria', 'category'],
  ['unidade', 'unit'],
  ['responsavel', 'owner'],
  ['cor', 'color'],
  ['icone', 'icon'],
];

const CATEGORIES: ReadonlyArray<[string, string]> = [
  ['crescimento', 'growth'],
  ['financeiro', 'financial'],
  ['producao', 'production'],
  ['carreira', 'career'],
];

function swap(pairs: ReadonlyArray<[string, string]>): Array<[string, string]> {
  return pairs.map(([a, b]) => [b, a]);
}

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'artist_goals' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'artist_goals' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "artist_goals" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function remapValues(column: string, pairs: ReadonlyArray<[string, string]>): string {
  const cases = pairs.map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
  const sources = pairs.map(([from]) => `'${from}'`).join(', ');
  return `UPDATE "artist_goals" SET "${column}" = CASE "${column}" ${cases} END WHERE "${column}" IN (${sources});`;
}

/** Moves metadata.<from> to metadata.<to>; an existing <to> key wins and <from> is dropped. */
function renameMetadataKey(from: string, to: string): string {
  return `
    UPDATE "artist_goals"
       SET "metadata" = CASE WHEN "metadata" ? '${to}' THEN "metadata" - '${from}'
                             ELSE ("metadata" - '${from}') || jsonb_build_object('${to}', "metadata" -> '${from}') END
     WHERE "metadata" ? '${from}';`;
}

function remapCategory(key: string, pairs: ReadonlyArray<[string, string]>): string {
  const cases = pairs.map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
  const sources = pairs.map(([from]) => `'${from}'`).join(', ');
  return `
    UPDATE "artist_goals"
       SET "metadata" = jsonb_set("metadata", '{${key}}', to_jsonb(CASE "metadata" ->> '${key}' ${cases} END))
     WHERE "metadata" ->> '${key}' IN (${sources});`;
}

export class CanonicalizeArtistGoalsToEnglish20260928000001 implements MigrationInterface {
  name = 'CanonicalizeArtistGoalsToEnglish20260928000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(renameColumn('periodo', 'period'));
    await queryRunner.query(remapValues('period', PERIODS));
    await queryRunner.query(`ALTER TABLE "artist_goals" ALTER COLUMN "period" SET DEFAULT 'monthly';`);
    await queryRunner.query(remapValues('type', GOAL_TYPES));
    for (const [from, to] of METADATA_KEYS) await queryRunner.query(renameMetadataKey(from, to));
    await queryRunner.query(remapCategory('category', CATEGORIES));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(remapCategory('category', swap(CATEGORIES)));
    for (const [from, to] of swap(METADATA_KEYS)) await queryRunner.query(renameMetadataKey(from, to));
    await queryRunner.query(remapValues('type', GOAL_TYPES_DOWN));
    await queryRunner.query(`ALTER TABLE "artist_goals" ALTER COLUMN "period" SET DEFAULT 'mensal';`);
    await queryRunner.query(remapValues('period', swap(PERIODS)));
    await queryRunner.query(renameColumn('period', 'periodo'));
  }
}
