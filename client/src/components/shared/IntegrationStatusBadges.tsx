import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type IntegrationConnectionStatus = "conectado" | "desconectado";

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

const noticeVariantClasses: Record<IntegrationNoticeVariant, string> = {
  warning:
    "border-amber-500/60 text-amber-700 bg-amber-500/10 dark:text-amber-400",
  info: "border-blue-500/60 text-blue-700 bg-blue-500/10 dark:text-blue-400",
  destructive:
    "border-destructive/60 text-destructive bg-destructive/10",
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
            variant="outline"
            className={cn("cursor-help", noticeVariantClasses[variant])}
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
        variant="outline"
        className={
          status === "conectado"
            ? "text-green-600 border-green-600"
            : "text-muted-foreground"
        }
        data-testid={
          testIdPrefix ? `${testIdPrefix}-status` : undefined
        }
      >
        {status === "conectado" ? "Conectado" : "Desconectado"}
      </Badge>
    </div>
  );
}
