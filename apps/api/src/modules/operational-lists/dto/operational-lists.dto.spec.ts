import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { CreateOperationalListItemDto, QueryOperationalListItemDto, UpdateOperationalListItemDto } from './operational-lists.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = <T>(type: new () => T, body: object) => pipe.transform(body, { type: 'body', metatype: type }) as Promise<T>;

describe('operational list DTO legacy kinds (AP3)', () => {
  it('maps a deprecated kind to the canonical one BEFORE validation (create, update, query)', async () => {
    await expect(run(CreateOperationalListItemDto, { kind: 'contact_pf_classification', name: 'X', slug: 'X' })).resolves.toMatchObject({ kind: 'contact_individual_classification' });
    await expect(run(UpdateOperationalListItemDto, { kind: 'contact_pj_classification' })).resolves.toMatchObject({ kind: 'contact_company_classification' });
    await expect(run(QueryOperationalListItemDto, { kind: 'contact_pf_classification' })).resolves.toMatchObject({ kind: 'contact_individual_classification' });
  });

  it('leaves canonical and tenant kinds untouched and still rejects non-strings', async () => {
    await expect(run(CreateOperationalListItemDto, { kind: 'lead_type', name: 'X', slug: 'x' })).resolves.toMatchObject({ kind: 'lead_type' });
    await expect(run(CreateOperationalListItemDto, { kind: 5, name: 'X', slug: 'x' })).rejects.toThrow();
  });
});
