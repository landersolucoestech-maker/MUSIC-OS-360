import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/shared/ui/dialog";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Hash, Radio, Tag, Calendar, BookOpen, Gauge, History } from "lucide-react";
import { divergenceTypeLabel, type Divergence, type DivergenceSeverity } from "./DivergencesPanel";
import { formatRightsDate } from "../utils/date-format";

const SEVERITY: Record<DivergenceSeverity, { label: string; variant: BadgeVariant }> = {
  critical: { label: "Crítica", variant: "danger" },
  high:    { label: "Alta",    variant: "warning" },
  medium:   { label: "Média",   variant: "warning" },
  low:   { label: "Baixa",   variant: "neutral" },
};

const STATUS: Record<Divergence["status"], { label: string; variant: BadgeVariant }> = {
  open:       { label: "Aberta",       variant: "warning" },
  in_resolution: { label: "Em Resolução", variant: "info" },
  resolved:    { label: "Resolvida",    variant: "success" },
};

const today = () => new Date().toISOString().split("T")[0];

function Row({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2.5 ${className}`}>
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

interface Props {
  divergence: Divergence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (updated: Divergence) => void;
}

export function ResolveDivergenceModal({ divergence, open, onOpenChange, onSubmit }: Props) {
  const [notes, setNotes] = useState("");

  // Repopulate when opening/switching the discrepancy
  useEffect(() => {
    if (open) setNotes(divergence?.notes ?? "");
  }, [open, divergence]);

  if (!divergence) return null;

  const sev = SEVERITY[divergence.severity];
  const st = STATUS[divergence.status];
  const createdAt = divergence.created_at ?? divergence.date;

  const apply = (newStatus: Divergence["status"], action: string) => {
    const date = today();
    const history = [
      ...(divergence.history ?? []),
      { date, action, by: "Você" },
    ];
    const updated: Divergence = {
      ...divergence,
      status: newStatus,
      notes: notes.trim() || undefined,
      resolved_at: newStatus === "resolved" ? date : undefined,
      history,
    };
    onSubmit(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-resolve-divergence">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">Resolver Divergência</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{divergenceTypeLabel(divergence.type)}</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-4">
          {/* Identification */}
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Row icon={<Tag className="h-3.5 w-3.5" />} label="Tipo" value={divergenceTypeLabel(divergence.type)} />
              <Row icon={<Gauge className="h-3.5 w-3.5" />} label="Severidade / Risco" value={
                <div className="flex items-center gap-2">
                  <Badge variant={sev.variant}>{sev.label}</Badge>
                  <Badge variant="neutral">Risco {divergence.risk_score}/100</Badge>
                </div>
              } />
              <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Status" value={<Badge variant={st.variant}>{st.label}</Badge>} />
              <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Detectada em" value={formatRightsDate(createdAt)} />
            </div>
          </div>

          {/* Related data */}
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">Dados relacionados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              {divergence.work && <Row icon={<BookOpen className="h-3.5 w-3.5" />} label="Obra" value={divergence.work} />}
              {divergence.isrc && <Row icon={<Hash className="h-3.5 w-3.5" />} label="ISRC" value={divergence.isrc} />}
              {divergence.origin && <Row icon={<Radio className="h-3.5 w-3.5" />} label="Origem da execução" value={divergence.origin} />}
              <Row className="sm:col-span-2" icon={<Tag className="h-3.5 w-3.5" />} label="Descrição" value={<span className="font-normal text-muted-foreground">{divergence.description}</span>} />
            </div>
          </div>

          {/* History (when present) */}
          {divergence.history && divergence.history.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </p>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1.5">
                {divergence.history.map((h, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-sans">{formatRightsDate(h.date)}</span>
                    <span className="text-foreground">{h.action}</span>
                    {h.by && <span>· {h.by}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handling */}
          <div className="space-y-1.5">
            <Label htmlFor="div-notes" className="text-xs font-semibold tracking-wide text-muted-foreground">
              Observações
            </Label>
            <Textarea
              id="div-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registre o tratamento, decisões ou contexto da resolução…"
              className="min-h-[80px] text-sm"
              data-testid="textarea-divergence-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-resolve">
            Fechar
          </Button>
          {divergence.status !== "open" && (
            <Button variant="outline" onClick={() => apply("open", "Divergência reaberta")} data-testid="button-reopen-divergence">
              Reabrir
            </Button>
          )}
          <Button variant="outline" onClick={() => apply("resolved", "Marcada como ignorada")} data-testid="button-ignore-divergence">
            Ignorar
          </Button>
          <Button onClick={() => apply("resolved", "Marcada como resolvida")} data-testid="button-resolve-divergence">
            Marcar como resolvida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
