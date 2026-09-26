/**
 * integrations/hooks/useSigningProviders.ts
 *
 * Aggregates the connection state of the digital signature providers
 * REALLY supported commercially by the product today.
 *
 * Autentique and DocuSign are selectable: both have a real end-to-end chain in the
 * backend (sending + webhook + status persistence). `connected`
 * reflects the real state of each one's credential/OAuth — a provider appears
 * as "Não conectado" until the integration is actually authorized, never
 * as connected in advance.
 *
 * Clicksign stays OUT: there is no backend in apps/api/src for it
 * (useClicksign.ts is an honest stub). Exposing a selectable provider without a
 * real adapter would fabricate functionality.
 *
 * 2026-08-23 CORRECTION of "Decision Gate item 13": the previous justification
 * said that "signing.adapter.ts always fails for all three" would prove that
 * Clicksign/DocuSign are not real. That does not hold — that adapter is a
 * deliberate frontend stub and fails ALSO for Autentique, which works
 * normally via the backend. The real state is:
 *   - DocuSign  — real OAuth already existed; the signature adapter was
 *                 implemented on 2026-08-23 (integrations/docusign/) and the
 *                 provider became selectable again.
 *   - Clicksign — a real UI exists (ClicksignConfigDialog + useClicksign), but
 *                 there is NO backend at all in apps/api/src. It stays out until it has a
 *                 real adapter. See docs/BACKLOG.md Group 1.
 *
 * Usage:
 *   const { data: providers } = useSigningProviders();
 */

import { useQuery } from "@tanstack/react-query";
import type { SigningProviderId } from "@/modules/integrations/services/signing.service";
import { useAutentiqueStatus } from "@/modules/integrations/hooks/useAutentique";
import { api } from "@/shared/lib/api-client";

export interface SigningProviderOption {
  id:          SigningProviderId;
  label:       string;
  description: string;
  connected:   boolean;
  logo:        string;
}

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_PROVIDERS: SigningProviderOption[] = [];

/** Real state of the DocuSign OAuth connection — never inferred, never fabricated. */
function useDocuSignStatus() {
  return useQuery<{ connected: boolean; needs_reauth?: boolean }>({
    queryKey: ["integrations", "docusign", "oauth-status"],
    queryFn: () =>
      api.get<{ connected: boolean; needs_reauth?: boolean }>(
        "/integrations/oauth/status?platform=docusign",
      ),
    staleTime: 30_000,
  });
}

export function useSigningProviders() {
  const { data: autentiqueStatus, isLoading: loadingAutentique } = useAutentiqueStatus();
  const { data: docusignStatus, isLoading: loadingDocusign } = useDocuSignStatus();

  const docusignConnected = (docusignStatus?.connected ?? false) && !docusignStatus?.needs_reauth;

  const providers: SigningProviderOption[] = [
    {
      id:          "autentique",
      label:       "Autentique",
      description: autentiqueStatus?.connected
        ? "Conectado"
        : (autentiqueStatus?.last_error ?? "Não conectado"),
      connected:   autentiqueStatus?.connected ?? false,
      logo:        "A",
    },
    {
      id:          "docusign",
      label:       "DocuSign",
      description: docusignConnected
        ? "Conectado"
        : docusignStatus?.needs_reauth
          ? "Reconexão necessária"
          : "Não conectado",
      connected:   docusignConnected,
      logo:        "D",
    },
  ];

  const query = useQuery<SigningProviderOption[]>({
    queryKey: [
      "integrations", "signing-providers",
      autentiqueStatus?.connected ?? false,
      docusignConnected,
    ],
    queryFn: async (): Promise<SigningProviderOption[]> => providers,
    enabled: !loadingAutentique && !loadingDocusign,
    staleTime: 0,
  });
  return { ...query, data: query.data ?? EMPTY_PROVIDERS };
}
