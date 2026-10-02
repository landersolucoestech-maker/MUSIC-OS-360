import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000028_BackfillCampaignBuilderStateToEnglish (AP3 / R3-02)
 *
 * The campaign builder persisted its UI state with Portuguese machine words, inside the payload of
 * the `campaigns` row (type = 'marketing_builder'), at metadata.marketingBuilder.payload:
 *
 *   notes          a JSON STRING (JSON.stringify of the builder state):
 *                    phase               pre_lancamento/lancamento/sustentacao/catalogo -> pre_launch/launch/sustain/catalog
 *                    creatives[].type    imagem/carrossel/texto                         -> image/carousel/text
 *                    budget.strategy     menor_custo/limite_custo/custo_alvo            -> lowest_cost/cost_cap/target_cost
 *   creatives[].type   same map (only when the payload carries creatives itself)
 *   audience.gender    todos/feminino/masculino/nao_binario/nao_informado -> all/female/male/non_binary/not_informed
 *   segmentation       JSON string with the same audience.gender
 *
 * EXACT, case-sensitive matches only. A `notes` value that is not a JSON object (free text typed by a user), any
 * other key inside the JSON, and any value that is not in a map (canonical, or user typed) are left byte-for-byte.
 * Maps are a frozen copy of marketing-vocabulary.ts (the spec asserts they are equal).
 *
 * Expand/contract, backfill step. The code shipped with this migration writes the canonical values (web builder state, API
 * payload mapping) and keeps ACCEPTING and READING the Portuguese ones (API: canonicalMarketingCampaignPayload on
 * input and on read; web: parseCampaignBuilderNotes). The contract step (delete the legacy maps) is gated on the census
 * in docs/runbooks/staging-to-production.md#residue-census-20260930000028 returning 0. No CHECK: the payload is free-form jsonb.
 *
 * Rules (jsonb-row-backfill.ts): candidate rows only (cheap predicate), idempotent, every other key preserved,
 * `updated_at` untouched, guarded UPDATE (a concurrent edit wins), BEFORE/AFTER of the changed column only in the
 * locked-down side table `campaign_builder_state_backfill_20260930`, counts-only logs.
 * down(): puts BEFORE back for the rows still holding exactly AFTER. The side table is kept (forensic).
 */
const MIGRATION = 'BackfillCampaignBuilderStateToEnglish20260930000028';
const LOG_TABLE = 'campaign_builder_state_backfill_20260930';

const PHASE: Readonly<Record<string, string>> = {
  pre_lancamento: 'pre_launch',
  lancamento: 'launch',
  sustentacao: 'sustain',
  catalogo: 'catalog',
};
const CREATIVE_TYPE: Readonly<Record<string, string>> = { imagem: 'image', carrossel: 'carousel', texto: 'text' };
const STRATEGY: Readonly<Record<string, string>> = { menor_custo: 'lowest_cost', limite_custo: 'cost_cap', custo_alvo: 'target_cost' };
const GENDER: Readonly<Record<string, string>> = {
  todos: 'all',
  feminino: 'female',
  masculino: 'male',
  nao_binario: 'non_binary',
  nao_informado: 'not_informed',
};

/** Exported for the unit spec only. */
export const CAMPAIGN_BUILDER_BACKFILL_MAPS = { PHASE, CREATIVE_TYPE, STRATEGY, GENDER } as const;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const mapValue = (map: Readonly<Record<string, string>>, v: unknown): unknown => (typeof v === 'string' && has(map, v) ? map[v] : v);

type KeyRules = Readonly<Record<string, (v: unknown) => unknown>>;
/** Copy of `o` with the listed keys rewritten, or the SAME object when nothing changes (or it is not an object). */
function rewrite(o: unknown, rules: KeyRules): unknown {
  if (!isObject(o)) return o;
  let out: Json | null = null;
  for (const [key, fn] of Object.entries(rules)) {
    if (!has(o, key)) continue;
    const mapped = fn(o[key]);
    if (JSON.stringify(mapped) !== JSON.stringify(o[key])) {
      out = out ?? { ...o };
      out[key] = mapped;
    }
  }
  return out ?? o;
}

const creatives = (v: unknown): unknown =>
  Array.isArray(v) ? v.map((c) => rewrite(c, { type: (t) => mapValue(CREATIVE_TYPE, t) })) : v;
const audience = (v: unknown): unknown => rewrite(v, { gender: (g) => mapValue(GENDER, g) });

/** A JSON object held in a string: its keys mapped; anything else (free text, invalid JSON) untouched. */
function jsonString(value: unknown, fn: (parsed: Json) => unknown): unknown {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return value;
  }
  if (!isObject(parsed)) return value;
  const mapped = fn(parsed);
  return mapped === parsed ? value : JSON.stringify(mapped);
}

const NOTES_RULES: KeyRules = {
  phase: (v) => mapValue(PHASE, v),
  creatives,
  budget: (b) => rewrite(b, { strategy: (v) => mapValue(STRATEGY, v) }),
};
const PAYLOAD_RULES: KeyRules = {
  notes: (v) => jsonString(v, (state) => rewrite(state, NOTES_RULES)),
  creatives,
  audience,
  segmentation: (v) => jsonString(v, audience),
};

/** Exported for the unit spec only: metadata after the rewrite, or null when it is already canonical. */
export function canonicalCampaignBuilderMetadataForBackfill(metadata: unknown): Json | null {
  if (!isObject(metadata)) return null;
  const builder = metadata['marketingBuilder'];
  if (!isObject(builder)) return null;
  const payload = rewrite(builder['payload'], PAYLOAD_RULES);
  return payload !== builder['payload'] ? { ...metadata, marketingBuilder: { ...builder, payload } } : null;
}

/**
 * Cheap candidate predicate: the payload mentions a legacy token as a JSON string value (`"phase":"lancamento"`, an escaped
 * `\"phase\":\"lancamento\"` inside notes, `"gender":"feminino"`...). Over-inclusive on purpose; the transform decides.
 */
const LEGACY_TOKENS = [...Object.keys(PHASE), ...Object.keys(CREATIVE_TYPE), ...Object.keys(STRATEGY), ...Object.keys(GENDER)];
const PREDICATE =
  `"type" = 'marketing_builder' AND ("metadata" #>> '{marketingBuilder,payload}') ~ '(${LEGACY_TOKENS.join('|')})'`;

/** Exported for the unit spec only. */
export const CAMPAIGN_BUILDER_CANDIDATE_PREDICATE = PREDICATE;
export const CAMPAIGN_BUILDER_LEGACY_TOKENS = LEGACY_TOKENS;

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'campaigns',
  logTable: LOG_TABLE,
  columns: ['metadata'],
  jsonbColumns: ['metadata'],
  candidatePredicate: PREDICATE,
  transform(row) {
    const metadata = canonicalCampaignBuilderMetadataForBackfill(row['metadata']);
    return metadata ? { set: { metadata }, conflicts: 0 } : null;
  },
};

export class BackfillCampaignBuilderStateToEnglish20260930000028 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
