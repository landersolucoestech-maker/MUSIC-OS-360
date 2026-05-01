import { useState, useMemo } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserPlus, Search, Loader2, Upload, Download, Plus, MoreHorizontal,
  Eye, Pencil, Trash2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadFormModal } from "@/components/forms/LeadFormModal";
import { LeadViewModal } from "@/components/forms/LeadViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, importCSV, CSVColumn } from "@/lib/csv";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useLeads,
  STATUS_LEAD_OPTIONS,
  ORIGEM_LEAD_OPTIONS,
  PRIORIDADE_OPTIONS,
  STATUS_LABELS,
  ORIGEM_LABELS,
} from "@/hooks/useLeads";

const leadColumns: CSVColumn[] = [
  { key: "nome_contratante", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "telefone", label: "Telefone" },
  { key: "artista_interesse", label: "Artista" },
  { key: "tipo_evento", label: "Tipo Evento" },
  { key: "data_evento", label: "Data Evento" },
  { key: "cidade_evento", label: "Cidade" },
  { key: "estado_evento", label: "Estado" },
  { key: "nome_local_evento", label: "Local" },
  { key: "endereco_evento", label: "Endereço" },
  { key: "orcamento_estimado", label: "Orçamento" },
  { key: "valor_estimado_cache", label: "Cachê" },
  { key: "status_lead", label: "Status" },
  { key: "prioridade", label: "Prioridade" },
  { key: "probabilidade_fechamento", label: "Probabilidade" },
  { key: "origem_lead", label: "Origem" },
  { key: "nome_empresa", label: "Empresa" },
  { key: "tipo_contrato", label: "Tipo Contrato" },
];

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500",
  qualificado: "bg-cyan-500",
  contato_realizado: "bg-sky-500",
  proposta_enviada: "bg-amber-500",
  negociacao: "bg-purple-500",
  followup: "bg-orange-500",
  confirmado: "bg-emerald-500",
  fechado: "bg-green-600",
  perdido: "bg-red-600",
  arquivado: "bg-slate-500",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  baixa: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function Leads() {
  const { leads, isLoading, error, deleteLead, addLead, refetch } = useLeads();
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; lead?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; lead?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; lead?: any }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [origemFilter, setOrigemFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");

  const handleExport = () => exportToCSV(leads, leadColumns, "leads");
  const handleImport = () => importCSV(async (data) => {
    let importados = 0;
    let ignorados = 0;
    for (const row of data) {
      const nome_contratante = row["Nome"] || row["nome_contratante"] || row["nome"];
      const emailVal = row["Email"] || row["email"];
      const telefoneVal = row["Telefone"] || row["telefone"];
      const artistaVal = row["Artista"] || row["artista_interesse"];
      const cidadeVal = row["Cidade"] || row["cidade_evento"];
      const enderecoVal = row["Endereço"] || row["endereco_evento"];
      if (!nome_contratante || !emailVal || !telefoneVal || !artistaVal) { ignorados++; continue; }
      try {
        const leadData: any = {
          nome_contratante,
          email: emailVal,
          telefone: telefoneVal,
          artista_interesse: artistaVal,
          tipo_evento: row["Tipo Evento"] || row["tipo_evento"] || "outro",
          data_evento: row["Data Evento"] || row["data_evento"] || new Date().toISOString().split("T")[0],
          cidade_evento: cidadeVal || "N/A",
          estado_evento: row["Estado"] || row["estado_evento"] || "SP",
          endereco_evento: enderecoVal || "N/A",
          orcamento_estimado: row["Orçamento"] || row["orcamento_estimado"] ? Number(row["Orçamento"] || row["orcamento_estimado"]) : null,
          origem_lead: row["Origem"] || row["origem_lead"] || "outro",
          nome_empresa: row["Empresa"] || row["nome_empresa"] || null,
          status_lead: row["Status"] || row["status_lead"] || "novo",
          prioridade: row["Prioridade"] || row["prioridade"] || "media",
        };
        await addLead.mutateAsync(leadData);
        importados++;
      } catch { ignorados++; }
    }
    if (importados > 0) toast.success(`${importados} lead(s) importado(s)${ignorados > 0 ? `, ${ignorados} ignorado(s)` : ""}`);
    else toast.error("Nenhum lead válido encontrado. Campos obrigatórios: Nome, Email, Telefone, Artista.");
  }, ["Nome", "Email", "Telefone", "Artista"]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = searchTerm === "" ||
        lead.nome_contratante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.artista_interesse?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.cidade_evento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.nome_empresa?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrigem = origemFilter === "all" || lead.origem_lead === origemFilter;
      const matchesPrioridade = prioridadeFilter === "all" || lead.prioridade === prioridadeFilter;
      return matchesSearch && matchesOrigem && matchesPrioridade;
    });
  }, [leads, searchTerm, origemFilter, prioridadeFilter]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_LEAD_OPTIONS.forEach(s => { counts[s.value] = 0; });
    leads.forEach(l => { counts[l.status_lead] = (counts[l.status_lead] || 0) + 1; });
    return counts;
  }, [leads]);

  const handleDelete = () => {
    if (deleteModal.lead) {
      deleteLead.mutate(deleteModal.lead.id);
      setDeleteModal({ open: false });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-destructive" data-testid="text-error-title">Erro ao carregar leads</h2>
            <p className="text-muted-foreground max-w-md" data-testid="text-error-message">
              Não foi possível carregar os dados de leads. Verifique se a tabela foi criada no banco de dados.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2" data-testid="button-retry">
            <Loader2 className="h-4 w-4" />Tentar novamente
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Leads</h1>
            <p className="text-muted-foreground">Captação e gestão de leads de booking & eventos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleImport} data-testid="button-import-leads">
              <Upload className="h-4 w-4" />Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} data-testid="button-export-leads">
              <Download className="h-4 w-4" />Exportar
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setFormModal({ open: true, mode: "create" })} data-testid="button-new-lead">
              <Plus className="h-4 w-4" />Novo Lead
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_LEAD_OPTIONS.map((status) => (
            <Card
              key={status.value}
              className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex-1 min-w-0"
              data-testid={`kpi-${status.value}`}
            >
              <CardContent className="p-2 text-center">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${STATUS_COLORS[status.value]}`} />
                <p className="text-xl font-bold">{pipelineCounts[status.value]}</p>
                <p className="text-[9px] text-muted-foreground leading-tight truncate">{status.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, artista, cidade, empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-leads"
            />
          </div>
          <div className="flex gap-2">
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-origem">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Origens</SelectItem>
                {ORIGEM_LEAD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-prioridade">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORIDADE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Nenhum lead encontrado"
            description="Comece adicionando seu primeiro lead ou importe de um CSV."
          />
        ) : (
          <div className="rounded-md border" data-testid="leads-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Artista de interesse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Probabilidade</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-[60px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum lead encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => setViewModal({ open: true, lead })}
                      data-testid={`row-lead-${lead.id}`}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {lead.nome_contratante || <span className="text-muted-foreground italic">(sem nome)</span>}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{lead.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.telefone || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{lead.artista_interesse || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs text-white ${STATUS_COLORS[lead.status_lead] || "bg-secondary"}`}>
                          {STATUS_LABELS[lead.status_lead] || lead.status_lead}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${PRIORIDADE_BADGE[lead.prioridade] || ""}`}>
                          {lead.prioridade === "alta" ? "Alta" : lead.prioridade === "media" ? "Média" : "Baixa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{lead.probabilidade_fechamento ?? 0}%</TableCell>
                      <TableCell className="text-muted-foreground">{ORIGEM_LABELS[lead.origem_lead] || lead.origem_lead || "—"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${lead.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewModal({ open: true, lead })} data-testid={`button-view-${lead.id}`}>
                              <Eye className="mr-2 h-4 w-4" />Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", lead })} data-testid={`button-edit-${lead.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteModal({ open: true, lead })} data-testid={`button-delete-${lead.id}`}>
                              <Trash2 className="mr-2 h-4 w-4" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LeadFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        mode={formModal.mode}
        lead={formModal.lead}
      />

      <LeadViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        lead={viewModal.lead}
        onEdit={(lead) => setFormModal({ open: true, mode: "edit", lead })}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title="Excluir Lead"
        description={`Tem certeza que deseja excluir o lead "${deleteModal.lead?.nome_contratante}"? Esta ação não pode ser desfeita.`}
      />

    </MainLayout>
  );
}
