import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20261005100001_BackfillMusicChatRoutingKeys
 *
 * `musicchat_automation_settings.menu_options[].queue` / `.sector` are tenant-editable DISPLAY LABELS (free text,
 * PT-BR by default), not machine slugs. Canonical machine keys are added NEXT TO them, additively:
 *
 *   queueKey   Comercial/Produção Musical/Catálogo/Marketing/Financeiro/Atendimento
 *              -> commercial/music_production/catalog/marketing/finance/customer_service
 *   sectorKey  Shows/Produção/Editora/Distribuição/Criação/Financeiro/Conteúdo/Suporte/Triagem
 *              -> shows/production/publishing_distribution/creative/finance/content/support/triage
 *
 * A key is added ONLY to an option object whose key is absent (or null) and whose label matches a legacy label
 * EXACTLY (case-sensitive, own-property lookup). An edited or unknown label ("Vendas") gets no key and is never
 * guessed; the labels themselves and every other key/option/array order are preserved byte for byte.
 * Conversations are not migrated: the web derives the key from `metadata.queue_key`, falling back to the label.
 * The maps are a frozen copy of musicchat-vocabulary.ts (the spec asserts they are equal).
 *
 * Rules of jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched, guarded UPDATE,
 * BEFORE/AFTER of `menu_options` in the locked-down side table `musicchat_routing_keys_backfill_20261005`,
 * counts-only logs. down() restores BEFORE for rows still holding exactly AFTER; the side table is kept.
 */
const MIGRATION = 'BackfillMusicChatRoutingKeys20261005100001';
const LOG_TABLE = 'musicchat_routing_keys_backfill_20261005';

const QUEUE: Readonly<Record<string, string>> = {
  Comercial: 'commercial',
  'Produção Musical': 'music_production',
  Catálogo: 'catalog',
  Marketing: 'marketing',
  Financeiro: 'finance',
  Atendimento: 'customer_service',
};
const SECTOR: Readonly<Record<string, string>> = {
  Shows: 'shows',
  Produção: 'production',
  'Editora/Distribuição': 'publishing_distribution',
  Criação: 'creative',
  Financeiro: 'finance',
  Conteúdo: 'content',
  Suporte: 'support',
  Triagem: 'triage',
};

/** Exported for the unit spec only. */
export const MUSICCHAT_ROUTING_KEYS_BACKFILL_MAPS = { QUEUE, SECTOR } as const;

type Json = Record<string, unknown>;
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const absent = (v: unknown): boolean => v === undefined || v === null;

/** menu_options after the rewrite, or null when nothing changes / not an array. Exported for the unit spec only. */
export function menuOptionsWithRoutingKeysForBackfill(menuOptions: unknown): unknown[] | null {
  if (!Array.isArray(menuOptions)) return null;
  let changed = false;
  const out = menuOptions.map((option: unknown) => {
    if (!isObject(option)) return option;
    const add: Json = {};
    if (absent(option['queueKey']) && typeof option['queue'] === 'string' && has(QUEUE, option['queue'])) add['queueKey'] = QUEUE[option['queue']];
    if (absent(option['sectorKey']) && typeof option['sector'] === 'string' && has(SECTOR, option['sector'])) add['sectorKey'] = SECTOR[option['sector']];
    if (Object.keys(add).length === 0) return option;
    changed = true;
    return { ...option, ...add };
  });
  return changed ? out : null;
}

const q = (map: Readonly<Record<string, string>>): string => Object.keys(map).map((k) => `'${k}'`).join(', ');

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'musicchat_automation_settings',
  logTable: LOG_TABLE,
  columns: ['menu_options'],
  jsonbColumns: ['menu_options'],
  candidatePredicate: `CASE WHEN jsonb_typeof("menu_options") = 'array' THEN EXISTS (
      SELECT 1 FROM jsonb_array_elements("menu_options") AS o
      WHERE ((o ->> 'queue') IN (${q(QUEUE)}) AND (o ->> 'queueKey') IS NULL)
         OR ((o ->> 'sector') IN (${q(SECTOR)}) AND (o ->> 'sectorKey') IS NULL)
    ) ELSE false END`,
  transform(row) {
    const menuOptions = menuOptionsWithRoutingKeysForBackfill(row['menu_options']);
    return menuOptions ? { set: { menu_options: menuOptions }, conflicts: 0 } : null;
  },
};

export class BackfillMusicChatRoutingKeys20261005100001 implements MigrationInterface {
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
