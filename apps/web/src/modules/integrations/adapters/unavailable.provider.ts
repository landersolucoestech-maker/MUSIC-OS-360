import type {
  AdCampaign,
  AdsPlatformId,
  ArtistMetrics,
  AuthInviteParams,
  AuthSession,
  AuthSignInParams,
  AuthSignUpParams,
  ChatChannel,
  ChatMessage,
  ChatNotification,
  CreateChannelParams,
  CreateCheckoutParams,
  CreatePortalParams,
  EmailDeliveryStatus,
  GenerateISRCInput,
  GenerateISRCResult,
  GenerateISWCInput,
  GenerateISWCResult,
  IAdsProvider,
  IAuthProvider,
  IChatProvider,
  IEmailProvider,
  IPaymentsProvider,
  IRightsProvider,
  IStorageProvider,
  IStreamingProvider,
  Invoice,
  MetricsDateRange,
  MetricsPeriod,
  PaymentMethod,
  RightsEntityId,
  RightsKind,
  RightsRegistrationStatus,
  RightsSearchQuery,
  RightsSearchResult,
  SendEmailParams,
  SendEmailResult,
  SendMessageParams,
  StorageBucket,
  StorageObject,
  StoragePresignedUrlParams,
  StorageUploadParams,
  StorageUploadResult,
  StreamingPlatformId,
  SubscriptionFeatures,
  TenantSubscription,
  TrackMetrics,
  VideoMetrics,
} from "@/modules/integrations/dto";
import type {
  ArrecadacaoEntry,
  ArrecadacaoSummary,
  ArtistSearchQuery,
  ArtistSearchResult,
  ConciliacaoResult,
  RegisterFonogramaInput,
  RegisterObraInput,
  RegistrationHistoryEntry,
  RegistrationResult,
} from "@/shared/integrations/contracts/rights.contract";
import { UserFacingError } from "@/shared/lib/errors";

function unavailable(integration: string): never {
  throw new UserFacingError(
    `${integration} has no real frontend provider; use the real backend before calling this adapter`,
    "Esta integração ainda não está disponível.",
  );
}

export function createUnavailableAuthProvider(): IAuthProvider {
  return {
    session: null,
    user: null,
    isLoading: false,
    signIn: (_params: AuthSignInParams): Promise<AuthSession> => Promise.reject(unavailable("auth")),
    signUp: (_params: AuthSignUpParams): Promise<AuthSession> => Promise.reject(unavailable("auth")),
    signOut: (): Promise<void> => Promise.reject(unavailable("auth")),
    inviteUser: (_params: AuthInviteParams): Promise<void> => Promise.reject(unavailable("auth")),
    revokeUser: (_userId: string): Promise<void> => Promise.reject(unavailable("auth")),
    verifySession: (): Promise<boolean> => Promise.reject(unavailable("auth")),
    refreshSession: (): Promise<AuthSession> => Promise.reject(unavailable("auth")),
  };
}

export function createUnavailableEmailProvider(): IEmailProvider {
  return {
    send: (_params: SendEmailParams): Promise<SendEmailResult> => Promise.reject(unavailable("email")),
    getDeliveryStatus: (_messageId: string): Promise<EmailDeliveryStatus> => Promise.reject(unavailable("email")),
    verifyConnection: (): Promise<boolean> => Promise.reject(unavailable("email")),
  };
}

export function createUnavailableStorageProvider(): IStorageProvider {
  return {
    upload: (_params: StorageUploadParams): Promise<StorageUploadResult> => Promise.reject(unavailable("storage")),
    presignedUrl: (_params: StoragePresignedUrlParams): Promise<string> => Promise.reject(unavailable("storage")),
    delete: (_bucket: StorageBucket, _key: string): Promise<void> => Promise.reject(unavailable("storage")),
    list: (_bucket: StorageBucket, _prefix: string): Promise<StorageObject[]> => Promise.reject(unavailable("storage")),
    exists: (_bucket: StorageBucket, _key: string): Promise<boolean> => Promise.reject(unavailable("storage")),
    copy: (_bucket: StorageBucket, _sourceKey: string, _destKey: string): Promise<StorageUploadResult> => Promise.reject(unavailable("storage")),
  };
}

export function createUnavailablePaymentsProvider(): IPaymentsProvider {
  return {
    getSubscription: (_tenantId: string): Promise<TenantSubscription | null> => Promise.reject(unavailable("payments")),
    createCheckoutSession: (_params: CreateCheckoutParams): Promise<{ url: string }> => Promise.reject(unavailable("payments")),
    createPortalSession: (_params: CreatePortalParams): Promise<{ url: string }> => Promise.reject(unavailable("payments")),
    listPaymentMethods: (_tenantId: string): Promise<PaymentMethod[]> => Promise.reject(unavailable("payments")),
    listInvoices: (_tenantId: string, _limit?: number): Promise<Invoice[]> => Promise.reject(unavailable("payments")),
    cancelSubscription: (_tenantId: string): Promise<void> => Promise.reject(unavailable("payments")),
    hasFeature: (_tenantId: string, _feature: keyof SubscriptionFeatures): Promise<boolean> => Promise.reject(unavailable("payments")),
  };
}

export function createUnavailableChatProvider(): IChatProvider {
  return {
    listChannels: (): Promise<ChatChannel[]> => Promise.reject(unavailable("chat")),
    getChannel: (_channelId: string): Promise<ChatChannel> => Promise.reject(unavailable("chat")),
    createChannel: (_params: CreateChannelParams): Promise<ChatChannel> => Promise.reject(unavailable("chat")),
    archiveChannel: (_channelId: string): Promise<void> => Promise.reject(unavailable("chat")),
    addMember: (_channelId: string, _userId: string): Promise<void> => Promise.reject(unavailable("chat")),
    removeMember: (_channelId: string, _userId: string): Promise<void> => Promise.reject(unavailable("chat")),
    listMessages: (_channelId: string, _params?: { before?: string; limit?: number }): Promise<ChatMessage[]> => Promise.reject(unavailable("chat")),
    sendMessage: (_params: SendMessageParams): Promise<ChatMessage> => Promise.reject(unavailable("chat")),
    editMessage: (_messageId: string, _text: string): Promise<ChatMessage> => Promise.reject(unavailable("chat")),
    deleteMessage: (_messageId: string): Promise<void> => Promise.reject(unavailable("chat")),
    addReaction: (_messageId: string, _emoji: string): Promise<void> => Promise.reject(unavailable("chat")),
    removeReaction: (_messageId: string, _emoji: string): Promise<void> => Promise.reject(unavailable("chat")),
    listNotifications: (): Promise<ChatNotification[]> => Promise.reject(unavailable("chat")),
    markNotificationRead: (_notificationId: string): Promise<void> => Promise.reject(unavailable("chat")),
    markChannelRead: (_channelId: string): Promise<void> => Promise.reject(unavailable("chat")),
    subscribe: (_channelId: string, _handler: (message: ChatMessage) => void): (() => void) => unavailable("chat"),
  };
}

export function createUnavailableRightsProvider(entity: RightsEntityId): IRightsProvider {
  return {
    entity,
    search: (_query: RightsSearchQuery): Promise<RightsSearchResult[]> => Promise.reject(unavailable(`rights:${entity}`)),
    searchArtists: (_query: ArtistSearchQuery): Promise<ArtistSearchResult[]> => Promise.reject(unavailable(`rights:${entity}`)),
    import: (_kind: RightsKind, _externalId: string): Promise<{ local_id: string }> => Promise.reject(unavailable(`rights:${entity}`)),
    getRegistrationStatus: (_kind: RightsKind, _localId: string): Promise<RightsRegistrationStatus> => Promise.reject(unavailable(`rights:${entity}`)),
    getRegistrationHistory: (_kind: RightsKind, _localId: string): Promise<RegistrationHistoryEntry[]> => Promise.reject(unavailable(`rights:${entity}`)),
    registerObra: (_input: RegisterObraInput): Promise<RegistrationResult> => Promise.reject(unavailable(`rights:${entity}`)),
    updateObraRegistration: (_externalId: string, _input: Partial<RegisterObraInput>): Promise<RegistrationResult> => Promise.reject(unavailable(`rights:${entity}`)),
    registerFonograma: (_input: RegisterFonogramaInput): Promise<RegistrationResult> => Promise.reject(unavailable(`rights:${entity}`)),
    updateFonogramaRegistration: (_externalId: string, _input: Partial<RegisterFonogramaInput>): Promise<RegistrationResult> => Promise.reject(unavailable(`rights:${entity}`)),
    generateISWC: (_input: GenerateISWCInput): Promise<GenerateISWCResult> => Promise.reject(unavailable(`rights:${entity}`)),
    generateISRC: (_input: GenerateISRCInput): Promise<GenerateISRCResult> => Promise.reject(unavailable(`rights:${entity}`)),
    syncAll: (): Promise<{ synced: number; errors: number }> => Promise.reject(unavailable(`rights:${entity}`)),
    getArrecadacao: (_periodo: string): Promise<ArrecadacaoEntry[]> => Promise.reject(unavailable(`rights:${entity}`)),
    getArrecadacaoSummary: (_periodo: string): Promise<ArrecadacaoSummary> => Promise.reject(unavailable(`rights:${entity}`)),
    conciliar: (_periodo: string): Promise<ConciliacaoResult> => Promise.reject(unavailable(`rights:${entity}`)),
    verifyConnection: (): Promise<boolean> => Promise.reject(unavailable(`rights:${entity}`)),
  };
}

export function createUnavailableStreamingProvider(platform: StreamingPlatformId): IStreamingProvider {
  return {
    platform,
    getArtistMetrics: (_artistId: string, _period: MetricsPeriod | MetricsDateRange): Promise<ArtistMetrics> => Promise.reject(unavailable(`streaming:${platform}`)),
    getTrackMetrics: (_isrc: string, _period: MetricsPeriod | MetricsDateRange): Promise<TrackMetrics> => Promise.reject(unavailable(`streaming:${platform}`)),
    getVideoMetrics: (_videoId: string, _period: MetricsPeriod | MetricsDateRange): Promise<VideoMetrics> => Promise.reject(unavailable(`streaming:${platform}`)),
    verifyConnection: (): Promise<boolean> => Promise.reject(unavailable(`streaming:${platform}`)),
  };
}

export function createUnavailableAdsProvider(platform: AdsPlatformId): IAdsProvider {
  return {
    platform,
    listCampaigns: (_params?: { status?: AdCampaign["status"] }): Promise<AdCampaign[]> => Promise.reject(unavailable(`ads:${platform}`)),
    getCampaign: (_campaignId: string): Promise<AdCampaign> => Promise.reject(unavailable(`ads:${platform}`)),
    verifyConnection: (): Promise<boolean> => Promise.reject(unavailable(`ads:${platform}`)),
  };
}
