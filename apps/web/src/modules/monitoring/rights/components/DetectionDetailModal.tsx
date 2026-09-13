import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock, Archive, BookOpen, Tag, Hash, Clock3, Link2, Globe } from "lucide-react";
import type { DetectionStatus } from "../types";
import type { DetectionRow } from "./DetectionsTable";
import { formatRightsDateTime } from "../utils/date-format";

const STATUS_CONFIG: Record<DetectionStatus, { label: string; variant: BadgeVariant; icon: React.ReactNode }> = {
  completed:    { label: "Concluído",    variant: "success", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  in_progress:  { label: "Em Andamento", variant: "info",    icon: <Clock className="h-3.5 w-3.5" /> },
  pending:      { label: "Pendente",     variant: "warning", icon: <Clock className="h-3.5 w-3.5" /> },
  rejected:     { label: "Rejeitado",    variant: "danger",  icon: <XCircle className="h-3.5 w-3.5" /> },
  archived:     { label: "Arquivado",    variant: "neutral", icon: <Archive className="h-3.5 w-3.5" /> },
};

interface Props {
  detection: DetectionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2.5">
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        <div className={`text-sm text-foreground break-words ${mono ? "font-sans" : "font-medium"}`}>{value}</div>
      </div>
    </div>
  );
}

export function DetectionDetailModal({ detection, open, onOpenChange }: Props) {
  if (!detection) return null;

  const status = STATUS_CONFIG[detection.status];
  const catalog = detection.obra;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">{catalog?.title ?? detection.titulo_detectado ?? "Detecção"}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{detection.plataforma}</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-4">

          {/* Detection info */}
          <div>
            <p className="text-xs font-semibold  tracking-wide text-muted-foreground mb-2">Dados da Detecção</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Row icon={<Globe className="h-3.5 w-3.5" />} label="Plataforma" value={detection.plataforma} />
              <Row icon={<Tag className="h-3.5 w-3.5" />} label="Tipo" value={<span className="capitalize">{detection.type.replace(/_/g, " ")}</span>} />
              <Row icon={<Clock3 className="h-3.5 w-3.5" />} label="Detectado em" value={formatRightsDateTime(detection.detectado_em).full} />
              <Row
                icon={<CheckCircle className="h-3.5 w-3.5" />}
                label="Status"
                value={<Badge variant={status.variant} className="gap-1">{status.icon}{status.label}</Badge>}
              />
              {detection.score && <Row icon={<Hash className="h-3.5 w-3.5" />} label="Score" value={Number(detection.score).toFixed(2)} mono />}
              {detection.url && (
                <Row
                  icon={<Link2 className="h-3.5 w-3.5" />}
                  label="URL"
                  value={<a href={detection.url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{detection.url}</a>}
                />
              )}
              <Row
                icon={<Link2 className="h-3.5 w-3.5" />}
                label="Match ECAD"
                value={
                  catalog?.cod_ecad
                    ? <span className="text-success font-semibold text-xs">✓ Obra vinculada com cód. ECAD</span>
                    : <span className="text-destructive font-semibold text-xs">✗ Sem correspondência no catálogo/ECAD</span>
                }
              />
            </div>
          </div>

          {/* Catalog / obra info */}
          <div>
            <p className="text-xs font-semibold  tracking-wide text-muted-foreground mb-2">Dados da Obra — Catálogo</p>
            {catalog ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Row icon={<BookOpen className="h-3.5 w-3.5" />} label="Compositor(es)" value={Array.isArray(catalog.compositores) ? catalog.compositores.join(", ") : (catalog.compositores || catalog.compositor || "—")} />
                <Row icon={<BookOpen className="h-3.5 w-3.5" />} label="Publisher / Editora" value={catalog.editora || "—"} />
                <Row icon={<Tag className="h-3.5 w-3.5" />} label="Gênero" value={catalog.genero || "—"} />
                <Row icon={<Clock3 className="h-3.5 w-3.5" />} label="Duração" value={catalog.duracao || "—"} />
                {catalog.iswc && (
                  <Row icon={<Hash className="h-3.5 w-3.5" />} label="ISWC" value={catalog.iswc} mono />
                )}
                <Row
                  icon={<CheckCircle className="h-3.5 w-3.5" />}
                  label="Cód. ECAD"
                  value={
                    catalog.cod_ecad
                      ? <span className="font-sans text-success">{catalog.cod_ecad}</span>
                      : <span className="text-warning text-xs">Não cadastrado — sem cod_ecad</span>
                  }
                />
                {catalog.cod_entidade && (
                  <Row icon={<Hash className="h-3.5 w-3.5" />} label="Cód. Sociedade" value={catalog.cod_entidade} mono />
                )}
                <Row
                  icon={<Tag className="h-3.5 w-3.5" />}
                  label="Status no Catálogo"
                  value={<span className="capitalize text-xs">{catalog.status || "—"}</span>}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Obra não encontrada no catálogo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {detection.work_id
                      ? <>Esta detecção referencia a obra <code className="font-sans">{detection.work_id}</code>, que não foi localizada no catálogo interno.</>
                      : "Esta detecção não possui obra vinculada. Associe-a a uma obra no Catálogo para habilitar a conciliação ECAD."}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
