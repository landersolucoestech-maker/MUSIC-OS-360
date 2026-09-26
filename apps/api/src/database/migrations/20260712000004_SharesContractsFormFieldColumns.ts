import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync (release Shares + Contracts/Wizard).
 *
 * PRODUCT RULE (2026-07-12): each form field has ITS OWN physical
 * column with the EXACT name of the key sent by the form (SharePendenteFormModal,
 * ContratoWizard).
 */
export class SharesContractsFormFieldColumns20260712000004 implements MigrationInterface {
  name = 'SharesContractsFormFieldColumns20260712000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shares"
        ADD COLUMN IF NOT EXISTS "share_type" varchar(30),
        ADD COLUMN IF NOT EXISTS "direcao" varchar(20),
        ADD COLUMN IF NOT EXISTS "lancamento_id" uuid,
        ADD COLUMN IF NOT EXISTS "nome_musica" varchar(500),
        ADD COLUMN IF NOT EXISTS "detentor" varchar(255),
        ADD COLUMN IF NOT EXISTS "destinatario" varchar(255),
        ADD COLUMN IF NOT EXISTS "tipo" varchar(100),
        ADD COLUMN IF NOT EXISTS "artista_externo" varchar(255),
        ADD COLUMN IF NOT EXISTS "artista_projeto_id" uuid,
        ADD COLUMN IF NOT EXISTS "artista_id" uuid,
        ADD COLUMN IF NOT EXISTS "pagador" varchar(255),
        ADD COLUMN IF NOT EXISTS "pagador_contato" varchar(255),
        ADD COLUMN IF NOT EXISTS "origem_acordo" varchar(255),
        ADD COLUMN IF NOT EXISTS "data_prevista" date,
        ADD COLUMN IF NOT EXISTS "documentos" text,
        ADD COLUMN IF NOT EXISTS "acordo_notas" text,
        ADD COLUMN IF NOT EXISTS "acordo_url" text,
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "versao" integer,
        ADD COLUMN IF NOT EXISTS "historico" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
        ADD COLUMN IF NOT EXISTS "template_id" uuid,
        ADD COLUMN IF NOT EXISTS "signers" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
        DROP COLUMN IF EXISTS "template_id",
        DROP COLUMN IF EXISTS "signers"
    `);
    await queryRunner.query(`
      ALTER TABLE "shares"
        DROP COLUMN IF EXISTS "share_type",
        DROP COLUMN IF EXISTS "direcao",
        DROP COLUMN IF EXISTS "lancamento_id",
        DROP COLUMN IF EXISTS "nome_musica",
        DROP COLUMN IF EXISTS "detentor",
        DROP COLUMN IF EXISTS "destinatario",
        DROP COLUMN IF EXISTS "tipo",
        DROP COLUMN IF EXISTS "artista_externo",
        DROP COLUMN IF EXISTS "artista_projeto_id",
        DROP COLUMN IF EXISTS "artista_id",
        DROP COLUMN IF EXISTS "pagador",
        DROP COLUMN IF EXISTS "pagador_contato",
        DROP COLUMN IF EXISTS "origem_acordo",
        DROP COLUMN IF EXISTS "data_prevista",
        DROP COLUMN IF EXISTS "documentos",
        DROP COLUMN IF EXISTS "acordo_notas",
        DROP COLUMN IF EXISTS "acordo_url",
        DROP COLUMN IF EXISTS "observacoes",
        DROP COLUMN IF EXISTS "versao",
        DROP COLUMN IF EXISTS "historico"
    `);
  }
}
