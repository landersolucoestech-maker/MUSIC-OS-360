import type { PlatformEnvironment } from "../types";

/**
 * Admin panel ENV_BADGE pattern (originally in AdminSettings.tsx, where it was
 * declared without a consumer): badge color per provider environment.
 * Reused by the Stripe mode indicator (find-340abf0b / Gotcha #20).
 */
export const ENV_BADGE: Record<PlatformEnvironment, string> = {
  production: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sandbox: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  disabled: "bg-muted text-muted-foreground border-border",
};

/** Human-readable Stripe mode label per environment — never the raw enum in the UI. */
export const STRIPE_ENV_LABEL: Record<PlatformEnvironment, string> = {
  production: "Stripe em produção",
  sandbox: "Stripe em modo de teste (TEST MODE)",
  disabled: "Stripe desativado neste ambiente",
};
