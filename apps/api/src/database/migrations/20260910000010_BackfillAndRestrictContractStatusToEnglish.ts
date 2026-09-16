import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `contracts.status` (`ContractStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `rascunho` / `em_analise` / `aguardando_assinatura` / `assinado` /
 * `ativo` / `vigente` / `vencendo` / `vencido` / `encerrado` / `cancelado`.
 * This project's deploy model is atomic (schema + app code ship together, no
 * version-skew window), so unlike a phased expand/backfill/contract/restrict
 * rollout across separate deploys, this single migration folds backfill +
 * restrict together: there is no live window where old app code
 * (reading/writing PT-BR values) and this migration's new CHECK constraint
 * (English-only) coexist. The `packages/types` enum values are switched to
 * English in the same change set that registers this migration, so by the
 * time this runs, no code path still writes the PT-BR values.
 *
 * Follows the same pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_contract_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictContractStatusToEnglish20260910000010
  implements MigrationInterface
{
  name = 'BackfillAndRestrictContractStatusToEnglish20260910000010';

  private readonly ptToEn: Array<[string, string]> = [
    ['rascunho', 'draft'],
    ['em_analise', 'under_review'],
    ['aguardando_assinatura', 'awaiting_signature'],
    ['assinado', 'signed'],
    ['ativo', 'active'],
    ['vigente', 'in_force'],
    ['vencendo', 'expiring'],
    ['vencido', 'expired'],
    ['encerrado', 'terminated'],
    ['cancelado', 'cancelled'],
  ];

  private readonly enValues = [
    'draft',
    'under_review',
    'awaiting_signature',
    'signed',
    'active',
    'in_force',
    'expiring',
    'expired',
    'terminated',
    'cancelled',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE contracts SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictContractStatusToEnglish] contracts.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "contracts"
       WHERE status NOT IN (${this.enValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      this.enValues,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictContractStatusToEnglish20260910000010: cannot add CHECK constraint, ` +
          `"contracts" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('rascunho') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "contracts" ALTER COLUMN "status" SET DEFAULT 'draft'`);

    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD CONSTRAINT "chk_contract_status"
      CHECK ("status" IN (${this.enValues.map((v) => `'${v}'`).join(', ')}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP CONSTRAINT IF EXISTS "chk_contract_status"
    `);
    await queryRunner.query(`ALTER TABLE "contracts" ALTER COLUMN "status" SET DEFAULT 'rascunho'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE contracts SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}
