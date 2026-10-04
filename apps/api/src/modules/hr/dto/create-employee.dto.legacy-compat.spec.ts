import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { EMPLOYEE_DEPRECATED_FIELDS } from '../hr-legacy-fields';
import { CreateEmployeeDto } from './create-employee.dto';

describe('CreateEmployeeDto legacy fields (legacy in, canonical out)', () => {
  it.each([
    ['cargo', 'job_title', 'Dev'],
    ['departamento', 'department', 'TI'],
    ['tipo_contrato', 'contract_type', 'CLT'],
    ['telefone', 'phone', '11999990000'],
    ['salario', 'salary', '3000'],
    ['data_admissao', 'hired_at', '2025-01-01'],
    ['data_demissao', 'terminated_at', '2025-03-01'],
  ])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { name: 'Fulano', [legacy]: value };
    const errors = await validate(plainToInstance(CreateEmployeeDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, EMPLOYEE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });

  it('rejects a malformed legacy date', async () => {
    const errors = await validate(plainToInstance(CreateEmployeeDto, { name: 'F', data_demissao: 'xx' }));
    expect(errors.map((e) => e.property)).toContain('data_demissao');
  });

  it('rejects a non-string legacy departamento/salario (the deprecated properties keep their validators)', async () => {
    const errors = await validate(plainToInstance(CreateEmployeeDto, { name: 'F', departamento: 5, salario: 3000 }));
    expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['departamento', 'salario']));
  });
});
