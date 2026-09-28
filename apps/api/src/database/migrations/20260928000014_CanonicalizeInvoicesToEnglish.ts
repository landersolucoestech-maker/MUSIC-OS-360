import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000014_CanonicalizeInvoicesToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for `invoices`
 * (CZ-036). Official Brazilian fiscal (NFS-e) terms keep their names by the
 * canonical map's PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION exceptions (tomador,
 * prestador, cfop, serie, tipo_nota, natureza_operacao, inscricao_estadual,
 * inscricao_municipal, aliquota_iss, iss_retido, base_calculo, ...); the
 * generic Portuguese names are renamed:
 *
 *   numero -> invoice_number, tomador_nome -> tomador_name,
 *   tomador_razao_social -> tomador_legal_name, data_emissao -> issued_at,
 *   data_vencimento -> due_at, arquivo_url -> file_url, venda_id -> sale_id,
 *   forma_pagamento -> payment_method, condicao_pagamento -> payment_terms,
 *   itens -> items
 *
 * `items` elements: codigo_servico -> service_code, quantidade -> quantity
 * (reversible), and the pre-Cluster-G keys valor_unitario -> unit_price,
 * valor_total -> total_amount, descricao -> description (forward-only).
 *
 * `due_at` (the NFS-e due date) and `due_date` (the Stripe billing invoice due
 * date) are different fields of the two invoice kinds that share the table.
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() reverses every step.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['numero', 'invoice_number'],
  ['tomador_nome', 'tomador_name'],
  ['tomador_razao_social', 'tomador_legal_name'],
  ['data_emissao', 'issued_at'],
  ['data_vencimento', 'due_at'],
  ['arquivo_url', 'file_url'],
  ['venda_id', 'sale_id'],
  ['forma_pagamento', 'payment_method'],
  ['condicao_pagamento', 'payment_terms'],
  ['itens', 'items'],
];

const ITEM_KEYS: ReadonlyArray<[from: string, to: string]> = [
  ['codigo_servico', 'service_code'],
  ['quantidade', 'quantity'],
];

/**
 * Elements saved before naming-normalization Cluster G still carry these (the
 * web read them as fallbacks). Forward-only: before this migration the app
 * already wrote the English keys for these three, so down() must not turn
 * English keys back into Portuguese ones.
 */
const PRE_CLUSTER_G_ITEM_KEYS: ReadonlyArray<[from: string, to: string]> = [
  ['valor_unitario', 'unit_price'],
  ['valor_total', 'total_amount'],
  ['descricao', 'description'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "invoices" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

/** Renames keys of every object element of invoices.<column> (only when the target key is absent). */
async function renameItemKeys(q: QueryRunner, column: string, keys: ReadonlyArray<[string, string]>): Promise<void> {
  let element = 'elem';
  for (const [from, to] of keys) {
    element = `(CASE WHEN ${element} ? '${from}' AND NOT ${element} ? '${to}'
                     THEN (${element} - '${from}') || jsonb_build_object('${to}', ${element} -> '${from}')
                     ELSE ${element} END)`;
  }
  await q.query(
    `UPDATE "invoices"
        SET "${column}" = COALESCE((
              SELECT jsonb_agg(CASE WHEN jsonb_typeof(elem) = 'object' THEN ${element} ELSE elem END ORDER BY ord)
                FROM jsonb_array_elements("${column}") WITH ORDINALITY AS t(elem, ord)
            ), '[]'::jsonb)
      WHERE jsonb_typeof("${column}") = 'array'`,
  );
}

export class CanonicalizeInvoicesToEnglish20260928000014 implements MigrationInterface {
  name = 'CanonicalizeInvoicesToEnglish20260928000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    await renameItemKeys(queryRunner, 'items', [...ITEM_KEYS, ...PRE_CLUSTER_G_ITEM_KEYS]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await renameItemKeys(queryRunner, 'items', ITEM_KEYS.map(([a, b]) => [b, a] as [string, string]));
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
