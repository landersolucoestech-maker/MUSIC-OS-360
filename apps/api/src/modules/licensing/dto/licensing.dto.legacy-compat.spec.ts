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
    ['moeda', 'currency', 'BRL'],
    ['artista', 'artist_name', 'Banda Y'],
  ])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { [legacy]: value };
    const errors = await validate(plainToInstance(CreateLicenseDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, LICENSE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });
});

describe('CreateLicenseDto deprecated moeda / artista keep their validators', () => {
  it('rejects a non-string moeda or artista and a moeda over 10 characters', async () => {
    const wrongType = await validate(plainToInstance(CreateLicenseDto, { moeda: 5, artista: 7 }), { whitelist: true, forbidNonWhitelisted: true });
    expect(wrongType.map((e) => e.property)).toEqual(expect.arrayContaining(['moeda', 'artista']));
    const tooLong = await validate(plainToInstance(CreateLicenseDto, { moeda: 'X'.repeat(11), artista: 'A'.repeat(256) }), { whitelist: true, forbidNonWhitelisted: true });
    expect(tooLong.map((e) => e.property)).toEqual(expect.arrayContaining(['moeda', 'artista']));
  });
});
