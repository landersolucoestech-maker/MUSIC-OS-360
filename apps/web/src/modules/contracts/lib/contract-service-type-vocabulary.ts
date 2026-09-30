/**
 * Contract service type vocabulary for the web module (technical = English, UX = PT-BR).
 *
 * Mirrors the API contract (apps/api/.../contract-service-type.vocabulary.ts, migration
 * 20260930000002): the persisted values of `client_types`, `financial_model` and
 * `financial_payment_frequency` are the canonical English ids below. PT-BR text lives
 * ONLY in the label maps at the bottom.
 *
 * READ compatibility: rows written before the backfill (or by a not-yet-updated API)
 * may still carry the deprecated Portuguese ids, so every read goes through the
 * normalizers, which map a known legacy id to its canonical one and pass everything
 * else through untouched. The web never WRITES a legacy id.
 */

export const CLIENT_TYPES = ["artist", "individual", "company"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/**
 * PENDING OWNER DECISION: the persisted value below has no canonical mapping yet and is
 * deliberately NOT translated (see findings/contracts-taxonomy.md). It is a valid,
 * pass-through `financial_model` until the owner decides.
 */
export const UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL = "recebimentos externos de direitos" as const;

export const CANONICAL_FINANCIAL_MODELS = ["fixed_value", "mixed", "recurring"] as const;
export type CanonicalFinancialModel = (typeof CANONICAL_FINANCIAL_MODELS)[number];
export type FinancialModel = CanonicalFinancialModel | typeof UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL;

export const PAYMENT_FREQUENCIES = ["one_time", "monthly", "quarterly", "yearly"] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

export const DEFAULT_FINANCIAL_MODEL: CanonicalFinancialModel = "fixed_value";
export const DEFAULT_PAYMENT_FREQUENCY: PaymentFrequency = "one_time";

export const LEGACY_CLIENT_TYPES: Readonly<Record<string, ClientType>> = {
  artista: "artist",
  pessoa_fisica: "individual",
  pessoa_juridica: "company",
};

/** The external-rights phrase and 'royalties' are deliberately absent (unmapped). */
export const LEGACY_FINANCIAL_MODELS: Readonly<Record<string, CanonicalFinancialModel>> = {
  valor_fixo: "fixed_value",
  misto: "mixed",
  recorrente: "recurring",
};

export const LEGACY_PAYMENT_FREQUENCIES: Readonly<Record<string, PaymentFrequency>> = {
  unico: "one_time",
  mensal: "monthly",
  trimestral: "quarterly",
  anual: "yearly",
};

function canonical<T extends string>(map: Readonly<Record<string, T>>, value: string): string {
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** Maps deprecated members to canonical ones; duplicates collapse (first position kept); unknown members pass through. */
export function normalizeClientTypes(value: unknown): ClientType[] {
  if (!Array.isArray(value)) return [];
  const mapped = value.filter((m): m is string => typeof m === "string").map((m) => canonical(LEGACY_CLIENT_TYPES, m));
  return mapped.filter((m, i) => mapped.indexOf(m) === i) as ClientType[];
}

export function normalizeFinancialModel(value: unknown): FinancialModel {
  if (typeof value !== "string" || value === "") return DEFAULT_FINANCIAL_MODEL;
  return canonical(LEGACY_FINANCIAL_MODELS, value) as FinancialModel;
}

export function normalizePaymentFrequency(value: unknown): string {
  if (typeof value !== "string" || value === "") return DEFAULT_PAYMENT_FREQUENCY;
  return canonical(LEGACY_PAYMENT_FREQUENCIES, value);
}

// ─── PT-BR labels (the only place Portuguese text for these ids lives) ──────────

export const CLIENT_TYPE_LABELS_PT_BR: Readonly<Record<ClientType, string>> = {
  artist: "Artista",
  individual: "Pessoa física",
  company: "Pessoa jurídica",
};

export const FINANCIAL_MODEL_LABELS_PT_BR: Readonly<Record<FinancialModel, string>> = {
  fixed_value: "Valor fixo",
  mixed: "Misto",
  recurring: "Recorrente",
  [UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL]: "Recebimentos externos de direitos",
};

export const PAYMENT_FREQUENCY_LABELS_PT_BR: Readonly<Record<PaymentFrequency, string>> = {
  one_time: "Único",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};
