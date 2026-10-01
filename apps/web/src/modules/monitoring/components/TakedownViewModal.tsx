import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { AlertTriangle, Link2, Music, Calendar, FileText, ExternalLink } from "lucide-react";
import { formatTakedownDate, normalizeTakedown, statusBadge, typeBadge, priorityLabel } from "@/modules/monitoring/lib/takedown-format";
import type { Takedown } from "@/modules/monitoring/types/monitoring.types";
import { safeHref } from "@/shared/lib/safe-url";

interface TakedownViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  takedown?: Takedown;
}

function Field({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <span className="text-sm text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

export function TakedownViewModal({ open, onOpenChange, takedown }: TakedownViewModalProps) {
  if (!takedown) return null;

  const n = normalizeTakedown(takedown);
  const url = n.infringingUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Detalhes do Takedown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Takedown information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Informações do Takedown
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Título/Identificação" value={n.title} />
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="mt-1">{statusBadge(n.status)}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Tipo</span>
                <div className="mt-1">{typeBadge(n.type)}</div>
              </div>
              <Field label="Prioridade" value={priorityLabel(n.priority)} />
            </div>
          </div>

          {/* Work and artist */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Obra Afetada
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Obra" value={n.affectedWork} />
              <Field label="Artista" value={n.artistName} />
            </div>
          </div>

          {/* Platform and URL */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Plataforma e Localização
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <div className="mt-1">{n.platform ? <Badge variant="neutral">{n.platform}</Badge> : <span className="font-medium">—</span>}</div>
              </div>
              <Field label="Data de Identificação" icon={<Calendar className="h-3 w-3" />} value={formatTakedownDate(n.identifiedAt)} />
            </div>
            {url && (
              <div>
                <span className="text-sm text-muted-foreground">URL do Conteúdo Infrator</span>
                <a
                  href={safeHref(/^https?:\/\//i.test(url) ? url : `https://${url}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline font-medium break-all"
                >
                  {url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
          </div>

          {/* Reason and description */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Motivo e Descrição
            </h3>
            <Field label="Motivo" value={n.reason} />
            {n.description && (
              <div>
                <span className="text-sm text-muted-foreground">Descrição Detalhada</span>
                <p className="text-sm bg-muted/30 p-3 rounded-lg mt-1">{n.description}</p>
              </div>
            )}
          </div>

          {/* Evidence */}
          {n.evidence && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Evidências/Links de Prova</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg break-all">{n.evidence}</p>
            </div>
          )}

          {/* Notes */}
          {n.notes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Observações</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{n.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
