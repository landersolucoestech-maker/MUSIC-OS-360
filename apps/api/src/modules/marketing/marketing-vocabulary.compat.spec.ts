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
  canonicalCampaignBuilderNotes,
  canonicalMarketingAiKind,
  canonicalMarketingAiSuggestion,
  canonicalMarketingBriefingMetadata,
  canonicalMarketingCampaignPayload,
  canonicalMarketingContentMetadata,
  canonicalMarketingContentStatus,
  canonicalMarketingContentTargetType,
  canonicalMarketingContentType,
  canonicalMarketingProjectMetadata,
  canonicalMarketingTarget,
  canonicalMarketingTaskKind,
  canonicalMarketingTaskMetadata,
  canonicalMarketingTaskPriority,
  canonicalMarketingTaskStatus,
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

// ─── Exhaustive pins of every legacy table of marketing-vocabulary.ts, one case per legacy name ───────────────────────────
// Explicit static copies (not derived from the module under test), each exercised through the public canonicalizer that
// consumes it: a renamed/dropped legacy entry, a wrong canonical target, or a mapping applied to the wrong field fails here.
type Row2 = ReadonlyArray<readonly [string, string]>;
const X_TASK_STATUS: Row2 = [['a_fazer', 'pending'], ['em_andamento', 'in_progress'], ['revisao', 'review'], ['bloqueada', 'blocked'], ['concluida', 'done']];
const X_TASK_PRIORITY: Row2 = [['baixa', 'low'], ['media', 'normal'], ['alta', 'high'], ['urgente', 'urgent']];
const X_CONTENT_STATUS: Row2 = [['rascunho', 'draft'], ['agendado', 'scheduled'], ['publicado', 'published'], ['cancelado', 'cancelled'], ['falhou', 'failed']];
const X_CONTENT_TARGET: Row2 = [['projeto_musical', 'music_project'], ['artista', 'artist'], ['empresa', 'company']];
const X_CONTENT_TYPE: Row2 = [['carrossel', 'carousel'], ['anuncio', 'ad'], ['rede_social', 'social_media'], ['institucional', 'institutional'], ['comercial', 'commercial'], ['artista', 'artist'], ['bastidores', 'behind_the_scenes'], ['reuniao', 'meeting'], ['evento', 'event'], ['publicidade', 'advertising']];
const X_APPROVAL: Row2 = [['pendente', 'pending'], ['aprovado', 'approved'], ['reprovado', 'rejected'], ['ajustes_solicitados', 'revision_requested']];
const X_TARGETS: Row2 = [
  ['projeto_musical', 'music_project'],
  ['artista', 'artist'],
  ['empresa', 'company'],
];

const X_PROJECT_UI_TYPES: Row2 = [
  ['lancamento_musical', 'music_release'],
  ['videoclipe', 'music_video'],
  ['campanha_institucional', 'institutional_campaign'],
  ['campanha_promocional', 'promotional_campaign'],
  ['evento', 'event'],
  ['conteudo_corporativo', 'corporate_content'],
  ['bastidores', 'behind_the_scenes'],
  ['reuniao', 'meeting'],
  ['divulgacao_produto', 'product_promotion'],
  ['divulgacao_servico', 'service_promotion'],
  ['divulgacao_saas', 'saas_promotion'],
  ['comunicacao_interna', 'internal_communication'],
  ['comunicacao_externa', 'external_communication'],
  ['portal_noticias', 'news_portal'],
  ['projeto_especial', 'special_project'],
];

const X_PROJECT_UI_STATUSES: Row2 = [
  ['planejamento', 'planning'],
  ['em_andamento', 'active'],
  ['pausado', 'paused'],
  ['concluido', 'completed'],
  ['cancelado', 'cancelled'],
];

const X_CAMPAIGN_TYPES: Row2 = [
  ['institucional', 'institutional'],
  ['comercial', 'commercial'],
  ['artistica', 'artistic'],
  ['promocional', 'promotional'],
  ['lancamento_musical', 'music_release'],
  ['produto', 'product'],
  ['servico', 'service'],
  ['evento', 'event'],
  ['conteudo', 'content'],
  ['trafego_pago', 'paid_traffic'],
  ['organica', 'organic'],
];

const X_BRIEFING_TYPES: Row2 = [
  ['campanha', 'campaign'],
  ['conteudo', 'content'],
  ['institucional', 'institutional'],
  ['comercial', 'commercial'],
  ['artistico', 'artistic'],
  ['evento', 'event'],
  ['produto', 'product'],
  ['servico', 'service'],
  ['portal_noticias', 'news_portal'],
  ['bastidores', 'behind_the_scenes'],
];

const X_CHANNELS: Row2 = [
  ['portal_noticias', 'news_portal'],
  ['campanha', 'campaign'],
  ['material_publicitario', 'advertising_material'],
  ['evento_interno', 'internal_event'],
  ['evento_externo', 'external_event'],
  ['reuniao', 'meeting'],
  ['bastidores', 'behind_the_scenes'],
];

const X_TASK_KINDS: Row2 = [
  ['publicacao', 'publishing'],
  ['campanha', 'campaign'],
  ['planejamento', 'planning'],
  ['aprovacao', 'approval'],
  ['revisao', 'review'],
  ['analise', 'analysis'],
  ['reuniao', 'meeting'],
  ['bastidor', 'behind_the_scenes_shot'],
  ['conteudo_institucional', 'institutional_content'],
  ['conteudo_comercial', 'commercial_content'],
  ['conteudo_artistico', 'artistic_content'],
  ['trafego_pago', 'paid_traffic'],
  ['capa', 'cover'],
  ['arte_redes_sociais', 'social_media_art'],
  ['identidade_visual', 'visual_identity'],
  ['material_promocional', 'promotional_material'],
  ['videoclipe', 'music_video'],
  ['video_redes_sociais', 'social_media_video'],
  ['bastidores', 'behind_the_scenes'],
  ['entrevista', 'interview'],
  ['captacao_evento', 'event_coverage'],
  ['prospeccao', 'prospecting'],
  ['negociacao', 'negotiation'],
  ['relacionamento', 'relationship'],
  ['planejamento_lancamento', 'release_planning'],
  ['material_institucional', 'institutional_material'],
  ['apresentacao_comercial', 'commercial_presentation'],
  ['video_institucional', 'institutional_video'],
  ['bastidores_empresa', 'company_behind_the_scenes'],
  ['cobertura_evento_corporativo', 'corporate_event_coverage'],
  ['entrevista_corporativa', 'corporate_interview'],
  ['campanha_institucional', 'institutional_campaign'],
  ['posicionamento_marca', 'brand_positioning'],
  ['comunicados', 'announcements'],
  ['relacionamento_parceiros', 'partner_relationship'],
  ['parcerias', 'partnerships'],
  ['planejamento_carreira', 'career_planning'],
  ['gestao_agenda', 'schedule_management'],
  ['planejamento_estrategico', 'strategic_planning'],
  ['assessoria_imprensa', 'press_relations'],
  ['branding_pessoal', 'personal_branding'],
  ['posicionamento', 'positioning'],
  ['estrategias_crescimento', 'growth_strategies'],
  ['sessao_fotos', 'photo_session'],
  ['conteudo_redes_sociais', 'social_media_content'],
  ['contratacoes', 'contracting'],
  ['arte_divulgacao', 'promotional_art'],
  ['conteudo_lancamento', 'release_content'],
  ['distribuicao', 'distribution'],
  ['campanha_lancamento', 'release_campaign'],
  ['divulgacao', 'promotion'],
  ['influenciadores', 'influencers'],
  ['aprovacao_conteudo', 'content_approval'],
];

const X_AI_KINDS: Row2 = [
  ['analise_fonograma', 'phonogram_analysis'],
  ['analise_letra', 'lyrics_analysis'],
  ['planejamento_campanha', 'campaign_planning'],
  ['sugestao_conteudo', 'content_suggestion'],
  ['legenda', 'caption'],
  ['roteiro', 'script'],
  ['analise_artista', 'artist_analysis'],
  ['analise_marca', 'brand_analysis'],
  ['analise_empresa', 'company_analysis'],
  ['pitch_playlist', 'playlist_pitch'],
  ['pitch_imprensa', 'press_pitch'],
  ['posicionamento', 'positioning'],
  ['calendario_editorial', 'editorial_calendar'],
  ['conteudo_bastidores', 'behind_the_scenes_content'],
  ['conteudo_corporativo', 'corporate_content'],
];

const X_SECTORS: Row2 = [
  ['Design', 'design'],
  ['Audiovisual', 'audiovisual'],
  ['Marketing', 'marketing'],
  ['Comunicação', 'communication'],
  ['Comercial', 'commercial'],
  ['Administração Musical', 'music_administration'],
  ['Distribuição Digital', 'digital_distribution'],
  ['CRM', 'crm'],
];

const X_FLOW_IDS: Row2 = [
  ['flow-lancamento', 'flow-music-release'],
  ['flow-conteudo-corporativo', 'flow-corporate-content'],
  ['flow-bastidores', 'flow-behind-the-scenes'],
  ['flow-evento', 'flow-event'],
  ['flow-produto-saas', 'flow-product-saas'],
];

const X_PHASES: Row2 = [
  ['pre_lancamento', 'pre_launch'],
  ['lancamento', 'launch'],
  ['sustentacao', 'sustain'],
  ['catalogo', 'catalog'],
];

const X_CREATIVE_TYPES: Row2 = [
  ['imagem', 'image'],
  ['carrossel', 'carousel'],
  ['texto', 'text'],
];

const X_BUDGET_STRATEGIES: Row2 = [
  ['menor_custo', 'lowest_cost'],
  ['limite_custo', 'cost_cap'],
  ['custo_alvo', 'target_cost'],
];

const X_AUDIENCE_GENDERS: Row2 = [
  ['todos', 'all'],
  ['feminino', 'female'],
  ['masculino', 'male'],
  ['nao_binario', 'non_binary'],
  ['nao_informado', 'not_informed'],
];

const at = (value: unknown) => ({ value });

describe('marketing legacy tables: every legacy name reaches its canonical value through the real canonicalizers', () => {
  describe.each([
    ['task status', X_TASK_STATUS, canonicalMarketingTaskStatus],
    ['task priority', X_TASK_PRIORITY, canonicalMarketingTaskPriority],
    ['content status', X_CONTENT_STATUS, canonicalMarketingContentStatus],
    ['content target type', X_CONTENT_TARGET, canonicalMarketingContentTargetType],
    ['content type', X_CONTENT_TYPE, canonicalMarketingContentType],
    ['task kind', X_TASK_KINDS, canonicalMarketingTaskKind],
    ['AI kind', X_AI_KINDS, canonicalMarketingAiKind],
    ['AI/target', X_TARGETS, canonicalMarketingTarget],
  ] as const)('%s', (_n, table, fn) => {
    it.each(table)('%s -> %s; the canonical value and unknown text are unchanged', (legacy, canonical) => {
      expect(fn(at(legacy))).toBe(canonical);
      expect(fn(at(canonical))).toBe(canonical);
      expect(fn(at(`${legacy}_x`))).toBe(`${legacy}_x`);
    });
    it('a non-string value passes through', () => {
      expect(fn(at(null))).toBeNull();
      expect(fn(at(3))).toBe(3);
    });
  });

  it.each(X_APPROVAL)('content metadata.approval %s -> %s (other keys kept)', (legacy, canonical) => {
    expect(canonicalMarketingContentMetadata(at({ approval: legacy, keep: 1 }))).toEqual({ approval: canonical, keep: 1 });
    expect(canonicalMarketingContentMetadata(at({ approval: canonical }))).toEqual({ approval: canonical });
  });

  it.each(X_CHANNELS)('channel %s -> %s in every channel list (content/project/briefing metadata, campaign platforms, AI suggestion)', (legacy, canonical) => {
    expect(canonicalMarketingContentMetadata(at({ channels: [legacy, 'instagram'] }))).toEqual({ channels: [canonical, 'instagram'] });
    expect(canonicalMarketingProjectMetadata(at({ channels: [legacy, 'instagram'] }))).toEqual({ channels: [canonical, 'instagram'] });
    expect(canonicalMarketingBriefingMetadata(at({ channels: [legacy, 'instagram'] }))).toEqual({ channels: [canonical, 'instagram'] });
    expect(canonicalMarketingCampaignPayload({ platforms: [legacy, 'instagram'] })).toEqual({ platforms: [canonical, 'instagram'] });
    expect(canonicalMarketingAiSuggestion({ channels: [legacy, 'instagram'] })).toEqual({ channels: [canonical, 'instagram'] });
  });

  it.each(X_TARGETS)('target %s -> %s in task metadata, AI suggestion and (upper-case) campaign promotedEntityType', (legacy, canonical) => {
    expect(canonicalMarketingTaskMetadata(at({ targetType: legacy }))).toEqual({ targetType: canonical });
    expect(canonicalMarketingAiSuggestion({ targetType: legacy })).toEqual({ targetType: canonical });
    expect(canonicalMarketingCampaignPayload({ promotedEntityType: legacy })).toEqual({ promotedEntityType: canonical.toUpperCase() });
    expect(canonicalMarketingCampaignPayload({ promotedEntityType: legacy.toUpperCase() })).toEqual({ promotedEntityType: canonical.toUpperCase() });
    expect(canonicalMarketingCampaignPayload({ promotedEntityType: canonical.toUpperCase() })).toEqual({ promotedEntityType: canonical.toUpperCase() });
  });

  it.each(X_TASK_KINDS)('task kind %s -> %s in task metadata.uiType', (legacy, canonical) => {
    expect(canonicalMarketingTaskMetadata(at({ uiType: legacy }))).toEqual({ uiType: canonical });
  });

  it.each(X_SECTORS)('task sector label %s -> %s (exact match only)', (legacy, canonical) => {
    expect(canonicalMarketingTaskMetadata(at({ sector: legacy }))).toEqual({ sector: canonical });
    expect(canonicalMarketingTaskMetadata(at({ sector: canonical }))).toEqual({ sector: canonical });
    expect(canonicalMarketingTaskMetadata(at({ sector: `${legacy} extra` }))).toEqual({ sector: `${legacy} extra` });
  });

  it.each(X_FLOW_IDS)('automation flow id %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingTaskMetadata(at({ automationFlowId: legacy }))).toEqual({ automationFlowId: canonical });
    expect(canonicalMarketingTaskMetadata(at({ automationFlowId: canonical }))).toEqual({ automationFlowId: canonical });
  });

  it.each(X_PROJECT_UI_TYPES)('project uiType %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingProjectMetadata(at({ uiType: legacy }))).toEqual({ uiType: canonical });
  });

  it.each(X_PROJECT_UI_STATUSES)('project uiStatus %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingProjectMetadata(at({ uiStatus: legacy }))).toEqual({ uiStatus: canonical });
  });

  it.each(X_CAMPAIGN_TYPES)('campaign type %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingCampaignPayload({ type: legacy })).toEqual({ type: canonical });
    expect(canonicalMarketingCampaignPayload({ type: canonical })).toEqual({ type: canonical });
  });

  it.each(X_BRIEFING_TYPES)('briefing type %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingBriefingMetadata(at({ type: legacy }))).toEqual({ type: canonical });
  });

  it.each(X_AI_KINDS)('AI suggestion kind %s -> %s', (legacy, canonical) => {
    expect(canonicalMarketingAiSuggestion({ kind: legacy })).toEqual({ kind: canonical });
  });

  it.each(X_PHASES)('campaign builder notes phase %s -> %s (JSON notes; free text untouched)', (legacy, canonical) => {
    expect(JSON.parse(canonicalCampaignBuilderNotes(JSON.stringify({ phase: legacy, keep: 1 })) as string)).toEqual({ phase: canonical, keep: 1 });
    expect(JSON.parse(canonicalMarketingCampaignPayload({ notes: JSON.stringify({ phase: legacy }) }).notes as string)).toEqual({ phase: canonical });
    expect(canonicalCampaignBuilderNotes(legacy)).toBe(legacy);
  });

  it.each(X_CREATIVE_TYPES)('campaign creative type %s -> %s (in notes.creatives and payload.creatives)', (legacy, canonical) => {
    expect(JSON.parse(canonicalCampaignBuilderNotes(JSON.stringify({ creatives: [{ type: legacy }] })) as string)).toEqual({ creatives: [{ type: canonical }] });
    expect(canonicalMarketingCampaignPayload({ creatives: [{ type: legacy }, 'x'] })).toEqual({ creatives: [{ type: canonical }, 'x'] });
  });

  it.each(X_BUDGET_STRATEGIES)('campaign budget strategy %s -> %s', (legacy, canonical) => {
    expect(JSON.parse(canonicalCampaignBuilderNotes(JSON.stringify({ budget: { strategy: legacy } })) as string)).toEqual({ budget: { strategy: canonical } });
  });

  it.each(X_AUDIENCE_GENDERS)('audience gender %s -> %s (audience object and segmentation JSON)', (legacy, canonical) => {
    expect(canonicalMarketingCampaignPayload({ audience: { gender: legacy } })).toEqual({ audience: { gender: canonical } });
    const segmentationJson = canonicalMarketingCampaignPayload({ segmentation: JSON.stringify({ gender: legacy }) }).segmentation as string;
    expect(JSON.parse(segmentationJson)).toEqual({ gender: canonical });
  });

  it('a canonical payload is returned as the very same object (no-op detection) and free-form text is untouched', () => {
    const payload = { type: 'institutional', platforms: ['news_portal'], notes: 'free text' };
    expect(canonicalMarketingCampaignPayload(payload)).toBe(payload);
    const meta = { uiType: 'music_release', channels: ['meeting'] };
    expect(canonicalMarketingProjectMetadata(at(meta))).toBe(meta);
  });
});
