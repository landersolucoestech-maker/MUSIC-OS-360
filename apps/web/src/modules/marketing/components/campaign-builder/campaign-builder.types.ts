import type { ContentChannel, MarketingTarget } from "../../types/marketing.types";

export type CampaignObjective = "REACH" | "TRAFFIC" | "ENGAGEMENT" | "CONVERSIONS";

export type CampaignExpectedOutcome =
  | "REACH"
  | "BRAND_AWARENESS"
  | "VIDEO_VIEWS"
  | "LINK_CLICKS"
  | "LANDING_PAGE_VIEWS"
  | "WEBSITE_VISITS"
  | "SMART_LINK_CLICKS"
  | "WHATSAPP_CLICKS"
  | "PROFILE_VISITS"
  | "POST_ENGAGEMENT"
  | "MESSAGES"
  | "COMMENTS"
  | "SHARES"
  | "FOLLOWERS"
  | "VIDEO_ENGAGEMENT"
  | "LEADS"
  | "SALES"
  | "PRE_SAVE"
  | "STREAMS"
  | "SIGNUPS"
  | "DOWNLOADS"
  | "WHATSAPP_CONTACT"
  | "FORM_SUBMISSION";

export type CampaignPhase = "pre_lancamento" | "lancamento" | "sustentacao" | "catalogo";
export type PromotedEntityType =
  | "ARTIST"
  | "MUSIC_PROJECT"
  | "RELEASE"
  | "TRACK"
  | "EP"
  | "ALBUM"
  | "VIDEO"
  | "EVENT"
  | "PRODUCT"
  | "SERVICE"
  | "BRAND"
  | "COMPANY"
  | "INSTITUTIONAL"
  | "OTHER";

export type CampaignPlatform = "META_ADS" | "GOOGLE_ADS" | "YOUTUBE_ADS" | "TIKTOK_ADS" | "SPOTIFY_ADS";

export type CampaignPlacement =
  | "META_FEED"
  | "META_STORIES"
  | "META_REELS"
  | "META_EXPLORE"
  | "META_CAROUSEL"
  | "GOOGLE_SEARCH"
  | "GOOGLE_DISPLAY"
  | "GOOGLE_DISCOVERY"
  | "YOUTUBE_IN_STREAM"
  | "YOUTUBE_SHORTS"
  | "YOUTUBE_SEARCH"
  | "YOUTUBE_DISCOVERY"
  | "TIKTOK_FOR_YOU"
  | "TIKTOK_SEARCH"
  | "TIKTOK_PROFILE_FEED"
  | "SPOTIFY_AUDIO"
  | "SPOTIFY_VIDEO"
  | "SPOTIFY_HOMEPAGE"
  | "SPOTIFY_OVERLAY";

export type CreativeType = "imagem" | "video" | "carrossel" | "audio" | "texto";

export type CreativeStatus = "rascunho" | "pendente_revisao" | "aprovado" | "reprovado";

export interface CampaignAudience {
  countries: string;
  locations: string;
  ageMin: number;
  ageMax: number;
  gender: string;
  interests: string;
  language: string;
  coldAudience: boolean;
  lookalike: boolean;
  remarketing: boolean;
  exclusions: string;
  /** Geo-radius targeting (interactive map). */
  geoLat?: number;
  geoLng?: number;
  geoRadiusKm?: number;
}

export interface CampaignCreative {
  id: string;
  /** Source content, when the creative was generated from an existing content. */
  contentId?: string;
  name: string;
  platform: CampaignPlatform;
  placement: CampaignPlacement;
  type: CreativeType;
  fileName: string;
  fileSizeMb: number;
  /** Transient object URL of the uploaded file (preview only). */
  previewUrl?: string;
  /** MIME type of the uploaded file (drives image/video preview). */
  mimeType?: string;
  ratio: string;
  durationSeconds?: number;
  primaryCopy: string;
  headline: string;
  description: string;
  cta: string;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  status: CreativeStatus;
}

export interface CampaignBudget {
  totalBudget: number;
  dailyBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  strategy: "menor_custo" | "limite_custo" | "custo_alvo";
  platformSplit: Partial<Record<CampaignPlatform, number>>;
}

export interface CampaignValidationIssue {
  id: string;
  step: number;
  severity: "error" | "warning";
  message: string;
}

export interface CampaignBuilderState {
  objective: CampaignObjective;
  expectedOutcome: CampaignExpectedOutcome | "";
  /** Campaign context — exclusively company or artist. */
  context: MarketingTarget;
  /** Publishing (social) platforms — multiple selection. */
  publishChannels: ContentChannel[];
  name: string;
  artist: string;
  release: string;
  project: string;
  /** Published content selected for promotion (content-driven flow). */
  contentId: string;
  promotedEntityType: PromotedEntityType;
  promotedEntityId: string;
  promotedEntityName: string;
  destinationUrl: string;
  owner: string;
  phase: CampaignPhase;
  internalDescription: string;
  tags: string;
  audience: CampaignAudience;
  platforms: CampaignPlatform[];
  placements: CampaignPlacement[];
  creatives: CampaignCreative[];
  budget: CampaignBudget;
}

export interface BuilderStepProps {
  state: CampaignBuilderState;
  setState: (updater: (current: CampaignBuilderState) => CampaignBuilderState) => void;
}

export const PLATFORM_TO_CHANNEL: Record<CampaignPlatform, ContentChannel> = {
  META_ADS: "facebook",
  GOOGLE_ADS: "material_publicitario",
  YOUTUBE_ADS: "youtube",
  TIKTOK_ADS: "tiktok",
  SPOTIFY_ADS: "podcast",
};
