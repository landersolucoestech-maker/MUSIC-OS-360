/**
 * shared/integrations/contracts/marketing.contract.ts
 *
 * Contratos unificados para integrações de Marketing Digital — contas corporativas.
 *
 * ARQUITECTURA:
 * — Plataformas dos ARTISTAS (Instagram, TikTok, Spotify, YouTube, Deezer, Apple Music,
 *   SoundCloud) funcionam AUTOMATICAMENTE via links do cadastro do artista.
 *   NÃO existe integração manual separada para artistas nessas plataformas.
 *
 * — Este módulo trata APENAS contas corporativas da empresa/label/publisher:
 *   · Métricas Corporativas — contas analytics da empresa
 *   · Tráfego Pago         — contas de anúncios da empresa
 *   · Website & Outros     — formulários, landing pages, API directa
 */

// ─── IDs de plataforma ────────────────────────────────────────────────────────

export type MarketingPlatformId =
  // ── Métricas Corporativas ─────────────────────────────────────────────────
  // Contas oficiais da empresa/label em cada plataforma.
  // Login obrigatório para aceder analytics, gestão de página e publicações.
  | "meta_business"       // Meta Business Suite — Facebook + Instagram + Meta Ads (unificado)
  | "youtube_business"    // YouTube Business — YouTube Studio + YouTube Ads (unificado)
  | "tiktok_business"     // TikTok Business — TikTok for Business + TikTok Ads (unificado)
  | "google_business"     // Google Business — Analytics 4 + Search Console + Google Ads (unificado)
  | "corp_spotify"        // Spotify for Artists — perfil oficial da empresa
  | "corp_deezer"         // Deezer for Artists — presença da label no Deezer
  | "corp_soundcloud"     // SoundCloud Pro — perfil oficial da label
  | "corp_apple_music"    // Apple Music for Artists — presença da label no Apple Music
  // ── Métricas Corporativas — aliases curtos ────────────────────────────────
  | "corp_instagram"       // Instagram corporativo (parte de meta_business)
  | "corp_tiktok"          // TikTok corporativo (parte de tiktok_business)
  | "corp_youtube"         // YouTube corporativo (parte de youtube_business)
  // ── Tráfego Pago ─────────────────────────────────────────────────────────
  // Contas de anúncios pagos da empresa. Login obrigatório.
  | "meta_ads"
  | "google_ads"
  | "tiktok_ads"
  | "youtube_ads"
  | "spotify_ads"
  | "deezer_ads"
  | "apple_music_ads"
  | "soundcloud_ads";

export type MarketingCategory = "corporate_metrics" | "paid_ads";

export type CampaignStatus = "active" | "paused" | "ended" | "draft" | "archived";

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

// ─── Campanhas (Tráfego Pago) ─────────────────────────────────────────────────

export interface ICampaign {
  id: string;
  platform: MarketingPlatformId;
  name: string;
  status: CampaignStatus;
  objective: string;
  budget: number;
  budgetType: "daily" | "lifetime";
  spent: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  roas?: number;
  startDate: string;
  endDate?: string;
  updatedAt: string;
}

export interface ICampaignSyncResult {
  synced: number;
  updated: number;
  errors: number;
  lastSyncAt: string;
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export interface ICapturedLead {
  id: string;
  platform: MarketingPlatformId;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  status: LeadStatus;
  capturedAt: string;
  campaignId?: string;
  campaignName?: string;
  formName?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ILeadSyncResult {
  synced: number;
  duplicates: number;
  errors: number;
  lastSyncAt: string;
}

// ─── Métricas & Analytics ─────────────────────────────────────────────────────

export interface IMetricsPeriod {
  from: string;
  to: string;
}

export interface IPlatformMetrics {
  platform: MarketingPlatformId;
  period: IMetricsPeriod;
  impressions: number;
  reach: number;
  engagement: number;
  engagementRate: number;
  clicks: number;
  followers?: number;
  followersGrowth?: number;
  followersGrowthPercent?: number;
  views?: number;
  watchTimeHours?: number;
  subscribers?: number;
  subscribersGrowth?: number;
  likesTotal?: number;
  commentsTotal?: number;
  sharesTotal?: number;
  savesTotal?: number;
  storiesImpressions?: number;
  reelsViews?: number;
  streams?: number;
  topPosts?: ITopPost[];
}

export interface ITopPost {
  id: string;
  title?: string;
  type: "video" | "image" | "carousel" | "reel" | "story" | "short";
  views?: number;
  likes: number;
  comments: number;
  shares?: number;
  engagementRate: number;
  publishedAt: string;
  thumbnailUrl?: string;
}

// ─── Contrato do provider ─────────────────────────────────────────────────────

export interface IMarketingProvider {
  getPlatformId(): MarketingPlatformId;
  getCategory(): MarketingCategory;
  isConnected(): boolean;
  getCampaigns?(): Promise<ICampaign[]>;
  getCampaignById?(id: string): Promise<ICampaign | null>;
  syncCampaigns?(): Promise<ICampaignSyncResult>;
  pauseCampaign?(id: string): Promise<void>;
  resumeCampaign?(id: string): Promise<void>;
  getLeads?(since?: string): Promise<ICapturedLead[]>;
  syncLeads?(): Promise<ILeadSyncResult>;
  getMetrics?(period: IMetricsPeriod): Promise<IPlatformMetrics>;
  refreshMetrics?(): Promise<void>;
  getTopContent?(limit?: number): Promise<ITopPost[]>;
}

// ─── Estado de conexão OAuth ──────────────────────────────────────────────────

export interface IMarketingOAuthConnection {
  platform: MarketingPlatformId;
  connected: boolean;
  /** Token expired/revoked server-side; connected but a fresh authorization is required. */
  needsReauth?: boolean;
  accountName?: string;
  accountId?: string;
  connectedAt?: string;
  expiresAt?: string;
  scopes?: string[];
  category: MarketingCategory;
  /** Tokens are encrypted and retained exclusively by the backend. */
}

