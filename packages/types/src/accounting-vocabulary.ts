/**
 * Canonical English vocabularies of the financial/accounting contract (CZ-041).
 * Verified against the transaction API (transaction-legacy-fields.ts), the
 * TransactionType enum and the web category-rule maps (financialRules.utils.ts).
 */

/** Same values as the TransactionType enum in enums.ts. */
export const TRANSACTION_TYPE_VALUES = ["revenue", "expense", "investment", "tax", "transfer"] as const;
export type TransactionTypeValue = (typeof TRANSACTION_TYPE_VALUES)[number];

export const COUNTERPARTY_TYPE_VALUES = ["company", "individual", "artist", "government", "own_account"] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPE_VALUES)[number];

/** Managerial link inputs a financial category rule can ask for. */
export const RULE_LINK_VALUES = [
  "artist", "project", "contract", "event", "cost_center", "reference_month",
  "source_bank_account", "destination_bank_account",
] as const;
export type RuleLink = (typeof RULE_LINK_VALUES)[number];

// PT-BR labels of the transaction types: TRANSACTION_TYPE_LABELS_PT_BR (status-labels.pt-br.ts).

export const COUNTERPARTY_TYPE_LABELS_PT_BR: Readonly<Record<CounterpartyType, string>> = {
  company: "Empresa",
  individual: "Pessoa",
  artist: "Artista",
  government: "Governo",
  own_account: "Conta Própria",
};

export const RULE_LINK_LABELS_PT_BR: Readonly<Record<RuleLink, string>> = {
  artist: "Artista",
  project: "Projeto",
  contract: "Contrato",
  event: "Evento",
  cost_center: "Centro de custo",
  reference_month: "Competência",
  source_bank_account: "Conta Origem",
  destination_bank_account: "Conta Destino",
};
