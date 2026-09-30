import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateMarketingContentDto,
  QueryMarketingContentDto,
  UpdateMarketingContentDto,
} from './marketing-contents.dto';
import {
  LEGACY_MARKETING_CONTENT_STATUSES,
  LEGACY_MARKETING_CONTENT_TARGET_TYPES,
  LEGACY_MARKETING_CONTENT_TYPES,
  MARKETING_CONTENT_STATUSES,
  MARKETING_CONTENT_TARGET_TYPES,
  MARKETING_CONTENT_TYPES,
} from '../marketing-vocabulary';

/** Same options as the global pipe in create-app.ts. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate<T>(metatype: new () => T, value: Record<string, unknown>, type: 'body' | 'query' = 'body'): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

const base = {
  title: 'Post',
  targetType: 'company',
  targetName: 'Empresa',
  channel: 'instagram',
  type: 'feed',
  publishDate: '2026-07-01',
  publishTime: '10:00',
  copy: 'copy',
};

describe('CreateMarketingContentDto vocabulary (S8)', () => {
  it.each([...MARKETING_CONTENT_STATUSES])('accepts the canonical status %s unchanged', async (status) => {
    await expect(validate(CreateMarketingContentDto, { ...base, status })).resolves.toMatchObject({ status });
  });

  it.each([...MARKETING_CONTENT_TARGET_TYPES])('accepts the canonical targetType %s unchanged', async (targetType) => {
    await expect(validate(CreateMarketingContentDto, { ...base, targetType })).resolves.toMatchObject({ targetType });
  });

  it.each([...MARKETING_CONTENT_TYPES])('accepts the canonical content type %s unchanged', async (type) => {
    await expect(validate(CreateMarketingContentDto, { ...base, type })).resolves.toMatchObject({ type });
  });

  it.each(Object.entries(LEGACY_MARKETING_CONTENT_STATUSES))('maps the deprecated status %s to %s (create, update, query)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...base, status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(UpdateMarketingContentDto, { status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(QueryMarketingContentDto, { status: legacy }, 'query')).resolves.toMatchObject({ status: canonical });
  });

  it.each(Object.entries(LEGACY_MARKETING_CONTENT_TARGET_TYPES))('maps the deprecated targetType %s to %s (create, update)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...base, targetType: legacy })).resolves.toMatchObject({ targetType: canonical });
    await expect(validate(UpdateMarketingContentDto, { targetType: legacy })).resolves.toMatchObject({ targetType: canonical });
  });

  it.each(Object.entries(LEGACY_MARKETING_CONTENT_TYPES))('maps the deprecated content type %s to %s (create, update)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...base, type: legacy })).resolves.toMatchObject({ type: canonical });
    await expect(validate(UpdateMarketingContentDto, { type: legacy })).resolves.toMatchObject({ type: canonical });
  });

  it('the legacy maps only produce values the database CHECKs accept', () => {
    for (const v of Object.values(LEGACY_MARKETING_CONTENT_STATUSES)) expect(MARKETING_CONTENT_STATUSES).toContain(v);
    for (const v of Object.values(LEGACY_MARKETING_CONTENT_TARGET_TYPES)) expect(MARKETING_CONTENT_TARGET_TYPES).toContain(v);
    for (const v of Object.values(LEGACY_MARKETING_CONTENT_TYPES)) expect(MARKETING_CONTENT_TYPES).toContain(v);
  });

  it.each(['ideia', 'producao', 'revisao', 'atrasado', 'overdue', 'DRAFT', '', 'constructor', '__proto__'])(
    'rejects the non-persisted or unknown status %j (web-only stages are not accepted, the legacy map is not a bypass)',
    async (status) => {
      await expect(validate(CreateMarketingContentDto, { ...base, status })).rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(UpdateMarketingContentDto, { status })).rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(QueryMarketingContentDto, { status }, 'query')).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['geral', 'Company', '', 'constructor'])('rejects the unknown targetType %j (free strings are gone)', async (targetType) => {
    await expect(validate(CreateMarketingContentDto, { ...base, targetType })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateMarketingContentDto, { targetType })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['gif', 'Feed', '', 'toString'])('rejects the unknown content type %j (free strings are gone)', async (type) => {
    await expect(validate(CreateMarketingContentDto, { ...base, type })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateMarketingContentDto, { type })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids unknown properties (the web must not send approval/channels at the top level)', async () => {
    await expect(validate(CreateMarketingContentDto, { ...base, approval: 'pendente' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(CreateMarketingContentDto, { ...base, channels: ['instagram'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the body the web mapper produces (approval and channels inside metadata)', async () => {
    await expect(validate(CreateMarketingContentDto, {
      ...base,
      status: 'scheduled',
      notes: '',
      owner: 'Marketing',
      format: 'Feed',
      files: [{ id: 'f1', name: 'a.png', url: 'https://cdn.example/a.png', kind: 'image/png' }],
      metadata: { creative: { version: 1 }, approval: 'pendente', channels: ['instagram', 'facebook'] },
    })).resolves.toMatchObject({ status: 'scheduled', targetType: 'company' });
  });
});
