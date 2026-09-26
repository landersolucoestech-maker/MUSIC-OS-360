/**
 * modules/integrations/hooks/index.ts
 *
 * Barrel of all integration hooks.
 *
 * Organization by category:
 *   - Storage           → useR2
 *   - Email             → useResend
 *   - Payments          → useStripe
 *   - Signing           → useAutentique
 *   - Streaming/Ads     → useSpotify, useYouTube, useTikTok,
 *                         useInstagram, useGoogleAds,
 *                         useDeezer, useAppleMusic, useSoundCloud
 *   - Rights            → useEcad, useUbc, useAbramus
 *   - Music Monitoring  → useACRCloud
 *   - Chat              → useChat
 */

// ─── Storage ──────────────────────────────────────────────────────────────────
export * from "./useR2";

// ─── Email ────────────────────────────────────────────────────────────────────
export * from "./useResend";

// ─── Payments ─────────────────────────────────────────────────────────────────
export * from "./useStripe";

// ─── Signing ──────────────────────────────────────────────────────────────────
export * from "./useAutentique";

// ─── Streaming & Ads ──────────────────────────────────────────────────────────
export * from "./useSpotify";
export * from "./useYouTube";
export * from "./useTikTok";
export * from "./useInstagram";
export * from "./useGoogleAds";
export * from "./useDeezer";
export * from "./useAppleMusic";
export * from "./useSoundCloud";

// ─── Rights (ECAD · UBC · ABRAMUS) ───────────────────────────────────────────
export * from "./useEcad";
export * from "./useUbc";
export * from "./useAbramus";

// ─── Music Monitoring (ACRCloud) ──────────────────────────────────────────────
export * from "./useACRCloud";

// ─── Marketing Digital (OAuth unificado) ─────────────────────────────────────
export * from "./useMarketingOAuth";

// ─── Chat ─────────────────────────────────────────────────────────────────────
export * from "./useChat";
