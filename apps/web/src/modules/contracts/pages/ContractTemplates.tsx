import { useEffect, useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Loader2, Plus, Trash2, FileText, Sparkles, Eye, Pencil, Search, X, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { EmptyState } from "@/shared/components/EmptyState";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SortableTableHead } from "@/shared/components/SortableTableHead";
import { nextTableSortState, sortTableRows, type TableSortState } from "@/shared/lib/table-sort";
import {
  useContractTemplates,
  type ContractTemplateRow,
  type ContractTemplateRowInsert,
  type ContractTemplateRowUpdate,
} from "@/modules/contracts/hooks/useContractTemplates";
import { ContractImportWorkspace } from "@/modules/contracts/components/ContractImportWorkspace";
import { ContractTemplateViewModal } from "@/modules/contracts/components/ContractTemplateViewModal";
import type { SemanticTemplateManifest } from "@/modules/contracts/types/contracts.types";

function parseManifest(template: ContractTemplateRow): SemanticTemplateManifest | null {
  const raw = template["variables_manifest"];
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed as SemanticTemplateManifest;
  } catch {
    return null;
  }
}

function countVariables(template: ContractTemplateRow): number {
  return parseManifest(template)?.variables?.length ?? 0;
}

function getClauseTypes(template: ContractTemplateRow): string[] {
  return parseManifest(template)?.clauseTypes ?? [];
}

function formatSlug(slug?: string | null): string {
  if (!slug) return "Padrao";
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function templateCategory(template: ContractTemplateRow): string {
  return template.tipo_servico === "semantico" ? "Semantico IA" : formatSlug(template.tipo_servico);
}

function templateStatus(template: ContractTemplateRow): string {
  return template.ativo ? "Ativo" : "Inativo";
}

export default function ContractTemplates() {
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useContractTemplates();

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateRow | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "semantico" | "padrao">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [sortState, setSortState] = useState<TableSortState>(null);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (q && !template.nome.toLowerCase().includes(q) && !(template.descricao ?? "").toLowerCase().includes(q)) return false;
      if (filterType === "semantico" && template.tipo_servico !== "semantico") return false;
      if (filterType === "padrao" && template.tipo_servico === "semantico") return false;
      if (filterStatus === "ativo" && !template.ativo) return false;
      if (filterStatus === "inativo" && template.ativo) return false;
      return true;
    });
  }, [templates, search, filterType, filterStatus]);

  const sortedTemplates = useMemo(
    () => sortTableRows(filteredTemplates, sortState, (template, key) => {
      if (key === "nome") return template.nome;
      if (key === "categoria") return templateCategory(template);
      if (key === "status") return templateStatus(template);
      if (key === "created_at") return template.created_at;
      return (template as Record<string, unknown>)[key];
    }),
    [filteredTemplates, sortState],
  );

  useEffect(() => {
    const visibleIds = new Set(filteredTemplates.map((template) => template.id));
    setSelectedTemplateIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [filteredTemplates]);

  useEffect(() => {
    setSelectedTemplateIds([]);
  }, [search, filterType, filterStatus]);

  const hasActiveFilters = search.trim() !== "" || filterType !== "all" || filterStatus !== "all";
  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(sortedTemplates, 10);

  const selectedCount = selectedTemplateIds.length;
  const allSelected = filteredTemplates.length > 0 && selectedTemplateIds.length === filteredTemplates.length;

  const toggleSelectAll = () => {
    setSelectedTemplateIds((current) => current.length === filteredTemplates.length ? [] : filteredTemplates.map((template) => template.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedTemplateIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleSave = (data: ContractTemplateRowInsert) => {
    addTemplate.mutate(data);
  };

  const handleEditSave = (id: string, data: ContractTemplateRowUpdate) => {
    updateTemplate.mutate({ id, ...data });
  };

  const handleDeleteClick = (template: ContractTemplateRow) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTemplate) {
      deleteTemplate.mutate(selectedTemplate.id);
      setIsDeleteOpen(false);
      setSelectedTemplate(null);
      setSelectedTemplateIds((current) => current.filter((id) => id !== selectedTemplate.id));
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = selectedTemplateIds;
    setSelectedTemplateIds([]);
    setIsBulkDeleteOpen(false);
    const result = await runBulkAction(ids, (id) => deleteTemplate.mutateAsync(id));
    reportBulkResult(result, "excluído", "template");
  };

  const handleViewClick = (template: ContractTemplateRow) => {
    setSelectedTemplate(template);
    setIsViewOpen(true);
  };

  const handleEditClick = (template: ContractTemplateRow) => {
    setSelectedTemplate(template);
    setIsEditOpen(true);
  };

  const semanticCount = templates.filter((template) => template.tipo_servico === "semantico").length;
  const activeCount = templates.filter((template) => template.ativo).length;
  const totalVars = templates.reduce((acc, template) => acc + countVariables(template), 0);

  if (isLoading) {
    return (
      <MainLayout title="Templates de Contrato" description="Motor semantico de templates contratuais">
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Templates de Contrato"
      description="Transforme qualquer contrato em template reutilizável com inteligência semântica"
      actions={
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setIsWorkspaceOpen(true)}
          data-testid="button-novo-template"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Template
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { title: "Total de Templates", value: templates.length, sub: "todos os tipos", icon: FileText },
            { title: "Semanticos (IA)", value: semanticCount, sub: "gerados por IA", icon: Sparkles },
            { title: "Ativos", value: activeCount, sub: "disponiveis", icon: FileText },
            { title: "Variáveis Mapeadas", value: totalVars, sub: "em todos os templates", icon: Sparkles },
          ].map(({ title, value, sub, icon: Icon }) => (
            <Card key={title}>
              <div className="flex flex-row items-center justify-between space-y-0 p-5 pb-2">
                <p className="text-sm font-medium">{title}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="px-5 pb-5">
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-sm bg-card border-border"
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-templates"
            />
            {search && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm" data-testid="select-filter-type">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="semantico">Semantico (IA)</SelectItem>
              <SelectItem value="padrao">Padrao</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all"); }}
              data-testid="button-clear-filters"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={Sparkles}
                title="Nenhum template criado ainda"
                description="Clique em Novo Template para importar um contrato e gerar um template inteligente com detecção automática de variáveis."
                action={{ label: "Novo Template", onClick: () => setIsWorkspaceOpen(true) }}
              />
            </CardContent>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={Search}
                title="Nenhum template encontrado"
                description="Tente ajustar os filtros ou limpar a busca para ver todos os templates."
                action={{ label: "Limpar filtros", onClick: () => { setSearch(""); setFilterType("all"); setFilterStatus("all"); } }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ListSectionHeader
                title="Lista de Templates"
                count={filteredTemplates.length}
                description="Acompanhe modelos contratuais, categorias, status e data de criação"
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os templates"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedCount > 0 ? `${selectedCount} selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedCount > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setIsBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedCount})
                      </Button>
                    )}
                  </div>
                }
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <SortableTableHead sortKey="nome" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Nome</SortableTableHead>
                    <SortableTableHead sortKey="categoria" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Categoria</SortableTableHead>
                    <SortableTableHead sortKey="status" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Status</SortableTableHead>
                    <SortableTableHead sortKey="created_at" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Data de Criação</SortableTableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((template) => {
                    const clauseTypes = getClauseTypes(template);
                    const isSemantic = template.tipo_servico === "semantico";
                    return (
                      <TableRow key={template.id} className="cursor-pointer" onClick={() => handleViewClick(template)} data-testid={`row-template-${template.id}`}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTemplateIds.includes(template.id)}
                            onCheckedChange={() => toggleSelect(template.id)}
                            aria-label={`Selecionar template ${template.nome}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${isSemantic ? "bg-primary/10" : "bg-muted"}`}>
                              {isSemantic ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">{template.nome}</p>
                              {template.descricao && <p className="text-xs text-muted-foreground truncate mt-0.5">{template.descricao}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant={isSemantic ? "secondary" : "outline"} className="text-[10px] gap-1">
                              {isSemantic && <Sparkles className="h-2.5 w-2.5" />}
                              {templateCategory(template)}
                            </Badge>
                            {clauseTypes.slice(0, 1).map((ct) => <Badge key={ct} variant="outline" className="text-[10px]">{ct}</Badge>)}
                            {clauseTypes.length > 1 && <span className="text-[10px] px-1 py-0.5 rounded border text-muted-foreground border-border">+{clauseTypes.length - 1}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.ativo ? "default" : "secondary"} className="text-[10px]">{templateStatus(template)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(template.created_at)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-actions-template-${template.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleViewClick(template)} data-testid={`menu-view-template-${template.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(template)} data-testid={`menu-edit-template-${template.id}`}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteClick(template)} className="text-destructive focus:text-destructive" data-testid={`menu-delete-template-${template.id}`}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="templates"
              />
            </CardContent>
          </Card>
        )}
      </div>

      <ContractImportWorkspace open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen} onSave={handleSave} />

      <ContractImportWorkspace
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={handleSave}
        template={selectedTemplate}
        onEdit={handleEditSave}
      />

      <ContractTemplateViewModal open={isViewOpen} onOpenChange={setIsViewOpen} template={selectedTemplate} />

      <DeleteConfirmModal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Template"
        description={`Tem certeza que deseja excluir o template "${selectedTemplate?.nome}"? Esta acao nao pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={handleBulkDeleteConfirm}
        title="Excluir Templates"
        description={`Tem certeza que deseja excluir ${selectedCount} template(s)? Esta acao nao pode ser desfeita.`}
      />
    </MainLayout>
  );
}
