import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M9 — operational bridges → financial project (Phase 12 §2.11;
 * decisions Q6/Q7).
 *
 * `projects` is the UNIVERSAL financial project. Marketing and
 * audiovisual projects may OPTIONALLY point to a financial project via
 * financial_project_id (composite FK, RESTRICT). NO automatic association
 * is made — the column is born NULL for every row and filling it is
 * always an explicit user decision (the UI must indicate the absence of a link).
 */
export class FinancialOperationalBridges20260718000009 implements MigrationInterface {
  name = 'FinancialOperationalBridges20260718000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketing_projects"
        ADD COLUMN "financial_project_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "marketing_projects"
        ADD CONSTRAINT "fk_marketing_projects_financial_project"
        FOREIGN KEY ("tenant_id", "financial_project_id")
        REFERENCES "projects" ("tenant_id", "id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_marketing_projects_financial_project"
        ON "marketing_projects" ("tenant_id", "financial_project_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "audiovisual_projects"
        ADD COLUMN "financial_project_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audiovisual_projects"
        ADD CONSTRAINT "fk_audiovisual_projects_financial_project"
        FOREIGN KEY ("tenant_id", "financial_project_id")
        REFERENCES "projects" ("tenant_id", "id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audiovisual_projects_financial_project"
        ON "audiovisual_projects" ("tenant_id", "financial_project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_audiovisual_projects_financial_project"`);
    await queryRunner.query(`
      ALTER TABLE "audiovisual_projects"
        DROP CONSTRAINT "fk_audiovisual_projects_financial_project"
    `);
    await queryRunner.query(`ALTER TABLE "audiovisual_projects" DROP COLUMN "financial_project_id"`);
    await queryRunner.query(`DROP INDEX "idx_marketing_projects_financial_project"`);
    await queryRunner.query(`
      ALTER TABLE "marketing_projects"
        DROP CONSTRAINT "fk_marketing_projects_financial_project"
    `);
    await queryRunner.query(`ALTER TABLE "marketing_projects" DROP COLUMN "financial_project_id"`);
  }
}
