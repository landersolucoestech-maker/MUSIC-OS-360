/**
 * financial-rule-legacy.mapper.ts
 *
 * Compatibility window for the financial_rules canonicalization
 * (migration 20260927000001). The canonical technical contract is English:
 *   fields  calculation_method, conditions
 *   values  calculation_method ∈ CALCULATION_METHODS, type ∈ RULE_TYPES
 * A client built before that change may still send the Portuguese field
 * names (calculo, condicoes) or values (percentual, imposto, ...). They are
 * accepted as deprecated input and normalized here — the only place that
 * knows the legacy vocabulary — so nothing past the controller ever sees a
 * Portuguese technical value. Responses are canonical only.
 */

export const CALCULATION_METHODS = ['percentage', 'fixed', 'tiered'] as const;
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];

export const RULE_TYPES = ['tax', 'commission', 'external_rights_fee', 'discount', 'fee', 'other'] as const;
export type FinancialRuleType = (typeof RULE_TYPES)[number];

/** Deprecated persisted/API values -> canonical value. */
export const LEGACY_CALCULATION_METHODS: Readonly<Record<string, CalculationMethod>> = {
  percentual: 'percentage',
  fixo: 'fixed',
  faixa: 'tiered',
};

export const LEGACY_RULE_TYPES: Readonly<Record<string, FinancialRuleType>> = {
  imposto: 'tax',
  comissao: 'commission',
  desconto: 'discount',
  taxa: 'fee',
  outros: 'other',
};

/** Values the DTO accepts during the compatibility window (canonical + deprecated). */
export const ACCEPTED_CALCULATION_METHODS = [...CALCULATION_METHODS, ...Object.keys(LEGACY_CALCULATION_METHODS)];
export const ACCEPTED_RULE_TYPES = [...RULE_TYPES, ...Object.keys(LEGACY_RULE_TYPES)];

export function canonicalCalculationMethod(value: string): string {
  return LEGACY_CALCULATION_METHODS[value] ?? value;
}

export function canonicalRuleType(value: string): string {
  return LEGACY_RULE_TYPES[value] ?? value;
}

/**
 * Normalizes a create/update payload to the canonical contract: deprecated
 * field names are moved to their canonical names (the canonical field wins
 * when both are sent) and deprecated values are mapped.
 */
export function normalizeFinancialRuleInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (out['calculo'] !== undefined) {
    if (out['calculation_method'] === undefined) out['calculation_method'] = out['calculo'];
    delete out['calculo'];
  }
  if (out['condicoes'] !== undefined) {
    if (out['conditions'] === undefined) out['conditions'] = out['condicoes'];
    delete out['condicoes'];
  }
  if (typeof out['calculation_method'] === 'string') {
    out['calculation_method'] = canonicalCalculationMethod(out['calculation_method']);
  }
  if (typeof out['type'] === 'string') out['type'] = canonicalRuleType(out['type']);
  return out;
}
