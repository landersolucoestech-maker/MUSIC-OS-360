import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `clients.status` (`ClientStatus` in packages/types/src/enums.ts) is a plain
 * `varchar(50)` with no CHECK constraint, currently holding the PT-BR values
 * `ativo` / `inativo` / `prospecto`. Same atomic deploy model as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`: schema +
 * app code ship together, so this single migration folds backfill + restrict
 * together — no live window where old PT-BR-writing app code and this
 * migration's English-only CHECK constraint coexist.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_clients_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictClientStatusToEnglish20260910000017
  implements MigrationInterface
{
  name = 'BackfillAndRestrictClientStatusToEnglish20260910000017';

  private readonly ptToEn: Array<[string, string]> = [
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['prospecto', 'prospect'],
  ];

  private readonly enValues = ['active', 'inactive', 'prospect'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE clients SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictClientStatusToEnglish] clients.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "clients"
       WHERE status NOT IN (${this.enValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      this.enValues,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictClientStatusToEnglish20260910000017: cannot add CHECK constraint, ` +
          `"clients" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('ativo') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "status" SET DEFAULT 'active'`);

    await queryRunner.query(`
      ALTER TABLE "clients"
      ADD CONSTRAINT "chk_clients_status"
      CHECK ("status" IN (${this.enValues.map((v) => `'${v}'`).join(', ')}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
      DROP CONSTRAINT IF EXISTS "chk_clients_status"
    `);
    await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "status" SET DEFAULT 'ativo'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE clients SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}
