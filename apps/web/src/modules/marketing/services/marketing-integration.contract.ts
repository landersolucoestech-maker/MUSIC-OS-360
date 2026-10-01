/**
 * Marketing Module — Integration Contracts (future-facing abstractions)
 *
 * These interfaces define the boundary the marketing module expects from
 * external systems. They are intentionally NOT implemented here: no real
 * network calls and no fabricated "connected" state. When a backend/provider becomes
 * available, implement these contracts in an adapter and register it.
 *
 * This keeps the UI decoupled from any specific vendor and makes the module
 * ready to evolve without rewrites.
 */

import type { ContentChannel, ID, MarketingContent, MetricSnapshot } from "../types/marketing.types";

export type IntegrationProviderKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "google_ads"
  | "meta_ads"
  | "spotify_ads"
  | "tiktok_ads"
  | "crm"
  | "news_portal"
  | "storage"
  | "ai"
  | "digital_distribution"
  | "music_production"
  | "music_administration"
  | "communications"
  | "commercial";

export type IntegrationCategory = "social" | "ads" | "crm" | "content" | "storage" | "ai" | "internal";

export interface IntegrationDescriptor {
  key: IntegrationProviderKey;
  label: string;
  category: IntegrationCategory;
  /** Whether an adapter has been registered (always false until implemented). */
  available: boolean;
}

/** Publishing abstraction for social channels. */
export interface PublishingProvider {
  readonly key: IntegrationProviderKey;
  publish(content: MarketingContent): Promise<{ externalId: string }>;
  schedule(content: MarketingContent, at: string): Promise<{ externalId: string }>;
}

/** Paid-media abstraction for ad platforms. */
export interface AdsProvider {
  readonly key: IntegrationProviderKey;
  fetchMetrics(externalCampaignId: string): Promise<MetricSnapshot>;
}

/** Asset storage abstraction. */
export interface StorageProvider {
  readonly key: IntegrationProviderKey;
  upload(file: File): Promise<{ id: ID; url: string }>;
  remove(id: ID): Promise<void>;
}

/** AI assistance abstraction. */
export interface AiProvider {
  readonly key: IntegrationProviderKey;
  generate(prompt: string): Promise<string[]>;
}

/**
 * Static catalogue of integrations the module is designed to support.
 * `available: false` is honest: nothing is wired yet.
 */
export const INTEGRATION_CATALOGUE: IntegrationDescriptor[] = [
  { key: "instagram", label: "Instagram", category: "social", available: false },
  { key: "facebook", label: "Facebook", category: "social", available: false },
  { key: "tiktok", label: "TikTok", category: "social", available: false },
  { key: "youtube", label: "YouTube", category: "social", available: false },
  { key: "linkedin", label: "LinkedIn", category: "social", available: false },
  { key: "google_ads", label: "Google Ads", category: "ads", available: false },
  { key: "meta_ads", label: "Meta Ads", category: "ads", available: false },
  { key: "spotify_ads", label: "Spotify Ads", category: "ads", available: false },
  { key: "tiktok_ads", label: "TikTok Ads", category: "ads", available: false },
  { key: "crm", label: "CRM", category: "crm", available: false },
  { key: "news_portal", label: "Portal de Notícias", category: "content", available: false },
  { key: "storage", label: "Armazenamento", category: "storage", available: false },
  { key: "ai", label: "IA", category: "ai", available: false },
  { key: "digital_distribution", label: "Distribuição Digital", category: "internal", available: false },
  { key: "music_production", label: "Produção Musical", category: "internal", available: false },
  { key: "music_administration", label: "Administração Musical", category: "internal", available: false },
  { key: "communications", label: "Comunicação", category: "internal", available: false },
  { key: "commercial", label: "Comercial", category: "internal", available: false },
];

/** Maps a content channel to its publishing provider key, when one exists. */
export const CHANNEL_TO_PROVIDER: Partial<Record<ContentChannel, IntegrationProviderKey>> = {
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
  linkedin: "linkedin",
  reels: "instagram",
  stories: "instagram",
  shorts: "youtube",
  news_portal: "news_portal",
};
