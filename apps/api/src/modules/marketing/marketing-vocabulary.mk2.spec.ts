import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { CreateMarketingTaskDto, UpdateMarketingTaskDto } from './dto/marketing-tasks.dto';
import { CreateMarketingProjectDto, UpdateMarketingProjectDto } from './dto/marketing-projects.dto';
import { CreateMarketingContentDto } from './dto/marketing-contents.dto';
import { CreateBriefingDto } from '../briefings/dto/briefings.dto';
import { GenerateMarketingSuggestionDto } from '../ai/dto/ai.dto';
import { MarketingCampaignBuilderService } from './marketing-campaign-builder.service';
import { MarketingAiSuggestionsService } from './marketing-ai-suggestions.service';
import {
  LEGACY_MARKETING_AI_KINDS,
  LEGACY_MARKETING_BRIEFING_TYPES,
  LEGACY_MARKETING_CAMPAIGN_TYPES,
  LEGACY_MARKETING_CHANNELS,
  LEGACY_MARKETING_PROJECT_UI_STATUSES,
  LEGACY_MARKETING_PROJECT_UI_TYPES,
  LEGACY_MARKETING_TARGETS,
  LEGACY_MARKETING_TASK_KINDS,
  MARKETING_TARGETS,
  canonicalMarketingAiSuggestion,
  canonicalMarketingCampaignPayload,
} from './marketing-vocabulary';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = <T>(metatype: new () => T, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype }) as Promise<T>;

const PORTUGUESE = /[ãõçáéíóúâêô]|(?:^|_)(?:projeto|musical|artista|empresa|lancamento|campanha|conteudo|bastidor|portal_noticias|reuniao|evento|planejamento|andamento|pausad|concluid|cancelad)/;
const MAPS = {
  targets: LEGACY_MARKETING_TARGETS,
  projectTypes: LEGACY_MARKETING_PROJECT_UI_TYPES,
  projectStatuses: LEGACY_MARKETING_PROJECT_UI_STATUSES,
  campaignTypes: LEGACY_MARKETING_CAMPAIGN_TYPES,
  briefingTypes: LEGACY_MARKETING_BRIEFING_TYPES,
  channels: LEGACY_MARKETING_CHANNELS,
  taskKinds: LEGACY_MARKETING_TASK_KINDS,
  aiKinds: LEGACY_MARKETING_AI_KINDS,
};

const PROJECT_ID = '3f1c3b1e-3d2a-4c55-9d0a-0d9f0d6a1b11';

describe('MK2 marketing vocabulary maps', () => {
  it.each(Object.entries(MAPS))('%s: injective, canonical values are English machine ids, no legacy value is also a canonical value of another key', (_name, map) => {
    const canonical = Object.values(map);
    expect(new Set(canonical).size).toBe(canonical.length);
    for (const value of canonical) expect(value).not.toMatch(PORTUGUESE);
    for (const [legacy, value] of Object.entries(map)) {
      expect(legacy).not.toBe(value);
      expect(canonical).not.toContain(legacy);
    }
  });

  it('targets are the three canonical content targets', () => {
    expect(Object.values(LEGACY_MARKETING_TARGETS).sort()).toEqual([...MARKETING_TARGETS].sort());
  });
});

describe('MK2 DTO input is canonicalized BEFORE validation (global pipe: whitelist + forbidNonWhitelisted + transform)', () => {
  it('task kind + metadata.targetType/uiType', async () => {
    const dto = await validate(CreateMarketingTaskDto, {
      marketingProjectId: PROJECT_ID, title: 'T', kind: 'capa',
      metadata: { targetType: 'projeto_musical', uiType: 'arte_divulgacao', sector: 'Design', other: 1 },
    });
    expect(dto.kind).toBe('cover');
    expect(dto.metadata).toEqual({ targetType: 'music_project', uiType: 'promotional_art', sector: 'Design', other: 1 });
    await expect(validate(UpdateMarketingTaskDto, { kind: 'bastidor' })).resolves.toMatchObject({ kind: 'behind_the_scenes_shot' });
  });

  it('task kind stays free-form: API-written and tenant kinds pass unchanged', async () => {
    await expect(validate(CreateMarketingTaskDto, { marketingProjectId: PROJECT_ID, title: 'T', kind: 'cover_art' })).resolves.toMatchObject({ kind: 'cover_art' });
    await expect(validate(CreateMarketingTaskDto, { marketingProjectId: PROJECT_ID, title: 'T', kind: 'Meu tipo' })).resolves.toMatchObject({ kind: 'Meu tipo' });
  });

  it('project metadata.uiType/uiStatus/channels (user-authored keys untouched)', async () => {
    const body = { type: 'MUSIC_PROJECT', title: 'Lançamento do álbum', metadata: { uiType: 'lancamento_musical', uiStatus: 'em_andamento', channels: ['instagram', 'portal_noticias'], objective: 'portal_noticias' } };
    const dto = await validate(CreateMarketingProjectDto, body);
    expect(dto.title).toBe('Lançamento do álbum');
    expect(dto.metadata).toEqual({ uiType: 'music_release', uiStatus: 'active', channels: ['instagram', 'news_portal'], objective: 'portal_noticias' });
    await expect(validate(UpdateMarketingProjectDto, { metadata: { uiStatus: 'cancelado' } })).resolves.toMatchObject({ metadata: { uiStatus: 'cancelled' } });
  });

  it('content metadata.channels (and approval) in the same transform', async () => {
    const dto = await validate(CreateMarketingContentDto, {
      title: 'C', targetType: 'empresa', targetName: 'E', channel: 'instagram', type: 'post', publishDate: '2026-07-01', publishTime: '10:00', copy: 'x',
      metadata: { channels: ['instagram', 'campanha'], approval: 'aprovado' },
    });
    expect(dto.metadata).toEqual({ channels: ['instagram', 'campaign'], approval: 'approved' });
  });

  it('briefing metadata.type/channels', async () => {
    const dto = await validate(CreateBriefingDto, { title: 'B', metadata: { type: 'portal_noticias', channels: ['reuniao'], objective: 'x' } });
    expect(dto.metadata).toEqual({ type: 'news_portal', channels: ['meeting'], objective: 'x' });
  });

  it('AI suggestion kind/targetType', async () => {
    const dto = await validate(GenerateMarketingSuggestionDto, { kind: 'sugestao_conteudo', targetType: 'artista', targetName: 'A', prompt: 'p' });
    expect(dto).toMatchObject({ kind: 'content_suggestion', targetType: 'artist' });
    await expect(validate(GenerateMarketingSuggestionDto, { kind: 'content_suggestion', targetType: 'company', targetName: 'A', prompt: 'p' })).resolves.toMatchObject({ kind: 'content_suggestion', targetType: 'company' });
  });
});

describe('MK2 campaign builder payload', () => {
  it('canonicalMarketingCampaignPayload maps promotedEntityType (upper-case wire), type and platforms; other values untouched', () => {
    const payload = { name: 'Campanha', promotedEntityType: 'PROJETO_MUSICAL', type: 'trafego_pago', platforms: ['instagram', 'campanha'], objective: 'TRAFFIC' };
    expect(canonicalMarketingCampaignPayload(payload)).toEqual({ name: 'Campanha', promotedEntityType: 'MUSIC_PROJECT', type: 'paid_traffic', platforms: ['instagram', 'campaign'], objective: 'TRAFFIC' });
    expect(canonicalMarketingCampaignPayload({ promotedEntityType: 'RELEASE' })).toEqual({ promotedEntityType: 'RELEASE' });
    expect(canonicalMarketingCampaignPayload({ promotedEntityType: 'EMPRESA' })).toEqual({ promotedEntityType: 'COMPANY' });
    const canonical = { promotedEntityType: 'ARTIST', type: 'music_release', platforms: ['META_ADS'] };
    expect(canonicalMarketingCampaignPayload(canonical)).toBe(canonical);
  });

  it('service: create persists canonical, read maps legacy rows to canonical', async () => {
    const saved: Array<Record<string, any>> = [];
    const repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => { saved.push(v); return { ...v, id: 'c1', created_at: new Date('2026-06-01'), updated_at: new Date('2026-06-01') }; }),
    };
    const service = new MarketingCampaignBuilderService({ getRepository: () => repo } as never);
    const out = await service.create('t', 'u', { name: 'C', promotedEntityType: 'EMPRESA', type: 'trafego_pago', platforms: ['campanha'] } as never, { valid: true, errors: [], warnings: [] });
    expect(saved[0].metadata.marketingBuilder.payload).toMatchObject({ promotedEntityType: 'COMPANY', type: 'paid_traffic', platforms: ['campaign'] });
    expect(out).toMatchObject({ promotedEntityType: 'COMPANY' });

    const legacyRow = { id: 'c2', tenant_id: 't', name: 'L', status: 'DRAFT', created_at: new Date(), updated_at: new Date(), metadata: { marketingBuilder: { payload: { promotedEntityType: 'ARTISTA', type: 'lancamento_musical' } } } };
    const readRepo = { findOne: jest.fn(async () => legacyRow) };
    const reader = new MarketingCampaignBuilderService({ getRepository: () => readRepo } as never);
    await expect(reader.find('t', 'c2')).resolves.toMatchObject({ promotedEntityType: 'ARTIST', type: 'music_release' });
  });
});

describe('MK2 AI suggestions (free-form blob)', () => {
  it('canonicalMarketingAiSuggestion maps kind/targetType/channels only', () => {
    expect(canonicalMarketingAiSuggestion({ kind: 'analise_marca', targetType: 'empresa', channels: ['portal_noticias'], prompt: 'portal_noticias fica' }))
      .toEqual({ kind: 'brand_analysis', targetType: 'company', channels: ['news_portal'], prompt: 'portal_noticias fica' });
  });

  it('service: stores canonical, lists legacy rows canonical', async () => {
    const stored: Array<Record<string, any>> = [];
    const repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => { stored.push(v); return { ...v, created_at: new Date('2026-06-01') }; }),
      find: jest.fn(async () => [{ entity_id: 'a1', created_at: new Date('2026-06-01'), metadata: { kind: 'roteiro', targetType: 'projeto_musical' } }]),
    };
    const service = new MarketingAiSuggestionsService({ getRepository: () => repo } as never);
    await service.create('t', 'u', { kind: 'legenda', targetType: 'artista', targetName: 'X' });
    expect(stored[0].metadata).toMatchObject({ kind: 'caption', targetType: 'artist' });
    await expect(service.list('t')).resolves.toEqual([expect.objectContaining({ id: 'a1', kind: 'script', targetType: 'music_project' })]);
  });
});
