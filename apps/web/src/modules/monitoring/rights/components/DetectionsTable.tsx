import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CheckCircle, AlertTriangle, XCircle, Clock, Archive, Radio, ExternalLink } from "lucide-react";
import type { ContentDetection, DetectionStatus, CatalogObraRef } from "../types";
import { formatRightsDateTime } from "../utils/date-format";

const STATUS_CONFIG: Record<DetectionStatus, { label: string; variant: BadgeVariant; icon: React.ReactNode }> = {
  completed:    { label: "Concluído",     variant: "success", icon: <CheckCircle className="h-3 w-3" /> },
  in_progress:  { label: "Em Andamento",  variant: "info",    icon: <Clock className="h-3 w-3" /> },
  pending:      { label: "Pendente",      variant: "warning", icon: <Clock className="h-3 w-3" /> },
  rejected:     { label: "Rejeitado",     variant: "danger",  icon: <XCircle className="h-3 w-3" /> },
  archived:     { label: "Arquivado",     variant: "neutral", icon: <Archive className="h-3 w-3" /> },
};

export interface DetectionRow extends ContentDetection {
  obra?: CatalogObraRef;
}

interface Props {
  detections: DetectionRow[];
  onViewDetail?: (det: DetectionRow) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

export function DetectionsTable({ detections, onViewDetail, selectedIds, onToggleSelect }: Props) {
  if (detections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Radio className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhuma detecção registrada</p>
        <p className="text-xs mt-1">As detecções de conteúdo aparecerão aqui automaticamente</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {onToggleSelect && <TableHead className="w-8"></TableHead>}
            <TableHead className="min-w-[190px] w-[24%]">Obra / Título Detectado</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[140px] w-[16%]">Plataforma</TableHead>
            <TableHead className="hidden md:table-cell w-[96px]">Tipo</TableHead>
            <TableHead className="hidden xl:table-cell min-w-[128px] w-[128px]">Detectado em</TableHead>
            <TableHead className="hidden lg:table-cell w-[90px]">Match</TableHead>
            <TableHead className="hidden md:table-cell w-[80px]">Score</TableHead>
            <TableHead className="min-w-[128px] w-[128px]">Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detections.map((det) => {
            const status = STATUS_CONFIG[det.status];
            const dt = formatRightsDateTime(det.detectado_em);
            const matched = Boolean(det.obra?.cod_ecad);
            return (
              <TableRow key={det.id} data-testid={`row-exec-${det.id}`}>
                {onToggleSelect && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds?.includes(det.id)}
                      onCheckedChange={() => onToggleSelect(det.id)}
                      aria-label={`Selecionar ${det.obra?.title ?? det.titulo_detectado ?? det.id}`}
                      data-testid={`checkbox-deteccao-${det.id}`}
                    />
                  </TableCell>
                )}
                <TableCell className="py-3">
                  <div className="min-w-0 max-w-[240px]">
                    <p className="font-semibold text-foreground leading-tight truncate">
                      {det.obra?.title ?? det.titulo_detectado ?? "—"}
                    </p>
                    {!det.obra && (
                      <p className="text-xs text-destructive mt-0.5 truncate">Sem vínculo com obra do catálogo</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 hidden lg:table-cell">
                  <span className="block max-w-[180px] truncate text-sm text-foreground/80">{det.plataforma}</span>
                </TableCell>
                <TableCell className="py-3 hidden md:table-cell">
                  <span className="inline-flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md font-medium capitalize">
                    {det.type.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell className="py-3 hidden xl:table-cell">
                  <div className="text-xs">
                    <p className="whitespace-nowrap text-foreground/80 font-medium">{dt.date}</p>
                    <p className="whitespace-nowrap text-muted-foreground">{dt.time}</p>
                  </div>
                </TableCell>
                <TableCell className="py-3 hidden lg:table-cell">
                  <span className={`text-xs font-semibold ${matched ? "text-success" : "text-destructive"}`}>
                    {matched ? "✓ Match" : "✗ Sem match"}
                  </span>
                </TableCell>
                <TableCell className="py-3 hidden md:table-cell text-sm">
                  {det.score ? Number(det.score).toFixed(2) : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant={status.variant} className="gap-1 whitespace-nowrap">{status.icon}{status.label}</Badge>
                </TableCell>
                <TableCell className="py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`btn-detail-${det.id}`}
                    className="h-7 px-2"
                    onClick={() => onViewDetail?.(det)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
