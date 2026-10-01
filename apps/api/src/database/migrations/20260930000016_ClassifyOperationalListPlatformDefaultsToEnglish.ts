import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';
import { OPERATIONAL_LIST_DEFAULTS } from '../../modules/operational-lists/operational-lists.defaults';
import {
  LEGACY_OPERATIONAL_NAMES,
  legacyOperationalSlugs,
  operationalStableKey,
} from '../../modules/operational-lists/operational-list-vocabulary';

/**
 * 20260930000016_ClassifyOperationalListPlatformDefaultsToEnglish (OL1)
 *
 * `operational_list_items` holds platform-seeded defaults (OPERATIONAL_LIST_DEFAULTS,
 * seeded per tenant by 20260713000001 and by the first-read bootstrap) AND
 * tenant-authored items, with nothing telling them apart; the seeded slugs were
 * Portuguese (artista_banda, novo_lead, sessoes_estudio...). Tenant content is
 * NEVER translated, so the platform rows must be PROVEN before they are touched.
 *
 * Expand-contract. EXPAND (this migration + the API/web read paths):
 *
 *   1. Schema, additive only: `origin` (NULL | 'platform' | 'tenant', CHECK),
 *      `stable_key`, `legacy_slug` (all nullable), a partial UNIQUE index on
 *      (tenant_id, kind, stable_key) and on (tenant_id, kind, legacy_slug) for
 *      live rows. The RLS policies are table-level and already cover the columns.
 *      `origin` stays NULL for every row not proven to be a platform default
 *      ("unclassified"); the API writes 'tenant' for rows created through it.
 *   2. Classification, one statement, bound parameters: a row is a platform
 *      default only if (kind, slug, name) EXACTLY equals a default, in its
 *      canonical form or in the legacy form the pre-OL1 seed wrote (no case
 *      folding, no trimming). A proven row gets origin='platform' and its
 *      `stable_key`; when its slug was Portuguese it is renamed to the canonical
 *      English slug and the old slug is kept in `legacy_slug` (the API lookups
 *      and the web readers resolve the alias). `name` (the pt-BR label),
 *      metadata and `updated_at` are NOT touched: a vocabulary rewrite is not a
 *      user edit and bumping updated_at would fail every open editor's
 *      optimistic-concurrency check.
 *   3. Per-tenant conflict detection: when a LIVE row of the same tenant and kind
 *      already uses the canonical slug, the legacy row is skipped (left exactly
 *      as it was) and reported; nothing is merged or overwritten.
 *   4. Report (never abort): unclassified rows whose (kind, slug) is a platform
 *      slug but whose name was edited, and every other unclassified row (tenant
 *      content), each as at most 20 values truncated to 40 characters.
 *
 * The marketing_* / briefing_service_type kinds keep their slug (they are the
 * persisted vocabulary of the marketing module, BLK-MARKETING-TARGET-WEB-VOCABULARY);
 * only `origin` and the English `stable_key` are set for them.
 *
 * The API is deployed first (older builds ignore the new columns and keep
 * reading slugs; rows renamed here are then only reachable by their canonical
 * slug, which is why the web readers map legacy <-> canonical).
 *
 * down(): renames the platform rows that hold a canonical slug back to their
 * Portuguese slug (skipping, and reporting, any row whose Portuguese slug is now
 * taken by a live row). Nothing is dropped: the additive columns, indexes and the
 * CHECK stay (older builds ignore them) and the contract step (drop legacy_slug)
 * is a separate, destructive migration gated on a zero census.
 */
export interface OperationalListMatchVariant {
  kind: string;
  matchSlug: string;
  matchName: string;
  canonicalSlug: string;
  stableKey: string;
}

export interface OperationalListRename {
  kind: string;
  stableKey: string;
  canonicalSlug: string;
  legacySlug: string;
}

/** Canonical form of every default, plus the legacy form the pre-OL1 seed wrote. */
export function buildMatchVariants(): OperationalListMatchVariant[] {
  const variants: OperationalListMatchVariant[] = [];
  for (const item of OPERATIONAL_LIST_DEFAULTS) {
    const stableKey = operationalStableKey(item.kind, item.slug);
    variants.push({ kind: item.kind, matchSlug: item.slug, matchName: item.name, canonicalSlug: item.slug, stableKey });
    for (const legacy of legacyOperationalSlugs(item.kind, item.slug)) {
      const legacyName = LEGACY_OPERATIONAL_NAMES[item.kind]?.[item.slug] ?? item.name;
      variants.push({ kind: item.kind, matchSlug: legacy, matchName: legacyName, canonicalSlug: item.slug, stableKey });
    }
  }
  return variants;
}

export function buildRenames(): OperationalListRename[] {
  const renames: OperationalListRename[] = [];
  for (const item of OPERATIONAL_LIST_DEFAULTS) {
    for (const legacy of legacyOperationalSlugs(item.kind, item.slug)) {
      renames.push({ kind: item.kind, stableKey: operationalStableKey(item.kind, item.slug), canonicalSlug: item.slug, legacySlug: legacy });
    }
  }
  return renames;
}

const VARIANTS = buildMatchVariants();
const RENAMES = buildRenames();

const variantParams = (): string[][] => [
  VARIANTS.map((v) => v.kind),
  VARIANTS.map((v) => v.matchSlug),
  VARIANTS.map((v) => v.matchName),
  VARIANTS.map((v) => v.canonicalSlug),
  VARIANTS.map((v) => v.stableKey),
];

/** distinct (kind, slug) pairs that are platform slugs, in either form */
const knownSlugParams = (): string[][] => {
  const pairs = [...new Set(VARIANTS.map((v) => `${v.kind}\u0000${v.matchSlug}`))].map((pair) => pair.split('\u0000'));
  return [pairs.map((p) => p[0]), pairs.map((p) => p[1])];
};

const renameParams = (): string[][] => [
  RENAMES.map((r) => r.kind),
  RENAMES.map((r) => r.stableKey),
  RENAMES.map((r) => r.canonicalSlug),
  RENAMES.map((r) => r.legacySlug),
];

const MATCHED_CTE = `WITH m AS (
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
             AS m(kind, match_slug, match_name, canonical_slug, stable_key)
         ), matched AS (
           SELECT i."id" AS id, i."kind" AS kind, i."slug" AS old_slug, m.canonical_slug, m.stable_key,
                  (i."slug" <> m.canonical_slug) AS needs_rename,
                  (i."slug" <> m.canonical_slug AND EXISTS (
                     SELECT 1 FROM "operational_list_items" o
                     WHERE o."tenant_id" = i."tenant_id" AND o."kind" = i."kind" AND o."slug" = m.canonical_slug
                       AND o."id" <> i."id" AND o."deleted_at" IS NULL
                  )) AS conflict
           FROM "operational_list_items" i
           JOIN m ON i."kind" = m.kind AND i."slug" = m.match_slug AND i."name" = m.match_name
           WHERE i."origin" IS NULL
         )`;

const CONFLICTS_SQL = `${MATCHED_CTE}
         SELECT kind || ':' || old_slug AS value, count(*)::int AS affected
         FROM matched WHERE conflict GROUP BY kind, old_slug ORDER BY 1 LIMIT 21`;

const CLASSIFY_SQL = `${MATCHED_CTE}, updated AS (
           UPDATE "operational_list_items" AS t
           SET "slug" = x.canonical_slug,
               "legacy_slug" = CASE WHEN x.needs_rename THEN x.old_slug END,
               "origin" = 'platform',
               "stable_key" = x.stable_key
           FROM matched x
           WHERE t."id" = x."id" AND NOT x.conflict
           RETURNING x.kind AS kind, x.old_slug AS old_slug, x.needs_rename AS renamed
         )
         SELECT kind || ':' || old_slug AS value, renamed, count(*)::int AS affected
         FROM updated GROUP BY kind, old_slug, renamed ORDER BY 1`;

const KNOWN_CTE = `WITH k AS (SELECT * FROM unnest($1::text[], $2::text[]) AS k(kind, slug))`;

const UNCLASSIFIED_COUNT_SQL = `${KNOWN_CTE}
         SELECT count(*) FILTER (WHERE k.kind IS NOT NULL)::int AS platform_slug_edited,
                count(*) FILTER (WHERE k.kind IS NULL)::int AS other
         FROM "operational_list_items" i
         LEFT JOIN k ON k.kind = i."kind" AND k.slug = i."slug"
         WHERE i."origin" IS NULL`;

const UNCLASSIFIED_LIST_SQL = (known: boolean): string => `${KNOWN_CTE}
         SELECT DISTINCT i."kind" || ':' || i."slug" AS value
         FROM "operational_list_items" i
         LEFT JOIN k ON k.kind = i."kind" AND k.slug = i."slug"
         WHERE i."origin" IS NULL AND k.kind IS ${known ? 'NOT NULL' : 'NULL'}
         ORDER BY 1
         LIMIT 21`;

const RENAMEABLE_CTE = `WITH m AS (
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS m(kind, stable_key, canonical_slug, legacy_slug)
         ), restorable AS (
           SELECT i."id" AS id, m.kind, m.canonical_slug, m.legacy_slug,
                  EXISTS (
                    SELECT 1 FROM "operational_list_items" o
                    WHERE o."tenant_id" = i."tenant_id" AND o."kind" = i."kind" AND o."slug" = m.legacy_slug
                      AND o."id" <> i."id" AND o."deleted_at" IS NULL
                  ) AS conflict
           FROM "operational_list_items" i
           JOIN m ON i."kind" = m.kind AND i."stable_key" = m.stable_key AND i."slug" = m.canonical_slug
           WHERE i."origin" = 'platform'
         )`;

const DOWN_CONFLICTS_SQL = `${RENAMEABLE_CTE}
         SELECT kind || ':' || canonical_slug AS value, count(*)::int AS affected
         FROM restorable WHERE conflict GROUP BY kind, canonical_slug ORDER BY 1 LIMIT 21`;

const DOWN_RESTORE_SQL = `${RENAMEABLE_CTE}, updated AS (
           UPDATE "operational_list_items" AS t
           SET "slug" = r.legacy_slug, "legacy_slug" = NULL
           FROM restorable r
           WHERE t."id" = r.id AND NOT r.conflict
           RETURNING r.kind AS kind, r.canonical_slug AS canonical_slug
         )
         SELECT kind || ':' || canonical_slug AS value, count(*)::int AS affected
         FROM updated GROUP BY kind, canonical_slug ORDER BY 1`;

const TAG = '[ClassifyOperationalListPlatformDefaults]';

export class ClassifyOperationalListPlatformDefaultsToEnglish20260930000016 implements MigrationInterface {
  name = 'ClassifyOperationalListPlatformDefaultsToEnglish20260930000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    // 1. Additive schema (nullable columns, guarded CHECK, partial unique indexes).
    await queryRunner.query(
      `ALTER TABLE "operational_list_items"
         ADD COLUMN IF NOT EXISTS "origin" VARCHAR(10),
         ADD COLUMN IF NOT EXISTS "stable_key" VARCHAR(150),
         ADD COLUMN IF NOT EXISTS "legacy_slug" VARCHAR(100)`,
    );
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_operational_list_items_origin') THEN
           ALTER TABLE "operational_list_items"
             ADD CONSTRAINT "chk_operational_list_items_origin" CHECK ("origin" IS NULL OR "origin" IN ('platform', 'tenant'));
         END IF;
       END $$`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_operational_list_items_tenant_kind_stable_key"
         ON "operational_list_items" ("tenant_id", "kind", "stable_key")
         WHERE "stable_key" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_operational_list_items_tenant_kind_legacy_slug"
         ON "operational_list_items" ("tenant_id", "kind", "legacy_slug")
         WHERE "legacy_slug" IS NOT NULL AND "deleted_at" IS NULL`,
    );

    // 3. Conflicts are reported first (they are skipped by the statement below).
    const conflicts: Array<{ value: string; affected: number }> = await queryRunner.query(CONFLICTS_SQL, variantParams());
    console.log(
      `${TAG} canonical slug already used by another live row of the tenant (skipped, left untouched): ` +
        (conflicts.length ? `[${formatAuditValues(conflicts.map((row) => `${row.value}=${row.affected}`))}]` : 'none'),
    );

    // 2. Classification: exact (kind, slug, name) match only.
    const changed: Array<{ value: string; renamed: boolean; affected: number }> = await queryRunner.query(CLASSIFY_SQL, variantParams());
    const total = changed.reduce((sum, row) => sum + row.affected, 0);
    const renamed = changed.filter((row) => row.renamed).reduce((sum, row) => sum + row.affected, 0);
    console.log(
      `${TAG} platform defaults classified: ${total} row(s), ${renamed} renamed to the canonical slug` +
        (changed.length ? ` [${formatAuditValues(changed.map((row) => `${row.value}=${row.affected}`))}]` : ''),
    );

    // 4. Report the rest (never abort).
    const counts: Array<{ platform_slug_edited: number; other: number }> = await queryRunner.query(UNCLASSIFIED_COUNT_SQL, knownSlugParams());
    const edited: Array<{ value: string }> = await queryRunner.query(UNCLASSIFIED_LIST_SQL(true), knownSlugParams());
    const other: Array<{ value: string }> = await queryRunner.query(UNCLASSIFIED_LIST_SQL(false), knownSlugParams());
    console.log(
      `${TAG} unclassified rows with a platform slug but a different name (edited or conflicting, left untouched): ` +
        `${counts[0]?.platform_slug_edited ?? 0} row(s) [${edited.length ? formatAuditValues(edited.map((row) => row.value)) : 'none'}]`,
    );
    console.log(
      `${TAG} unclassified rows not matching any platform default (tenant content, left untouched): ` +
        `${counts[0]?.other ?? 0} row(s) [${other.length ? formatAuditValues(other.map((row) => row.value)) : 'none'}]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const conflicts: Array<{ value: string; affected: number }> = await queryRunner.query(DOWN_CONFLICTS_SQL, renameParams());
    console.log(
      `${TAG} down: Portuguese slug already taken by a live row (skipped): ` +
        (conflicts.length ? `[${formatAuditValues(conflicts.map((row) => `${row.value}=${row.affected}`))}]` : 'none'),
    );

    const restored: Array<{ value: string; affected: number }> = await queryRunner.query(DOWN_RESTORE_SQL, renameParams());
    console.log(
      `${TAG} down: platform defaults restored to the Portuguese slug: ${restored.reduce((sum, row) => sum + row.affected, 0)} row(s)`,
    );
  }
}
