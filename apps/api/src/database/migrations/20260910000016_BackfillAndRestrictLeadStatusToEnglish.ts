import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `leads.status` (`LeadStatus` in packages/types/src/enums.ts) is a plain
 * `varchar(50)` with no CHECK constraint, currently holding the PT-BR values
 * `novo` / `contato` / `em_contato` / `qualificado` / `proposta` /
 * `negociacao` / `fechado` / `perdido` / `inativo`. Same atomic deploy model
 * as `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`: schema
 * + app code ship together, so this single migration folds backfill +
 * restrict together — no live window where old PT-BR-writing app code and
 * this migration's English-only CHECK constraint coexist.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_leads_status` CHECK constraint restricting the column to the
 *      English enum values.
 */
export class BackfillAndRestrictLeadStatusToEnglish20260910000016
  implements MigrationInterface
{
  name = 'BackfillAndRestrictLeadStatusToEnglish20260910000016';

  private readonly ptToEn: Array<[string, string]> = [
    ['novo', 'new'],
    ['contato', 'contacted'],
    ['em_contato', 'in_contact'],
    ['qualificado', 'qualified'],
    ['proposta', 'proposal'],
    ['negociacao', 'negotiation'],
    ['fechado', 'closed'],
    ['perdido', 'lost'],
    ['inativo', 'inactive'],
  ];

  private readonly enValues = [
    'new',
    'contacted',
    'in_contact',
    'qualified',
    'proposal',
    'negotiation',
    'closed',
    'lost',
    'inactive',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE leads SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictLeadStatusToEnglish] leads.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "leads"
       WHERE status NOT IN (${this.enValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      this.enValues,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictLeadStatusToEnglish20260910000016: cannot add CHECK constraint, ` +
          `"leads" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "leads"
      ADD CONSTRAINT "chk_leads_status"
      CHECK ("status" IN (${this.enValues.map((v) => `'${v}'`).join(', ')}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
      DROP CONSTRAINT IF EXISTS "chk_leads_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE leads SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}
