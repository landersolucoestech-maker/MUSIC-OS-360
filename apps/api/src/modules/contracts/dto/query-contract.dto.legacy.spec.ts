import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryContractDto } from './query-contract.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(QueryContractDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};
const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('QueryContractDto deprecated query aliases tipo / artistId (legacy in)', () => {
  it.each([
    ['tipo', 'recording', 'isString', 42],
    ['artistId', UUID, 'isUuid', 'not-a-uuid'],
  ])('accepts %s, preserves it, and rejects a malformed value on that property', async (legacy, valid, constraint, bad) => {
    const ok = await run({ [legacy]: valid });
    expect(ok.errors).toEqual([]);
    expect((ok.instance as unknown as Record<string, unknown>)[legacy]).toBe(valid);

    const { errors } = await run({ [legacy]: bad });
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    expect(Object.keys(forLegacy[0].constraints ?? {})).toEqual([constraint]);
  });

  it.each(['tipo', 'artistId'])('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', QueryContractDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });

  it('the canonical type / artist_id are not deprecated and validate independently', async () => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', QueryContractDto.prototype, 'type').deprecated).toBeUndefined();
    const { errors } = await run({ artist_id: 'nope', artistId: UUID, tipo: 'recording' });
    expect(errors.map((e) => e.property)).toEqual(['artist_id']);
  });
});
