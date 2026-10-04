import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateFinancialRuleDto } from './dto/financial-rules.dto';
import {
  CALCULATION_METHODS,
  LEGACY_CALCULATION_METHODS,
  LEGACY_RULE_TYPES,
  RULE_TYPES,
  canonicalCalculationMethod,
  canonicalRuleType,
  normalizeFinancialRuleInput,
} from './financial-rule-legacy.mapper';

describe('financial rule legacy compatibility (migration 20260927000001)', () => {
  it('maps every deprecated value to a canonical English value', () => {
    for (const value of Object.values(LEGACY_CALCULATION_METHODS)) expect(CALCULATION_METHODS).toContain(value);
    for (const value of Object.values(LEGACY_RULE_TYPES)) expect(RULE_TYPES).toContain(value);
  });

  it('normalizes deprecated field names and values to the canonical contract', () => {
    expect(
      normalizeFinancialRuleInput({ type: 'imposto', calculo: 'fixo', condicoes: { triggers: ['transaction.paid'] } }),
    ).toEqual({ type: 'tax', calculation_method: 'fixed', conditions: { triggers: ['transaction.paid'] } });
  });

  it('keeps the canonical field when both the canonical and the deprecated name are sent', () => {
    expect(normalizeFinancialRuleInput({ calculation_method: 'percentage', calculo: 'fixo' })).toEqual({
      calculation_method: 'percentage',
    });
  });

  it('keeps the canonical conditions when both the canonical and the deprecated name are sent, and drops the deprecated key', () => {
    const out = normalizeFinancialRuleInput({ conditions: { triggers: ['a'] }, condicoes: { triggers: ['b'] } });
    expect(out).toEqual({ conditions: { triggers: ['a'] } });
    expect(out).not.toHaveProperty('condicoes');
  });

  it('a deprecated name alone is moved to the canonical name only when the canonical one is absent (both fields, both directions)', () => {
    expect(normalizeFinancialRuleInput({ condicoes: { x: 1 } })).toEqual({ conditions: { x: 1 } });
    expect(normalizeFinancialRuleInput({ calculo: 'fixo' })).toEqual({ calculation_method: 'fixed' });
    expect(normalizeFinancialRuleInput({ conditions: {}, condicoes: { x: 1 } })['conditions']).toEqual({});
  });

  it.each([
    ['percentual', 'percentage'],
    ['fixo', 'fixed'],
    ['faixa', 'tiered'],
  ])('maps the deprecated calculation method %j to %j (function and payload)', (legacy, canonical) => {
    expect(canonicalCalculationMethod(legacy)).toBe(canonical);
    expect(normalizeFinancialRuleInput({ calculation_method: legacy })).toEqual({ calculation_method: canonical });
    expect(normalizeFinancialRuleInput({ calculo: legacy })).toEqual({ calculation_method: canonical });
  });

  it.each([
    ['imposto', 'tax'],
    ['comissao', 'commission'],
    ['desconto', 'discount'],
    ['taxa', 'fee'],
    ['outros', 'other'],
  ])('maps the deprecated rule type %j to %j (function and payload)', (legacy, canonical) => {
    expect(canonicalRuleType(legacy)).toBe(canonical);
    expect(normalizeFinancialRuleInput({ type: legacy })).toEqual({ type: canonical });
  });

  it('the deprecated vocabulary is exactly the accepted legacy set (no key can disappear unnoticed)', () => {
    expect(Object.keys(LEGACY_CALCULATION_METHODS).sort()).toEqual(['faixa', 'fixo', 'percentual']);
    expect(Object.keys(LEGACY_RULE_TYPES).sort()).toEqual(['comissao', 'desconto', 'imposto', 'outros', 'taxa']);
  });

  it('leaves canonical input unchanged', () => {
    const input = { type: 'external_rights_fee', calculation_method: 'tiered', conditions: {} };
    expect(normalizeFinancialRuleInput(input)).toEqual(input);
  });

  describe('CreateFinancialRuleDto', () => {
    const errorsFor = (plain: Record<string, unknown>) =>
      validateSync(plainToInstance(CreateFinancialRuleDto, plain)).map((e) => e.property);

    it('accepts the canonical payload', () => {
      expect(errorsFor({ name: 'ISS', type: 'tax', calculation_method: 'percentage', value: 5 })).toEqual([]);
    });

    it('accepts the deprecated payload during the compatibility window', () => {
      expect(errorsFor({ name: 'ISS', type: 'imposto', calculo: 'percentual', value: 5 })).toEqual([]);
    });

    it('requires a calculation method under one of the two names', () => {
      expect(errorsFor({ name: 'ISS', type: 'tax', value: 5 })).toContain('calculation_method');
    });

    it('rejects an unknown calculation method', () => {
      expect(errorsFor({ name: 'ISS', type: 'tax', calculation_method: 'progressive', value: 5 })).toContain(
        'calculation_method',
      );
    });
  });
});
