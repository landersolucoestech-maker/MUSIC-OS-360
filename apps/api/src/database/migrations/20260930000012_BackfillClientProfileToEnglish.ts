import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';
import { CLIENT_PROFILES, LEGACY_CLIENT_PROFILES } from '../../modules/clients/client-profile-vocabulary';

/**
 * 20260930000012_BackfillClientProfileToEnglish (PV1 / S1)
 *
 * `clients.profile` (varchar(100) NOT NULL, no DEFAULT, no CHECK) stores the
 * specific contact identity. Its only writer of values is the web catalog
 * (contact-classification.ts), which held Portuguese slugs; migration
 * 20260928000023 renamed the column (perfil -> profile) but deliberately left
 * the values (BLK-CLIENT-PROFILE-TAXONOMY). The audit
 * (docs/naming/canonical-naming-map.json (client profile rows) section 1) fixed the canonical English
 * ids: 50 of the 60 catalog slugs are renamed, 10 (abramus, ecad, inpi,
 * beatmaker, designer, manager, mix_engineer, motion_designer, hosting,
 * cloud_provider) are proper nouns / English loanwords and stay.
 *
 * Expand-contract, Backfill-and-Restrict shape (see 20260930000010/11). The
 * EXPAND step lives in the API, not in the database: the column type/width is
 * unchanged and the API maps the deprecated Portuguese slugs to canonical ids on
 * write and filter (client-profile-vocabulary.ts, DTO @Transform +
 * canonicalizeClientInput), the web reads legacy slugs as canonical. DEPLOY THE
 * API FIRST (an old API build would keep writing Portuguese slugs after this
 * migration; they would simply be re-mapped by the next run / read as legacy).
 *
 *   1. Backfill: EXACT-match map only (the LEGACY_CLIENT_PROFILES constant, one
 *      statement, bound parameters). No case folding, no trimming, no guessing:
 *      a value that is not literally a catalog slug is left untouched.
 *      Idempotent: a row already holding a canonical id never matches.
 *      `updated_at` is left alone (a vocabulary rewrite is not a user edit;
 *      bumping it would make every open editor fail its optimistic-concurrency
 *      check). Soft-deleted rows are rewritten too.
 *   2. Report (never abort): distinct values outside the canonical set (e.g.
 *      `produtora`, anything from the pre-catalog app) are listed in the log,
 *      at most 20 values each truncated to 40 characters.
 *
 * NO CHECK is added, deliberately (audit proposed a format CHECK NOT VALID):
 * the column is a free string on the API (the DTO validates length only, the
 * reports import may also write it) and unknown residue is tolerated by
 * design. A NOT VALID CHECK still runs on every UPDATE of a residue row, so
 * renaming a contact whose profile is `Produtora X` would start failing with a
 * constraint error; an exact-list CHECK would couple the database to a web
 * catalog. A CHECK needs the residue preflight (runbook SQL: distinct
 * clients.profile outside the canonical set) to be 0 in every environment first.
 *
 * DEFAULT: clients.profile has no database default; the fallback is applied by
 * ClientsService (DEFAULT_CLIENT_PROFILE = 'other', was 'outros'), the lead
 * conversion handler and the seed.
 *
 * down(): maps every renamed canonical id back to its Portuguese slug
 * (one-to-one, the map is injective). Rows written canonical after up() are
 * therefore also rewritten, which is what the previous build reads. The
 * proper-noun ids that never changed are not touched. No table is dropped.
 */
const LEGACY = Object.keys(LEGACY_CLIENT_PROFILES);
const CANONICAL_OF_LEGACY = LEGACY.map((legacy) => LEGACY_CLIENT_PROFILES[legacy]);

const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

const REWRITE = (from: 'legacy' | 'canonical'): string => {
  const [match, target] = from === 'legacy' ? ['legacy', 'canonical'] : ['canonical', 'legacy'];
  return `WITH updated AS (
           UPDATE "clients" AS c SET "profile" = m.${target}
           FROM unnest($1::text[], $2::text[]) AS m(legacy, canonical)
           WHERE c."profile" = m.${match}
           RETURNING m.${match} AS matched
         )
         SELECT matched AS value, count(*)::int AS affected FROM updated GROUP BY matched ORDER BY matched`;
};

export class BackfillClientProfileToEnglish20260930000012 implements MigrationInterface {
  name = 'BackfillClientProfileToEnglish20260930000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const changed: Array<{ value: string; affected: number }> = await queryRunner.query(REWRITE('legacy'), [LEGACY, CANONICAL_OF_LEGACY]);
    const total = changed.reduce((sum, row) => sum + row.affected, 0);
    console.log(
      `[BackfillClientProfileToEnglish] clients.profile renamed: ${total} row(s)` +
        (changed.length ? ` [${formatAuditValues(changed.map((row) => `${row.value}=${row.affected}`))}]` : ''),
    );

    const residue: Array<{ value: string }> = await queryRunner.query(
      `SELECT DISTINCT "profile" AS value
       FROM "clients"
       WHERE "profile" NOT IN (${quote(CLIENT_PROFILES)})
       ORDER BY 1
       LIMIT 21`,
    );
    console.log(
      `[BackfillClientProfileToEnglish] clients.profile outside the canonical set (left untouched): ` +
        (residue.length ? `[${formatAuditValues(residue.map((row) => row.value))}]` : 'none'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const changed: Array<{ value: string; affected: number }> = await queryRunner.query(REWRITE('canonical'), [LEGACY, CANONICAL_OF_LEGACY]);
    console.log(`[BackfillClientProfileToEnglish] down: clients.profile restored to Portuguese slugs: ${changed.reduce((sum, row) => sum + row.affected, 0)} row(s)`);
  }
}
