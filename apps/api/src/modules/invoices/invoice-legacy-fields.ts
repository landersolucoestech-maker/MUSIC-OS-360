/**
 * invoice-legacy-fields.ts — CZ-036 deploy-skew compatibility for the invoice
 * contract.
 *
 * Generic invoice field names are English; official Brazilian fiscal (NFS-e)
 * terms keep their names (canonical map PRODUCT_TERM exceptions). A web build
 * released before CZ-036 sends the Portuguese names below (and `codigo_servico`
 * / `quantidade` inside each item); they are accepted as deprecated input and
 * moved here before persistence. Responses are canonical.
 */
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const INVOICE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  numero: 'invoice_number',
  venda_id: 'sale_id',
  data_emissao: 'issued_at',
  vencimento: 'due_at',
  tomador_razao_social: 'tomador_legal_name',
  forma_pagamento: 'payment_method',
  condicao_pagamento: 'payment_terms',
  itens: 'items',
};

export const INVOICE_ITEM_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  codigo_servico: 'service_code',
  quantidade: 'quantity',
};
