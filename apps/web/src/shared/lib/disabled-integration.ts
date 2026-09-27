/**
 * Helper shared by the external integrations whose backend is not wired yet
 * (Cloudflare R2, Stripe checkout, Clicksign, TikTok metrics, MusicChat,
 * Autentique disconnect). They all fail with the same standardized error:
 * `message` is the English technical diagnosis (logs), `userMessage` is the
 * PT-BR copy rendered through toUserMessage().
 */
import { DomainError } from "./errors";

export const INTEGRATION_DISABLED_CODE = "integration_disabled";

export class DisabledIntegrationError extends DomainError {
  readonly status = 503;

  /**
   * @param integration product name shown to the user (e.g. "Stripe").
   * @param reason      English technical reason; defaults to the backend not being configured.
   */
  constructor(integration: string, reason = "backend not configured") {
    super(`Integration ${integration} disabled: ${reason}.`, INTEGRATION_DISABLED_CODE, "warn", {
      userMessage: `A integração com ${integration} está indisponível no momento.`,
    });
    this.name = "DisabledIntegrationError";
  }
}

export function disabledIntegration(integration: string, reason?: string): never {
  throw new DisabledIntegrationError(integration, reason);
}
