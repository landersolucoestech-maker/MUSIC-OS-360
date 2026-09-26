/**
 * queues/queue.constants.ts
 *
 * Nomes das filas BullMQ do Music OS 360.
 * Usar estas constantes em vez de strings literais elimina erros de digitação
 * e centraliza o registo de todas as filas da plataforma.
 */

export const QUEUE_NAMES = {
  EMAILS:             'emails',
  NOTIFICATIONS:      'notifications',
  AI_JOBS:            'ai-jobs',
  INTEGRATIONS_SYNC:  'integrations-sync',
  STREAMING_SYNC:     'streaming-sync',
  MARKETING_PUBLISHING: 'marketing-publishing',
  ARTIST_PLATFORM_SYNC: 'artist-platform-sync',
  ANALYTICS_REFRESH:   'analytics-refresh',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Job names da fila EMAILS ─────────────────────────────────────────────────

export const EMAIL_JOB_NAMES = {
  WELCOME:            'welcome',
  PASSWORD_RESET:     'password-reset',
  CONTRACT_EXPIRY:    'contract-expiry',
  INVITE_USER:        'invite-user',
  PAYMENT_RECEIPT:    'payment-receipt',
  MONITORING_ALERT:   'monitoring-alert',
} as const;

export type EmailJobName = (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];

// ─── Job names da fila NOTIFICATIONS ─────────────────────────────────────────

export const NOTIFICATION_JOB_NAMES = {
  SEND:               'send',
  BROADCAST_TENANT:   'broadcast-tenant',
} as const;

export type NotificationJobName = (typeof NOTIFICATION_JOB_NAMES)[keyof typeof NOTIFICATION_JOB_NAMES];

// ─── Job names das filas de workflow/integrações ──────────────────────────────

export const WORKFLOW_JOB_NAMES = {
  DISTRIBUTION_SYNC:    'distribution-sync',
  EXTERNAL_DATA_SYNC:   'external-data.sync',
  SOCIETY_SUBMIT:       'society.submit',
  SOCIETY_STATUS_CHECK: 'society.status-check',
  DISTRIBUTOR_SUBMIT:   'distributor.submit',
  DISTRIBUTOR_STATUS_CHECK: 'distributor.status-check',
  ONBOARDING_CHECK:     'onboarding-check',
  WORKFLOW_FOLLOWUP:    'workflow-followup',
} as const;

export type WorkflowJobName = (typeof WORKFLOW_JOB_NAMES)[keyof typeof WORKFLOW_JOB_NAMES];

/** Jobs produzidos por SpotifyService na fila streaming-sync. */
export const SPOTIFY_JOB_NAMES = {
  ACCOUNT_SYNC: 'spotify:sync',
} as const;

/**
 * find-721c845e — jobs SEM consumidor. Produzi-los enchia Redis
 * (integrations-sync não tem @Processor) ou gerava "concluído" sem trabalho
 * (distribution-sync cai no default do ExternalDataProcessor). A semântica é
 * DEPENDENTE_DECISÃO_DE_PRODUTO; WorkflowQueueService não os enfileira e
 * `preservedAs` aponta o evento de domínio (persistido em domain_event_log)
 * que já guarda o fato de origem. queue-topology.spec.ts garante que todo
 * job produzido tem consumidor real OU está nesta lista.
 */
export const UNCONSUMED_QUEUE_JOBS = {
  [WORKFLOW_JOB_NAMES.ONBOARDING_CHECK]:  { queue: 'integrations-sync', preservedAs: 'artist.onboarding_started' },
  [WORKFLOW_JOB_NAMES.WORKFLOW_FOLLOWUP]: { queue: 'integrations-sync', preservedAs: 'contract.signed | contract.expiring_soon' },
  [WORKFLOW_JOB_NAMES.DISTRIBUTION_SYNC]: { queue: 'streaming-sync',    preservedAs: 'distribution.setup_requested' },
  [SPOTIFY_JOB_NAMES.ACCOUNT_SYNC]:       { queue: 'streaming-sync',    preservedAs: 'oauth_connections (linha upsertada por SpotifyService.handleCallback)' },
} as const;

export const MARKETING_PUBLISHING_JOB_NAMES = {
  PUBLISH_CONTENT: 'publish-content',
} as const;

export type MarketingPublishingJobName =
  (typeof MARKETING_PUBLISHING_JOB_NAMES)[keyof typeof MARKETING_PUBLISHING_JOB_NAMES];

export const ARTIST_PLATFORM_PROFILE_JOB_NAMES = {
  SYNC: 'artist-platform-profile-sync',
} as const;

export type ArtistPlatformProfileJobName =
  (typeof ARTIST_PLATFORM_PROFILE_JOB_NAMES)[keyof typeof ARTIST_PLATFORM_PROFILE_JOB_NAMES];

// Fase 3.2 — refresh em background da coorte externa do Market Benchmark
// (item 4: nenhuma chamada pesada à Soundcharts dentro do request HTTP).
export const ANALYTICS_REFRESH_JOB_NAMES = {
  MARKET_BENCHMARK_REFRESH: 'market-benchmark-refresh',
} as const;

export type AnalyticsRefreshJobName =
  (typeof ANALYTICS_REFRESH_JOB_NAMES)[keyof typeof ANALYTICS_REFRESH_JOB_NAMES];
