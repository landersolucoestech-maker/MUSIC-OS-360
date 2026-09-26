/**
 * integrations/adapters/signing.adapter.ts
 *
 * Digital signature adapter.
 *
 * RULE: the frontend NEVER calls external signature APIs directly and
 * NEVER simulates success. While the flow is not wired to the real backend
 * (/integrations/autentique), any call fails explicitly — same
 * pattern as unavailable.provider (storage/streaming).
 *
 * Usage:
 *   import { resolveSigningAdapter } from "@/modules/integrations/adapters/signing.adapter";
 *   const adapter = resolveSigningAdapter("autentique");
 */

import type { ISigningProvider } from "@/modules/integrations/dto";
import { UserFacingError } from "@/shared/lib/errors";

export type SigningProviderId = "autentique" | "clicksign" | "docusign";

function unavailable(provider: string): never {
  throw new UserFacingError(
    `Signing provider "${provider}" has no real frontend provider; use the real backend (/integrations/autentique) before calling this adapter`,
    "A assinatura digital por este provedor ainda não está disponível.",
  );
}

function createUnavailableSigningProvider(provider: SigningProviderId): ISigningProvider {
  return {
    createDocument: () => Promise.reject(unavailable(provider)),
    getDocument:    () => Promise.reject(unavailable(provider)),
    listDocuments:  () => Promise.reject(unavailable(provider)),
    cancelDocument: () => Promise.reject(unavailable(provider)),
    resendInvite:   () => Promise.reject(unavailable(provider)),
    handleWebhook:  () => Promise.reject(unavailable(provider)),
    verifyConnection: () => Promise.resolve(false),
  };
}

export function resolveSigningAdapter(provider: SigningProviderId = "autentique"): ISigningProvider {
  return createUnavailableSigningProvider(provider);
}

export const signingAdapter: ISigningProvider = createUnavailableSigningProvider("autentique");
