import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000031_ClassifyMarketingAndContactOperationalListsToEnglish (AP3 / R3-03)
 *
 * Extends the OL1 classification (20260930000016) to the kinds it deferred or did not know:
 *
 *   marketing_context       projeto_musical/artista/empresa              -> music_project/artist/company
 *   marketing_sector        Design/Audiovisual/Marketing/Comunicação     -> design/audiovisual/marketing/communication
 *   marketing_task_type     campanha                                     -> campaign
 *   briefing_service_type   campanha/conteudo                            -> campaign/content
 *   contact_pf_classification  (KIND renamed, slugs already English)     -> contact_individual_classification
 *   contact_pj_classification  (KIND renamed, slugs already English)     -> contact_company_classification
 *
 * Platform-owned vs tenant content: a row is a platform default ONLY by an EXACT (kind, slug, name) match
 * (no case folding, no trimming) with `origin` NULL or 'platform'. Tenant-authored rows (origin 'tenant'),
 * rows whose name was edited, and any other slug are never touched. The pt-BR copy stays in `name`
 * (unchanged), `metadata` and `updated_at` are NOT touched (a vocabulary rewrite is not a user edit).
 * A matched row gets: new kind and slug, the old slug in `legacy_slug` (only when the slug changed and it is
 * free), origin 'platform' and `stable_key` = '<kind>.<slug lower-case>'. A row whose target
 * (tenant, kind, slug / stable_key) is already used by another LIVE row is skipped and counted (never merged).
 *
 * Mechanics: jsonb-row-backfill.ts (candidate predicate, idempotent, guarded UPDATE so a concurrent edit wins,
 * BEFORE/AFTER of the changed columns only in the locked-down side table
 * `operational_list_classification_backfill_20260930`, counts-only logs). down() restores BEFORE for the rows
 * that still hold exactly AFTER. Nothing is dropped.
 *
 * Expand/contract: the API (DTO @Transform before validation, list/lookup dual kind, canonical responses) and the web
 * readers accept the legacy kind and slugs until the census in docs/runbooks/staging-to-production.md#residue-census-20260930000031 is 0; the contract step
 * (drop legacy maps / legacy_slug) is a later, separate migration. Deploy the API first.
 */
const MIGRATION = 'ClassifyMarketingAndContactOperationalListsToEnglish20260930000031';
const LOG_TABLE = 'operational_list_classification_backfill_20260930';

/** Frozen copy of the platform defaults involved (kind, slug and name as seeded). */
interface Variant {
  kind: string;
  slug: string;
  name: string;
  newKind: string;
  newSlug: string;
}
const rename = (kind: string, rows: Array<[string, string, string]>, newKind = kind): Variant[] =>
  rows.map(([slug, name, newSlug]) => ({ kind, slug, name, newKind, newSlug }));

export const OPERATIONAL_LIST_AP3_VARIANTS: readonly Variant[] = [
  ...rename('marketing_context', [
    ['projeto_musical', 'Projeto Musical', 'music_project'],
    ['artista', 'Artista', 'artist'],
    ['empresa', 'Empresa', 'company'],
  ]),
  ...rename('marketing_sector', [
    ['Design', 'Design', 'design'],
    ['Audiovisual', 'Audiovisual', 'audiovisual'],
    ['Marketing', 'Marketing', 'marketing'],
    ['Comunicação', 'Comunicação', 'communication'],
  ]),
  ...rename('marketing_task_type', [['campanha', 'Campanha', 'campaign']]),
  ...rename('briefing_service_type', [
    ['campanha', 'Campanha', 'campaign'],
    ['conteudo', 'Conteúdo', 'content'],
  ]),
  ...rename(
    'contact_pf_classification',
    [
      ['ARTIST_AGENT', 'Agente Artístico', 'ARTIST_AGENT'],
      ['PRESS_OFFICE', 'Assessoria de Imprensa', 'PRESS_OFFICE'],
      ['VIDEOMAKER', 'Videomaker', 'VIDEOMAKER'],
      ['OTHER', 'Outro', 'OTHER'],
    ],
    'contact_individual_classification',
  ),
  ...rename(
    'contact_pj_classification',
    [
      ['MARKETING_AGENCY', 'Agência de Marketing', 'MARKETING_AGENCY'],
      ['VENUE', 'Casa de Show', 'VENUE'],
      ['SUPPLIER', 'Fornecedor', 'SUPPLIER'],
      ['OTHER', 'Outro', 'OTHER'],
    ],
    'contact_company_classification',
  ),
];

const stableKey = (v: Variant): string => `${v.newKind}.${v.newSlug.toLowerCase()}`;

const lit = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const T = '"operational_list_items"';

/** the row is exactly this platform default (and is not classified as tenant content) */
const identityPredicate = (v: Variant): string =>
  `("kind" = ${lit(v.kind)} AND "slug" = ${lit(v.slug)} AND "name" = ${lit(v.name)} AND ("origin" IS NULL OR "origin" = 'platform'))`;

/** a LIVE row of the same tenant already holds the target (kind, slug) or (kind, stable_key): the row is skipped, never merged */
const targetTakenPredicate = (v: Variant): string =>
  `EXISTS (SELECT 1 FROM ${T} o WHERE o."tenant_id" = ${T}."tenant_id" AND o."id" <> ${T}."id" AND o."deleted_at" IS NULL AND ` +
  `o."kind" = ${lit(v.newKind)} AND (o."slug" = ${lit(v.newSlug)} OR o."stable_key" = ${lit(stableKey(v))}))`;

const find = (row: Record<string, unknown>): Variant | undefined =>
  OPERATIONAL_LIST_AP3_VARIANTS.find((v) => v.kind === row['kind'] && v.slug === row['slug'] && v.name === row['name']);

/** Pure rewrite of one row (columns that change only), or null when it is not a platform default / is already canonical. Exported for the spec. */
export function operationalListAp3Rewrite(row: Record<string, unknown>): Record<string, unknown> | null {
  if (row['origin'] != null && row['origin'] !== 'platform') return null;
  const v = find(row);
  if (!v) return null;
  const set: Record<string, unknown> = {};
  if (row['kind'] !== v.newKind) set['kind'] = v.newKind;
  if (row['slug'] !== v.newSlug) {
    set['slug'] = v.newSlug;
    if (row['legacy_slug'] == null) set['legacy_slug'] = v.slug;
  }
  if (row['origin'] !== 'platform') set['origin'] = 'platform';
  if (row['stable_key'] !== stableKey(v)) set['stable_key'] = stableKey(v);
  return Object.keys(set).length > 0 ? set : null;
}

const CANDIDATE_PREDICATE = OPERATIONAL_LIST_AP3_VARIANTS.map((v) => `(${identityPredicate(v)} AND NOT ${targetTakenPredicate(v)})`).join(' OR ');

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'operational_list_items',
  logTable: LOG_TABLE,
  columns: ['kind', 'slug', 'name', 'legacy_slug', 'origin', 'stable_key'],
  jsonbColumns: [],
  candidatePredicate: CANDIDATE_PREDICATE,
  transform(row) {
    const set = operationalListAp3Rewrite(row);
    return set ? { set, conflicts: 0 } : null;
  },
};

/** Count of rows that exactly match a platform default but whose target is taken by another live row (skipped, left untouched). */
const SKIPPED_COUNT_SQL = `SELECT count(*)::int AS skipped FROM ${T} WHERE ${OPERATIONAL_LIST_AP3_VARIANTS.map(
  (v) => `(${identityPredicate(v)} AND ${targetTakenPredicate(v)})`,
).join(' OR ')}`;

export class ClassifyMarketingAndContactOperationalListsToEnglish20260930000031 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    const counted: Array<{ skipped: number }> = await queryRunner.query(SKIPPED_COUNT_SQL);
    console.log(`[${MIGRATION}] platform defaults whose target is already used by another live row (skipped, untouched): ${counted[0]?.skipped ?? 0}`);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
