/**
 * modules/integrations/hooks/useExternalProviders.ts
 *
 * Commercial catalog resolved for THIS tenant (GET /integrations/providers).
 *
 * The BACKEND is the source of truth: it composes administrative governance +
 * technical capability + VIEW/USE audience + plan entitlement + connection, and
 * returns only what the customer can DISCOVER. Internal integrations
 * (Soundcharts/ACRCloud/Resend) and billing (Stripe) are excluded by
 * classification in the resolver — never by a frontend filter.
 *
 * Rule: always branch on `reasonCode`/flags (enum), never on human text.
 */

import { useQuery } from "@tanstack/react-query";
import {
  ExternalProviderStatus,
  IntegrationClassification,
  IntegrationPublicationState,
  IntegrationTechnicalState,
  IntegrationReasonCode,
} from "@music-os-360/types";
import { api } from "@/shared/lib/api-client";

/** Mirrors the resolver's client-safe payload 1:1 — no administrative fields. */
export interface ClientIntegration {
  slug: string;
  name: string;
  category: string | null;
  classification: IntegrationClassification;
  publicationState: IntegrationPublicationState;
  technicalState: IntegrationTechnicalState;
  connectionKind: "oauth" | "tenant_credentials" | "platform_credentials";
  /** The tenant's plan includes this integration. */
  entitled: boolean;
  /** Can start connection/OAuth — does not require being connected already. */
  canConnect: boolean;
  /** Can actually operate (requires a valid connection). */
  canUse: boolean;
  connectionState: ExternalProviderStatus;
  reasonCode: IntegrationReasonCode;
  /** Plans that include the slug — discovered in the backend, never hardcoded. */
  eligiblePlans: string[];
}

const EMPTY: ClientIntegration[] = [];

/** How each state must be presented. Derived from the enum, never a source of logic. */
export interface IntegrationPresentation {
  label: string;
  tone: "success" | "neutral" | "warning" | "danger" | "info";
  /** Primary action offered to the customer, if any. */
  action: "connect" | "reconnect" | "manage" | "upgrade" | "none";
  hint?: string;
}

/**
 * PLAN_NOT_INCLUDED and COMING_SOON are deliberately distinct in label, tone
 * and action: "blocked by the plan" is a sale (upgrade), "coming soon" is the absence of a
 * product. Collapsing them into a single state hides the difference from the customer.
 */
export const INTEGRATION_PRESENTATION: Record<IntegrationReasonCode, IntegrationPresentation> = {
  [IntegrationReasonCode.CONNECTED]: {
    label: "Conectado", tone: "success", action: "manage",
  },
  [IntegrationReasonCode.NOT_CONNECTED]: {
    label: "Incluído no seu plano", tone: "info", action: "connect",
    hint: "Conecte sua conta para começar a usar.",
  },
  [IntegrationReasonCode.PLAN_NOT_INCLUDED]: {
    label: "Bloqueado pelo plano", tone: "warning", action: "upgrade",
    hint: "Esta integração não está incluída no seu plano atual.",
  },
  [IntegrationReasonCode.COMING_SOON]: {
    label: "Em breve", tone: "neutral", action: "none",
    hint: "Estamos preparando esta integração.",
  },
  [IntegrationReasonCode.TEMPORARILY_UNAVAILABLE]: {
    label: "Temporariamente indisponível", tone: "warning", action: "none",
    hint: "Esta integração está fora do ar no momento.",
  },
  [IntegrationReasonCode.REQUIRES_REAUTH]: {
    label: "Reconexão necessária", tone: "warning", action: "reconnect",
    hint: "A autorização expirou ou foi revogada.",
  },
  [IntegrationReasonCode.PROVIDER_ERROR]: {
    label: "Erro no provedor", tone: "danger", action: "reconnect",
    hint: "A última comunicação com o provedor falhou.",
  },
  [IntegrationReasonCode.TECHNICAL_NOT_READY]: {
    label: "Ainda não operacional", tone: "neutral", action: "none",
  },
  [IntegrationReasonCode.NOT_IMPLEMENTED]: {
    label: "Ainda não disponível", tone: "neutral", action: "none",
  },
  [IntegrationReasonCode.AUDIENCE_NOT_ALLOWED]: {
    label: "Indisponível para esta conta", tone: "neutral", action: "none",
  },
  [IntegrationReasonCode.HIDDEN]: {
    label: "Indisponível", tone: "neutral", action: "none",
  },
  [IntegrationReasonCode.NOT_CUSTOMER_FACING]: {
    label: "Indisponível", tone: "neutral", action: "none",
  },
};

export function useExternalProviders() {
  const query = useQuery<ClientIntegration[]>({
    queryKey: ["integrations", "external-providers"],
    queryFn: () => api.get<ClientIntegration[]>("/integrations/providers"),
    staleTime: 30_000,
  });
  return { ...query, data: query.data ?? EMPTY };
}

/** Lookup by slug. Undefined = the backend did not resolve it for this customer. */
export function findProviderState(
  providers: ClientIntegration[],
  slug: string,
): ClientIntegration | undefined {
  return providers.find((p) => p.slug === slug);
}

/**
 * A connect button may only exist when the backend authorizes connecting AND the
 * provider has a real way to connect. Entitlement alone never creates a button.
 */
export function canOfferConnection(p: ClientIntegration): boolean {
  return p.canConnect && p.connectionKind !== "platform_credentials";
}
