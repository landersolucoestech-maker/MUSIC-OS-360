/**
 * shared/integrations/registry.ts
 *
 * Central registry of every MUSIC OS 360 integration.
 * Single source of truth for integration metadata.
 *
 * Usage:
 *   import { INTEGRATION_REGISTRY, getIntegration, getIntegrationsByCategory }
 *     from "@/shared/integrations/registry";
 */

import type { IntegrationCategory, IntegrationId, IntegrationMeta } from "./types";

// ─── Registry ─────────────────────────────────────────────────────────────────

export const INTEGRATION_REGISTRY: Record<IntegrationId, IntegrationMeta> = {
  // ── Storage ───────────────────────────────────────────────────────────────
  r2: {
    id: "r2",
    name: "Cloudflare R2",
    category: "storage",
    description: "Armazenamento de arquivos de áudio, capas, contratos e materiais de marketing.",
    logoId: "r2",
    docsUrl: "https://developers.cloudflare.com/r2",
    credentialsKey: "musicos360_r2_credentials",
  },

  // ── Email ─────────────────────────────────────────────────────────────────
  resend: {
    id: "resend",
    name: "Resend",
    category: "email",
    description: "Envio transaccional de e-mails: convites, alertas de contrato, recebimentos externos de direitos e relatórios.",
    logoId: "resend",
    docsUrl: "https://resend.com/docs",
    credentialsKey: "musicos360_resend_credentials",
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  stripe: {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    description: "Gestão de assinaturas, cobrança por workspace e processamento de pagamentos.",
    logoId: "stripe",
    docsUrl: "https://stripe.com/docs",
    credentialsKey: "musicos360_stripe_credentials",
  },

  // ── Signing ───────────────────────────────────────────────────────────────
  autentique: {
    id: "autentique",
    name: "Autentique",
    category: "signing",
    description: "Assinatura digital de contratos com validade jurídica no Brasil.",
    logoId: "autentique",
    docsUrl: "https://docs.autentique.com.br",
    credentialsKey: "musicos360_autentique_credentials",
  },
  clicksign: {
    id: "clicksign",
    name: "Clicksign",
    category: "signing",
    description: "Assinatura eletrônica brasileira com validade jurídica.",
    logoId: "clicksign",
    docsUrl: "https://developers.clicksign.com",
    credentialsKey: "musicos360_clicksign_credentials",
  },
  docusign: {
    id: "docusign",
    name: "DocuSign",
    category: "signing",
    description: "Assinatura digital e gestão de envelopes e acordos.",
    logoId: "docusign",
    docsUrl: "https://developers.docusign.com",
    credentialsKey: "musicos360_docusign_credentials",
  },

  // ── Monitoring ────────────────────────────────────────────────────────────
  posthog: {
    id: "posthog",
    name: "PostHog",
    category: "monitoring",
    description: "Análise de produto: chaves de funcionalidade, funis, gravações de sessão e testes A/B.",
    docsUrl: "https://posthog.com/docs",
    credentialsKey: "musicos360_posthog_credentials",
  },
  sentry: {
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    description: "Monitoramento de erros e performance em tempo real.",
    docsUrl: "https://docs.sentry.io",
    credentialsKey: "musicos360_sentry_credentials",
  },

  // ── Streaming / metrics ───────────────────────────────────────────────────
  spotify: {
    id: "spotify",
    name: "Spotify for Artists",
    category: "streaming",
    description: "Métricas de streams, ouvintes únicos, análise demográfica e campanhas de Marquee.",
    logoId: "spotify_ads",
    docsUrl: "https://artists.spotify.com",
    credentialsKey: "musicos360_spotify_credentials",
  },
  youtube: {
    id: "youtube",
    name: "YouTube Analytics",
    category: "streaming",
    description: "Métricas de visualizações, retenção, receita e gestão de claims via Content ID.",
    docsUrl: "https://developers.google.com/youtube/analytics",
    credentialsKey: "musicos360_youtube_credentials",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok for Business",
    category: "streaming",
    description: "Métricas de vídeos, sons virais e campanhas de TikTok Ads.",
    logoId: "tiktok_business",
    docsUrl: "https://ads.tiktok.com/help",
    credentialsKey: "musicos360_tiktok_credentials",
  },
  instagram: {
    id: "instagram",
    name: "Instagram Insights",
    category: "streaming",
    description: "Métricas de Reels, Stories, alcance e engagement via Graph API.",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    credentialsKey: "musicos360_instagram_credentials",
  },
  "google-ads": {
    id: "google-ads",
    name: "Google Ads",
    category: "streaming",
    description: "Campanhas de YouTube Ads, Display e Search para promoção de lançamentos.",
    logoId: "google_business",
    docsUrl: "https://ads.google.com/home",
    credentialsKey: "musicos360_google_ads_credentials",
  },
  meta_business: {
    id: "meta_business",
    name: "Meta Business Suite",
    category: "marketing",
    description: "Facebook, Instagram e Meta Ads da conta corporativa.",
    logoId: "meta_business",
    docsUrl: "https://business.facebook.com",
    credentialsKey: "musicos360_meta_business_credentials",
  },
  tiktok_business: {
    id: "tiktok_business",
    name: "TikTok Business",
    category: "marketing",
    description: "TikTok for Business, analytics e campanhas corporativas.",
    logoId: "tiktok_business",
    docsUrl: "https://business.tiktok.com",
    credentialsKey: "musicos360_tiktok_business_credentials",
  },
  google_business: {
    id: "google_business",
    name: "Google & YouTube",
    category: "marketing",
    description: "Google Analytics, Ads, Search Console e YouTube corporativo.",
    logoId: "google_business",
    docsUrl: "https://business.google.com",
    credentialsKey: "musicos360_google_business_credentials",
  },
  spotify_ads: {
    id: "spotify_ads",
    name: "Spotify Ad Studio",
    category: "marketing",
    description: "Campanhas de áudio e display no Spotify.",
    logoId: "spotify_ads",
    docsUrl: "https://ads.spotify.com",
    credentialsKey: "musicos360_spotify_ads_credentials",
  },
  deezer: {
    id: "deezer",
    name: "Deezer",
    category: "streaming",
    description: "Métricas de streams, favoritos e tendências no mercado brasileiro e francês.",
    docsUrl: "https://developers.deezer.com",
    credentialsKey: "musicos360_deezer_credentials",
  },
  "apple-music": {
    id: "apple-music",
    name: "Apple Music for Artists",
    category: "streaming",
    description: "Métricas de streams, Shazams, playlists editoriais e descoberta.",
    docsUrl: "https://artists.apple.com",
    credentialsKey: "musicos360_apple_music_credentials",
  },
  soundcloud: {
    id: "soundcloud",
    name: "SoundCloud",
    category: "streaming",
    description: "Métricas de reproduções, republicações, seguidores e integração com SoundCloud for Artists.",
    docsUrl: "https://developers.soundcloud.com",
    credentialsKey: "musicos360_soundcloud_credentials",
  },

  // ── Rights / collection ───────────────────────────────────────────────────
  ecad: {
    id: "ecad",
    name: "ECAD",
    category: "rights",
    description: "Consulta e conciliação de arrecadação de direitos de execução pública (ECAD).",
    logoId: "ecad",
    docsUrl: "https://www.ecad.org.br",
    credentialsKey: "musicos360_ecad_credentials",
  },
  ubc: {
    id: "ubc",
    name: "UBC",
    category: "rights",
    description: "Gestão de obras e distribuição de direitos via União Brasileira de Compositores.",
    logoId: "ubc",
    docsUrl: "https://www.ubc.org.br",
    credentialsKey: "musicos360_ubc_credentials",
  },
  abramus: {
    id: "abramus",
    name: "ABRAMUS",
    category: "rights",
    description: "Registro e conciliação de obras e fonogramas via ABRAMUS (simulação funcional).",
    logoId: "abramus",
    docsUrl: "https://www.abramus.org.br",
    credentialsKey: "musicos360_abramus_credentials",
  },

  // ── Digital distribution ─────────────────────────────────────────────────
  onerpm: {
    id: "onerpm",
    name: "ONErpm",
    category: "distribution",
    description: "Distribuição global e analytics para artistas e selos.",
    logoId: "onerpm",
  },
  distrokid: {
    id: "distrokid",
    name: "DistroKid",
    category: "distribution",
    description: "Distribuição digital para plataformas de streaming.",
    logoId: "distrokid",
  },
  symphonic: {
    id: "symphonic",
    name: "Symphonic",
    category: "distribution",
    description: "Distribuição e marketing para artistas independentes.",
    logoId: "symphonic",
  },
  soundon: {
    id: "soundon",
    name: "SoundOn",
    category: "distribution",
    description: "Distribuição e monetização musical do ecossistema TikTok.",
    logoId: "soundon",
  },
  somvibe: {
    id: "somvibe",
    name: "SomVibe",
    category: "distribution",
    description: "Distribuidora brasileira independente.",
    logoId: "somvibe",
  },
  musicpro: {
    id: "musicpro",
    name: "MusicPro",
    category: "distribution",
    description: "Distribuição profissional com suporte dedicado.",
    logoId: "musicpro",
  },

  // ── Fiscal ───────────────────────────────────────────────────────────────
  nfe: {
    id: "nfe",
    name: "NF-e",
    category: "fiscal",
    description: "Emissão de Nota Fiscal Eletrônica via provedor fiscal.",
    logoId: "nfe",
    credentialsKey: "musicos360_nfe_credentials",
  },

  // ── Music Monitoring (ACRCloud) ───────────────────────────────────────────
  acrcloud: {
    id: "acrcloud",
    name: "ACRCloud",
    category: "music-monitoring",
    description: "Reconhecimento de áudio e monitoramento de uso não autorizado.",
    docsUrl: "https://www.acrcloud.com/docs",
    credentialsKey: "musicos360_acrcloud_credentials",
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  chat: {
    id: "chat",
    name: "MusicChat",
    category: "chat",
    description: "Comunicação interna entre membros do time: mensagens, canais e notificações.",
    credentialsKey: "musicos360_chat_credentials",
  },
  musicroomchat: {
    id: "musicroomchat",
    name: "MusicRoom Chat",
    category: "chat",
    description: "Canal de chat de sala musical — discussões por projeto, artista e lançamento.",
    credentialsKey: "musicos360_musicroomchat_credentials",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns an integration's metadata by id. */
export function getIntegration(id: IntegrationId): IntegrationMeta {
  return INTEGRATION_REGISTRY[id];
}

/** Returns every integration of a category. */
export function getIntegrationsByCategory(category: IntegrationCategory): IntegrationMeta[] {
  return Object.values(INTEGRATION_REGISTRY).filter((i) => i.category === category);
}

/** Returns every registered integration. */
export function getAllIntegrations(): IntegrationMeta[] {
  return Object.values(INTEGRATION_REGISTRY);
}

/** Returns every unique category present in the registry. */
export function getAllCategories(): IntegrationCategory[] {
  const set = new Set<IntegrationCategory>();
  for (const meta of Object.values(INTEGRATION_REGISTRY)) set.add(meta.category);
  return Array.from(set);
}

/**
 * Builds the localStorage key for an integration's credentials.
 * Convention: `musicos360_<id>_credentials`
 */
export function credentialsStorageKey(id: IntegrationId): string {
  return `musicos360_${id.replace("-", "_")}_credentials`;
}

