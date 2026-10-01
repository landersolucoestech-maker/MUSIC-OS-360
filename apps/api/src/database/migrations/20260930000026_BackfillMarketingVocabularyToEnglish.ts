import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000026_BackfillMarketingVocabularyToEnglish (MK2)
 *
 * The marketing module persisted its web UI vocabulary as Portuguese machine values in
 * jsonb keys and one free varchar. Canonical English (VALUES that a user typed -- titles,
 * names, notes, sectors, free text -- are never touched, only the machine keys listed here):
 *
 *   marketing_projects.metadata      uiType, uiStatus, channels[]
 *   marketing_tasks                  kind (column) + metadata.uiType, metadata.targetType
 *   campaigns (marketing_builder)    metadata.marketingBuilder.payload.{promotedEntityType, type, platforms[]}
 *   briefings.metadata               type, channels[]
 *   marketing_content_posts.metadata channels[]
 *   activity_logs (marketing_ai)     metadata.kind, metadata.targetType, metadata.channels[]
 *
 * Maps are in the const tables below (a frozen copy of marketing-vocabulary.ts at this
 * release; the spec asserts they are equal). EXACT, case-sensitive matches only: a value that
 * is not in a map (canonical, tenant-defined, e.g. a task kind written by the API such as
 * cover_art) is left exactly as it is. The campaign promotedEntityType is stored upper-case
 * (PROJETO_MUSICAL/ARTISTA/EMPRESA -> MUSIC_PROJECT/ARTIST/COMPANY, the campaign-builder
 * entity types).
 *
 * Expand/contract, backfill step. The code that ships with this migration writes the canonical
 * values (web + API) and keeps ACCEPTING and READING the Portuguese ones (the API maps input
 * before validation, the web readers map on read). The contract step (delete the legacy maps) is
 * gated on the census in findings/marketing-mk2.md returning 0. No CHECK is added: the columns are
 * free-form (jsonb / varchar) and tenants' integrations may write other values.
 *
 * Rules (jsonb-row-backfill.ts): candidate rows only (cheap predicate), idempotent (a canonical row
 * is skipped), every other key preserved, `updated_at` untouched (vocabulary rewrite, not a user
 * edit: bumping it would break open editors' optimistic concurrency), the UPDATE is guarded by the
 * value that was read (a concurrent edit wins, a re-run retries), each rewritten row is recorded
 * (BEFORE/AFTER of the changed columns only) in the locked-down side table
 * `marketing_vocabulary_backfill_20260930`, logs are counts only.
 *
 * down(): puts BEFORE back for the rows still holding exactly AFTER (a row edited since is never
 * reverted). The side table is kept (forensic); drop it in a later migration.
 */
const MIGRATION = 'BackfillMarketingVocabularyToEnglish20260930000026';
const LOG_TABLE = 'marketing_vocabulary_backfill_20260930';

const TARGET: Readonly<Record<string, string>> = {
  projeto_musical: 'music_project',
  artista: 'artist',
  empresa: 'company',
};
const PROJECT_TYPE: Readonly<Record<string, string>> = {
  lancamento_musical: 'music_release',
  videoclipe: 'music_video',
  campanha_institucional: 'institutional_campaign',
  campanha_promocional: 'promotional_campaign',
  evento: 'event',
  conteudo_corporativo: 'corporate_content',
  bastidores: 'behind_the_scenes',
  reuniao: 'meeting',
  divulgacao_produto: 'product_promotion',
  divulgacao_servico: 'service_promotion',
  divulgacao_saas: 'saas_promotion',
  comunicacao_interna: 'internal_communication',
  comunicacao_externa: 'external_communication',
  portal_noticias: 'news_portal',
  projeto_especial: 'special_project',
};
const PROJECT_STATUS: Readonly<Record<string, string>> = {
  planejamento: 'planning',
  em_andamento: 'active',
  pausado: 'paused',
  concluido: 'completed',
  cancelado: 'cancelled',
};
const CAMPAIGN_TYPE: Readonly<Record<string, string>> = {
  institucional: 'institutional',
  comercial: 'commercial',
  artistica: 'artistic',
  promocional: 'promotional',
  lancamento_musical: 'music_release',
  produto: 'product',
  servico: 'service',
  evento: 'event',
  conteudo: 'content',
  trafego_pago: 'paid_traffic',
  organica: 'organic',
};
const BRIEFING_TYPE: Readonly<Record<string, string>> = {
  campanha: 'campaign',
  conteudo: 'content',
  institucional: 'institutional',
  comercial: 'commercial',
  artistico: 'artistic',
  evento: 'event',
  produto: 'product',
  servico: 'service',
  portal_noticias: 'news_portal',
  bastidores: 'behind_the_scenes',
};
const CHANNEL: Readonly<Record<string, string>> = {
  portal_noticias: 'news_portal',
  campanha: 'campaign',
  material_publicitario: 'advertising_material',
  evento_interno: 'internal_event',
  evento_externo: 'external_event',
  reuniao: 'meeting',
  bastidores: 'behind_the_scenes',
};
const TASK_KIND: Readonly<Record<string, string>> = {
  publicacao: 'publishing',
  campanha: 'campaign',
  planejamento: 'planning',
  aprovacao: 'approval',
  revisao: 'review',
  analise: 'analysis',
  reuniao: 'meeting',
  bastidor: 'behind_the_scenes_shot',
  conteudo_institucional: 'institutional_content',
  conteudo_comercial: 'commercial_content',
  conteudo_artistico: 'artistic_content',
  trafego_pago: 'paid_traffic',
  capa: 'cover',
  arte_redes_sociais: 'social_media_art',
  identidade_visual: 'visual_identity',
  material_promocional: 'promotional_material',
  videoclipe: 'music_video',
  video_redes_sociais: 'social_media_video',
  bastidores: 'behind_the_scenes',
  entrevista: 'interview',
  captacao_evento: 'event_coverage',
  prospeccao: 'prospecting',
  negociacao: 'negotiation',
  relacionamento: 'relationship',
  planejamento_lancamento: 'release_planning',
  material_institucional: 'institutional_material',
  apresentacao_comercial: 'commercial_presentation',
  video_institucional: 'institutional_video',
  bastidores_empresa: 'company_behind_the_scenes',
  cobertura_evento_corporativo: 'corporate_event_coverage',
  entrevista_corporativa: 'corporate_interview',
  campanha_institucional: 'institutional_campaign',
  posicionamento_marca: 'brand_positioning',
  comunicados: 'announcements',
  relacionamento_parceiros: 'partner_relationship',
  parcerias: 'partnerships',
  planejamento_carreira: 'career_planning',
  gestao_agenda: 'schedule_management',
  planejamento_estrategico: 'strategic_planning',
  assessoria_imprensa: 'press_relations',
  branding_pessoal: 'personal_branding',
  posicionamento: 'positioning',
  estrategias_crescimento: 'growth_strategies',
  sessao_fotos: 'photo_session',
  conteudo_redes_sociais: 'social_media_content',
  contratacoes: 'contracting',
  arte_divulgacao: 'promotional_art',
  conteudo_lancamento: 'release_content',
  distribuicao: 'distribution',
  campanha_lancamento: 'release_campaign',
  divulgacao: 'promotion',
  influenciadores: 'influencers',
  aprovacao_conteudo: 'content_approval',
};
const AI_KIND: Readonly<Record<string, string>> = {
  analise_fonograma: 'phonogram_analysis',
  analise_letra: 'lyrics_analysis',
  planejamento_campanha: 'campaign_planning',
  sugestao_conteudo: 'content_suggestion',
  legenda: 'caption',
  roteiro: 'script',
  analise_artista: 'artist_analysis',
  analise_marca: 'brand_analysis',
  analise_empresa: 'company_analysis',
  pitch_playlist: 'playlist_pitch',
  pitch_imprensa: 'press_pitch',
  posicionamento: 'positioning',
  calendario_editorial: 'editorial_calendar',
  conteudo_bastidores: 'behind_the_scenes_content',
  conteudo_corporativo: 'corporate_content',
};

const q = (values: string[]): string => values.map((v) => `'${v}'`).join(', ');

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const mapValue = (map: Readonly<Record<string, string>>, v: unknown): unknown => (typeof v === 'string' && has(map, v) ? map[v] : v);
const mapList = (map: Readonly<Record<string, string>>, v: unknown): unknown => (Array.isArray(v) ? v.map((e) => mapValue(map, e)) : v);
const campaignEntityType = (v: unknown): unknown => (typeof v === 'string' && has(TARGET_UPPER, v) ? TARGET_UPPER[v] : v);
const TARGET_UPPER: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TARGET).flatMap(([legacy, canonical]) => [
    [legacy.toUpperCase(), canonical.toUpperCase()],
    [legacy, canonical.toUpperCase()],
  ]),
);

type KeyRules = Readonly<Record<string, (v: unknown) => unknown>>;

/** Copy of `metadata` with the listed keys rewritten, or null when nothing changes (or it is not an object). */
function rewrite(metadata: unknown, rules: KeyRules): Json | null {
  if (!isObject(metadata)) return null;
  let out: Json | null = null;
  for (const [key, fn] of Object.entries(rules)) {
    if (!has(metadata, key)) continue;
    const mapped = fn(metadata[key]);
    if (JSON.stringify(mapped) !== JSON.stringify(metadata[key])) {
      out = out ?? { ...metadata };
      out[key] = mapped;
    }
  }
  return out;
}

const PROJECT_RULES: KeyRules = {
  uiType: (v) => mapValue(PROJECT_TYPE, v),
  uiStatus: (v) => mapValue(PROJECT_STATUS, v),
  channels: (v) => mapList(CHANNEL, v),
};
const TASK_RULES: KeyRules = {
  targetType: (v) => mapValue(TARGET, v),
  uiType: (v) => mapValue(TASK_KIND, v),
};
const BRIEFING_RULES: KeyRules = {
  type: (v) => mapValue(BRIEFING_TYPE, v),
  channels: (v) => mapList(CHANNEL, v),
};
const CONTENT_RULES: KeyRules = { channels: (v) => mapList(CHANNEL, v) };
const CAMPAIGN_PAYLOAD_RULES: KeyRules = {
  promotedEntityType: campaignEntityType,
  type: (v) => mapValue(CAMPAIGN_TYPE, v),
  platforms: (v) => mapList(CHANNEL, v),
};
const AI_RULES: KeyRules = {
  kind: (v) => mapValue(AI_KIND, v),
  targetType: (v) => mapValue(TARGET, v),
  channels: (v) => mapList(CHANNEL, v),
};

/** Exported for the unit spec only. */
export const MARKETING_BACKFILL_MAPS = { TARGET, PROJECT_TYPE, PROJECT_STATUS, CAMPAIGN_TYPE, BRIEFING_TYPE, CHANNEL, TASK_KIND, AI_KIND } as const;

/** Exported for the unit spec only: jsonb of a row after the rewrite, or null when it is already canonical. */
export function canonicalMarketingMetadataForBackfill(table: BackfillTable, metadata: unknown): Json | null {
  switch (table) {
    case 'marketing_projects': return rewrite(metadata, PROJECT_RULES);
    case 'marketing_tasks': return rewrite(metadata, TASK_RULES);
    case 'briefings': return rewrite(metadata, BRIEFING_RULES);
    case 'marketing_content_posts': return rewrite(metadata, CONTENT_RULES);
    case 'activity_logs': return rewrite(metadata, AI_RULES);
    case 'campaigns': {
      if (!isObject(metadata)) return null;
      const builder = metadata['marketingBuilder'];
      if (!isObject(builder)) return null;
      const payload = rewrite(builder['payload'], CAMPAIGN_PAYLOAD_RULES);
      return payload ? { ...metadata, marketingBuilder: { ...builder, payload } } : null;
    }
  }
}

export type BackfillTable = 'marketing_projects' | 'marketing_tasks' | 'campaigns' | 'briefings' | 'marketing_content_posts' | 'activity_logs';

/** Exported for the unit spec only: marketing_tasks.kind. */
export const canonicalTaskKindForBackfill = (kind: unknown): unknown => mapValue(TASK_KIND, kind);

// ── candidate predicates (cheap, static; the transform decides) ──────────────────────────────

const channelHit = (path: string): string =>
  `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(${path}) = 'array' THEN ${path} ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN (${q(Object.keys(CHANNEL))}))`;
const scalarHit = (path: string, map: Readonly<Record<string, string>>): string => `(${path}) IN (${q(Object.keys(map))})`;

const PREDICATES: Readonly<Record<BackfillTable, string>> = {
  marketing_projects: [
    scalarHit(`"metadata" ->> 'uiType'`, PROJECT_TYPE),
    scalarHit(`"metadata" ->> 'uiStatus'`, PROJECT_STATUS),
    channelHit(`"metadata" -> 'channels'`),
  ].join(' OR '),
  marketing_tasks: [
    scalarHit(`"kind"`, TASK_KIND),
    scalarHit(`"metadata" ->> 'uiType'`, TASK_KIND),
    scalarHit(`"metadata" ->> 'targetType'`, TARGET),
  ].join(' OR '),
  campaigns: `"type" = 'marketing_builder' AND (${[
    scalarHit(`"metadata" #>> '{marketingBuilder,payload,promotedEntityType}'`, TARGET_UPPER),
    scalarHit(`"metadata" #>> '{marketingBuilder,payload,type}'`, CAMPAIGN_TYPE),
    channelHit(`"metadata" #> '{marketingBuilder,payload,platforms}'`),
  ].join(' OR ')})`,
  briefings: [scalarHit(`"metadata" ->> 'type'`, BRIEFING_TYPE), channelHit(`"metadata" -> 'channels'`)].join(' OR '),
  marketing_content_posts: channelHit(`"metadata" -> 'channels'`),
  activity_logs: `"entity_type" = 'marketing_ai' AND (${[
    scalarHit(`"metadata" ->> 'kind'`, AI_KIND),
    scalarHit(`"metadata" ->> 'targetType'`, TARGET),
    channelHit(`"metadata" -> 'channels'`),
  ].join(' OR ')})`,
};

function spec(table: BackfillTable, withKind = false): RowBackfillSpec {
  return {
    migration: MIGRATION,
    table,
    logTable: LOG_TABLE,
    columns: withKind ? ['kind', 'metadata'] : ['metadata'],
    jsonbColumns: ['metadata'],
    candidatePredicate: PREDICATES[table],
    transform(row) {
      const set: Record<string, unknown> = {};
      const metadata = canonicalMarketingMetadataForBackfill(table, row['metadata']);
      if (metadata) set['metadata'] = metadata;
      if (withKind && typeof row['kind'] === 'string') {
        const kind = canonicalTaskKindForBackfill(row['kind']);
        if (kind !== row['kind']) set['kind'] = kind;
      }
      return Object.keys(set).length > 0 ? { set, conflicts: 0 } : null;
    },
  };
}

const SPECS: readonly RowBackfillSpec[] = [
  spec('marketing_projects'),
  spec('marketing_tasks', true),
  spec('campaigns'),
  spec('briefings'),
  spec('marketing_content_posts'),
  spec('activity_logs'),
];

export class BackfillMarketingVocabularyToEnglish20260930000026 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    for (const s of SPECS) await backfillRows(queryRunner, s);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const s of [...SPECS].reverse()) await restoreRows(queryRunner, s);
  }
}
