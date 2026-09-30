import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateMarketingTaskDto,
  QueryMarketingTaskDto,
  UpdateMarketingTaskDto,
} from './marketing-tasks.dto';
import {
  LEGACY_MARKETING_TASK_PRIORITIES,
  LEGACY_MARKETING_TASK_STATUSES,
  MARKETING_TASK_PRIORITIES,
  MARKETING_TASK_STATUSES,
} from '../marketing-vocabulary';

/**
 * Same options as the global pipe in create-app.ts. The web used to send its
 * UI vocabulary (a_fazer / concluida / media ...) straight to the API, which
 * accepted any string and let the database CHECK reject it with a 500.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate<T>(metatype: new () => T, value: Record<string, unknown>, type: 'body' | 'query' = 'body'): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

const PROJECT_ID = '3f1c3b1e-3d2a-4c55-9d0a-0d9f0d6a1b11';
const base = { marketingProjectId: PROJECT_ID, title: 'Tarefa' };

describe('CreateMarketingTaskDto status/priority (S7)', () => {
  it.each([...MARKETING_TASK_STATUSES])('accepts the canonical status %s unchanged', async (status) => {
    await expect(validate(CreateMarketingTaskDto, { ...base, status })).resolves.toMatchObject({ status });
  });

  it.each([...MARKETING_TASK_PRIORITIES])('accepts the canonical priority %s unchanged', async (priority) => {
    await expect(validate(CreateMarketingTaskDto, { ...base, priority })).resolves.toMatchObject({ priority });
  });

  it('accepts a body without status/priority (the service applies pending/normal)', async () => {
    await expect(validate(CreateMarketingTaskDto, base)).resolves.toMatchObject(base);
  });

  it.each(Object.entries(LEGACY_MARKETING_TASK_STATUSES))('maps the deprecated status %s to %s (create, update, query)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingTaskDto, { ...base, status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(UpdateMarketingTaskDto, { status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(QueryMarketingTaskDto, { status: legacy }, 'query')).resolves.toMatchObject({ status: canonical });
  });

  it.each(Object.entries(LEGACY_MARKETING_TASK_PRIORITIES))('maps the deprecated priority %s to %s (create, update)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingTaskDto, { ...base, priority: legacy })).resolves.toMatchObject({ priority: canonical });
    await expect(validate(UpdateMarketingTaskDto, { priority: legacy })).resolves.toMatchObject({ priority: canonical });
  });

  it('the legacy maps only produce values the database CHECK accepts', () => {
    for (const canonical of Object.values(LEGACY_MARKETING_TASK_STATUSES)) expect(MARKETING_TASK_STATUSES).toContain(canonical);
    for (const canonical of Object.values(LEGACY_MARKETING_TASK_PRIORITIES)) expect(MARKETING_TASK_PRIORITIES).toContain(canonical);
  });

  it.each(['completed', 'Done', 'DONE', 'todo', '', 'constructor', '__proto__', 'toString'])(
    'rejects the unknown status %j (the legacy map is not a bypass)',
    async (status) => {
      await expect(validate(CreateMarketingTaskDto, { ...base, status })).rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(UpdateMarketingTaskDto, { status })).rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(QueryMarketingTaskDto, { status }, 'query')).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['critical', 'medium', 'Alta', '', 'constructor'])('rejects the unknown priority %j', async (priority) => {
    await expect(validate(CreateMarketingTaskDto, { ...base, priority })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateMarketingTaskDto, { priority })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids unknown properties (whitelist + forbidNonWhitelisted)', async () => {
    await expect(validate(CreateMarketingTaskDto, { ...base, uiStatus: 'pending' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
