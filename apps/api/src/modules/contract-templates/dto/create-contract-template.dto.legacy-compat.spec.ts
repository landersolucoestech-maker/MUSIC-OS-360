import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { CONTRACT_TEMPLATE_DEPRECATED_FIELDS, CreateContractTemplateDto } from './create-contract-template.dto';

// Deprecated field names a pre-canonical build still sends are accepted and moved to the canonical names.
describe('CreateContractTemplateDto legacy fields (legacy in, canonical out)', () => {
  it.each([
    ['conteudo', 'content'],
    ['tipo_servico', 'service_type'],
  ])('accepts deprecated %s and maps it to %s', async (legacy, canonical) => {
    const payload: Record<string, unknown> = { name: 'Modelo', [legacy]: 'valor' };
    if (legacy !== 'conteudo') payload.content = 'corpo';
    const errors = await validate(plainToInstance(CreateContractTemplateDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, CONTRACT_TEMPLATE_DEPRECATED_FIELDS);
    expect(moved[canonical]).toBe('valor');
    expect(moved).not.toHaveProperty(legacy);
  });

  it('the legacy content alone satisfies the required content (conteudo replaces content)', async () => {
    const errors = await validate(plainToInstance(CreateContractTemplateDto, { name: 'M', conteudo: 'x' }));
    expect(errors.map((e) => e.property)).not.toContain('content');
    const missing = await validate(plainToInstance(CreateContractTemplateDto, { name: 'M' }));
    expect(missing.map((e) => e.property)).toContain('content');
  });
});
