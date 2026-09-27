import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateFinancialRuleDto } from './dto/financial-rules.dto';
import {
  CALCULATION_METHODS,
  LEGACY_CALCULATION_METHODS,
  LEGACY_RULE_TYPES,
  RULE_TYPES,
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
