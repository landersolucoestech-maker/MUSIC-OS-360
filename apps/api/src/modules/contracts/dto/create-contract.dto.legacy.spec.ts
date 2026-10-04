import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContractDto } from './create-contract.dto';

// Real validation pipeline with the global pipe options. Every deprecated contract property must stay accepted
// (value preserved) and reject a malformed value with a constraint on that exact property.
const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreateContractDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

// [deprecated property, valid value, malformed value, expected constraint on the property]
const LEGACY: Array<[string, unknown, unknown, string]> = [
  ['titulo', 'Contrato legado', 42, 'isString'],
  ['tipo', 'gravacao', 42, 'isString'],
  ['artistId', '123e4567-e89b-12d3-a456-426614174000', 'not-a-uuid', 'isUuid'],
  ['value', '15000.00', 'abc', 'isNumberString'],
  ['valor', 15000, 'abc', 'isNumber'],
  ['startsAt', '2024-01-01T00:00:00.000Z', 'not-a-date', 'isDateString'],
  ['expiresAt', '2025-01-01T00:00:00.000Z', 'not-a-date', 'isDateString'],
  ['data_inicio', '2024-01-01', 'not-a-date', 'isDateString'],
  ['data_fim', '2025-12-31', 'not-a-date', 'isDateString'],
  ['fileUrl', 'r2://bucket/key.pdf', 42, 'isString'],
  ['arquivo_url', 'r2://bucket/key.pdf', 42, 'isString'],
  ['exclusivo', true, 'yes', 'isBoolean'],
  ['versoes', [{ version: 1 }], 'not-an-array', 'isArray'],
];

describe('CreateContractDto deprecated properties (legacy in)', () => {
  it.each(LEGACY)('accepts %s and preserves its value', async (legacy, valid) => {
    const { instance, errors } = await run({ title: 'Contrato', [legacy]: valid });
    expect(errors).toEqual([]);
    expect((instance as unknown as Record<string, unknown>)[legacy]).toEqual(valid);
  });

  it.each(LEGACY)('rejects a malformed %s with a constraint on that property (not a whitelist error)', async (legacy, _valid, bad, constraint) => {
    const { errors } = await run({ title: 'Contrato', [legacy]: bad });
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    const keys = Object.keys(forLegacy[0].constraints ?? {});
    expect(keys).toContain(constraint);
    expect(keys).not.toContain('whitelistValidation');
  });

  it.each(LEGACY)('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', CreateContractDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });

  it('an unknown (non-declared) property is still rejected by the same pipe', async () => {
    const { errors } = await run({ title: 'Contrato', not_a_contract_field: 1 });
    expect(errors.map((e) => e.property)).toEqual(['not_a_contract_field']);
  });
});
