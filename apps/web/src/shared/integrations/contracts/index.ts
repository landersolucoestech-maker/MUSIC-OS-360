/**
 * shared/integrations/contracts/index.ts
 *
 * Barrel of every integration contract.
 * Import from "@/shared/integrations/contracts" to reach any contract.
 */

export type {
  AuthUser,
  AuthSession,
  AuthSignInParams,
  AuthSignUpParams,
  AuthInviteParams,
  IAuthProvider,
  AuthProviderCapabilities,
} from "./auth.contract";
export { SUPABASE_AUTH_CAPABILITIES } from "./auth.contract";

export type {
  StorageBucket,
  StorageObject,
  StorageUploadParams,
  StorageUploadResult,
  StoragePresignedUrlParams,
  IStorageProvider,
} from "./storage.contract";
export { buildStorageKey } from "./storage.contract";

export type {
  EmailTemplateId,
  EmailRecipient,
  EmailAttachment,
  SendEmailParams,
  SendEmailResult,
  EmailDeliveryStatus,
  IEmailProvider,
} from "./email.contract";
export { EMAIL_TEMPLATE_VARS } from "./email.contract";

export type {
  SubscriptionPlan,
  SubscriptionStatus,
  PaymentStatus,
  SubscriptionFeatures,
  TenantSubscription,
  PaymentMethod,
  Invoice,
  CreateCheckoutParams,
  CreatePortalParams,
  IPaymentsProvider,
} from "./payments.contract";
export { PLAN_FEATURES } from "./payments.contract";

export type {
  SigningStatus,
  SignerRole,
  Signer,
  SigningDocument,
  CreateSigningDocumentParams,
  SigningWebhookEvent,
  ISigningProvider,
} from "./signing.contract";

export type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  FeatureFlagContext,
  IAnalyticsProvider,
  ErrorSeverity,
  ErrorContext,
  BreadcrumbEntry,
  PerformanceTransaction,
  IErrorMonitorProvider,
} from "./monitoring.contract";

export type {
  StreamingPlatformId,
  AdsPlatformId,
  MetricsPeriod,
  MetricsDateRange,
  MetricTimeSeries,
  TrackMetrics,
  ArtistMetrics,
  VideoMetrics,
  SocialMetrics,
  AdCampaign,
  IStreamingProvider,
  IAdsProvider,
  StreamingPlatformMeta,
} from "./streaming.contract";
export { STREAMING_PLATFORMS } from "./streaming.contract";

export type {
  RightsEntityId,
  RightsKind,
  RightsRegistrationStatus,
  RightsSearchQuery,
  RightsSearchResult,
  ArrecadacaoTipo,
  ArrecadacaoEntry,
  ArrecadacaoSummary,
  ConciliacaoResult,
  IRightsProvider,
} from "./rights.contract";
export { arrecadacaoStorageKey } from "./rights.contract";

export type {
  ChannelType,
  MessageType,
  EntityReference,
  ChatAttachment,
  ChatMember,
  ChatChannel,
  ChatMessage,
  SendMessageParams,
  CreateChannelParams,
  ChatNotification,
  IChatProvider,
} from "./chat.contract";

