/**
 * find-2f63ad75: QueryBriefingDto declared `campaignId`, which
 * BriefingsService.list() never read (silently-ignored-filter), and had
 * no field for `artist_id`, which the service already implements --
 * unreachable under the real global ValidationPipe (whitelist +
 * forbidNonWhitelisted). Reproduces that pipe exactly, without booting the
 * app, to prove the DTO's actual accepted-field contract.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, getMetadataStorage } from 'class-validator';
import { QueryBriefingDto } from './briefings.dto';

function decoratedPropertyNames(dto: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(metas.map((m) => m.propertyName)));
}

async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(QueryBriefingDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('QueryBriefingDto — matches BriefingsService.list()\'s real filters', () => {
  it('accepts artist_id (a real service filter previously unreachable)', async () => {
    const errors = await validatePayload({ artist_id: 'artist-1' });
    expect(errors).toHaveLength(0);
  });

  it('no longer declares campaignId (the service never read it -- dead filter, removed)', () => {
    expect(decoratedPropertyNames(QueryBriefingDto)).not.toContain('campaignId');
  });

  it('rejects an unknown field (global ValidationPipe still enforces whitelist)', async () => {
    const errors = await validatePayload({ notARealFilter: 'x' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
