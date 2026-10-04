import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { EMPLOYEE_DEPRECATED_FIELDS } from '../hr-legacy-fields';
import { CreateEmployeeDto } from './create-employee.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreateEmployeeDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

// [deprecated property, canonical property, valid value, malformed value, expected constraint]
const LEGACY: Array<[string, string, unknown, unknown, string]> = [
  ['cargo', 'job_title', 'Produtor', 42, 'isString'],
  ['departamento', 'department', 'Financeiro', 42, 'isString'],
  ['tipo_contrato', 'contract_type', 'clt', 42, 'isString'],
  ['telefone', 'phone', '+5511999990000', 42, 'isString'],
  ['salario', 'salary', '3500.00', 42, 'isString'],
  ['data_admissao', 'hired_at', '2024-02-01', 'xx', 'isDateString'],
  ['data_demissao', 'terminated_at', '2025-03-01', 'xx', 'isDateString'],
];

describe('CreateEmployeeDto deprecated properties (legacy in, canonical out)', () => {
  it.each(LEGACY)('accepts %s, preserves it, and maps it to %s', async (legacy, canonical, valid) => {
    const payload = { name: 'Fulano', [legacy]: valid };
    const { instance, errors } = await run(payload);
    expect(errors).toEqual([]);
    expect((instance as unknown as Record<string, unknown>)[legacy]).toEqual(valid);
    const moved = applyDeprecatedFieldAliases(payload, EMPLOYEE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toEqual(valid);
    expect(moved).not.toHaveProperty(legacy);
  });

  it.each(LEGACY)('rejects a malformed %s with a constraint on that property (not a whitelist error)', async (legacy, _canonical, _valid, bad, constraint) => {
    const { errors } = await run({ name: 'Fulano', [legacy]: bad });
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    expect(Object.keys(forLegacy[0].constraints ?? {})).toEqual([constraint]);
  });

  it.each(LEGACY)('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', CreateEmployeeDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
