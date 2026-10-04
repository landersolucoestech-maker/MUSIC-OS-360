import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ArtistRelationshipType } from '@music-os-360/types';
import { QueryArtistDto } from './query-artist.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(QueryArtistDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

describe('QueryArtistDto deprecated query alias vinculo (legacy in)', () => {
  it.each(Object.values(ArtistRelationshipType))('accepts vinculo=%s and preserves the value', async (value) => {
    const { instance, errors } = await run({ vinculo: value });
    expect(errors).toEqual([]);
    expect(instance.vinculo).toBe(value);
  });

  it('rejects a malformed vinculo with an isEnum constraint on vinculo itself (not a whitelist error)', async () => {
    const { errors } = await run({ vinculo: 'bogus' });
    const forVinculo = errors.filter((e) => e.property === 'vinculo');
    expect(forVinculo).toHaveLength(1);
    expect(Object.keys(forVinculo[0].constraints ?? {})).toEqual(['isEnum']);
  });

  it('keeps validating the canonical relationship next to the alias', async () => {
    const { errors } = await run({ relationship: 'bogus', vinculo: ArtistRelationshipType.PARTNER });
    expect(errors.map((e) => e.property)).toEqual(['relationship']);
  });

  it('is declared deprecated in the Swagger metadata', () => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', QueryArtistDto.prototype, 'vinculo')).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
