/**
 * shared/integrations/contracts/streaming.contract.ts
 *
 * Streaming and digital advertising metrics contract.
 *
 * Covered platforms:
 *   Streaming: Spotify · YouTube · TikTok · Instagram · Deezer · Apple Music · SoundCloud
 *   Ads:       Google Ads · Meta Ads (already in marketing/adapters/meta-ads.adapter.ts)
 *
 * CURRENT STATE: standalone — metrics are MOCK_DATA.
 * FUTURE MIGRATION: each platform implements IStreamingProvider with its own API.
 *
 * RULE: the Analytics module uses IStreamingProvider for company-level metrics.
 *       The Artist module uses IStreamingProvider filtered by artist (360 view modal).
 *       No component calls streaming APIs directly.
 */

// ─── Platform identifiers ─────────────────────────────────────────────────────

export type StreamingPlatformId =
  | "spotify"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "deezer"
  | "apple-music"
  | "soundcloud";

export type AdsPlatformId =
  | "google-ads"
  | "meta-ads";

// ─── Metrics DTOs ─────────────────────────────────────────────────────────────

export type MetricsPeriod = "7d" | "28d" | "30d" | "90d" | "365d" | "all";

export interface MetricsDateRange {
  from: string;  // ISO 8601
  to: string;    // ISO 8601
}

/** Time series of a single indicator */
export interface MetricTimeSeries {
  date: string;
  value: number;
}

/** Metrics of a work/phonogram on a platform */
export interface TrackMetrics {
  isrc: string;
  platform: StreamingPlatformId;
  streams: number;
  saves?: number;
  playlist_adds?: number;
  skip_rate?: number;
  completion_rate?: number;
  /** Time series of daily streams */
  daily_streams?: MetricTimeSeries[];
}

/** Overall metrics of an artist on a platform */
export interface ArtistMetrics {
  artist_id: string;
  platform: StreamingPlatformId;
  period: MetricsPeriod | MetricsDateRange;
  monthly_listeners?: number;
  followers?: number;
  total_streams: number;
  top_tracks: TrackMetrics[];
  /** Geographic distribution of streams per country */
  geo_breakdown?: Array<{ country: string; streams: number; pct: number }>;
  /** Monthly listeners trend */
  listener_trend?: MetricTimeSeries[];
}

/** Video content metrics (YouTube, TikTok) */
export interface VideoMetrics {
  video_id: string;
  platform: "youtube" | "tiktok";
  views: number;
  likes?: number;
  comments?: number;
  shares?: number;
  watch_time_hours?: number;
  avg_view_duration_seconds?: number;
  /** Estimated revenue in cents (available only on YouTube) */
  estimated_revenue_cents?: number;
}

/** Social content metrics (Instagram, TikTok) */
export interface SocialMetrics {
  account_id: string;
  platform: "instagram" | "tiktok";
  period: MetricsPeriod;
  reach: number;
  impressions: number;
  profile_visits?: number;
  followers: number;
  followers_gained: number;
  engagement_rate: number;
  top_posts: Array<{
    post_id: string;
    type: "reel" | "post" | "story" | "video";
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    plays?: number;
  }>;
}

// ─── Ad campaign DTOs ─────────────────────────────────────────────────────────

export interface AdCampaign {
  campaign_id: string;
  platform: AdsPlatformId;
  name: string;
  status: "active" | "paused" | "ended" | "draft";
  budget_daily_cents: number;
  spend_total_cents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents: number;
  conversions?: number;
  started_at: string;
  ended_at?: string | null;
}

// ─── Streaming contract ───────────────────────────────────────────────────────

/**
 * IStreamingProvider — per-platform streaming metrics contract.
 *
 * Planned implementations (one per platform):
 *   - MockStreamingProvider        (standalone — MOCK_DATA)
 *   - SpotifyStreamingProvider     (Spotify for Artists API)
 *   - YouTubeStreamingProvider     (YouTube Analytics API v2)
 *   - TikTokStreamingProvider      (TikTok for Business API)
 *   - InstagramStreamingProvider   (Instagram Graph API)
 *   - DeezerStreamingProvider      (Deezer API)
 *   - AppleMusicStreamingProvider  (Apple Music for Artists API)
 *   - SoundCloudStreamingProvider  (SoundCloud API v2)
 */
export interface IStreamingProvider {
  readonly platform: StreamingPlatformId;

  /** An artist's metrics for the period */
  getArtistMetrics(
    artistId: string,
    period: MetricsPeriod | MetricsDateRange
  ): Promise<ArtistMetrics>;

  /** A work/phonogram's metrics by ISRC */
  getTrackMetrics(
    isrc: string,
    period: MetricsPeriod | MetricsDateRange
  ): Promise<TrackMetrics>;

  /** Video metrics (YouTube / TikTok) */
  getVideoMetrics?(
    videoId: string,
    period: MetricsPeriod | MetricsDateRange
  ): Promise<VideoMetrics>;

  /** Social metrics (Instagram / TikTok) */
  getSocialMetrics?(
    accountId: string,
    period: MetricsPeriod
  ): Promise<SocialMetrics>;

  /** Checks whether the configured credentials are valid */
  verifyConnection(): Promise<boolean>;
}

// ─── Ads contract ─────────────────────────────────────────────────────────────

/**
 * IAdsProvider — digital advertising campaigns contract.
 *
 * Planned implementations:
 *   - MockAdsProvider       (standalone — MOCK_DATA)
 *   - GoogleAdsProvider     (Google Ads API)
 *   - MetaAdsProvider       (Meta Marketing API — already in marketing/hooks/useMetaAds.ts)
 */
export interface IAdsProvider {
  readonly platform: AdsPlatformId;

  listCampaigns(params?: { status?: AdCampaign["status"] }): Promise<AdCampaign[]>;
  getCampaign(campaignId: string): Promise<AdCampaign>;

  verifyConnection(): Promise<boolean>;
}

// ─── Platform metadata ────────────────────────────────────────────────────────

export interface StreamingPlatformMeta {
  id: StreamingPlatformId;
  name: string;
  color: string;
  /** Main metric key shown on the cards */
  primaryMetric: "streams" | "views" | "plays" | "listeners";
  /** Base profile URL used to build artist links */
  profileBaseUrl: string;
}

export const STREAMING_PLATFORMS: Record<StreamingPlatformId, StreamingPlatformMeta> = {
  spotify: {
    id: "spotify",
    name: "Spotify",
    color: "#1DB954",
    primaryMetric: "streams",
    profileBaseUrl: "https://open.spotify.com/artist/",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    primaryMetric: "views",
    profileBaseUrl: "https://youtube.com/channel/",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    color: "#010101",
    primaryMetric: "plays",
    profileBaseUrl: "https://www.tiktok.com/@",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    primaryMetric: "plays",
    profileBaseUrl: "https://instagram.com/",
  },
  deezer: {
    id: "deezer",
    name: "Deezer",
    color: "#FF0092",
    primaryMetric: "streams",
    profileBaseUrl: "https://www.deezer.com/artist/",
  },
  "apple-music": {
    id: "apple-music",
    name: "Apple Music",
    color: "#FC3C44",
    primaryMetric: "plays",
    profileBaseUrl: "https://music.apple.com/artist/",
  },
  soundcloud: {
    id: "soundcloud",
    name: "SoundCloud",
    color: "#FF5500",
    primaryMetric: "plays",
    profileBaseUrl: "https://soundcloud.com/",
  },
};

