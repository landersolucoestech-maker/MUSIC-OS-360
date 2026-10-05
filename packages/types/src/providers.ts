/**
 * Provider / platform identifier vocabularies. Persisted values are kept exactly
 * as stored today; each vocabulary keeps its own case convention.
 */

/** OAuth integration providers (snake_case, lowercase) accepted by POST /integrations/oauth/init. */
export const INTEGRATION_PROVIDER_IDS = [
  "corp_instagram", "meta_business", "meta_ads",
  "corp_tiktok", "tiktok_business", "tiktok_ads",
  "corp_youtube", "youtube_business", "google_business", "google_ads", "youtube_ads",
  "spotify_ads", "corp_spotify",
  "docusign", "stripe_connect",
] as const;
export type IntegrationProviderId = (typeof INTEGRATION_PROVIDER_IDS)[number];

/** Providers served by the generic OAuth exchange (the Spotify ids use the dedicated Spotify flow). */
export const GENERIC_OAUTH_PROVIDER_IDS = INTEGRATION_PROVIDER_IDS.filter(
  (id) => id !== "spotify_ads" && id !== "corp_spotify",
) as readonly IntegrationProviderId[];

/** Social platforms an artist profile can be synced from (kebab-case, as stored in artist_platform_profiles.platform). */
export const SOCIAL_PLATFORM_IDS = [
  "spotify", "youtube", "deezer", "soundcloud", "instagram", "tiktok", "apple-music",
] as const;
export type SocialPlatformId = (typeof SOCIAL_PLATFORM_IDS)[number];

/** Paid-media platforms of the campaign builder (UPPERCASE, as persisted in the campaign payload). */
export const CAMPAIGN_AD_PLATFORMS = ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"] as const;
export type CampaignAdPlatform = (typeof CAMPAIGN_AD_PLATFORMS)[number];

/** Campaign ad platform -> integration provider that connects its ad account. Total over CampaignAdPlatform. */
export const AD_PLATFORM_TO_PROVIDER_ID: Readonly<Record<CampaignAdPlatform, IntegrationProviderId>> = {
  META_ADS: "meta_ads",
  GOOGLE_ADS: "google_ads",
  YOUTUBE_ADS: "youtube_ads",
  TIKTOK_ADS: "tiktok_ads",
  SPOTIFY_ADS: "spotify_ads",
};
