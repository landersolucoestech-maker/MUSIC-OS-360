import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateContractServiceTypeDto } from './create-contract-service-type.dto';
import { UpdateContractServiceTypeDto } from './update-contract-service-type.dto';
import {
  CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS,
  CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS,
  CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES,
  LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS,
  LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES,
  UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL,
} from '../contract-service-type.vocabulary';

/** Same options as the global pipe in create-app.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate<T>(metatype: new () => T, value: Record<string, unknown>): Promise<T> {
  return pipe.transform(value, { type: 'body', metatype }) as Promise<T>;
}

const base = { name: 'Distribuição', slug: 'distribuicao', client_types: ['artist'], financial_model: 'fixed_value' };

describe('contract service type vocabulary', () => {
  it('every legacy spelling maps to a canonical member and no legacy key is canonical', () => {
    for (const canonical of Object.values(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES)) {
      expect(CONTRACT_SERVICE_TYPE_CLIENT_TYPES).toContain(canonical);
    }
    for (const canonical of Object.values(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS)) {
      expect(CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS).toContain(canonical);
    }
    for (const canonical of Object.values(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES)) {
      expect(CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES).toContain(canonical);
    }
    for (const legacy of Object.keys(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES)) {
      expect(CONTRACT_SERVICE_TYPE_CLIENT_TYPES).not.toContain(legacy);
    }
  });

  it('keeps the external-rights value UNMAPPED: accepted as-is, never a canonical or a legacy-map key', () => {
    expect(CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS).toContain(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
    expect(CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS).not.toContain(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
    expect(Object.keys(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS)).not.toContain(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
    expect(Object.keys(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS)).not.toContain('royalties');
  });
});

describe('CreateContractServiceTypeDto legacy-input normalizer', () => {
  it.each(Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES))('maps client_types member %s -> %s', async (legacy, canonical) => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, client_types: [legacy] });
    expect(dto.client_types).toEqual([canonical]);
  });

  it.each(Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS))('maps financial_model %s -> %s', async (legacy, canonical) => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, financial_model: legacy });
    expect(dto.financial_model).toBe(canonical);
  });

  it.each(Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES))('maps financial_payment_frequency %s -> %s', async (legacy, canonical) => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, financial_payment_frequency: legacy });
    expect(dto.financial_payment_frequency).toBe(canonical);
  });

  it.each([...CONTRACT_SERVICE_TYPE_CLIENT_TYPES])('accepts canonical client type %s unchanged', async (member) => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, client_types: [member] });
    expect(dto.client_types).toEqual([member]);
  });

  it.each([...CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES])('accepts canonical frequency %s unchanged', async (value) => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, financial_payment_frequency: value });
    expect(dto.financial_payment_frequency).toBe(value);
  });

  it('the canonical member wins when both spellings are sent (collapsed, first position kept)', async () => {
    const dto = await validate(CreateContractServiceTypeDto, {
      ...base,
      client_types: ['artista', 'company', 'artist', 'pessoa_juridica'],
    });
    expect(dto.client_types).toEqual(['artist', 'company']);
  });

  it('passes the unmapped external-rights value through untouched (owner decision pending)', async () => {
    const dto = await validate(CreateContractServiceTypeDto, {
      ...base,
      financial_model: UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL,
    });
    expect(dto.financial_model).toBe(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
  });

  it.each([
    ['financial_model', 'royalties'],
    ['financial_model', 'external_rights'],
    ['financial_model', 'VALOR_FIXO'],
    ['client_types', ['artista', 'gravadora']],
    ['client_types', 'artist'],
  ])('rejects unknown %s = %j with 400 (nothing is guessed)', async (field, value) => {
    await expect(validate(CreateContractServiceTypeDto, { ...base, [field]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leaves an unknown frequency untouched (unconstrained column: no owner audit of stored values yet)', async () => {
    const dto = await validate(CreateContractServiceTypeDto, { ...base, financial_payment_frequency: 'semestral' });
    expect(dto.financial_payment_frequency).toBe('semestral');
  });
});

describe('UpdateContractServiceTypeDto legacy-input normalizer', () => {
  it('maps legacy values on PATCH', async () => {
    const dto = await validate(UpdateContractServiceTypeDto, {
      client_types: ['pessoa_fisica'],
      financial_model: 'misto',
      financial_payment_frequency: 'anual',
    });
    expect(dto).toMatchObject({ client_types: ['individual'], financial_model: 'mixed', financial_payment_frequency: 'yearly' });
  });

  it('a partial PATCH does not invent the normalized fields (absent stays absent)', async () => {
    const dto = await validate(UpdateContractServiceTypeDto, { name: 'Novo nome' });
    expect(Object.keys(dto).sort()).toEqual(['name']);
  });
});
