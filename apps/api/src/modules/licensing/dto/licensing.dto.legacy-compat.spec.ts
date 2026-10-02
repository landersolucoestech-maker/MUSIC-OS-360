import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { LICENSE_DEPRECATED_FIELDS } from '../license-vocabulary';
import { CreateLicenseDto } from './licensing.dto';

describe('CreateLicenseDto legacy fields (legacy in, canonical out)', () => {
  it.each([
    ['obra_musical', 'work_title', 'Obra X'],
    ['tipo_uso', 'usage_type', 'sync'],
  ])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { [legacy]: value };
    const errors = await validate(plainToInstance(CreateLicenseDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, LICENSE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });
});
