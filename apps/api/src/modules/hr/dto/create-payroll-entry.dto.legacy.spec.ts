import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { PAYROLL_DEPRECATED_FIELDS } from '../hr-legacy-fields';
import { CreatePayrollEntryDto } from './create-payroll-entry.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreatePayrollEntryDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

const CANONICAL_REQUIRED = { employee_id: 'emp-1', reference_month: '2025-03', gross_salary: '1000.00', net_salary: '900.00' };

// [deprecated property, canonical property, valid value, malformed value, expected constraint]
const LEGACY: Array<[string, string, unknown, unknown, string]> = [
  ['funcionario_id', 'employee_id', 'emp-1', 42, 'isString'],
  ['competencia', 'reference_month', '2025-03', 42, 'isString'],
  ['mes_referencia', 'reference_month', '2025-03', 42, 'isString'],
  ['salario_bruto', 'gross_salary', '1000.00', 1000, 'isString'],
  ['descontos', 'deductions', '100.00', 100, 'isString'],
  ['salario_liquido', 'net_salary', '900.00', 900, 'isString'],
  ['data_pagamento', 'payment_date', '2025-03-05', 'xx', 'isDateString'],
  ['pago_em', 'paid_at', '2025-03-05', 'xx', 'isDateString'],
  ['observacoes', 'notes', 'nota', 42, 'isString'],
];

/** A payload where the deprecated name REPLACES its canonical counterpart (the required-field guards must follow). */
const legacyOnly = (legacy: string, canonical: string, value: unknown): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...CANONICAL_REQUIRED, [legacy]: value };
  delete payload[canonical];
  return payload;
};

describe('CreatePayrollEntryDto deprecated properties (legacy in, canonical out)', () => {
  it.each(LEGACY)('accepts %s IN PLACE OF %s: whole payload valid, value preserved, mapped to the canonical name', async (legacy, canonical, valid) => {
    const payload = legacyOnly(legacy, canonical, valid);
    const { instance, errors } = await run(payload);
    // the whole payload, not just the legacy property: the required-field guards (ValidateIf) must also honour the legacy name
    expect(errors).toEqual([]);
    expect((instance as unknown as Record<string, unknown>)[legacy]).toEqual(valid);
    const moved = applyDeprecatedFieldAliases(payload, PAYROLL_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toEqual(valid);
    expect(moved).not.toHaveProperty(legacy);
  });

  it.each(LEGACY)('rejects a malformed %s with a constraint on that property (not a whitelist error)', async (legacy, canonical, _valid, bad, constraint) => {
    const { errors } = await run(legacyOnly(legacy, canonical, bad));
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    expect(Object.keys(forLegacy[0].constraints ?? {})).toEqual([constraint]);
  });

  it('accepts the deprecated file link and rejects an executable scheme on that property', async () => {
    const ok = await run({ ...CANONICAL_REQUIRED, arquivo_url: 'https://cdn.example.com/holerite.pdf' });
    expect(ok.errors).toEqual([]);
    expect((ok.instance as unknown as Record<string, unknown>)['arquivo_url']).toBe('https://cdn.example.com/holerite.pdf');
    const { errors } = await run({ ...CANONICAL_REQUIRED, arquivo_url: 'javascript:alert(1)' });
    const forLegacy = errors.filter((e) => e.property === 'arquivo_url');
    expect(forLegacy).toHaveLength(1);
    expect(Object.keys(forLegacy[0].constraints ?? {})).not.toContain('whitelistValidation');
    expect(Object.keys(forLegacy[0].constraints ?? {}).length).toBeGreaterThan(0);
  });

  it('still requires the canonical-or-legacy value: neither name sent is a validation error', async () => {
    const { errors } = await run({ employee_id: 'emp-1', gross_salary: '1', net_salary: '1' });
    expect(errors.map((e) => e.property)).toEqual(['reference_month']);
  });

  it.each(LEGACY)('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', CreatePayrollEntryDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
