/**
 * components/ClientIntegrationCard.tsx
 *
 * Card of a commercial integration in the tenant's catalog.
 *
 * Every decision comes from the backend (`reasonCode`, `canConnect`, `entitled`,
 * `eligiblePlans`). This component does NOT recompute policy — it only presents.
 *
 * States that must be unmistakably different:
 *   PLAN_NOT_INCLUDED → blocked by the plan, with an upgrade (it is a sale)
 *   COMING_SOON       → coming soon, no action (there is no product yet)
 * Collapsing the two would hide from the customer which path unlocks it.
 */

import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { IntegrationReasonCode } from "@music-os-360/types";
import {
  INTEGRATION_PRESENTATION,
  canOfferConnection,
  type ClientIntegration,
} from "@/modules/integrations/hooks/useExternalProviders";

const TONE_VARIANT: Record<string, BadgeVariant> = {
  success: "success",
  neutral: "neutral",
  warning: "warning",
  danger: "danger",
  info: "info",
};

interface Props {
  integration: ClientIntegration;
  /** Opens the provider's canonical connection surface, when it exists. */
  onConnect?: (slug: string) => void;
  /** Leads to the already existing upgrade/billing surface — never a new checkout. */
  onUpgrade?: () => void;
}

export function ClientIntegrationCard({ integration, onConnect, onUpgrade }: Props) {
  const p = INTEGRATION_PRESENTATION[integration.reasonCode];
  const showConnect = canOfferConnection(integration)
    && (p.action === "connect" || p.action === "reconnect");
  const lockedByPlan = integration.reasonCode === IntegrationReasonCode.PLAN_NOT_INCLUDED;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      data-testid={`client-integration-${integration.slug}`}
      data-reason={integration.reasonCode}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{integration.name}</p>
          {p.hint && <p className="text-xs text-muted-foreground mt-0.5">{p.hint}</p>}
        </div>
        <Badge
          variant={TONE_VARIANT[p.tone] ?? "neutral"}
          data-testid={`client-integration-${integration.slug}-status`}
        >
          {p.label}
        </Badge>
      </div>

      {/* Plan block: shows the REAL plans that include it, coming from the
          backend. No plan name is decided here. */}
      {lockedByPlan && (
        <div className="rounded-md bg-muted/50 p-3 space-y-2" data-testid={`client-integration-${integration.slug}-locked`}>
          {integration.eligiblePlans.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Disponível no{integration.eligiblePlans.length > 1 ? "s planos" : " plano"}:{" "}
              <span className="font-medium text-foreground">
                {integration.eligiblePlans.join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum plano ativo inclui esta integração no momento.
            </p>
          )}
          {onUpgrade && integration.eligiblePlans.length > 0 && (
            <Button size="sm" variant="outline" onClick={onUpgrade}
              data-testid={`client-integration-${integration.slug}-upgrade`}>
              Ver planos
            </Button>
          )}
        </div>
      )}

      {/* Connect only appears when the BACKEND authorizes connecting. Coming soon,
          unavailable and not-implemented never offer a working button. */}
      {showConnect && (
        <Button
          size="sm"
          onClick={() => onConnect?.(integration.slug)}
          data-testid={`client-integration-${integration.slug}-connect`}
        >
          {p.action === "reconnect" ? "Reconectar conta" : "Conectar conta"}
        </Button>
      )}

      {integration.canUse && (
        <p className="text-xs text-emerald-500" data-testid={`client-integration-${integration.slug}-ready`}>
          Pronta para uso
        </p>
      )}
    </div>
  );
}
