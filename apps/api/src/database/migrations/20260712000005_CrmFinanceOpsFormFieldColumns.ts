import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync (CRM, Finance and Operations).
 *
 * PRODUCT RULE (2026-07-12): each field of each form has ITS OWN
 * physical column with the EXACT name of the key sent by the form.
 * Modules: Leads, Contacts (clients), Transactions, Invoices (invoices),
 * Takedowns, Events, Licenses.
 */
export class CrmFinanceOpsFormFieldColumns20260712000005 implements MigrationInterface {
  name = 'CrmFinanceOpsFormFieldColumns20260712000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
        ADD COLUMN IF NOT EXISTS "uploads" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "nome_pf" varchar(255),
        ADD COLUMN IF NOT EXISTS "cpf" varchar(20),
        ADD COLUMN IF NOT EXISTS "cnpj" varchar(25),
        ADD COLUMN IF NOT EXISTS "funcao" varchar(100),
        ADD COLUMN IF NOT EXISTS "instagram" varchar(255),
        ADD COLUMN IF NOT EXISTS "foto" text,
        ADD COLUMN IF NOT EXISTS "razao_social" varchar(255),
        ADD COLUMN IF NOT EXISTS "nome_fantasia" varchar(255),
        ADD COLUMN IF NOT EXISTS "categoria" varchar(100),
        ADD COLUMN IF NOT EXISTS "perfil" varchar(100),
        ADD COLUMN IF NOT EXISTS "cep" varchar(15),
        ADD COLUMN IF NOT EXISTS "logradouro" varchar(255),
        ADD COLUMN IF NOT EXISTS "numero" varchar(20),
        ADD COLUMN IF NOT EXISTS "complemento" varchar(100),
        ADD COLUMN IF NOT EXISTS "bairro" varchar(120),
        ADD COLUMN IF NOT EXISTS "status_contato" varchar(40),
        ADD COLUMN IF NOT EXISTS "prioridade_contato" varchar(40),
        ADD COLUMN IF NOT EXISTS "prioridade" varchar(40),
        ADD COLUMN IF NOT EXISTS "responsavel_nome" varchar(150),
        ADD COLUMN IF NOT EXISTS "responsavel_email" varchar(150),
        ADD COLUMN IF NOT EXISTS "responsavel_telefone" varchar(30),
        ADD COLUMN IF NOT EXISTS "responsavel_cargo" varchar(100),
        ADD COLUMN IF NOT EXISTS "interacoes" jsonb,
        ADD COLUMN IF NOT EXISTS "attachments" jsonb,
        ADD COLUMN IF NOT EXISTS "endereco_completo" varchar(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "tipo_transacao" varchar(50),
        ADD COLUMN IF NOT EXISTS "tipo_cliente" varchar(50),
        ADD COLUMN IF NOT EXISTS "subcategoria" varchar(100),
        ADD COLUMN IF NOT EXISTS "data_transacao" date,
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "fornecedor_cliente" varchar(255),
        ADD COLUMN IF NOT EXISTS "orgao_arrecadador" varchar(255),
        ADD COLUMN IF NOT EXISTS "centro_custo" varchar(100),
        ADD COLUMN IF NOT EXISTS "competencia" varchar(20),
        ADD COLUMN IF NOT EXISTS "conta_origem" varchar(100),
        ADD COLUMN IF NOT EXISTS "conta_destino" varchar(100),
        ADD COLUMN IF NOT EXISTS "item_investimento" varchar(255),
        ADD COLUMN IF NOT EXISTS "motivo_viagem" varchar(255),
        ADD COLUMN IF NOT EXISTS "nome_publicidade" varchar(255),
        ADD COLUMN IF NOT EXISTS "forma_pagamento" varchar(50),
        ADD COLUMN IF NOT EXISTS "tipo_pagamento" varchar(50),
        ADD COLUMN IF NOT EXISTS "quantidade_parcelas" integer,
        ADD COLUMN IF NOT EXISTS "intervalo_parcelas" varchar(30),
        ADD COLUMN IF NOT EXISTS "data_primeira_parcela" date,
        ADD COLUMN IF NOT EXISTS "anexo_url" text,
        ADD COLUMN IF NOT EXISTS "anexo_nome" varchar(255),
        ADD COLUMN IF NOT EXISTS "evento_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "serie" varchar(20),
        ADD COLUMN IF NOT EXISTS "tipo_nota" varchar(30),
        ADD COLUMN IF NOT EXISTS "cliente_id" uuid,
        ADD COLUMN IF NOT EXISTS "venda_id" uuid,
        ADD COLUMN IF NOT EXISTS "url_pdf" text,
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "natureza_operacao" varchar(255),
        ADD COLUMN IF NOT EXISTS "codigo_servico_municipal" varchar(50),
        ADD COLUMN IF NOT EXISTS "codigo_municipio" varchar(20),
        ADD COLUMN IF NOT EXISTS "cfop" varchar(20),
        ADD COLUMN IF NOT EXISTS "descricao_servicos" text,
        ADD COLUMN IF NOT EXISTS "vencimento" date,
        ADD COLUMN IF NOT EXISTS "tomador_cnpj" varchar(30),
        ADD COLUMN IF NOT EXISTS "tomador_razao_social" varchar(255),
        ADD COLUMN IF NOT EXISTS "tomador_inscricao_estadual" varchar(50),
        ADD COLUMN IF NOT EXISTS "tomador_inscricao_municipal" varchar(50),
        ADD COLUMN IF NOT EXISTS "tomador_email" varchar(150),
        ADD COLUMN IF NOT EXISTS "tomador_endereco" varchar(300),
        ADD COLUMN IF NOT EXISTS "tomador_cidade" varchar(120),
        ADD COLUMN IF NOT EXISTS "tomador_uf" varchar(5),
        ADD COLUMN IF NOT EXISTS "tomador_cep" varchar(15),
        ADD COLUMN IF NOT EXISTS "valor_servicos" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_deducoes" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "base_calculo" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "aliquota_iss" numeric(7,4),
        ADD COLUMN IF NOT EXISTS "valor_iss" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "iss_retido" boolean,
        ADD COLUMN IF NOT EXISTS "valor_pis" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_cofins" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_inss" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_ir" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_csll" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "valor_liquido" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "forma_pagamento" varchar(50),
        ADD COLUMN IF NOT EXISTS "condicao_pagamento" varchar(100),
        ADD COLUMN IF NOT EXISTS "itens" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "takedowns"
        ADD COLUMN IF NOT EXISTS "tipo" varchar(30),
        ADD COLUMN IF NOT EXISTS "obra_afetada" varchar(500),
        ADD COLUMN IF NOT EXISTS "artista" varchar(255),
        ADD COLUMN IF NOT EXISTS "prioridade" varchar(20),
        ADD COLUMN IF NOT EXISTS "url_infracao" text,
        ADD COLUMN IF NOT EXISTS "descricao" text,
        ADD COLUMN IF NOT EXISTS "evidencias" text,
        ADD COLUMN IF NOT EXISTS "data_identificacao" date,
        ADD COLUMN IF NOT EXISTS "observacoes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
        ADD COLUMN IF NOT EXISTS "data_fim" timestamp,
        ADD COLUMN IF NOT EXISTS "endereco" varchar(300),
        ADD COLUMN IF NOT EXISTS "contato_local" varchar(255),
        ADD COLUMN IF NOT EXISTS "valor_cache" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "publico_esperado" integer,
        ADD COLUMN IF NOT EXISTS "descricao" text,
        ADD COLUMN IF NOT EXISTS "participantes" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "licenses"
        ADD COLUMN IF NOT EXISTS "remuneration_type" varchar(50),
        ADD COLUMN IF NOT EXISTS "artista_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "licenses" DROP COLUMN IF EXISTS "remuneration_type", DROP COLUMN IF EXISTS "artista_id"`);
    await queryRunner.query(`
      ALTER TABLE "events"
        DROP COLUMN IF EXISTS "data_fim", DROP COLUMN IF EXISTS "endereco",
        DROP COLUMN IF EXISTS "contato_local", DROP COLUMN IF EXISTS "valor_cache",
        DROP COLUMN IF EXISTS "publico_esperado", DROP COLUMN IF EXISTS "descricao",
        DROP COLUMN IF EXISTS "participantes"
    `);
    await queryRunner.query(`
      ALTER TABLE "takedowns"
        DROP COLUMN IF EXISTS "tipo", DROP COLUMN IF EXISTS "obra_afetada",
        DROP COLUMN IF EXISTS "artista", DROP COLUMN IF EXISTS "prioridade",
        DROP COLUMN IF EXISTS "url_infracao", DROP COLUMN IF EXISTS "descricao",
        DROP COLUMN IF EXISTS "evidencias", DROP COLUMN IF EXISTS "data_identificacao",
        DROP COLUMN IF EXISTS "observacoes"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "serie", DROP COLUMN IF EXISTS "tipo_nota",
        DROP COLUMN IF EXISTS "cliente_id", DROP COLUMN IF EXISTS "venda_id",
        DROP COLUMN IF EXISTS "url_pdf", DROP COLUMN IF EXISTS "observacoes",
        DROP COLUMN IF EXISTS "natureza_operacao", DROP COLUMN IF EXISTS "codigo_servico_municipal",
        DROP COLUMN IF EXISTS "codigo_municipio", DROP COLUMN IF EXISTS "cfop",
        DROP COLUMN IF EXISTS "descricao_servicos", DROP COLUMN IF EXISTS "vencimento",
        DROP COLUMN IF EXISTS "tomador_cnpj", DROP COLUMN IF EXISTS "tomador_razao_social",
        DROP COLUMN IF EXISTS "tomador_inscricao_estadual", DROP COLUMN IF EXISTS "tomador_inscricao_municipal",
        DROP COLUMN IF EXISTS "tomador_email", DROP COLUMN IF EXISTS "tomador_endereco",
        DROP COLUMN IF EXISTS "tomador_cidade", DROP COLUMN IF EXISTS "tomador_uf",
        DROP COLUMN IF EXISTS "tomador_cep", DROP COLUMN IF EXISTS "valor_servicos",
        DROP COLUMN IF EXISTS "valor_deducoes", DROP COLUMN IF EXISTS "base_calculo",
        DROP COLUMN IF EXISTS "aliquota_iss", DROP COLUMN IF EXISTS "valor_iss",
        DROP COLUMN IF EXISTS "iss_retido", DROP COLUMN IF EXISTS "valor_pis",
        DROP COLUMN IF EXISTS "valor_cofins", DROP COLUMN IF EXISTS "valor_inss",
        DROP COLUMN IF EXISTS "valor_ir", DROP COLUMN IF EXISTS "valor_csll",
        DROP COLUMN IF EXISTS "valor_liquido", DROP COLUMN IF EXISTS "forma_pagamento",
        DROP COLUMN IF EXISTS "condicao_pagamento", DROP COLUMN IF EXISTS "itens"
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "tipo_transacao", DROP COLUMN IF EXISTS "tipo_cliente",
        DROP COLUMN IF EXISTS "subcategoria", DROP COLUMN IF EXISTS "data_transacao",
        DROP COLUMN IF EXISTS "observacoes", DROP COLUMN IF EXISTS "fornecedor_cliente",
        DROP COLUMN IF EXISTS "orgao_arrecadador", DROP COLUMN IF EXISTS "centro_custo",
        DROP COLUMN IF EXISTS "competencia", DROP COLUMN IF EXISTS "conta_origem",
        DROP COLUMN IF EXISTS "conta_destino", DROP COLUMN IF EXISTS "item_investimento",
        DROP COLUMN IF EXISTS "motivo_viagem", DROP COLUMN IF EXISTS "nome_publicidade",
        DROP COLUMN IF EXISTS "forma_pagamento", DROP COLUMN IF EXISTS "tipo_pagamento",
        DROP COLUMN IF EXISTS "quantidade_parcelas", DROP COLUMN IF EXISTS "intervalo_parcelas",
        DROP COLUMN IF EXISTS "data_primeira_parcela", DROP COLUMN IF EXISTS "anexo_url",
        DROP COLUMN IF EXISTS "anexo_nome", DROP COLUMN IF EXISTS "evento_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "nome_pf", DROP COLUMN IF EXISTS "cpf", DROP COLUMN IF EXISTS "cnpj",
        DROP COLUMN IF EXISTS "funcao", DROP COLUMN IF EXISTS "instagram", DROP COLUMN IF EXISTS "foto",
        DROP COLUMN IF EXISTS "razao_social", DROP COLUMN IF EXISTS "nome_fantasia",
        DROP COLUMN IF EXISTS "categoria", DROP COLUMN IF EXISTS "perfil",
        DROP COLUMN IF EXISTS "cep", DROP COLUMN IF EXISTS "logradouro",
        DROP COLUMN IF EXISTS "numero", DROP COLUMN IF EXISTS "complemento",
        DROP COLUMN IF EXISTS "bairro", DROP COLUMN IF EXISTS "status_contato",
        DROP COLUMN IF EXISTS "prioridade_contato", DROP COLUMN IF EXISTS "prioridade",
        DROP COLUMN IF EXISTS "responsavel_nome", DROP COLUMN IF EXISTS "responsavel_email",
        DROP COLUMN IF EXISTS "responsavel_telefone", DROP COLUMN IF EXISTS "responsavel_cargo",
        DROP COLUMN IF EXISTS "interacoes", DROP COLUMN IF EXISTS "attachments",
        DROP COLUMN IF EXISTS "endereco_completo"
    `);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "uploads"`);
  }
}
