import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { ExternalProviderStatus } from "@music-os-360/types";


/**
 * The badge now renders the governance enum (ExternalProviderStatus) instead
 * of the "connected"/"disconnected" pair. Reason: that boolean could not
 * distinguish "unavailable on the platform", "needs re-authentication" and "provider
 * error" — all three showed up as "Desconectado", which hid from the
 * user which action was needed.
 */
export type IntegrationConnectionStatus = ExternalProviderStatus;

export type IntegrationNoticeVariant = "warning" | "info" | "destructive";

export interface IntegrationNotice {
  id: string;
  label: string;
  tooltip?: string;
  variant?: IntegrationNoticeVariant;
}

interface IntegrationStatusBadgesProps {
  status: IntegrationConnectionStatus;
  notices?: IntegrationNotice[];
  testIdPrefix?: string;
}

const noticeBadgeVariant: Record<IntegrationNoticeVariant, BadgeVariant> = {
  warning: "warning",
  info: "info",
  destructive: "danger",
};

/** Presentation tone → design-system variant. */
/** Label/tone per tenant CONNECTION state (a dimension separate from policy). */
const CONNECTION_PRESENTATION: Record<ExternalProviderStatus, { label: string; variant: BadgeVariant }> = {
  [ExternalProviderStatus.CONNECTED]:               { label: 'Conectado',            variant: 'success' },
  [ExternalProviderStatus.AVAILABLE_NOT_CONNECTED]: { label: 'Não conectado',        variant: 'neutral' },
  [ExternalProviderStatus.REQUIRES_REAUTH]:         { label: 'Reconexão necessária', variant: 'warning' },
  [ExternalProviderStatus.PROVIDER_ERROR]:          { label: 'Erro no provedor',     variant: 'danger'  },
  [ExternalProviderStatus.DEPENDENCY_NOT_MET]:      { label: 'Indisponível',         variant: 'neutral' },
};

export function IntegrationStatusBadges({
  status,
  notices,
  testIdPrefix,
}: IntegrationStatusBadgesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {notices?.map((notice) => {
        const variant = notice.variant ?? "warning";
        const badge = (
          <Badge
            variant={noticeBadgeVariant[variant]}
            className="cursor-help"
            data-testid={
              testIdPrefix
                ? `${testIdPrefix}-notice-${notice.id}`
                : undefined
            }
          >
            {notice.label}
          </Badge>
        );

        if (!notice.tooltip) {
          return (
            <span key={notice.id} className="inline-flex">
              {badge}
            </span>
          );
        }

        return (
          <Tooltip key={notice.id}>
            <TooltipTrigger asChild>
              <span className="inline-flex">{badge}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {notice.tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Badge
        variant={CONNECTION_PRESENTATION[status].variant}
        data-testid={
          testIdPrefix ? `${testIdPrefix}-status` : undefined
        }
        data-status={status}
      >
        {CONNECTION_PRESENTATION[status].label}
      </Badge>
    </div>
  );
}
