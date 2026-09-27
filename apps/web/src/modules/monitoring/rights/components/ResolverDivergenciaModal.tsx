import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/shared/ui/dialog";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Hash, Radio, Tag, Calendar, BookOpen, Gauge, History } from "lucide-react";
import type { Divergencia, DivergenciaSeverity } from "./DivergenciasPanel";
import { formatRightsDate } from "../utils/date-format";

const SEVERITY: Record<DivergenciaSeverity, { label: string; variant: BadgeVariant }> = {
  critica: { label: "Crítica", variant: "danger" },
  alta:    { label: "Alta",    variant: "warning" },
  media:   { label: "Média",   variant: "warning" },
  baixa:   { label: "Baixa",   variant: "neutral" },
};

const STATUS: Record<Divergencia["status"], { label: string; variant: BadgeVariant }> = {
  aberta:       { label: "Aberta",       variant: "warning" },
  em_resolucao: { label: "Em Resolução", variant: "info" },
  resolvida:    { label: "Resolvida",    variant: "success" },
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
  divergencia: Divergencia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (updated: Divergencia) => void;
}

export function ResolverDivergenciaModal({ divergencia, open, onOpenChange, onSubmit }: Props) {
  const [notes, setNotes] = useState("");

  // Repopulate when opening/switching the discrepancy
  useEffect(() => {
    if (open) setNotes(divergencia?.observacoes ?? "");
  }, [open, divergencia]);

  if (!divergencia) return null;

  const sev = SEVERITY[divergencia.severity];
  const st = STATUS[divergencia.status];
  const criadaEm = divergencia.data_criacao ?? divergencia.data;

  const aplicar = (newStatus: Divergencia["status"], acao: string) => {
    const data = today();
    const history = [
      ...(divergencia.historico ?? []),
      { data, acao, por: "Você" },
    ];
    const updated: Divergencia = {
      ...divergencia,
      status: newStatus,
      observacoes: notes.trim() || undefined,
      data_resolucao: newStatus === "resolvida" ? data : undefined,
      historico: history,
    };
    onSubmit(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-resolver-divergencia">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">Resolver Divergência</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{divergencia.type}</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-4">
          {/* Identification */}
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Row icon={<Tag className="h-3.5 w-3.5" />} label="Tipo" value={divergencia.type} />
              <Row icon={<Gauge className="h-3.5 w-3.5" />} label="Severidade / Risco" value={
                <div className="flex items-center gap-2">
                  <Badge variant={sev.variant}>{sev.label}</Badge>
                  <Badge variant="neutral">Risco {divergencia.risco_score}/100</Badge>
                </div>
              } />
              <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Status" value={<Badge variant={st.variant}>{st.label}</Badge>} />
              <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Detectada em" value={formatRightsDate(criadaEm)} />
            </div>
          </div>

          {/* Related data */}
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">Dados relacionados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              {divergencia.obra && <Row icon={<BookOpen className="h-3.5 w-3.5" />} label="Obra" value={divergencia.obra} />}
              {divergencia.isrc && <Row icon={<Hash className="h-3.5 w-3.5" />} label="ISRC" value={divergencia.isrc} />}
              {divergencia.origem && <Row icon={<Radio className="h-3.5 w-3.5" />} label="Origem da execução" value={divergencia.origem} />}
              <Row className="sm:col-span-2" icon={<Tag className="h-3.5 w-3.5" />} label="Descrição" value={<span className="font-normal text-muted-foreground">{divergencia.descricao}</span>} />
            </div>
          </div>

          {/* History (when present) */}
          {divergencia.historico && divergencia.historico.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </p>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1.5">
                {divergencia.historico.map((h, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-sans">{formatRightsDate(h.data)}</span>
                    <span className="text-foreground">{h.acao}</span>
                    {h.por && <span>· {h.por}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handling */}
          <div className="space-y-1.5">
            <Label htmlFor="div-observacoes" className="text-xs font-semibold tracking-wide text-muted-foreground">
              Observações
            </Label>
            <Textarea
              id="div-observacoes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registre o tratamento, decisões ou contexto da resolução…"
              className="min-h-[80px] text-sm"
              data-testid="textarea-observacoes-divergencia"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-fechar-resolver">
            Fechar
          </Button>
          {divergencia.status !== "aberta" && (
            <Button variant="outline" onClick={() => aplicar("aberta", "Divergência reaberta")} data-testid="button-reabrir-divergencia">
              Reabrir
            </Button>
          )}
          <Button variant="outline" onClick={() => aplicar("resolvida", "Marcada como ignorada")} data-testid="button-ignorar-divergencia">
            Ignorar
          </Button>
          <Button onClick={() => aplicar("resolvida", "Marcada como resolvida")} data-testid="button-resolver-divergencia">
            Marcar como resolvida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
