import type { CreateInput, MarketingCampaign } from "../../types/marketing.types";
import type {
  CampaignBuilderState,
  CampaignCreative,
  CampaignExpectedOutcome,
  CampaignObjective,
  CampaignPlacement,
  CampaignPlatform,
  CampaignValidationIssue,
  PromotedEntityType,
} from "./campaign-builder.types";

export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  REACH: "Alcance",
  TRAFFIC: "Tráfego",
  ENGAGEMENT: "Engajamento",
  CONVERSIONS: "Conversões",
};

export const OBJECTIVE_DESCRIPTION: Record<CampaignObjective, string> = {
  REACH: "Aumentar a exposição da campanha para o maior número possível de pessoas.",
  TRAFFIC: "Levar pessoas para um site, landing page, smart link ou canal externo.",
  ENGAGEMENT: "Gerar curtidas, comentários, mensagens, compartilhamentos e interações.",
  CONVERSIONS: "Gerar vendas, inscrições, cadastros, pré-saves ou outras ações específicas.",
};

export const EXPECTED_OUTCOME_LABEL: Record<CampaignExpectedOutcome, string> = {
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento de marca",
  VIDEO_VIEWS: "Visualizações de vídeo",
  LINK_CLICKS: "Cliques no link",
  LANDING_PAGE_VIEWS: "Visualizações da landing page",
  WEBSITE_VISITS: "Visitas ao site",
  SMART_LINK_CLICKS: "Cliques no smart link",
  WHATSAPP_CLICKS: "Cliques no WhatsApp",
  PROFILE_VISITS: "Visitas ao perfil",
  POST_ENGAGEMENT: "Engajamento em post",
  MESSAGES: "Mensagens",
  COMMENTS: "Comentários",
  SHARES: "Compartilhamentos",
  FOLLOWERS: "Seguidores",
  VIDEO_ENGAGEMENT: "Engajamento em vídeo",
  LEADS: "Leads",
  SALES: "Vendas",
  PRE_SAVE: "Pré-save",
  STREAMS: "Streams",
  SIGNUPS: "Inscrições",
  DOWNLOADS: "Downloads",
  WHATSAPP_CONTACT: "Contato via WhatsApp",
  FORM_SUBMISSION: "Envio de formulário",
};

export const OUTCOMES_BY_OBJECTIVE: Record<CampaignObjective, CampaignExpectedOutcome[]> = {
  REACH: ["REACH", "BRAND_AWARENESS", "VIDEO_VIEWS"],
  TRAFFIC: ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "WEBSITE_VISITS", "SMART_LINK_CLICKS", "WHATSAPP_CLICKS", "PROFILE_VISITS"],
  ENGAGEMENT: ["POST_ENGAGEMENT", "MESSAGES", "COMMENTS", "SHARES", "FOLLOWERS", "VIDEO_ENGAGEMENT"],
  CONVERSIONS: ["LEADS", "SALES", "PRE_SAVE", "STREAMS", "SIGNUPS", "DOWNLOADS", "WHATSAPP_CONTACT", "FORM_SUBMISSION"],
};

export const PROMOTED_ENTITY_LABEL: Record<PromotedEntityType, string> = {
  ARTIST: "Artista",
  MUSIC_PROJECT: "Projeto musical",
  RELEASE: "Lançamento",
  TRACK: "Faixa",
  EP: "EP",
  ALBUM: "Álbum",
  VIDEO: "Vídeo",
  EVENT: "Evento",
  PRODUCT: "Produto",
  SERVICE: "Serviço",
  BRAND: "Marca",
  COMPANY: "Empresa",
  INSTITUTIONAL: "Institucional",
  OTHER: "Outro",
};

export const PLATFORM_LABEL: Record<CampaignPlatform, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  YOUTUBE_ADS: "YouTube Ads",
  TIKTOK_ADS: "TikTok Ads",
  SPOTIFY_ADS: "Spotify Ads",
};

export const PLACEMENT_LABEL: Record<CampaignPlacement, string> = {
  META_FEED: "Feed",
  META_STORIES: "Stories",
  META_REELS: "Reels",
  META_EXPLORE: "Explore",
  META_CAROUSEL: "Carrossel",
  GOOGLE_SEARCH: "Search",
  GOOGLE_DISPLAY: "Display",
  GOOGLE_DISCOVERY: "Discovery",
  YOUTUBE_IN_STREAM: "In-stream",
  YOUTUBE_SHORTS: "Shorts",
  YOUTUBE_SEARCH: "Search",
  YOUTUBE_DISCOVERY: "Discovery",
  TIKTOK_FOR_YOU: "For You",
  TIKTOK_SEARCH: "Search",
  TIKTOK_PROFILE_FEED: "Profile feed",
  SPOTIFY_AUDIO: "Audio",
  SPOTIFY_VIDEO: "Vídeo",
  SPOTIFY_HOMEPAGE: "Homepage",
  SPOTIFY_OVERLAY: "Overlay",
};

export const PLATFORMS_BY_OBJECTIVE: Record<CampaignObjective, CampaignPlatform[]> = {
  REACH: ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"],
  TRAFFIC: ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"],
  ENGAGEMENT: ["META_ADS", "YOUTUBE_ADS", "TIKTOK_ADS"],
  CONVERSIONS: ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"],
};

export const PLACEMENTS_BY_PLATFORM: Record<CampaignPlatform, CampaignPlacement[]> = {
  META_ADS: ["META_FEED", "META_STORIES", "META_REELS", "META_EXPLORE", "META_CAROUSEL"],
  GOOGLE_ADS: ["GOOGLE_SEARCH", "GOOGLE_DISPLAY", "GOOGLE_DISCOVERY", "YOUTUBE_IN_STREAM"],
  YOUTUBE_ADS: ["YOUTUBE_IN_STREAM", "YOUTUBE_SHORTS", "YOUTUBE_SEARCH", "YOUTUBE_DISCOVERY"],
  TIKTOK_ADS: ["TIKTOK_FOR_YOU", "TIKTOK_SEARCH", "TIKTOK_PROFILE_FEED"],
  SPOTIFY_ADS: ["SPOTIFY_AUDIO", "SPOTIFY_VIDEO", "SPOTIFY_HOMEPAGE", "SPOTIFY_OVERLAY"],
};

export const ALL_OBJECTIVES = Object.keys(OBJECTIVE_LABEL) as CampaignObjective[];

/**
 * Curated, de-duplicated list shown in "O que será promovido?". The full label
 * map is kept for backward compatibility, but redundant items (TRACK/EP/ALBUM/
 * VIDEO → consolidated into Lançamento/Projeto; BRAND/INSTITUTIONAL → Empresa/
 * Outro) are no longer offered, to avoid ambiguity.
 */
export const ALL_PROMOTED_ENTITY_TYPES: PromotedEntityType[] = [
  "ARTIST",
  "MUSIC_PROJECT",
  "RELEASE",
  "EVENT",
  "PRODUCT",
  "SERVICE",
  "COMPANY",
  "OTHER",
];

function normalizeCampaignObjective(value?: string): CampaignObjective {
  if (value && value in OBJECTIVE_LABEL) return value as CampaignObjective;
  if (["alcance", "awareness", "visualizacao_video", "visualizacoes"].includes(value ?? "")) return "REACH";
  if (["trafego", "TRAFFIC"].includes(value ?? "")) return "TRAFFIC";
  if (["engajamento", "seguidores", "crescimento_seguidores", "remarketing"].includes(value ?? "")) return "ENGAGEMENT";
  if (["conversao", "conversoes", "pre_save", "captacao_leads"].includes(value ?? "")) return "CONVERSIONS";
  return "TRAFFIC";
}

export function createDefaultCampaignState(campaign?: MarketingCampaign | null): CampaignBuilderState {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const objective = normalizeCampaignObjective(campaign?.objective);
  return {
    objective,
    expectedOutcome: OUTCOMES_BY_OBJECTIVE[objective][0],
    // Contexto restrito a Empresa/Artista (campanhas legadas de outro contexto viram "empresa").
    context: campaign?.targetType === "artista" ? "artista" : "empresa",
    // Plataformas de publicação selecionadas — preserva todas ao reabrir/editar.
    publishChannels: campaign?.platforms ?? [],
    name: campaign?.name ?? "",
    artist: campaign?.owner ?? "",
    release: "",
    project: campaign?.projectId ?? "",
    contentId: campaign?.contentIds?.[0] ?? "",
    promotedEntityType: "COMPANY",
    promotedEntityId: campaign?.targetId ?? "",
    promotedEntityName: campaign?.targetName ?? campaign?.owner ?? "",
    destinationUrl: "",
    owner: campaign?.owner ?? "Marketing",
    phase: "lancamento",
    internalDescription: campaign?.notes ?? "",
    tags: "",
    audience: {
      countries: "Brasil",
      locations: "",
      ageMin: 18,
      ageMax: 34,
      gender: "todos",
      interests: "",
      language: "pt-BR",
      coldAudience: true,
      lookalike: false,
      remarketing: false,
      exclusions: "",
    },
    platforms: [],
    placements: [],
    creatives: [],
    budget: {
      totalBudget: campaign?.budget ?? 500,
      dailyBudget: campaign ? Math.max(10, Math.round(campaign.budget / 14)) : 35,
      currency: "BRL",
      startDate: campaign?.startDate ?? today,
      endDate: campaign?.endDate ?? end.toISOString().slice(0, 10),
      strategy: "menor_custo",
      platformSplit: {},
    },
  };
}

export function getRequiredPlacements(platforms: CampaignPlatform[]): CampaignPlacement[] {
  // De-duplica: posicionamentos compartilhados (ex.: YOUTUBE_IN_STREAM em Google e
  // YouTube Ads) devem aparecer uma única vez.
  return Array.from(new Set(platforms.flatMap((platform) => PLACEMENTS_BY_PLATFORM[platform])));
}

/** Plataforma dona do posicionamento, derivada do prefixo do valor. */
export function placementPlatform(placement: CampaignPlacement): CampaignPlatform {
  if (placement.startsWith("TIKTOK")) return "TIKTOK_ADS";
  if (placement.startsWith("YOUTUBE")) return "YOUTUBE_ADS";
  if (placement.startsWith("GOOGLE")) return "GOOGLE_ADS";
  if (placement.startsWith("SPOTIFY")) return "SPOTIFY_ADS";
  return "META_ADS";
}

export function expectedRatio(placement: CampaignPlacement) {
  if (placement.includes("STORIES") || placement.includes("REELS") || placement.includes("SHORTS") || placement.includes("TIKTOK")) return "9:16";
  if (placement.includes("IN_STREAM") || placement.includes("VIDEO")) return "16:9";
  if (placement.includes("DISPLAY")) return "1:1";
  if (placement.includes("AUDIO") || placement.includes("SEARCH")) return "n/a";
  return "1:1";
}

export function validateCreativeForPlacement(creative: CampaignCreative): CampaignValidationIssue[] {
  const issues: CampaignValidationIssue[] = [];
  const ratio = expectedRatio(creative.placement);
  if (!creative.fileName && creative.type !== "texto") issues.push({ id: `${creative.id}-file`, step: 7, severity: "error", message: `${creative.name}: arquivo obrigatório.` });
  if (ratio !== "n/a" && creative.ratio && creative.ratio !== ratio) issues.push({ id: `${creative.id}-ratio`, step: 9, severity: "warning", message: `${creative.name}: proporção enviada ${creative.ratio}, esperada ${ratio}.` });
  if (!creative.cta) issues.push({ id: `${creative.id}-cta`, step: 7, severity: "error", message: `${creative.name}: CTA obrigatório.` });
  if (creative.fileSizeMb > 500) issues.push({ id: `${creative.id}-size`, step: 7, severity: "error", message: `${creative.name}: arquivo acima do limite.` });
  return issues;
}

export function validateCampaignStep(state: CampaignBuilderState, step: number): CampaignValidationIssue[] {
  const issues: CampaignValidationIssue[] = [];
  const compatibleOutcomes = OUTCOMES_BY_OBJECTIVE[state.objective];
  if (step >= 1 && !state.objective) issues.push({ id: "objective", step: 1, severity: "error", message: "Selecione um objetivo." });
  if (step >= 2 && (!state.expectedOutcome || !compatibleOutcomes.includes(state.expectedOutcome))) issues.push({ id: "outcome", step: 2, severity: "error", message: "Selecione um resultado compatível com o objetivo." });
  if (step >= 3 && !state.name.trim()) issues.push({ id: "name", step: 3, severity: "error", message: "Nome da campanha obrigatório." });
  if (step >= 3 && !state.promotedEntityName.trim()) issues.push({ id: "entity", step: 3, severity: "error", message: "Informe a entidade promovida." });
  if (step >= 3 && state.publishChannels.length === 0) issues.push({ id: "publish-channels", step: 3, severity: "error", message: "Selecione ao menos uma plataforma de publicação." });
  if (step >= 3 && ["TRAFFIC", "CONVERSIONS"].includes(state.objective) && !state.destinationUrl.trim()) issues.push({ id: "url", step: 3, severity: "error", message: "URL de destino obrigatória para tráfego/conversões." });
  if (step >= 5 && state.platforms.length === 0) issues.push({ id: "platforms", step: 5, severity: "error", message: "Selecione ao menos uma plataforma." });
  if (step >= 6 && state.placements.length === 0) issues.push({ id: "placements", step: 6, severity: "error", message: "Selecione ao menos um posicionamento." });
  if (step >= 7 && state.placements.some((placement) => !state.creatives.some((creative) => creative.placement === placement))) issues.push({ id: "creative-missing", step: 7, severity: "error", message: "Cada posicionamento precisa de um criativo." });
  if (step >= 8 && state.budget.totalBudget <= 0) issues.push({ id: "budget", step: 8, severity: "error", message: "Informe orçamento para a campanha." });
  if (step >= 8 && new Date(state.budget.endDate) <= new Date(state.budget.startDate)) issues.push({ id: "period", step: 8, severity: "error", message: "Período inválido." });
  state.creatives.forEach((creative) => issues.push(...validateCreativeForPlacement(creative)));
  return issues;
}

export function buildUtmUrl(creative: CampaignCreative) {
  if (!creative.destinationUrl) return "";
  const url = new URL(creative.destinationUrl, "https://example.com");
  if (creative.utmSource) url.searchParams.set("utm_source", creative.utmSource);
  if (creative.utmMedium) url.searchParams.set("utm_medium", creative.utmMedium);
  if (creative.utmCampaign) url.searchParams.set("utm_campaign", creative.utmCampaign);
  if (creative.utmContent) url.searchParams.set("utm_content", creative.utmContent);
  return creative.destinationUrl.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
}

export function estimateCampaignResults(state: CampaignBuilderState) {
  const budget = state.budget.totalBudget;
  return {
    reach: Math.round(budget * 85),
    clicks: Math.round(budget * 2.8),
    conversions: Math.round(budget * 0.18),
    costPerResult: budget > 0 ? Math.max(0.5, budget / Math.max(1, Math.round(budget * 0.18))) : 0,
  };
}

export function toMarketingCampaignInput(state: CampaignBuilderState): CreateInput<MarketingCampaign> {
  const estimate = estimateCampaignResults(state);
  const promotedEntityName = state.promotedEntityName || state.artist || "Empresa";
  return {
    name: state.name,
    // Contexto explícito (Empresa/Artista) — não derivado de promotedEntityType.
    targetType: state.context,
    targetId: state.promotedEntityId || undefined,
    targetName: promotedEntityName,
    type: state.promotedEntityType === "RELEASE" || state.promotedEntityType === "TRACK" ? "lancamento_musical" : "trafego_pago",
    objective: state.objective,
    audience: `${state.audience.countries}; ${state.audience.locations}; ${state.audience.ageMin}-${state.audience.ageMax}; ${state.audience.interests}`,
    segmentation: JSON.stringify(state.audience),
    budget: state.budget.totalBudget,
    startDate: state.budget.startDate,
    endDate: state.budget.endDate,
    // Plataformas de publicação (sociais) selecionadas pelo usuário — multiplataforma.
    platforms: state.publishChannels,
    status: "rascunho",
    owner: state.owner || state.artist || "Marketing",
    projectId: state.project || undefined,
    creativeAssetIds: state.creatives.map((creative) => creative.id),
    // Conteúdos vinculados à campanha: o selecionado em Dados + os usados como criativos.
    contentIds: Array.from(
      new Set([state.contentId, ...state.creatives.map((creative) => creative.contentId)].filter(Boolean)),
    ) as string[],
    metrics: {
      reach: estimate.reach,
      impressions: estimate.reach * 2,
      engagement: Math.round(estimate.reach * 0.06),
      clicks: estimate.clicks,
      conversions: estimate.conversions,
      roi: 0,
      costPerResult: estimate.costPerResult,
      // CODEBASE_MAP Gotcha #16: always true here -- publish() never calls a real
      // ad-platform integration, so this is the only kind of metrics this flow can
      // ever produce. See Campanhas.tsx for how it's disclosed to the user.
      isEstimated: true,
    },
    notes: JSON.stringify({
      expectedOutcome: state.expectedOutcome,
      promotedEntityType: state.promotedEntityType,
      promotedEntityId: state.promotedEntityId,
      promotedEntityName,
      destinationUrl: state.destinationUrl,
      phase: state.phase,
      description: state.internalDescription,
      tags: state.tags,
      creatives: state.creatives,
      placements: state.placements,
      budget: state.budget,
    }),
  };
}

