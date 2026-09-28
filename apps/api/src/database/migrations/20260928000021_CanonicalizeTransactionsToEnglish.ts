import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000021_CanonicalizeTransactionsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for
 * `transactions` (CZ-041). `transactions` is the single canonical ledger
 * (product decision PO-VERIFY-027 — REMOVE_SECOND_ACCOUNTING_LAYER).
 *
 * Renames: categoria -> category, descricao -> description, valor -> amount,
 *   data -> transaction_date, contrato_id -> contract_id, evento_id -> event_id,
 *   comprovante_url -> attachment_url, anexo_nome ->
 *   attachment_name, tipo_cliente -> counterparty_type, subcategoria ->
 *   subcategory, fornecedor_cliente -> counterparty_name, orgao_arrecadador ->
 *   tax_authority, centro_custo -> cost_center, competencia -> reference_month,
 *   conta_origem / conta_destino -> source_bank_account /
 *   destination_bank_account, item_investimento -> investment_item,
 *   motivo_viagem -> travel_reason, forma_pagamento -> payment_method,
 *   tipo_pagamento -> payment_type, quantidade_parcelas -> installment_count,
 *   intervalo_parcelas -> installment_interval, data_primeira_parcela ->
 *   first_installment_date. Index idx_transactions_tenant_data ->
 *   idx_transactions_tenant_transaction_date.
 * Duplicates with no writer (tipo_transacao/data_transacao of type/data;
 *   anexo_url of comprovante_url; referencia, where the old API copied the
 *   note — `notes` is backfilled from it) keep their data as
 *   legacy_transaction_type / legacy_transaction_date / legacy_attachment_url /
 *   legacy_reference (drop needs explicit authorization — blocker
 *   BLK-TRANSACTIONS-LEGACY-DUPLICATES).
 * Hardening before first application (database review of 353a967): invalid
 *   calendar dates in metadata are skipped instead of aborting (pg_temp
 *   try-date helper), and lock_timeout bounds the wait for the table lock.
 * One source of truth: the API wrote the form fields only into `metadata`
 *   (tipoCliente, subcategoria, formaPagamento, ...), while the reports import
 *   wrote the physical columns. Every metadata value is copied into its (empty)
 *   column here — forward-only, nothing overwritten, over-long values skipped,
 *   metadata kept as historical data — and the API now reads/writes columns.
 * Values: type receita/despesa/investimento/imposto/transferencia ->
 *   revenue/expense/investment/tax/transfer (also financial_rules
 *   conditions->>'type', deferred by 20260927000001, and
 *   finance_category_keyword_rules.transaction_type RECEITA/DESPESA ->
 *   REVENUE/EXPENSE, the vocabulary of financial_categories.transaction_types);
 *   counterparty_type empresa/artista/pessoa/governo/conta-propria ->
 *   company/artist/individual/government/own_account;
 *   payment_method cartao-credito/cartao-debito/dinheiro/cheque ->
 *   credit_card/debit_card/cash/check (pix/ted/boleto are Brazilian
 *   payment-rail names, kept); payment_type avista/parcelado ->
 *   upfront/installments; installment_interval mensal/quinzenal/semanal ->
 *   monthly/biweekly/weekly.
 * chk_transactions_type is added NOT VALID (enforced for new writes; rows with
 *   an unforeseen legacy value are reported by the census, not rewritten).
 * Category / subcategory slug values are NOT touched (taxonomy decision
 * pending). RLS policies reference tenant_id only. Every step is guarded.
 * down() reverses renames and value remaps; the metadata backfill is
 * forward-only.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['categoria', 'category'],
  ['descricao', 'description'],
  ['valor', 'amount'],
  ['data', 'transaction_date'],
  ['contrato_id', 'contract_id'],
  ['evento_id', 'event_id'],
  ['referencia', 'legacy_reference'],
  ['comprovante_url', 'attachment_url'],
  ['anexo_nome', 'attachment_name'],
  ['tipo_cliente', 'counterparty_type'],
  ['subcategoria', 'subcategory'],
  ['fornecedor_cliente', 'counterparty_name'],
  ['orgao_arrecadador', 'tax_authority'],
  ['centro_custo', 'cost_center'],
  ['competencia', 'reference_month'],
  ['conta_origem', 'source_bank_account'],
  ['conta_destino', 'destination_bank_account'],
  ['item_investimento', 'investment_item'],
  ['motivo_viagem', 'travel_reason'],
  ['forma_pagamento', 'payment_method'],
  ['tipo_pagamento', 'payment_type'],
  ['quantidade_parcelas', 'installment_count'],
  ['intervalo_parcelas', 'installment_interval'],
  ['data_primeira_parcela', 'first_installment_date'],
  ['tipo_transacao', 'legacy_transaction_type'],
  ['data_transacao', 'legacy_transaction_date'],
  ['anexo_url', 'legacy_attachment_url'],
];

const TRANSACTION_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['receita', 'revenue'], ['despesa', 'expense'], ['investimento', 'investment'],
  ['imposto', 'tax'], ['transferencia', 'transfer'],
];

const VALUES: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['counterparty_type', 'empresa', 'company'],
  ['counterparty_type', 'artista', 'artist'],
  ['counterparty_type', 'pessoa', 'individual'],
  ['counterparty_type', 'governo', 'government'],
  ['counterparty_type', 'conta-propria', 'own_account'],
  ['payment_method', 'cartao-credito', 'credit_card'],
  ['payment_method', 'cartao-debito', 'debit_card'],
  ['payment_method', 'dinheiro', 'cash'],
  ['payment_method', 'cheque', 'check'],
  ['payment_type', 'avista', 'upfront'],
  ['payment_type', 'parcelado', 'installments'],
  ['installment_interval', 'mensal', 'monthly'],
  ['installment_interval', 'quinzenal', 'biweekly'],
  ['installment_interval', 'semanal', 'weekly'],
];

/** metadata key written by the pre-CZ-041 API -> column (with its varchar limit; null = text/other type). */
const METADATA_TO_COLUMN: ReadonlyArray<[key: string, column: string, maxLength: number | null]> = [
  ['tipoCliente', 'counterparty_type', 50],
  ['subcategoria', 'subcategory', 100],
  ['formaPagamento', 'payment_method', 50],
  ['tipoPagamento', 'payment_type', 50],
  ['intervaloParcelas', 'installment_interval', 30],
  ['fornecedorCliente', 'counterparty_name', 255],
  ['orgaoArrecadador', 'tax_authority', 255],
  ['itemInvestimento', 'investment_item', 255],
  ['motivoViagem', 'travel_reason', 255],
  ['advertisingName', 'advertising_name', 255],
  ['anexoNome', 'attachment_name', 255],
  ['observacao', 'notes', null],
  ['anexoUrl', 'attachment_url', null],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "transactions" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = '${from}' AND relkind = 'i')
         AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '${to}' AND relkind = 'i') THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

export class CanonicalizeTransactionsToEnglish20260928000021 implements MigrationInterface {
  name = 'CanonicalizeTransactionsToEnglish20260928000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pg_temp.cz041_try_date(t text) RETURNS date
      LANGUAGE plpgsql IMMUTABLE AS $fn$
      BEGIN
        IF t IS NULL OR t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
        RETURN t::date;
      EXCEPTION WHEN others THEN RETURN NULL;
      END $fn$;`);
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await queryRunner.query(renameIndex('idx_transactions_tenant_data', 'idx_transactions_tenant_transaction_date'));

    // One source of truth: metadata-only form fields -> their empty columns.
    for (const [key, column, maxLength] of METADATA_TO_COLUMN) {
      const fits = maxLength === null ? '' : ` AND length("metadata"->>'${key}') <= ${maxLength}`;
      await queryRunner.query(`
        UPDATE "transactions" SET "${column}" = NULLIF("metadata"->>'${key}', '')
        WHERE "${column}" IS NULL AND jsonb_typeof("metadata") = 'object' AND "metadata" ? '${key}'${fits}`);
    }
    await queryRunner.query(`
      UPDATE "transactions" SET "installment_count" = ("metadata"->>'quantidadeParcelas')::integer
      WHERE "installment_count" IS NULL AND jsonb_typeof("metadata") = 'object'
        AND "metadata"->>'quantidadeParcelas' ~ '^[0-9]{1,6}$'`);
    await queryRunner.query(`
      UPDATE "transactions" SET "first_installment_date" = pg_temp.cz041_try_date("metadata"->>'dataPrimeiraParcela')
      WHERE "first_installment_date" IS NULL AND jsonb_typeof("metadata") = 'object'
        AND pg_temp.cz041_try_date("metadata"->>'dataPrimeiraParcela') IS NOT NULL`);
    // The old API copied the note into `referencia` and read metadata.observacao ?? referencia.
    await queryRunner.query(`
      UPDATE "transactions" SET "notes" = "legacy_reference"
      WHERE "notes" IS NULL AND "legacy_reference" IS NOT NULL AND "legacy_reference" <> ''`);
    await queryRunner.query(`
      UPDATE "transactions" SET "event_id" = ("metadata"->>'eventoVinculado')::uuid
      WHERE "event_id" IS NULL AND jsonb_typeof("metadata") = 'object'
        AND "metadata"->>'eventoVinculado' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`);
    await queryRunner.query(`
      UPDATE "transactions" SET "attachment_url" = "legacy_attachment_url"
      WHERE "attachment_url" IS NULL AND "legacy_attachment_url" IS NOT NULL`);

    for (const [legacy, canonical] of TRANSACTION_TYPES) {
      await queryRunner.query(`UPDATE "transactions" SET "type" = $1 WHERE lower("type") = $2`, [canonical, legacy]);
      await queryRunner.query(
        `UPDATE "financial_rules" SET "conditions" = jsonb_set("conditions", '{type}', to_jsonb($1::text))
         WHERE jsonb_typeof("conditions") = 'object' AND lower("conditions"->>'type') = $2`,
        [canonical, legacy],
      );
    }
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "transactions" SET "${column}" = $1 WHERE lower("${column}") = $2`, [canonical, legacy]);
    }
    await queryRunner.query(`UPDATE "finance_category_keyword_rules" SET "transaction_type" = 'REVENUE' WHERE "transaction_type" = 'RECEITA'`);
    await queryRunner.query(`UPDATE "finance_category_keyword_rules" SET "transaction_type" = 'EXPENSE' WHERE "transaction_type" = 'DESPESA'`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.transactions'::regclass AND conname = 'chk_transactions_type') THEN
          ALTER TABLE "transactions" ADD CONSTRAINT "chk_transactions_type"
            CHECK ("type" IN ('revenue', 'expense', 'investment', 'tax', 'transfer')) NOT VALID;
        END IF;
      END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "chk_transactions_type"`);
    await queryRunner.query(`UPDATE "finance_category_keyword_rules" SET "transaction_type" = 'RECEITA' WHERE "transaction_type" = 'REVENUE'`);
    await queryRunner.query(`UPDATE "finance_category_keyword_rules" SET "transaction_type" = 'DESPESA' WHERE "transaction_type" = 'EXPENSE'`);
    for (const [column, legacy, canonical] of VALUES) {
      await queryRunner.query(`UPDATE "transactions" SET "${column}" = $1 WHERE "${column}" = $2`, [legacy, canonical]);
    }
    for (const [legacy, canonical] of TRANSACTION_TYPES) {
      await queryRunner.query(`UPDATE "transactions" SET "type" = $1 WHERE "type" = $2`, [legacy, canonical]);
      await queryRunner.query(
        `UPDATE "financial_rules" SET "conditions" = jsonb_set("conditions", '{type}', to_jsonb($1::text))
         WHERE jsonb_typeof("conditions") = 'object' AND "conditions"->>'type' = $2`,
        [legacy, canonical],
      );
    }
    await queryRunner.query(renameIndex('idx_transactions_tenant_transaction_date', 'idx_transactions_tenant_data'));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
