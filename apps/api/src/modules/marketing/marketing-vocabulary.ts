/**
 * Marketing technical vocabulary (technical = English, UX = PT-BR; the web
 * renders the PT-BR labels).
 *
 * Canonical values are the persisted values: they match the CHECK constraints
 * of `marketing_tasks` (chk_marketing_tasks_status / chk_marketing_tasks_priority).
 * The legacy maps below only translate deprecated INPUT from a web build
 * released before the vocabulary was canonicalized (that build sent its UI
 * vocabulary straight to the API, which the database rejected). They are the
 * only place that knows the Portuguese spellings; responses are canonical only.
 */

/**
 * `backlog` is a distinct persisted state (not an alias of `pending`): the task
 * board has it as its own first column next to "to do" (`pending`), and the
 * dashboard KPI counts both explicitly. Added to the CHECK by migration
 * 20260929000001_AddBacklogToMarketingTaskStatusCheck.
 */
export const MARKETING_TASK_STATUSES = [
  'backlog',
  'pending',
  'in_progress',
  'review',
  'blocked',
  'done',
  'cancelled',
] as const;
export type MarketingTaskStatus = (typeof MARKETING_TASK_STATUSES)[number];

export const MARKETING_TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type MarketingTaskPriority = (typeof MARKETING_TASK_PRIORITIES)[number];

/** Status that stamps `completed_at`. */
export const MARKETING_TASK_DONE_STATUS: MarketingTaskStatus = 'done';

export const LEGACY_MARKETING_TASK_STATUSES: Readonly<Record<string, MarketingTaskStatus>> = {
  a_fazer: 'pending',
  em_andamento: 'in_progress',
  revisao: 'review',
  bloqueada: 'blocked',
  concluida: 'done',
};

export const LEGACY_MARKETING_TASK_PRIORITIES: Readonly<Record<string, MarketingTaskPriority>> = {
  baixa: 'low',
  media: 'normal',
  alta: 'high',
  urgente: 'urgent',
};

function canonical(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** class-transformer @Transform: maps a deprecated Portuguese task status before validation. */
export const canonicalMarketingTaskStatus = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_TASK_STATUSES, value);

/** class-transformer @Transform: maps a deprecated Portuguese task priority before validation. */
export const canonicalMarketingTaskPriority = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_TASK_PRIORITIES, value);

// ─── Content calendar (marketing_content_posts) ─────────────────────────────

/**
 * Persisted lifecycle of a content post (chk_marketing_content_posts_status).
 * The web pipeline stages idea / production / review were never persistable
 * (the DTO rejected them) and `late` is derived from the schedule, never
 * stored: neither belongs to this list.
 */
export const MARKETING_CONTENT_STATUSES = ['draft', 'scheduled', 'published', 'cancelled', 'failed'] as const;
export type MarketingContentStatus = (typeof MARKETING_CONTENT_STATUSES)[number];

export const MARKETING_CONTENT_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const satisfies Record<string, MarketingContentStatus>;

/** Who the content is about (chk_marketing_content_posts_target_type). */
export const MARKETING_CONTENT_TARGET_TYPES = ['music_project', 'artist', 'company'] as const;
export type MarketingContentTargetType = (typeof MARKETING_CONTENT_TARGET_TYPES)[number];

/** Publication format (chk_marketing_content_posts_content_type). */
export const MARKETING_CONTENT_TYPES = [
  'post',
  'feed',
  'stories',
  'reels',
  'shorts',
  'video',
  'carousel',
  'ad',
  'social_media',
  'institutional',
  'commercial',
  'artist',
  'behind_the_scenes',
  'meeting',
  'event',
  'portal',
  'blog',
  'advertising',
] as const;
export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export const LEGACY_MARKETING_CONTENT_STATUSES: Readonly<Record<string, MarketingContentStatus>> = {
  rascunho: 'draft',
  agendado: 'scheduled',
  publicado: 'published',
  cancelado: 'cancelled',
  falhou: 'failed',
};

export const LEGACY_MARKETING_CONTENT_TARGET_TYPES: Readonly<Record<string, MarketingContentTargetType>> = {
  projeto_musical: 'music_project',
  artista: 'artist',
  empresa: 'company',
};

export const LEGACY_MARKETING_CONTENT_TYPES: Readonly<Record<string, MarketingContentType>> = {
  carrossel: 'carousel',
  anuncio: 'ad',
  rede_social: 'social_media',
  institucional: 'institutional',
  comercial: 'commercial',
  artista: 'artist',
  bastidores: 'behind_the_scenes',
  reuniao: 'meeting',
  evento: 'event',
  publicidade: 'advertising',
};

/** class-transformer @Transform: maps a deprecated Portuguese content status before validation. */
export const canonicalMarketingContentStatus = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_STATUSES, value);

/** class-transformer @Transform: maps a deprecated Portuguese content target type before validation. */
export const canonicalMarketingContentTargetType = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_TARGET_TYPES, value);

/** class-transformer @Transform: maps a deprecated Portuguese content type before validation. */
export const canonicalMarketingContentType = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_TYPES, value);
