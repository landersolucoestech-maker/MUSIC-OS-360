import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000002_CanonicalizeContractServiceTypeValuesAndIndex
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for the
 * persisted vocabulary of `contract_service_types` plus one leftover index name.
 *
 *   1. Index: `idx_contracts_data_fim` -> `idx_contracts_end_date` (the column
 *      became `end_date` in 20260905000008 / 20260928000004; the index name was
 *      never updated). Guarded RENAME: only when the legacy index exists ON
 *      `contracts` and the canonical name is free. Metadata-only.
 *   2. Defaults: `financial_model` 'valor_fixo' -> 'fixed_value' and
 *      `financial_payment_frequency` 'unico' -> 'one_time'. Metadata-only.
 *   3. Backfill of UNAMBIGUOUS values only, by exact match (idempotent: a row
 *      already holding a canonical value never matches; `updated_at` is left
 *      alone because this is a vocabulary rewrite, not a user edit):
 *        financial_model              valor_fixo -> fixed_value, misto -> mixed,
 *                                     recorrente -> recurring
 *        financial_payment_frequency  unico -> one_time, mensal -> monthly,
 *                                     trimestral -> quarterly, anual -> yearly
 *        client_types (jsonb array)   artista -> artist, pessoa_fisica -> individual,
 *                                     pessoa_juridica -> company
 *      (individual/company: CZ-043 clients.person_type; monthly/quarterly/yearly:
 *      artist goal periods; one_time is new.) A client_types row that held both
 *      spellings collapses to one canonical member; order of first occurrence is
 *      kept; non-string members are preserved.
 *
 * NOT DONE ON PURPOSE (owner decision pending, see docs/NAMING_NORMALIZATION_CANONICAL_MAP.md (BLK-CONTRACT-CATEGORY-REGISTRY)):
 *   - the persisted value 'recebimentos externos de direitos' (and a possible
 *     pre-rewrite 'royalties') is left UNMAPPED, byte for byte;
 *   - NO CHECK constraint is added to `financial_model` (or to any other column)
 *     until the owner chooses the canonical value for that phrase;
 *   - any other value is left untouched. Nothing is guessed or coerced.
 *   After the backfill the migration REPORTS (console.log, never aborts) the
 *   distinct residue outside the canonical sets with row counts, so the
 *   operator can compare it with the read-only staging/prod DISTINCT queries.
 *
 * Recovery. Before the first UPDATE, the pre-image of every row that the
 * backfill will touch is copied into the side table
 * `contract_service_types_taxonomy_backup_20260930` (id, tenant_id and the three
 * columns; `ON CONFLICT (id) DO NOTHING`, so the OLDEST pre-image survives a
 * down()/up() replay). The side table has RLS enabled and FORCED with NO policy
 * (only a BYPASSRLS/superuser role, i.e. the migration role, can read it), and
 * all privileges are revoked from PUBLIC/anon/authenticated. It is NOT dropped by
 * down(): it is forensic data. Drop it in a later migration after the owner
 * signs off the release window. Manual restore of a row:
 *   UPDATE contract_service_types t SET client_types = b.client_types,
 *          financial_model = b.financial_model,
 *          financial_payment_frequency = b.financial_payment_frequency
 *     FROM contract_service_types_taxonomy_backup_20260930 b WHERE b.id = t.id;
 *
 * down(): reverses the index name and the defaults and maps the canonical values
 * back one-to-one (the mapping is a bijection on the mapped values). A row that
 * already held a canonical value before up() (only possible through direct SQL:
 * the API never accepted one) is also rewritten to the Portuguese spelling; the
 * previous build read those as unknown values anyway. Unmapped values stay
 * untouched in both directions.
 *
 * Deploy skew. Old web/API builds keep working: they read financial_model /
 * client_types only for display or client-side filtering (both tolerate unknown
 * values) and the new API accepts the deprecated spellings on input (mapped
 * before validation, CONTRACT_SERVICE_TYPE_* legacy maps). An OLD API writing a
 * Portuguese value after this migration is possible (no CHECK) and is reported
 * by the residue query; re-running up() maps it (idempotent).
 */
type Pair = readonly [legacy: string, canonical: string];

const TABLE = 'contract_service_types';
const BACKUP_TABLE = 'contract_service_types_taxonomy_backup_20260930';

const FINANCIAL_MODELS: ReadonlyArray<Pair> = [
  ['valor_fixo', 'fixed_value'],
  ['misto', 'mixed'],
  ['recorrente', 'recurring'],
];

const PAYMENT_FREQUENCIES: ReadonlyArray<Pair> = [
  ['unico', 'one_time'],
  ['mensal', 'monthly'],
  ['trimestral', 'quarterly'],
  ['anual', 'yearly'],
];

const CLIENT_TYPES: ReadonlyArray<Pair> = [
  ['artista', 'artist'],
  ['pessoa_fisica', 'individual'],
  ['pessoa_juridica', 'company'],
];

const invert = (pairs: ReadonlyArray<Pair>): ReadonlyArray<Pair> => pairs.map(([a, b]) => [b, a] as const);
const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');
const toObject = (pairs: ReadonlyArray<Pair>): string => JSON.stringify(Object.fromEntries(pairs));
const sources = (pairs: ReadonlyArray<Pair>): string[] => pairs.map(([from]) => from);

/** Same guarded shape as 20260927000002; the index must belong to `contracts`. */
const RENAME_INDEX = (from: string, to: string): string => `
  DO $$
  BEGIN
    IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL
       AND EXISTS (
         SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.${from}') AND indrelid = to_regclass('public.contracts')
       ) THEN
      ALTER INDEX "public"."${from}" RENAME TO "${to}";
    END IF;
  END $$;`;

/** Maps client_types members through `map` (a JSON object); duplicates collapse, first position kept. */
const REMAP_CLIENT_TYPES = (guardSources: readonly string[]): string => `
  UPDATE "${TABLE}" SET "client_types" = (
    SELECT COALESCE(jsonb_agg(m.elem ORDER BY m.first_ord), '[]'::jsonb)
    FROM (
      SELECT x.elem, min(x.ord) AS first_ord
      FROM (
        SELECT CASE WHEN jsonb_typeof(e.value) = 'string' AND $1::jsonb ? (e.value #>> '{}')
                    THEN $1::jsonb -> (e.value #>> '{}') ELSE e.value END AS elem,
               e.ord
        FROM jsonb_array_elements("client_types") WITH ORDINALITY AS e(value, ord)
      ) x
      GROUP BY x.elem
    ) m
  )
  WHERE jsonb_typeof("client_types") = 'array' AND "client_types" ?| ARRAY[${quote(guardSources)}]`;

async function backfillScalar(
  queryRunner: QueryRunner,
  migration: string,
  column: 'financial_model' | 'financial_payment_frequency',
  pairs: ReadonlyArray<Pair>,
): Promise<void> {
  for (const [from, to] of pairs) {
    const [{ affected }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "${TABLE}" SET "${column}" = $2 WHERE "${column}" = $1 RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
      [from, to],
    );
    console.log(`[${migration}] ${TABLE}.${column} '${from}' -> '${to}': ${affected} row(s)`);
  }
}

async function backfillClientTypes(queryRunner: QueryRunner, migration: string, pairs: ReadonlyArray<Pair>): Promise<void> {
  const [{ affected }] = await queryRunner.query(
    `WITH updated AS (${REMAP_CLIENT_TYPES(sources(pairs))} RETURNING id)
     SELECT count(*)::int AS affected FROM updated`,
    [toObject(pairs)],
  );
  console.log(`[${migration}] ${TABLE}.client_types ${JSON.stringify(Object.fromEntries(pairs))}: ${affected} row(s)`);
}

/** Read-only: distinct values that are neither canonical nor a mapped legacy spelling, with counts. */
async function reportResidue(queryRunner: QueryRunner, migration: string): Promise<void> {
  const columns: ReadonlyArray<[column: 'financial_model' | 'financial_payment_frequency', pairs: ReadonlyArray<Pair>]> = [
    ['financial_model', FINANCIAL_MODELS],
    ['financial_payment_frequency', PAYMENT_FREQUENCIES],
  ];
  for (const [column, pairs] of columns) {
    const rows: Array<{ value: string | null; rows: number }> = await queryRunner.query(
      `SELECT "${column}" AS value, count(*)::int AS rows FROM "${TABLE}"
       WHERE "${column}" IS NULL OR "${column}" NOT IN (${quote(pairs.map(([, canonical]) => canonical))})
       GROUP BY 1 ORDER BY 1`,
    );
    console.log(`[${migration}] residue ${TABLE}.${column} outside the canonical set (left untouched): ${JSON.stringify(rows)}`);
  }
  const members: Array<{ value: string; rows: number }> = await queryRunner.query(
    `SELECT e.value #>> '{}' AS value, count(DISTINCT t.id)::int AS rows
     FROM "${TABLE}" t, jsonb_array_elements(CASE WHEN jsonb_typeof(t."client_types") = 'array' THEN t."client_types" ELSE '[]'::jsonb END) AS e(value)
     WHERE jsonb_typeof(e.value) <> 'string' OR (e.value #>> '{}') NOT IN (${quote(CLIENT_TYPES.map(([, canonical]) => canonical))})
     GROUP BY 1 ORDER BY 1`,
  );
  // Bounded: at most 20 distinct members, each truncated, so arbitrary tenant jsonb cannot flood deploy logs.
  const shown = members.slice(0, 20).map((m) => ({ value: String(m.value).slice(0, 40), rows: m.rows }));
  console.log(
    `[${migration}] residue ${TABLE}.client_types members outside the canonical set (left untouched): ` +
      `${JSON.stringify(shown)}${members.length > shown.length ? ` (+${members.length - shown.length} more distinct members)` : ''}`,
  );
}

export class CanonicalizeContractServiceTypeValuesAndIndex20260930000002 implements MigrationInterface {
  name = 'CanonicalizeContractServiceTypeValuesAndIndex20260930000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(RENAME_INDEX('idx_contracts_data_fim', 'idx_contracts_end_date'));

    // Pre-image of every row the backfill touches (soft-deleted rows included).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${BACKUP_TABLE}" (
        "id" uuid PRIMARY KEY,
        "tenant_id" uuid NOT NULL,
        "client_types" jsonb,
        "financial_model" varchar(50),
        "financial_payment_frequency" varchar(50),
        "backed_up_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`ALTER TABLE "${BACKUP_TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${BACKUP_TABLE}" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`REVOKE ALL ON TABLE "${BACKUP_TABLE}" FROM PUBLIC`);
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${BACKUP_TABLE}', r);
          END IF;
        END LOOP;
      END $$;`);
    await queryRunner.query(`
      INSERT INTO "${BACKUP_TABLE}" ("id", "tenant_id", "client_types", "financial_model", "financial_payment_frequency")
      SELECT "id", "tenant_id", "client_types", "financial_model", "financial_payment_frequency" FROM "${TABLE}"
      WHERE "financial_model" IN (${quote(sources(FINANCIAL_MODELS))})
         OR "financial_payment_frequency" IN (${quote(sources(PAYMENT_FREQUENCIES))})
         OR (jsonb_typeof("client_types") = 'array' AND "client_types" ?| ARRAY[${quote(sources(CLIENT_TYPES))}])
      ON CONFLICT ("id") DO NOTHING`);

    await backfillScalar(queryRunner, this.name, 'financial_model', FINANCIAL_MODELS);
    await backfillScalar(queryRunner, this.name, 'financial_payment_frequency', PAYMENT_FREQUENCIES);
    await backfillClientTypes(queryRunner, this.name, CLIENT_TYPES);

    // Defaults last: SET DEFAULT takes ACCESS EXCLUSIVE, so the lock is held for the shortest possible time.
    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "financial_model" SET DEFAULT 'fixed_value'`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "financial_payment_frequency" SET DEFAULT 'one_time'`);
    await reportResidue(queryRunner, this.name);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await backfillClientTypes(queryRunner, this.name, invert(CLIENT_TYPES));
    await backfillScalar(queryRunner, this.name, 'financial_payment_frequency', invert(PAYMENT_FREQUENCIES));
    await backfillScalar(queryRunner, this.name, 'financial_model', invert(FINANCIAL_MODELS));

    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "financial_payment_frequency" SET DEFAULT 'unico'`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" ALTER COLUMN "financial_model" SET DEFAULT 'valor_fixo'`);
    await queryRunner.query(RENAME_INDEX('idx_contracts_end_date', 'idx_contracts_data_fim'));
  }
}
