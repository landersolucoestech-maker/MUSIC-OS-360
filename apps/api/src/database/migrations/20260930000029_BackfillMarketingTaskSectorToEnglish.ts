import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000029_BackfillMarketingTaskSectorToEnglish (AP3 / R3-03)
 *
 * The marketing task form persisted the Portuguese LABEL of the platform sector as the value of
 * `marketing_tasks.metadata.sector` (and kept the label as the slug of the `marketing_sector`
 * operational list), and the five automation flow blueprints persisted their Portuguese flow id in
 * `marketing_tasks.metadata.automationFlowId`. Canonical English machine values (the PT-BR text stays
 * the display label in the web):
 *
 *   sector            Design/Audiovisual/Marketing/Comunicação/Comercial/Administração Musical/Distribuição Digital/CRM
 *                     -> design/audiovisual/marketing/communication/commercial/music_administration/digital_distribution/crm
 *   automationFlowId  flow-lancamento/flow-conteudo-corporativo/flow-bastidores/flow-evento/flow-produto-saas
 *                     -> flow-music-release/flow-corporate-content/flow-behind-the-scenes/flow-event/flow-product-saas
 *
 * EXACT, case-sensitive matches only. A sector a tenant typed (any other text, including "design " or a
 * different capitalization) is user content and stays byte-for-byte; every other metadata key is preserved.
 * Maps are a frozen copy of marketing-vocabulary.ts (the spec asserts they are equal).
 *
 * Expand/contract, backfill step: the shipped code writes the canonical values and keeps ACCEPTING (API DTO
 * @Transform before validation) and READING (web canonicalMarketingSector / canonicalAutomationFlowId) the
 * Portuguese ones; the contract step (delete the legacy maps) is gated on the census in findings/persisted-ap3.md
 * returning 0. Rules of jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched, guarded
 * UPDATE, BEFORE/AFTER of the changed column in the locked-down side table `marketing_task_sector_backfill_20260930`,
 * counts-only logs. down() restores BEFORE for rows still holding exactly AFTER; the side table is kept.
 */
const MIGRATION = 'BackfillMarketingTaskSectorToEnglish20260930000029';
const LOG_TABLE = 'marketing_task_sector_backfill_20260930';

const SECTOR: Readonly<Record<string, string>> = {
  Design: 'design',
  Audiovisual: 'audiovisual',
  Marketing: 'marketing',
  Comunicação: 'communication',
  Comercial: 'commercial',
  'Administração Musical': 'music_administration',
  'Distribuição Digital': 'digital_distribution',
  CRM: 'crm',
};
const FLOW_ID: Readonly<Record<string, string>> = {
  'flow-lancamento': 'flow-music-release',
  'flow-conteudo-corporativo': 'flow-corporate-content',
  'flow-bastidores': 'flow-behind-the-scenes',
  'flow-evento': 'flow-event',
  'flow-produto-saas': 'flow-product-saas',
};

/** Exported for the unit spec only. */
export const MARKETING_TASK_SECTOR_BACKFILL_MAPS = { SECTOR, FLOW_ID } as const;

type Json = Record<string, unknown>;
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

/** metadata after the rewrite, or null when already canonical / not an object. Exported for the unit spec only. */
export function canonicalMarketingTaskSectorMetadataForBackfill(metadata: unknown): Json | null {
  if (!isObject(metadata)) return null;
  let out: Json | null = null;
  for (const [key, map] of [['sector', SECTOR], ['automationFlowId', FLOW_ID]] as const) {
    const v = metadata[key];
    if (typeof v === 'string' && has(map, v)) {
      out = out ?? { ...metadata };
      out[key] = map[v];
    }
  }
  return out;
}

const q = (map: Readonly<Record<string, string>>): string => Object.keys(map).map((k) => `'${k}'`).join(', ');

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'marketing_tasks',
  logTable: LOG_TABLE,
  columns: ['metadata'],
  jsonbColumns: ['metadata'],
  candidatePredicate: `("metadata" ->> 'sector') IN (${q(SECTOR)}) OR ("metadata" ->> 'automationFlowId') IN (${q(FLOW_ID)})`,
  transform(row) {
    const metadata = canonicalMarketingTaskSectorMetadataForBackfill(row['metadata']);
    return metadata ? { set: { metadata }, conflicts: 0 } : null;
  },
};

export class BackfillMarketingTaskSectorToEnglish20260930000029 implements MigrationInterface {
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
