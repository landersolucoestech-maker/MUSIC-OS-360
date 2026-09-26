import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task U — aligns `contract_templates` with the real contract of the only active
 * form (ContractImportWorkspace.tsx, via TemplatesContratos.tsx).
 *
 * Finding: `useTemplatesContratos()` writes via storage.create("templates_contratos", …)
 * → POST /contract-templates → CreateContractTemplateDto. The old DTO only
 * accepted English fields (title/type/content/variables/metadata); the
 * real form always sent nome/tipo_servico/conteudo/ativo/descricao/
 * variables_manifest/header_image/footer_image — zero overlap. With
 * forbidNonWhitelisted, every template create/edit returned 400. Even
 * if the old DTO had been bypassed, the service spread the DTO directly (`...dto`)
 * onto the entity, whose physical columns were already `titulo`/`tipo` (not
 * `title`/`type`) — the old DTO fields would never have persisted
 * anyway. `descricao`/`variables_manifest`/`header_image`/
 * `footer_image` never had any physical column at all.
 *
 * `titulo`→`nome`, `tipo`→`tipo_servico` (canonical contract required by the
 * active form). DEV has no real business data in this table (the
 * flow had always been broken) — RENAME COLUMN is safe.
 */
export class ContractTemplatesFormFieldAlignment20260816000003
  implements MigrationInterface
{
  name = 'ContractTemplatesFormFieldAlignment20260816000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contract_templates" RENAME COLUMN "titulo" TO "nome"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_templates" RENAME COLUMN "tipo" TO "tipo_servico"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_templates"
        ADD COLUMN IF NOT EXISTS "descricao" text,
        ADD COLUMN IF NOT EXISTS "variables_manifest" text,
        ADD COLUMN IF NOT EXISTS "header_image" text,
        ADD COLUMN IF NOT EXISTS "footer_image" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contract_templates"
        DROP COLUMN IF EXISTS "descricao",
        DROP COLUMN IF EXISTS "variables_manifest",
        DROP COLUMN IF EXISTS "header_image",
        DROP COLUMN IF EXISTS "footer_image"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_templates" RENAME COLUMN "tipo_servico" TO "tipo"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_templates" RENAME COLUMN "nome" TO "titulo"
    `);
  }
}
