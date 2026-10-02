/**
 * modules/integrations/hooks/index.ts
 *
 * Barrel of all integration hooks.
 *
 * Organization by category:
 *   - Email             → useResend
 *   - Signing           → useAutentique
 *   - Streaming/Ads     → useTikTok, useGoogleAds, useDeezer
 *   - Rights            → useEcad, useUbc, useAbramus
 *   - Music Monitoring  → useACRCloud
 */

// ─── Email ────────────────────────────────────────────────────────────────────
export * from "./useResend";

// ─── Signing ──────────────────────────────────────────────────────────────────
export * from "./useAutentique";

// ─── Streaming & Ads ──────────────────────────────────────────────────────────
export * from "./useTikTok";
export * from "./useGoogleAds";
export * from "./useDeezer";

// ─── Rights (ECAD · UBC · ABRAMUS) ───────────────────────────────────────────
export * from "./useEcad";
export * from "./useUbc";
export * from "./useAbramus";

// ─── Music Monitoring (ACRCloud) ──────────────────────────────────────────────
export * from "./useACRCloud";

// ─── Digital marketing (unified OAuth) ───────────────────────────────────────
export * from "./useMarketingOAuth";
