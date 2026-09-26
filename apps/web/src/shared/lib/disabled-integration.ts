/**
 * Helper shared by the external integrations (Spotify, YouTube,
 * Apple Music, Deezer, SoundCloud, ABRAMUS, Autentique, Resend, Creative
 * AI, Meta Ads). All these integrations return the same
 * standardized error while the replacement backend is not configured.
 * The UI renders "Integração desativada — backend não configurado".
 */

export const INTEGRATION_DISABLED_CODE = "integration_disabled";

export class DisabledIntegrationError extends Error {
  status: number;
  code: string;
  constructor(name: string) {
    super(
      `Integração ${name} desativada — backend não configurado. ` +
        `Conecte um backend ao app para reativá-la.`,
    );
    this.name = "DisabledIntegrationError";
    this.code = INTEGRATION_DISABLED_CODE;
    this.status = 503;
  }
}

export function disabledIntegration(name: string): never {
  throw new DisabledIntegrationError(name);
}
