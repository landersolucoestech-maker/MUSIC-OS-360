import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260929000002_BackfillAndRestrictMarketingContentVocabularyToEnglish (S8)
 *
 * `marketing_content_posts.status`, `.target_type` and `.content_type` are
 * plain varchar(40) columns with no CHECK, holding Portuguese values written
 * by the app (status rascunho/agendado/publicado/cancelado/falhou, target
 * projeto_musical/artista/empresa, content type carrossel/anuncio/...).
 * Technical vocabulary is English (the web renders the PT-BR labels).
 *
 * Same single-migration Backfill-and-Restrict shape as the 20260910* series.
 * Schema and app code must be swapped atomically: after this migration an old
 * API build that still writes Portuguese values fails the CHECK, and an old
 * publishing worker (which filters status = 'agendado') would silently skip
 * rows that are now 'scheduled'. Stop the old API and workers (or drain the
 * publishing queue) before running it -- see docs/runbooks/staging-to-production.md,
 * "Marketing vocabulary release". The expand step is unnecessary
 * because the columns keep their type and width. The compatibility layer for a
 * web build that is still the old one lives in the API DTO (deprecated input
 * mapped before validation), not in the database.
 *
 *   1. Backfill exact legacy values (case/space-insensitive, idempotent -- a
 *      row already holding a canonical value never matches). `updated_at` is
 *      left alone: this is a vocabulary rewrite, not a user edit, and bumping
 *      it would make every open editor fail its optimistic-concurrency check.
 *   2. Verify: any remaining value outside the canonical set aborts the
 *      migration with the offending values listed, before any constraint is
 *      added (nothing is guessed or coerced).
 *   3. Restrict: column default -> 'scheduled', then the three CHECKs.
 *
 * The web-only pipeline stages ideia/producao/revisao and the derived
 * `atrasado` are not persisted states (the DTO never accepted them), so they
 * have no mapping: a row holding one aborts step 2 for a human decision.
 *
 * down(): drops the CHECKs, restores the old default and maps every
 * canonical value back to its Portuguese spelling (the mappings are
 * one-to-one). A row whose value was already canonical before up() and equals
 * a mapped target (e.g. a free-text content_type 'artist') is also rewritten
 * to its Portuguese spelling; the previous build read those as unknown values
 * anyway.
 */
type Pair = readonly [legacy: string, canonical: string];

const STATUSES: ReadonlyArray<Pair> = [
  ['rascunho', 'draft'],
  ['agendado', 'scheduled'],
  ['publicado', 'published'],
  ['cancelado', 'cancelled'],
  ['falhou', 'failed'],
];

const TARGET_TYPES: ReadonlyArray<Pair> = [
  ['projeto_musical', 'music_project'],
  ['artista', 'artist'],
  ['empresa', 'company'],
];

const CONTENT_TYPES: ReadonlyArray<Pair> = [
  ['carrossel', 'carousel'],
  ['anuncio', 'ad'],
  ['rede_social', 'social_media'],
  ['institucional', 'institutional'],
  ['comercial', 'commercial'],
  ['artista', 'artist'],
  ['bastidores', 'behind_the_scenes'],
  ['reuniao', 'meeting'],
  ['evento', 'event'],
  ['publicidade', 'advertising'],
];

/** Formats that were already English before this migration (no rewrite). */
const CONTENT_TYPES_UNCHANGED = ['post', 'feed', 'stories', 'reels', 'shorts', 'video', 'portal', 'blog'];

const COLUMNS: ReadonlyArray<{
  column: 'status' | 'target_type' | 'content_type';
  constraint: string;
  pairs: ReadonlyArray<Pair>;
  unchanged: ReadonlyArray<string>;
}> = [
  { column: 'status', constraint: 'chk_marketing_content_posts_status', pairs: STATUSES, unchanged: [] },
  { column: 'target_type', constraint: 'chk_marketing_content_posts_target_type', pairs: TARGET_TYPES, unchanged: [] },
  { column: 'content_type', constraint: 'chk_marketing_content_posts_content_type', pairs: CONTENT_TYPES, unchanged: CONTENT_TYPES_UNCHANGED },
];

const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');
const canonicalValues = (spec: (typeof COLUMNS)[number]): string[] => [...spec.pairs.map(([, canonical]) => canonical), ...spec.unchanged];

export class BackfillAndRestrictMarketingContentVocabularyToEnglish20260929000002 implements MigrationInterface {
  name = 'BackfillAndRestrictMarketingContentVocabularyToEnglish20260929000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const spec of COLUMNS) {
      for (const [legacy, canonical] of spec.pairs) {
        const [{ affected }] = await queryRunner.query(
          `WITH updated AS (
             UPDATE "marketing_content_posts" SET "${spec.column}" = $2
             WHERE lower(trim("${spec.column}")) = $1 AND "${spec.column}" <> $2
             RETURNING id
           )
           SELECT count(*)::int AS affected FROM updated`,
          [legacy, canonical],
        );
        console.log(
          `[BackfillAndRestrictMarketingContentVocabularyToEnglish] marketing_content_posts.${spec.column} '${legacy}' -> '${canonical}': ${affected} row(s)`,
        );
      }
    }

    for (const spec of COLUMNS) {
      const invalidRows: Array<{ value: string }> = await queryRunner.query(
        `SELECT DISTINCT "${spec.column}" AS value
         FROM "marketing_content_posts"
         WHERE "${spec.column}" NOT IN (${quote(canonicalValues(spec))})`,
      );
      if (invalidRows.length > 0) {
        throw new Error(
          `${this.name}: cannot add CHECK constraint, "marketing_content_posts"."${spec.column}" contains ` +
            `unexpected values after backfill: [${invalidRows.map((row) => row.value).join(', ')}]. ` +
            `Fix or migrate this data before re-running this migration.`,
        );
      }
    }

    // The old default ('agendado') would violate the CHECK for any INSERT that relies on it.
    await queryRunner.query(`ALTER TABLE "marketing_content_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled'`);
    for (const spec of COLUMNS) {
      await queryRunner.query(`ALTER TABLE "marketing_content_posts" DROP CONSTRAINT IF EXISTS "${spec.constraint}"`);
      await queryRunner.query(
        `ALTER TABLE "marketing_content_posts" ADD CONSTRAINT "${spec.constraint}" ` +
          `CHECK ("${spec.column}" IN (${quote(canonicalValues(spec))}))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const spec of COLUMNS) {
      await queryRunner.query(`ALTER TABLE "marketing_content_posts" DROP CONSTRAINT IF EXISTS "${spec.constraint}"`);
    }
    await queryRunner.query(`ALTER TABLE "marketing_content_posts" ALTER COLUMN "status" SET DEFAULT 'agendado'`);

    for (const spec of COLUMNS) {
      for (const [legacy, canonical] of spec.pairs) {
        await queryRunner.query(
          `UPDATE "marketing_content_posts" SET "${spec.column}" = $1 WHERE "${spec.column}" = $2`,
          [legacy, canonical],
        );
      }
    }
  }
}
