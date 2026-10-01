/**
 * Canonical id of the "recebimentos externos de direitos" concept.
 *
 * The phrase was persisted as a plain-text value in two places
 * (`contract_service_types.financial_model` and `transactions.category`) and as a
 * web-only form value. The canonical technical id is `external_rights_receipts`
 * (precedent: financial_rules.type `external_rights_fee`); the PT-BR label
 * "Recebimentos externos de direitos" lives in the web UI only.
 *
 * Expand/contract: writes are canonical; reads and filters keep accepting the
 * legacy phrase until migration 20260930000017 has run everywhere.
 * Removal condition: the census queries in findings/contracts-ct1.md return 0 on
 * production for one release window.
 */
export const EXTERNAL_RIGHTS_RECEIPTS = 'external_rights_receipts' as const;
export const LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE = 'recebimentos externos de direitos' as const;

/** The canonical id for the legacy phrase; every other value is returned untouched (exact match only). */
export function canonicalExternalRightsReceipts<T>(value: T): T | typeof EXTERNAL_RIGHTS_RECEIPTS {
  return value === LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE ? EXTERNAL_RIGHTS_RECEIPTS : value;
}

/** Every persisted spelling to match in an exact-match filter (canonical first), or `[value]` for any other value. */
export function externalRightsReceiptsVariants(value: string): string[] {
  return value === EXTERNAL_RIGHTS_RECEIPTS || value === LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE
    ? [EXTERNAL_RIGHTS_RECEIPTS, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE]
    : [value];
}
