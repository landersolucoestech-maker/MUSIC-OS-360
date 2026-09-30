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
import type { EcadReport, CatalogWorkRef } from "@/modules/monitoring/rights/types";
import { formatRightsDate } from "@/modules/monitoring/rights/utils/date-format";
import { StoredFileLink } from "@/shared/components/StoredFileLink";
import { EcadReportStatus } from "@music-os-360/types";
import { ecadReportStatusLabel, ecadReportTypeLabel } from "@/modules/monitoring/rights/utils/ecad-labels";

export interface EcadReportRow extends EcadReport {
  work?: CatalogWorkRef;
}

interface ECADViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: EcadReportRow | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);


export function ECADViewModal({ open, onOpenChange, report }: ECADViewModalProps) {
  if (!report) return null;

  const getStatusBadge = (status: string) => {
    const label = ecadReportStatusLabel(status);
    switch (status) {
      case EcadReportStatus.COMPLETED:
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />{label}</Badge>;
      case EcadReportStatus.IMPORTED:
        return <Badge variant="info"><Clock className="h-3 w-3 mr-1" />{label}</Badge>;
      case EcadReportStatus.ERROR:
        return <Badge variant="danger"><AlertTriangle className="h-3 w-3 mr-1" />{label}</Badge>;
      default:
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />{label}</Badge>;
    }
  };

  const amount = Number(report.net_amount ?? report.gross_amount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <EcadIcon className="h-5 w-5" />
            Relatório ECAD — {report.period}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            <div className="flex gap-2">
              {getStatusBadge(report.status)}
              <Badge variant="outline">{ecadReportTypeLabel(report.type)}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-lg font-bold text-foreground">{fmtBRL(Number(report.gross_amount ?? 0))}</p>
                <p className="text-sm text-muted-foreground">Valor Bruto</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-lg font-bold text-success">{fmtBRL(amount)}</p>
                <p className="text-sm text-muted-foreground">Valor Líquido</p>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Obra vinculada</p>
              </div>
              {report.work ? (
                <div className="p-4 text-sm space-y-1">
                  <p className="font-medium text-foreground">{report.work.title}</p>
                  <p className="text-muted-foreground">{report.work.composer_name || "—"} · {report.work.publisher_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">Cód. ECAD: {report.work.ecad_code || "—"}</p>
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  {report.work_id ? `Obra ${report.work_id} não encontrada no catálogo.` : "Nenhuma obra vinculada a este relatório."}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Criado em {formatRightsDate(report.created_at)}</span>
              {report.file_url && (
                <StoredFileLink url={report.file_url} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" />Ver arquivo original
                </StoredFileLink>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
