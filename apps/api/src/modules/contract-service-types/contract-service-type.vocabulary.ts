/**
 * Contract service type technical vocabulary (technical = English, UX = PT-BR; the
 * web renders the PT-BR labels).
 *
 * Canonical values are the persisted values of `contract_service_types.client_types`
 * (jsonb array), `.financial_model` and `.financial_payment_frequency` (migration
 * 20260930000002_CanonicalizeContractServiceTypeValuesAndIndex). The legacy maps
 * below only translate deprecated INPUT from a web build or integration released
 * before the vocabulary was canonicalized; they are the only place that knows the
 * Portuguese spellings. Responses are canonical only.
 *
 * Deprecated input is mapped BEFORE validation (class-transformer @Transform runs
 * ahead of class-validator) and is registered as TEMPORARY_MIGRATION_COMPATIBILITY
 * in the canonical naming map ledger (removal condition: no legacy value received
 * on any environment for one release window).
 */

/** Client audience of a service type. Precedent: clients.person_type (CZ-043), counterparty_type. */
export const CONTRACT_SERVICE_TYPE_CLIENT_TYPES = ['artist', 'individual', 'company'] as const;
export type ContractServiceTypeClientType = (typeof CONTRACT_SERVICE_TYPE_CLIENT_TYPES)[number];

/**
 * PENDING OWNER DECISION (see findings/contracts-taxonomy.md): the persisted value
 * 'recebimentos externos de direitos' (probably the artifact of an earlier mass
 * rewrite of 'royalties') has NO canonical mapping yet. It stays a valid,
 * unmapped, pass-through value: never translated on input, never rewritten by the
 * migration, never given a CHECK constraint. Replace this constant by the canonical
 * value only after the owner decides (and add the backfill in a new migration).
 */
export const UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL = 'recebimentos externos de direitos' as const;

export const CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS = ['fixed_value', 'mixed', 'recurring'] as const;
export type ContractServiceTypeCanonicalFinancialModel =
  (typeof CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS)[number];

/** Values the API accepts for `financial_model`: canonical + the one unmapped pass-through value. */
export const CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS = [
  ...CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS,
  UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL,
] as const;

/**
 * Precedent for monthly/quarterly/yearly: artist goal periods (GOAL_PERIODS).
 * Not enforced with IsIn: no owner audit of the values already persisted exists
 * yet (column is unconstrained varchar), so rejecting unknown values on update
 * could break an edit that echoes a stored value. Deprecated spellings are still mapped.
 */
export const CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES = ['one_time', 'monthly', 'quarterly', 'yearly'] as const;
export type ContractServiceTypePaymentFrequency = (typeof CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES)[number];

export const LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES: Readonly<Record<string, ContractServiceTypeClientType>> = {
  artista: 'artist',
  pessoa_fisica: 'individual',
  pessoa_juridica: 'company',
};

/** 'recebimentos externos de direitos' and 'royalties' are deliberately absent: unmapped until the owner decides. */
export const LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS: Readonly<
  Record<string, ContractServiceTypeCanonicalFinancialModel>
> = {
  valor_fixo: 'fixed_value',
  misto: 'mixed',
  recorrente: 'recurring',
};

export const LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES: Readonly<
  Record<string, ContractServiceTypePaymentFrequency>
> = {
  unico: 'one_time',
  mensal: 'monthly',
  trimestral: 'quarterly',
  anual: 'yearly',
};

function canonical(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** class-transformer @Transform: maps a deprecated `financial_model` before validation. */
export const canonicalContractServiceTypeFinancialModel = ({ value }: { value: unknown }) =>
  canonical(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS, value);

/** class-transformer @Transform: maps a deprecated `financial_payment_frequency` before validation. */
export const canonicalContractServiceTypePaymentFrequency = ({ value }: { value: unknown }) =>
  canonical(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES, value);

/**
 * class-transformer @Transform: maps deprecated `client_types` members before validation.
 * The canonical member wins over its deprecated alias: a value sent under both spellings
 * collapses to one entry (first position kept). Anything that is not a known legacy
 * spelling (including a non-array payload) is passed through so validation rejects it.
 */
export const canonicalContractServiceTypeClientTypes = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const mapped = value.map((member) => canonical(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES, member));
  return mapped.filter((member, index) => mapped.indexOf(member) === index);
};
