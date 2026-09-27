import { useEffect, useState } from "react";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { LeadRowSummary } from "../components";
import { optionLabel, leadServiceTypeOptions } from "../constants";
import {
  ORIGEM_LEAD_OPTIONS,
  PRIORIDADE_OPTIONS,
  SERVICOS_OPTIONS,
  STATUS_LEAD_OPTIONS,
} from "../constants/lead-form-options";
import type { Lead } from "../types";

export function LeadsTable({
  leads,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
}: {
  leads: Lead[];
  onView?: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onBulkDelete?: (leads: Lead[]) => void;
}) {
  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(leads, 10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = new Set(leads.map((l) => l.id));
    setSelectedIds((cur) => cur.filter((id) => ids.has(id)));
  }, [leads]);

  const allSelected = leads.length > 0 && selectedIds.length === leads.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : leads.map((l) => l.id));
  const toggleSelect = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    onBulkDelete?.(leads.filter((l) => selectedIds.includes(l.id)));
    setSelectedIds([]);
  };

  return (
    <Card>
      <CardContent className="pt-0">
      <ListSectionHeader
        title="Lista de Leads"
        count={leads.length}
        description="Acompanhe oportunidades, status, origens e próximos follow-ups"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos os leads" />
            <span className="text-xs text-muted-foreground">
              {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : "Selecionar todos"}
            </span>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleBulkDelete} disabled={!onBulkDelete} data-testid="button-bulk-delete-leads">
                <Trash2 className="h-3.5 w-3.5" /> Excluir ({selectedIds.length})
              </Button>
            )}
          </div>
        }
      />
      <Table className="min-w-[980px]" data-testid="table-leads">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]"></TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Tipo de Serviço</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Valor Estimado</TableHead>
            <TableHead>Próximo Follow-up</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((lead) => {
            const ps = (lead.payloadServico ?? {}) as Record<string, unknown>;
            const servico = typeof ps.servico === "string" ? ps.servico : "";

            // CORRIGIDO: fallback usa leadServiceTypeOptions (enum LeadServiceType),
            // not leadStatusOptions, which is a status list unrelated to serviceType.
            const servicoLabel = servico
              ? optionLabel(SERVICOS_OPTIONS, servico)
              : optionLabel(leadServiceTypeOptions, lead.serviceType);

            return (
              <TableRow key={lead.id} className={selectedIds.includes(lead.id) ? "bg-primary/5" : ""}>
                <TableCell>
                  <Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} aria-label="Selecionar lead" />
                </TableCell>
                <TableCell>
                  <LeadRowSummary lead={lead} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[lead.city, lead.state].filter(Boolean).join(" / ") || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {servicoLabel}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {/* FIXED: uses STATUS_LEAD_OPTIONS aligned with the values saved by the new system */}
                  {optionLabel(STATUS_LEAD_OPTIONS, lead.dadosInternosCRM.statusLead)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {optionLabel(ORIGEM_LEAD_OPTIONS, lead.dadosInternosCRM.origemLead) ?? "-"}
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {Number(lead.dadosInternosCRM.valorEstimado ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(lead.dadosInternosCRM.proximoFollowUp)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {optionLabel(PRIORIDADE_OPTIONS, lead.dadosInternosCRM.prioridade) ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" title="Ações">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onView && (
                        <DropdownMenuItem onClick={() => onView(lead)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualizar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(lead)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(lead)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {leads.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado.
        </div>
      )}
      {leads.length > 0 && (
        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="leads"
        />
      )}
      </CardContent>
    </Card>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}
