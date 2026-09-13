import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { EcadIcon } from "@/shared/ui/brand-icons";
import { CheckCircle, AlertTriangle, Clock, FileText } from "lucide-react";
import type { EcadReport, CatalogObraRef } from "@/modules/monitoring/rights/types";
import { formatRightsDate } from "@/modules/monitoring/rights/utils/date-format";

export interface EcadReportRow extends EcadReport {
  obra?: CatalogObraRef;
}

interface ECADViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: EcadReportRow | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", importado: "Importado", concluido: "Concluído", erro: "Erro",
};

export function ECADViewModal({ open, onOpenChange, report }: ECADViewModalProps) {
  if (!report) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      case "importado":
        return <Badge variant="info"><Clock className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      case "erro":
        return <Badge variant="danger"><AlertTriangle className="h-3 w-3 mr-1" />{STATUS_LABEL[status]}</Badge>;
      default:
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />{STATUS_LABEL[status] ?? status}</Badge>;
    }
  };

  const valor = Number(report.valor_liquido ?? report.valor_bruto ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <EcadIcon className="h-5 w-5" />
            Relatório ECAD — {report.periodo}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            <div className="flex gap-2">
              {getStatusBadge(report.status)}
              <Badge variant="outline" className="capitalize">{report.type.replace(/_/g, " ")}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-lg font-bold text-foreground">{fmtBRL(Number(report.valor_bruto ?? 0))}</p>
                <p className="text-sm text-muted-foreground">Valor Bruto</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-lg font-bold text-success">{fmtBRL(valor)}</p>
                <p className="text-sm text-muted-foreground">Valor Líquido</p>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Obra vinculada</p>
              </div>
              {report.obra ? (
                <div className="p-4 text-sm space-y-1">
                  <p className="font-medium text-foreground">{report.obra.title}</p>
                  <p className="text-muted-foreground">{report.obra.compositor || "—"} · {report.obra.editora || "—"}</p>
                  <p className="text-xs text-muted-foreground">Cód. ECAD: {report.obra.cod_ecad || "—"}</p>
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  {report.work_id ? `Obra ${report.work_id} não encontrada no catálogo.` : "Nenhuma obra vinculada a este relatório."}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Criado em {formatRightsDate(report.created_at)}</span>
              {report.arquivo_url && (
                <a href={report.arquivo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" />Ver arquivo original
                </a>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
