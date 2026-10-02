import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { CONTRACT_SERVICE_TYPE_DEPRECATED_FIELDS, CreateContractServiceTypeDto } from './create-contract-service-type.dto';

// The pre-canonical web sends `conteudo`; the DTO must still accept it and the alias table must move it to `content`.
describe('CreateContractServiceTypeDto legacy fields (legacy in, canonical out)', () => {
  const base = { name: 'n', slug: 's', client_types: ['artista'], financial_model: 'valor_fixo' };

  it.each([['conteudo', 'content']])('accepts deprecated %s and maps it to %s', async (legacy, canonical) => {
    const payload = { ...base, [legacy]: 'texto' };
    const dto = plainToInstance(CreateContractServiceTypeDto, payload);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toEqual([]);
    // legacy enum members were converted before validation
    expect(dto.client_types).toEqual(['artist']);
    expect(dto.financial_model).toBe('fixed_value');
    const moved = applyDeprecatedFieldAliases(payload, CONTRACT_SERVICE_TYPE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe('texto');
    expect(moved).not.toHaveProperty(legacy);
  });

  it('still rejects an unknown financial model', async () => {
    const dto = plainToInstance(CreateContractServiceTypeDto, { ...base, financial_model: 'bogus' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('financial_model');
  });
});
