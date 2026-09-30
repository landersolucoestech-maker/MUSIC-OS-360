import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';
import {
  DEFAULT_ORGANIZATION_INDUSTRY,
  LEGACY_ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRIES,
} from '../../modules/auth/organization-industry';

/**
 * 20260930000013_BackfillOrganizationIndustryToEnglish (PV1 / S2)
 *
 * `organizations.industry` (varchar(100) NOT NULL DEFAULT 'gravadora', no CHECK)
 * stored three conflicting Portuguese vocabularies (web Register, web
 * Onboarding, the two API DTOs). PV1/S0 established ONE canonical English
 * vocabulary (apps/api/src/modules/auth/organization-industry.ts, mirrored by
 * the web) and the API now maps deprecated Portuguese input to it.
 *
 * Expand-contract, Backfill-and-Restrict shape (see 20260930000010/11). The
 * EXPAND step lives in the API (DTO @Transform + IsIn(canonical), DEFAULT
 * constant, the web reads legacy values as canonical). DEPLOY THE API FIRST.
 *
 *   1. Backfill: EXACT-match map only (LEGACY_ORGANIZATION_INDUSTRIES, one
 *      statement, bound parameters): gravadora -> record_label, editora ->
 *      music_publisher, distribuidora -> distributor, agencia -> artist_agency,
 *      outro -> other, produtora -> music_production_company, escritorio ->
 *      artist_management (the last two were only ever offered by the Register
 *      form, which the API rejected: zero rows expected). `publisher` and
 *      `indie` are already canonical. No case folding / trimming / guessing.
 *      Idempotent. `updated_at` is left alone (vocabulary rewrite, not a user
 *      edit). `organizations` is a tenant-root table: the RLS-bypass guard
 *      makes sure every tenant is rewritten.
 *   2. DEFAULT: 'gravadora' -> 'record_label' (the entity default and every
 *      seed/bootstrap/SQL artifact are changed in the same PR).
 *   3. Report (never abort): distinct values outside the canonical set are
 *      listed in the log (at most 20, each truncated to 40 characters).
 *
 * NO CHECK is added, deliberately: an OLD API build still running during the
 * rollout writes Portuguese values (provisioning writes the DTO value verbatim)
 * and would start failing signups with a constraint error, and hand-edited
 * rows of unknown shape would abort the migration. Add the CHECK in a later
 * migration after the runbook residue preflight is 0 in every environment.
 *
 * down(): restores the DEFAULT 'gravadora' and maps the seven renamed ids back
 * to their Portuguese spelling (one-to-one; `publisher`, `indie` were never
 * renamed). Rows written canonical after up() are rewritten too, which is what
 * the previous build reads.
 */
const LEGACY = Object.keys(LEGACY_ORGANIZATION_INDUSTRIES);
const CANONICAL_OF_LEGACY = LEGACY.map((legacy) => LEGACY_ORGANIZATION_INDUSTRIES[legacy]);
const PREVIOUS_DEFAULT = 'gravadora';

const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

const REWRITE = (from: 'legacy' | 'canonical'): string => {
  const [match, target] = from === 'legacy' ? ['legacy', 'canonical'] : ['canonical', 'legacy'];
  return `WITH updated AS (
           UPDATE "organizations" AS o SET "industry" = m.${target}
           FROM unnest($1::text[], $2::text[]) AS m(legacy, canonical)
           WHERE o."industry" = m.${match}
           RETURNING m.${match} AS matched
         )
         SELECT matched AS value, count(*)::int AS affected FROM updated GROUP BY matched ORDER BY matched`;
};

export class BackfillOrganizationIndustryToEnglish20260930000013 implements MigrationInterface {
  name = 'BackfillOrganizationIndustryToEnglish20260930000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const changed: Array<{ value: string; affected: number }> = await queryRunner.query(REWRITE('legacy'), [LEGACY, CANONICAL_OF_LEGACY]);
    console.log(
      `[BackfillOrganizationIndustryToEnglish] organizations.industry renamed: ${changed.reduce((sum, row) => sum + row.affected, 0)} row(s)` +
        (changed.length ? ` [${formatAuditValues(changed.map((row) => `${row.value}=${row.affected}`))}]` : ''),
    );

    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "industry" SET DEFAULT '${DEFAULT_ORGANIZATION_INDUSTRY}'`);

    const residue: Array<{ value: string }> = await queryRunner.query(
      `SELECT DISTINCT "industry" AS value
       FROM "organizations"
       WHERE "industry" NOT IN (${quote(ORGANIZATION_INDUSTRIES)})
       ORDER BY 1
       LIMIT 21`,
    );
    console.log(
      `[BackfillOrganizationIndustryToEnglish] organizations.industry outside the canonical set (left untouched): ` +
        (residue.length ? `[${formatAuditValues(residue.map((row) => row.value))}]` : 'none'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "industry" SET DEFAULT '${PREVIOUS_DEFAULT}'`);
    const changed: Array<{ value: string; affected: number }> = await queryRunner.query(REWRITE('canonical'), [LEGACY, CANONICAL_OF_LEGACY]);
    console.log(`[BackfillOrganizationIndustryToEnglish] down: organizations.industry restored to Portuguese values: ${changed.reduce((sum, row) => sum + row.affected, 0)} row(s)`);
  }
}
