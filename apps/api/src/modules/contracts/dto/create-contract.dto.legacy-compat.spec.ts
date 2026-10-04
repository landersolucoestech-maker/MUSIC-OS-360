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

// Every other deprecated Portuguese property of the DTO: a pre-canonical web build still sends it, so it must be a declared,
// validated property (whitelist + forbidNonWhitelisted), and a wrong type must be rejected by ITS validator, not as "unknown".
describe('CreateContractDto deprecated properties are declared and validated (titulo, tipo, valor, exclusivo, arquivo_url, versoes)', () => {
  const strict = { whitelist: true, forbidNonWhitelisted: true } as const;
  const errorsOf = (payload: Record<string, unknown>) => validate(plainToInstance(CreateContractDto, payload), strict);

  it.each([
    ['titulo', 'title', 'Contrato legado', 5, 'isString'],
    ['tipo', 'type', 'gravacao', 5, 'isString'],
    ['valor', 'fixed_value', 15000, 'muito', 'isNumber'],
    ['exclusivo', 'exclusive', true, 'sim', 'isBoolean'],
    ['arquivo_url', 'file_url', 'https://a.example/c.pdf', 5, 'isString'],
    ['versoes', 'versions', [{ versao: 1 }], 'v1', 'isArray'],
  ])('%s: accepted as a declared property, wrong type rejected by its own validator, resolved to %s', async (legacy, _canonical, goodValue, badValue, constraint) => {
    const good = await errorsOf({ title: 'Contrato', [legacy]: goodValue });
    expect(good.filter((e) => e.property === legacy)).toEqual([]);
    expect(good).toEqual([]);

    const bad = (await errorsOf({ title: 'Contrato', [legacy]: badValue })).filter((e) => e.property === legacy);
    expect(bad).toHaveLength(1);
    expect(Object.keys(bad[0].constraints ?? {})).toContain(constraint);
    expect(Object.keys(bad[0].constraints ?? {})).not.toContain('whitelistValidation');
  });

  it.each([
    ['titulo', 'title', 'Contrato legado'],
    ['tipo', 'type', 'service'],
    ['valor', 'fixed_value', 10],
    ['arquivo_url', 'file_url', 'https://a.example/c.pdf'],
  ])('%s resolves to %s through the real resolver', (legacy, canonical, value) => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ [legacy]: value });
    expect((normalized as Record<string, unknown>)[canonical]).toEqual(canonical === 'fixed_value' ? '10' : value);
    expect(legacyAliasesUsed).toContain(legacy);
  });

  it('titulo longer than 500 and tipo longer than 100 characters are rejected by their length validators', async () => {
    const t = (await errorsOf({ titulo: 'x'.repeat(501) })).filter((e) => e.property === 'titulo');
    expect(Object.keys(t[0].constraints ?? {})).toEqual(['maxLength']);
    const k = (await errorsOf({ title: 'T', tipo: 'x'.repeat(101) })).filter((e) => e.property === 'tipo');
    expect(Object.keys(k[0].constraints ?? {})).toEqual(['maxLength']);
  });
});

