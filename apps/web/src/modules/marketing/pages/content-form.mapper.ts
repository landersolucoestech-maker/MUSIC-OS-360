/**
 * Pure form <-> MarketingContent mapping for the Content Schedule modal
 * (Calendario.tsx). Extracted so it can be unit-tested without importing the
 * page component itself, which pulls in MainLayout/Supabase/auth-context and
 * other side-effecting modules real unit tests can't satisfy.
 */
import {
  ensureValidType,
  getDefaultType,
  getFormatSpec,
  normalizePlatform,
  type SocialPlatform,
} from "../config/social-formats";
import { defaultCreativeConfig, type CreativeConfig } from "../types/creative.types";
import type { ContentStatus, ContentType, MarketingContent, MarketingTarget } from "../types/marketing.types";

export type MediaItem = { url: string; name: string; kind: string; uploading?: boolean };

export type ContentFormValues = {
  title: string;
  targetType: MarketingTarget;
  targetName: string;
  /** Plataforma principal — dirige formato/preview/type. */
  channel: SocialPlatform;
  /** Every selected platform (multi-platform publishing). */
  channels: SocialPlatform[];
  type: ContentType;
  publishDate: string;
  publishTime: string;
  copy: string;
  campaignId: string;
  releaseId: string;
  notes: string;
  hashtags: string;
  location: string;
  status: ContentStatus;
  /** Integrated (corporate) account used to publish — company content only. */
  integratedAccountId: string;
  media: MediaItem[];
  creative: CreativeConfig;
};

/** Narrow, defensive check -- a malformed/legacy metadata.creative must never crash the modal. */
function isCreativeConfig(value: unknown): value is CreativeConfig {
  return !!value && typeof value === "object" && (value as { version?: unknown }).version === 1;
}

export function initialContentForm(content?: MarketingContent | null): ContentFormValues {
  // Context restricted to company/artist — legacy contents of another context become "artista".
  const targetType: MarketingTarget = content?.targetType === "empresa" ? "empresa" : "artista";
  // Selected platforms (multi-platform); the first one is the main one.
  const rawChannels = content?.channels?.length ? content.channels : [content?.channel ?? "instagram"];
  const channels = Array.from(new Set(rawChannels.map((c) => normalizePlatform(c))));
  const channel = channels[0] ?? "instagram";
  const type = ensureValidType(channel, content?.type ?? getDefaultType(channel));
  return {
    title: content?.title ?? "",
    targetType,
    targetName: content?.targetName ?? (targetType === "empresa" ? "Empresa" : ""),
    channel,
    channels,
    type,
    publishDate: content?.publishDate?.slice(0, 10) ?? "",
    publishTime: content?.publishTime ?? "",
    copy: content?.copy ?? "",
    campaignId: content?.campaignId ?? "none",
    releaseId: content?.releaseId ?? "none",
    notes: content?.notes ?? "",
    hashtags: "",
    location: "",
    status: content?.status ?? "agendado",
    integratedAccountId: "none",
    media: (content?.files ?? []).map((file) => ({
      url: file.url,
      name: file.name,
      kind: file.kind ?? "",
    })),
    // Legacy content has no metadata.creative yet -- opens in Simple mode
    // with a fresh default config, never auto-converted (section 16).
    creative: isCreativeConfig(content?.metadata?.creative) ? (content!.metadata!.creative as CreativeConfig) : defaultCreativeConfig(),
  };
}

export function toMarketingContentInput(
  values: ContentFormValues,
  current: MarketingContent | undefined,
): Omit<MarketingContent, "id" | "createdAt" | "updatedAt"> {
  const spec = getFormatSpec(values.channel, values.type);
  return {
    title: values.title.trim(),
    targetType: values.targetType,
    targetName: values.targetType === "empresa" ? "Empresa" : values.targetName.trim(),
    type: values.type,
    channel: values.channel,
    channels: values.channels,
    // Publishing rule: only company content can publish (via an integration).
    // Artist/music project content always stays "agendado" (internal scheduling only).
    status: values.targetType === "empresa" ? values.status : "agendado",
    approval: current?.approval ?? "pendente",
    publishDate: values.publishDate,
    publishTime: values.publishTime,
    owner: current?.owner ?? "Marketing",
    copy: values.copy.trim(),
    notes: [values.hashtags, values.location, values.notes].filter(Boolean).join("\n"),
    campaignId: values.campaignId === "none" ? undefined : values.campaignId,
    releaseId: values.releaseId === "none" ? undefined : values.releaseId,
    format: spec?.label ?? values.type,
    // Simple mode: media IS the publishable output, same as always. Template
    // mode: source slot media never becomes `files` directly (that would be
    // the exact "source media treated as publishable output" bug this model
    // exists to avoid) -- files stays whatever it already was until a real
    // render pipeline exists (see the finalize() guard blocking
    // scheduling/publishing on unrendered template content).
    files: values.creative.mode === "template"
      ? (current?.files ?? [])
      : values.media.map((item, index) => ({
          id: current?.files?.[index]?.id ?? `media-${Date.now()}-${index}`,
          name: item.name || "Mídia do conteúdo",
          url: item.url,
          kind: item.kind || "media",
        })),
    metadata: { ...(current?.metadata ?? {}), creative: values.creative },
  };
}
