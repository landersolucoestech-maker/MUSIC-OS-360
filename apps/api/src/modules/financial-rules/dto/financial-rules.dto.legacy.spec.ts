import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeFinancialRuleInput } from '../financial-rule-legacy.mapper';
import { CreateFinancialRuleDto } from './financial-rules.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreateFinancialRuleDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};
const base = { name: 'ISS', type: 'tax', value: 5 };

describe('CreateFinancialRuleDto deprecated properties calculo / condicoes (legacy in, canonical out)', () => {
  it('accepts calculo in place of calculation_method, preserves it and maps it', async () => {
    const payload = { ...base, calculo: 'percentual' };
    const { instance, errors } = await run(payload);
    expect(errors).toEqual([]);
    expect(instance.calculo).toBe('percentual');
    expect(normalizeFinancialRuleInput(payload)).toEqual({ ...base, calculation_method: 'percentage' });
  });

  it('rejects a malformed calculo with an isIn constraint on calculo itself (not a whitelist error)', async () => {
    const { errors } = await run({ ...base, calculo: 'progressive' });
    expect(errors.map((e) => e.property)).toEqual(['calculo']);
    expect(Object.keys(errors[0].constraints ?? {})).toEqual(['isIn']);
  });

  it('without either name calculation_method is required (the alias is what waives it)', async () => {
    const { errors } = await run(base);
    expect(errors.map((e) => e.property)).toEqual(['calculation_method']);
  });

  it('accepts condicoes under the whitelist pipe, preserves the object and maps it to conditions', async () => {
    const condicoes = { triggers: ['transaction.paid'] };
    const payload = { ...base, calculation_method: 'fixed', condicoes };
    const { instance, errors } = await run(payload);
    expect(errors).toEqual([]);
    expect(instance.condicoes).toEqual(condicoes);
    expect(normalizeFinancialRuleInput(payload)['conditions']).toEqual(condicoes);
    expect(normalizeFinancialRuleInput(payload)).not.toHaveProperty('condicoes');
  });

  it.each(['calculo', 'condicoes'])('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', CreateFinancialRuleDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
