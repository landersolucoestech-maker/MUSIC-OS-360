import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { CreateMarketingTaskDto, UpdateMarketingTaskDto } from './dto/marketing-tasks.dto';
import { CreateMarketingContentDto, QueryMarketingContentDto } from './dto/marketing-contents.dto';
import {
  LEGACY_MARKETING_CONTENT_APPROVALS,
  LEGACY_MARKETING_CONTENT_STATUSES,
  LEGACY_MARKETING_CONTENT_TARGET_TYPES,
  LEGACY_MARKETING_CONTENT_TYPES,
  LEGACY_MARKETING_TASK_PRIORITIES,
  LEGACY_MARKETING_TASK_STATUSES,
  MARKETING_CONTENT_APPROVALS,
  MARKETING_CONTENT_STATUSES,
  MARKETING_CONTENT_TARGET_TYPES,
  MARKETING_CONTENT_TYPES,
  MARKETING_TASK_PRIORITIES,
  MARKETING_TASK_STATUSES,
} from './marketing-vocabulary';

/**
 * Compatibility contract of the deprecated Portuguese marketing input (a web
 * build released before the vocabulary was canonicalized): every legacy value
 * is accepted through the real DTO + global-pipe configuration and arrives
 * canonical; canonical values still validate; unknown values are rejected.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = <T>(metatype: new () => T, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype }) as Promise<T>;

const PROJECT_ID = '3f1c3b1e-3d2a-4c55-9d0a-0d9f0d6a1b11';
const TASK_BASE = { marketingProjectId: PROJECT_ID, title: 'T' };
const CONTENT_BASE = {
  title: 'C', targetType: 'artist', targetName: 'A', channel: 'instagram', type: 'post',
  publishDate: '2026-10-01', publishTime: '10:00', copy: 'x',
};

const TASK_STATUS: Array<[string, string]> = [
  ['a_fazer', 'pending'], ['em_andamento', 'in_progress'], ['revisao', 'review'], ['bloqueada', 'blocked'], ['concluida', 'done'],
];
const TASK_PRIORITY: Array<[string, string]> = [['baixa', 'low'], ['media', 'normal'], ['alta', 'high'], ['urgente', 'urgent']];
const CONTENT_STATUS: Array<[string, string]> = [
  ['rascunho', 'draft'], ['agendado', 'scheduled'], ['publicado', 'published'], ['cancelado', 'cancelled'], ['falhou', 'failed'],
];
const CONTENT_TARGET: Array<[string, string]> = [['projeto_musical', 'music_project'], ['artista', 'artist'], ['empresa', 'company']];
const CONTENT_TYPE: Array<[string, string]> = [
  ['carrossel', 'carousel'], ['anuncio', 'ad'], ['rede_social', 'social_media'], ['institucional', 'institutional'],
  ['comercial', 'commercial'], ['artista', 'artist'], ['bastidores', 'behind_the_scenes'], ['reuniao', 'meeting'],
  ['evento', 'event'], ['publicidade', 'advertising'],
];
const APPROVAL: Array<[string, string]> = [
  ['pendente', 'pending'], ['aprovado', 'approved'], ['reprovado', 'rejected'], ['ajustes_solicitados', 'revision_requested'],
];

describe('marketing legacy maps are pinned literally and target persisted canonical values', () => {
  it.each([
    ['task status', LEGACY_MARKETING_TASK_STATUSES, TASK_STATUS, MARKETING_TASK_STATUSES],
    ['task priority', LEGACY_MARKETING_TASK_PRIORITIES, TASK_PRIORITY, MARKETING_TASK_PRIORITIES],
    ['content status', LEGACY_MARKETING_CONTENT_STATUSES, CONTENT_STATUS, MARKETING_CONTENT_STATUSES],
    ['content target', LEGACY_MARKETING_CONTENT_TARGET_TYPES, CONTENT_TARGET, MARKETING_CONTENT_TARGET_TYPES],
    ['content type', LEGACY_MARKETING_CONTENT_TYPES, CONTENT_TYPE, MARKETING_CONTENT_TYPES],
    ['content approval', LEGACY_MARKETING_CONTENT_APPROVALS, APPROVAL, MARKETING_CONTENT_APPROVALS],
  ] as const)('%s', (_n, map, expected, canonical) => {
    expect(Object.entries(map).sort()).toEqual([...expected].sort());
    for (const value of Object.values(map)) expect((canonical as readonly string[]).includes(value)).toBe(true);
    for (const legacy of Object.keys(map)) expect((canonical as readonly string[]).includes(legacy)).toBe(false);
  });
});

describe('task DTO accepts legacy status/priority and delivers canonical values', () => {
  it.each(TASK_STATUS)('status %s -> %s (create and update)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingTaskDto, { ...TASK_BASE, status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(UpdateMarketingTaskDto, { status: legacy })).resolves.toMatchObject({ status: canonical });
  });

  it.each(TASK_PRIORITY)('priority %s -> %s (create and update)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingTaskDto, { ...TASK_BASE, priority: legacy })).resolves.toMatchObject({ priority: canonical });
    await expect(validate(UpdateMarketingTaskDto, { priority: legacy })).resolves.toMatchObject({ priority: canonical });
  });

  it('canonical values still validate; backlog is a distinct state, not an alias of pending', async () => {
    for (const status of MARKETING_TASK_STATUSES) {
      await expect(validate(CreateMarketingTaskDto, { ...TASK_BASE, status })).resolves.toMatchObject({ status });
    }
    expect((LEGACY_MARKETING_TASK_STATUSES as Record<string, string>).backlog).toBeUndefined();
  });

  it('negative: unknown Portuguese-looking values are rejected, not guessed', async () => {
    await expect(validate(CreateMarketingTaskDto, { ...TASK_BASE, status: 'quase_pronta' })).rejects.toBeDefined();
    await expect(validate(CreateMarketingTaskDto, { ...TASK_BASE, priority: 'altissima' })).rejects.toBeDefined();
  });
});

describe('content DTO accepts legacy status/target/type/approval and delivers canonical values', () => {
  it.each(CONTENT_STATUS)('status %s -> %s (create and list query)', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, status: legacy })).resolves.toMatchObject({ status: canonical });
    await expect(validate(QueryMarketingContentDto, { status: legacy })).resolves.toMatchObject({ status: canonical });
  });

  it.each(CONTENT_TARGET)('targetType %s -> %s', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, targetType: legacy })).resolves.toMatchObject({ targetType: canonical });
  });

  it.each(CONTENT_TYPE)('type %s -> %s', async (legacy, canonical) => {
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, type: legacy })).resolves.toMatchObject({ type: canonical });
  });

  it.each(APPROVAL)('metadata.approval %s -> %s', async (legacy, canonical) => {
    const dto = await validate(CreateMarketingContentDto, { ...CONTENT_BASE, metadata: { approval: legacy, keep: 'x' } });
    expect(dto.metadata).toEqual({ approval: canonical, keep: 'x' });
  });

  it('negative: unknown legacy-looking values are rejected', async () => {
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, status: 'rascunho2' })).rejects.toBeDefined();
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, targetType: 'gravadora' })).rejects.toBeDefined();
    await expect(validate(CreateMarketingContentDto, { ...CONTENT_BASE, type: 'podcast_x' })).rejects.toBeDefined();
  });
});
