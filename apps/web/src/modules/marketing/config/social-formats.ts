/**
 * Marketing — Social Formats (single source of truth)
 *
 * THE single validation/rendering layer shared by the whole module. It maps
 * each supported publishing platform to the editorial content types it accepts
 * and describes how every Platform + Content Type combination must be previewed
 * (aspect ratio, accepted media, carousel behaviour, chrome).
 *
 * The "Content Type" is the ONLY source of truth for the publication format —
 * there is intentionally NO separate carousel toggle/switch/flag. Carousel
 * behaviour is derived exclusively from `spec.carousel` (type === "carrossel").
 *
 * Consumed by:
 *  - the content form / preview UI (Calendario.tsx)
 *  - the validation schema (forms/content-schema.ts) — frontend boundary
 *  - the data service (services/marketing.service.ts) — persistence boundary
 *
 * Frontend and backend MUST call into this module so the rules never diverge.
 */

import type { ContentChannel, ContentType } from "../types/marketing.types";

/** Platforms that can actually receive a publication. */
export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "threads";

export const PUBLISH_PLATFORM_VALUES: SocialPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "twitter",
  "threads",
];

export interface PlatformOption {
  value: SocialPlatform;
  label: string;
}

export const PUBLISH_PLATFORMS: PlatformOption[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "threads", label: "Threads" },
];

/** Short platform name used in preview headers (e.g. "X" instead of "X (Twitter)"). */
export const PREVIEW_PLATFORM_NAME: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
  threads: "Threads",
};

/** Aspect ratios used by the preview, mapped to Tailwind classes. */
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export const ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

/** Which media kinds a format editorially accepts. */
export type MediaAcceptance = "image" | "video" | "both";

/** Visual chrome family used by the preview renderer. */
export type PreviewChrome =
  | "ig-feed"
  | "ig-story"
  | "ig-reel"
  | "fb-feed"
  | "fb-story"
  | "fb-reel"
  | "tiktok"
  | "yt-video"
  | "yt-shorts"
  | "yt-post"
  | "x-feed"
  | "x-vertical"
  | "threads";

export interface FormatSpec {
  /** Stored content type (single source of truth). */
  type: ContentType;
  /** Human label shown in the type selector and preview header. */
  label: string;
  /** Preview aspect ratio. */
  aspect: AspectRatio;
  /** Whether this format is a carousel (multiple media + page navigation). */
  carousel: boolean;
  /** Editorial media acceptance. */
  media: MediaAcceptance;
  /** Whether multiple media files are allowed (carousel only). */
  multiple: boolean;
  /** Preview chrome family. */
  chrome: PreviewChrome;
}

/**
 * Per-platform ordered list of accepted formats. Order defines the default
 * (first item) selected when the platform changes.
 */
export const PLATFORM_FORMATS: Record<SocialPlatform, FormatSpec[]> = {
  instagram: [
    { type: "feed", label: "Feed", aspect: "1:1", carousel: false, media: "both", multiple: false, chrome: "ig-feed" },
    { type: "carrossel", label: "Carrossel", aspect: "1:1", carousel: true, media: "both", multiple: true, chrome: "ig-feed" },
    { type: "stories", label: "Stories", aspect: "9:16", carousel: false, media: "both", multiple: false, chrome: "ig-story" },
    { type: "reels", label: "Reels", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "ig-reel" },
  ],
  facebook: [
    { type: "feed", label: "Feed", aspect: "4:5", carousel: false, media: "both", multiple: false, chrome: "fb-feed" },
    { type: "carrossel", label: "Carrossel", aspect: "1:1", carousel: true, media: "both", multiple: true, chrome: "fb-feed" },
    { type: "stories", label: "Stories", aspect: "9:16", carousel: false, media: "both", multiple: false, chrome: "fb-story" },
    { type: "reels", label: "Reels", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "fb-reel" },
  ],
  tiktok: [
    { type: "reels", label: "Reels", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "tiktok" },
    { type: "stories", label: "Stories", aspect: "9:16", carousel: false, media: "both", multiple: false, chrome: "tiktok" },
  ],
  youtube: [
    { type: "video", label: "Vídeo", aspect: "16:9", carousel: false, media: "video", multiple: false, chrome: "yt-video" },
    { type: "shorts", label: "Shorts", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "yt-shorts" },
    { type: "post", label: "Post", aspect: "1:1", carousel: false, media: "both", multiple: false, chrome: "yt-post" },
  ],
  twitter: [
    { type: "post", label: "Post", aspect: "16:9", carousel: false, media: "both", multiple: false, chrome: "x-feed" },
    { type: "carrossel", label: "Carrossel", aspect: "1:1", carousel: true, media: "both", multiple: true, chrome: "x-feed" },
    { type: "reels", label: "Reels", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "x-vertical" },
    { type: "shorts", label: "Shorts", aspect: "9:16", carousel: false, media: "video", multiple: false, chrome: "x-vertical" },
    { type: "stories", label: "Stories", aspect: "9:16", carousel: false, media: "both", multiple: false, chrome: "x-vertical" },
  ],
  threads: [
    { type: "post", label: "Post", aspect: "1:1", carousel: false, media: "both", multiple: false, chrome: "threads" },
    { type: "carrossel", label: "Carrossel", aspect: "1:1", carousel: true, media: "both", multiple: true, chrome: "threads" },
  ],
};

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** True when `channel` is one of the supported publishing platforms. */
export function isPublishPlatform(channel: ContentChannel | string): channel is SocialPlatform {
  return (PUBLISH_PLATFORM_VALUES as string[]).includes(channel);
}

/** Ordered list of formats accepted by a platform. */
export function getPlatformFormats(platform: SocialPlatform): FormatSpec[] {
  return PLATFORM_FORMATS[platform] ?? [];
}

/** The format spec for a Platform + Content Type combination (if valid). */
export function getFormatSpec(
  platform: ContentChannel | string,
  type: ContentType | string,
): FormatSpec | undefined {
  if (!isPublishPlatform(platform)) return undefined;
  return PLATFORM_FORMATS[platform].find((spec) => spec.type === type);
}

/** Whether a Platform + Content Type combination is allowed. */
export function isValidPlatformType(
  platform: ContentChannel | string,
  type: ContentType | string,
): boolean {
  return getFormatSpec(platform, type) !== undefined;
}

/** Default content type for a platform (first accepted format). */
export function getDefaultType(platform: SocialPlatform): ContentType {
  return PLATFORM_FORMATS[platform][0]?.type ?? "post";
}

/**
 * Coerce a channel to a supported publishing platform, falling back to
 * Instagram for legacy/unknown channels so the editor always renders.
 */
export function normalizePlatform(channel: ContentChannel | string): SocialPlatform {
  return isPublishPlatform(channel) ? channel : "instagram";
}

/**
 * Ensure a content type is valid for the given platform; otherwise return the
 * platform's default type.
 */
export function ensureValidType(platform: SocialPlatform, type: ContentType | string): ContentType {
  return isValidPlatformType(platform, type) ? (type as ContentType) : getDefaultType(platform);
}

/** `accept` attribute for the file input, derived from media acceptance. */
export function acceptAttr(media: MediaAcceptance): string {
  if (media === "image") return "image/*";
  if (media === "video") return "video/*";
  return "image/*,video/*";
}

// ---------------------------------------------------------------------------
// Centralized validation (single rule layer for frontend + persistence)
// ---------------------------------------------------------------------------

export interface MediaRef {
  /** MIME-ish hint, e.g. "image/png", "video/mp4". */
  kind?: string;
}

/**
 * Validate a Platform + Content Type + media set against the format rules.
 * Returns a human-readable violation message, or `null` when valid.
 *
 * This is the ONE function both the form schema and the data service call, so
 * invalid combinations are rejected identically on every boundary.
 */
export function getFormatViolation(
  platform: ContentChannel | string,
  type: ContentType | string,
  media: MediaRef[] = [],
): string | null {
  const spec = getFormatSpec(platform, type);
  if (!spec) {
    return "Este tipo de conteúdo não está disponível para a plataforma selecionada.";
  }
  if (!spec.multiple && media.length > 1) {
    return "Este formato permite apenas uma mídia.";
  }
  if (spec.media === "video" && media.some((item) => (item.kind ?? "").startsWith("image/"))) {
    return "Este formato aceita apenas vídeo.";
  }
  if (spec.media === "image" && media.some((item) => (item.kind ?? "").startsWith("video/"))) {
    return "Este formato aceita apenas imagem.";
  }
  return null;
}
