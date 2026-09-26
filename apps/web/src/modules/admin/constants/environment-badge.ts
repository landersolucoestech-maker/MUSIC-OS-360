import type { PlatformEnvironment } from "../types";

/**
 * Padrão ENV_BADGE do Painel Admin (originalmente em AdminSettings.tsx, onde
 * estava declarado sem consumidor): cor do badge por ambiente de provedor.
 * Reutilizado pelo indicador de modo do Stripe (find-340abf0b / Gotcha #20).
 */
export const ENV_BADGE: Record<PlatformEnvironment, string> = {
  production: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sandbox: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  disabled: "bg-muted text-muted-foreground border-border",
};

/** Rótulo humano do modo Stripe por ambiente — nunca o enum cru na UI. */
export const STRIPE_ENV_LABEL: Record<PlatformEnvironment, string> = {
  production: "Stripe em produção",
  sandbox: "Stripe em modo de teste (TEST MODE)",
  disabled: "Stripe desativado neste ambiente",
};
