import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000023_BackfillContractLastPaymentKeysToEnglish (PJ1)
 *
 * `contracts.metadata` (jsonb) carries the last payment of the linked transaction under
 * Portuguese KEYS (written by TransactionEventsHandler.onTransactionPaid). Canonical English keys:
 *   ultimo_pagamento_em -> last_payment_at
 *   ultimo_pagamento_valor -> last_payment_amount
 *   ultimo_pagamento_por -> last_payment_by
 * Values are untouched. No reader of these keys exists in the repository (write-only metadata);
 * the compat module common/compat/contract-last-payment.ts documents the dual-read.
 *
 * Same rules as 20260930000019 (see jsonb-row-backfill.ts): exact key match, other keys preserved,
 * canonical rows skipped (idempotent), both spellings present -> CANONICAL wins and the conflict is
 * counted in the log, `updated_at` untouched, guarded UPDATE, BEFORE/AFTER recorded in the locked-down
 * side table `contracts_last_payment_backfill_20260930` (kept by down()), counts-only logs.
 * down(): restores BEFORE only for rows still holding AFTER.
 */
const MIGRATION = 'BackfillContractLastPaymentKeysToEnglish20260930000023';
const LOG_TABLE = 'contracts_last_payment_backfill_20260930';
const MAP: Readonly<Record<string, string>> = {
  ultimo_pagamento_em: 'last_payment_at',
  ultimo_pagamento_valor: 'last_payment_amount',
  ultimo_pagamento_por: 'last_payment_by',
};
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Exported for the unit spec only. */
export function canonicalContractMetadataForBackfill(metadata: unknown): { value: unknown; changed: boolean; conflicts: number } {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return { value: metadata, changed: false, conflicts: 0 };
  const source = metadata as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let changed = false;
  let conflicts = 0;
  for (const [key, value] of Object.entries(source)) {
    if (key === '__proto__') continue;
    if (!has(MAP, key)) {
      out[key] = value;
      continue;
    }
    changed = true;
    if (has(source, MAP[key])) {
      conflicts += 1;
      continue;
    }
    out[MAP[key]] = value;
  }
  return { value: out, changed, conflicts };
}

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'contracts',
  logTable: LOG_TABLE,
  columns: ['metadata'],
  jsonbColumns: ['metadata'],
  candidatePredicate: `"metadata" ?| ARRAY[${Object.keys(MAP).map((k) => `'${k}'`).join(', ')}]::text[]`,
  transform(row) {
    const { value, changed, conflicts } = canonicalContractMetadataForBackfill(row['metadata']);
    return changed ? { set: { metadata: value }, conflicts } : null;
  },
};

export class BackfillContractLastPaymentKeysToEnglish20260930000023 implements MigrationInterface {
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
