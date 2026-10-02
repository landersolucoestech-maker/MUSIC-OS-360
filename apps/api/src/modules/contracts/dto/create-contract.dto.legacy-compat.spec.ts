import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { resolveContractAliases } from '../contract-legacy-alias.util';
import { CreateContractDto } from './create-contract.dto';

// Deprecated Portuguese date fields are accepted by the DTO and resolved to the canonical start_date/end_date.
describe('CreateContractDto legacy date fields (legacy in, canonical out)', () => {
  it.each([
    ['data_inicio', 'start_date', '2024-01-01'],
    ['data_fim', 'end_date', '2025-12-31'],
  ])('accepts %s and resolves it to %s', async (legacy, canonical, value) => {
    const payload = { title: 'Contrato', [legacy]: value };
    const errors = await validate(plainToInstance(CreateContractDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const { normalized, legacyAliasesUsed } = resolveContractAliases(payload);
    expect((normalized as Record<string, unknown>)[canonical]).toBe(value);
    expect(legacyAliasesUsed).toContain(legacy);
  });

  it('rejects a malformed legacy date and a conflicting canonical value', async () => {
    const errors = await validate(plainToInstance(CreateContractDto, { title: 'C', data_inicio: 'not-a-date' }));
    expect(errors.map((e) => e.property)).toContain('data_inicio');
    expect(() => resolveContractAliases({ data_inicio: '2024-01-01', start_date: '2030-05-05' })).toThrow();
  });
});
