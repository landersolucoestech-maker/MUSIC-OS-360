import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task X — finding from real runtime validation (OBJECTIVE 1).
 *
 * Migration 20260816000003 renamed `contract_templates.tipo` to
 * `tipo_servico`, but kept the NOT NULL constraint inherited from the old
 * column. `CreateContractTemplateDto.tipo_servico` is `@IsOptional()` (the
 * only active form, ContractImportWorkspace.tsx, does not require the field) —
 * every template creation without tipo_servico broke at runtime with
 * "null value in column tipo_servico violates not-null constraint",
 * never covered by the tests (mocks do not validate NOT NULL). Relaxes the
 * constraint to align with the form's real contract.
 */
export class ContractTemplatesTipoServicoOptional20260816000004
  implements MigrationInterface
{
  name = 'ContractTemplatesTipoServicoOptional20260816000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contract_templates" ALTER COLUMN "tipo_servico" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contract_templates" ALTER COLUMN "tipo_servico" SET NOT NULL
    `);
  }
}
