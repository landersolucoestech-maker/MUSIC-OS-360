import { CheckCircle2, Clock, XCircle, Eye, Send, AlertCircle, FileText, Webhook } from "lucide-react";
import type { DocumentLog, DocumentLogEvent } from "@/modules/contracts/types/document-types";

interface EventConfig {
  icon:  React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const EVENT_CONFIG: Record<DocumentLogEvent, EventConfig> = {
  created:            { icon: FileText,     label: "Documento criado",                 color: "text-info"    },
  template_applied:   { icon: FileText,     label: "Modelo aplicado",                  color: "text-info"    },
  sent_for_signature: { icon: Send,         label: "Enviado para assinatura",          color: "text-amber-600"  },
  signer_viewed:      { icon: Eye,          label: "Visualizado pelo signatário",      color: "text-primary"},
  signer_signed:      { icon: CheckCircle2, label: "Assinado",                         color: "text-green-600"  },
  signer_rejected:    { icon: XCircle,      label: "Rejeitado pelo signatário",        color: "text-destructive"                    },
  completed:          { icon: CheckCircle2, label: "Documento completamente assinado", color: "text-green-600"  },
  cancelled:          { icon: XCircle,      label: "Documento cancelado",              color: "text-destructive"                    },
  expired:            { icon: AlertCircle,  label: "Documento expirado",               color: "text-orange-600"},
  webhook_received:   { icon: Webhook,      label: "Webhook recebido",                 color: "text-muted-foreground"                      },
};

function TimelineEvent({ log, isLast }: { log: DocumentLog; isLast: boolean }) {
  const cfg  = EVENT_CONFIG[log.event] ?? EVENT_CONFIG.created;
  const Icon = cfg.icon;
  const date = new Date(log.created_at);
  const timeLabel =
    date.toLocaleDateString("pt-BR") +
    " às " +
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex gap-3" data-testid={`timeline-event-${log.id}`}>
      <div className="flex flex-col items-center">
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 border-current flex items-center justify-center bg-background ${cfg.color}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      <div className="pb-5 pt-0.5 min-h-[28px]">
        <p className={`text-sm font-medium leading-none ${cfg.color}`}>{cfg.label}</p>
        <p className="text-xs text-muted-foreground mt-1">{timeLabel}</p>
        {log.payload && Object.keys(log.payload).length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
            {Object.entries(log.payload)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

interface DocumentTimelineProps {
  logs: DocumentLog[];
  className?: string;
}

export function DocumentTimeline({ logs, className = "" }: DocumentTimelineProps) {
  if (logs.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2 ${className}`}
      >
        <Clock className="h-8 w-8 opacity-30" />
        <p>Nenhum evento registrado ainda.</p>
      </div>
    );
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className={className} data-testid="document-timeline">
      {sorted.map((log, idx) => (
        <TimelineEvent key={log.id} log={log} isLast={idx === sorted.length - 1} />
      ))}
    </div>
  );
}

