import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { PAYROLL_DEPRECATED_FIELDS } from '../hr-legacy-fields';
import { CreatePayrollEntryDto } from './create-payroll-entry.dto';

describe('CreatePayrollEntryDto legacy fields (legacy in, canonical out)', () => {
  it.each([
    ['competencia', 'reference_month', '2025-03'],
    ['pago_em', 'paid_at', '2025-03-05'],
  ])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { [legacy]: value };
    const errors = await validate(plainToInstance(CreatePayrollEntryDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, PAYROLL_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });
});
