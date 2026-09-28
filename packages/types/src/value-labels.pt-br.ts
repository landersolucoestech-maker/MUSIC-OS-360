/**
 * PT-BR display labels of non-status enum values persisted by the API
 * (technical value = English, label = PT-BR). Single source for the API
 * (reports export/import round-trip) and the web option lists.
 * Status labels live in status-labels.pt-br.ts.
 */

// ── transactions (CZ-041) ────────────────────────────────────────────────────
export const TRANSACTION_COUNTERPARTY_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {
  company: "Empresa",
  artist: "Artista",
  individual: "Pessoa",
  government: "Governo",
  own_account: "Conta Própria",
};

export const TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR: Readonly<Record<string, string>> = {
  pix: "PIX",
  ted: "TED",
  boleto: "Boleto",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
  check: "Cheque",
};

export const TRANSACTION_PAYMENT_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {
  upfront: "À vista",
  installments: "Parcelado",
};

export const TRANSACTION_INSTALLMENT_INTERVAL_LABELS_PT_BR: Readonly<Record<string, string>> = {
  monthly: "Mensal",
  biweekly: "Quinzenal",
  weekly: "Semanal",
};

// ── works (CZ-039) ───────────────────────────────────────────────────────────
export const WORK_ORIGIN_LABELS_PT_BR: Readonly<Record<string, string>> = {
  original: "Autoral",
  reference: "Referência",
};

export const WORK_AI_USAGE_LEVEL_LABELS_PT_BR: Readonly<Record<string, string>> = {
  full: "Totalmente",
  partial: "Parcialmente",
};

// ── phonograms (CZ-040) ──────────────────────────────────────────────────────
export const PHONOGRAM_MEDIA_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {
  all: "Todas",
  digital: "Digital",
  physical: "Física",
  streaming: "Streaming",
};

export const PHONOGRAM_RECORDING_CLASSIFICATION_LABELS_PT_BR: Readonly<Record<string, string>> = {
  studio: "Estúdio",
  live: "Ao vivo",
  remix: "Remix",
  demo: "Demo",
  other: "Outra",
};
