/**
 * find-8229f49e: QueryContractTemplateDto declared `status`, which
 * ContractTemplatesService.list() never read (silently-ignored-filter),
 * and had no field for `ativo`, which the service already implements --
 * unreachable under the real global ValidationPipe (whitelist +
 * forbidNonWhitelisted). Reproduces that pipe exactly, without booting the
 * app, to prove the DTO's actual accepted-field contract.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, getMetadataStorage } from 'class-validator';
import { QueryContractTemplateDto } from './query-contract-template.dto';

function decoratedPropertyNames(dto: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(metas.map((m) => m.propertyName)));
}

async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(QueryContractTemplateDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('QueryContractTemplateDto — matches ContractTemplatesService.list()\'s real filters', () => {
  it('accepts ativo (a real service filter previously unreachable)', async () => {
    const errors = await validatePayload({ ativo: 'true' });
    expect(errors).toHaveLength(0);
  });

  it('no longer declares status (the service never read it -- dead filter, removed)', () => {
    expect(decoratedPropertyNames(QueryContractTemplateDto)).not.toContain('status');
  });

  it('rejects an unknown field (global ValidationPipe still enforces whitelist)', async () => {
    const errors = await validatePayload({ notARealFilter: 'x' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
