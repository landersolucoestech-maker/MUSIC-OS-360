import { useMemo, useState } from "react";
import { ArrowLeft, MoreHorizontal, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { SortableTableHead } from "@/shared/components/SortableTableHead";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { nextTableSortState, sortTableRows, type TableSortState } from "@/shared/lib/table-sort";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { useFinancialCategoryRulesStore } from "@/modules/accounting/hooks/useFinancialCategoryRulesStore";
import type {
  FinancialCategoryRuleEntity,
  FinancialTransactionType,
  FinancialCounterpartyType,
} from "@/modules/accounting/types/financial-category-rules.types";

const TRANSACTION_TYPES: FinancialTransactionType[] = ["Receita", "Despesa", "Investimento", "Imposto", "Transferência"];
const COUNTERPARTY_TYPES: FinancialCounterpartyType[] = ["Empresa", "Pessoa", "Artista", "Governo", "Conta Própria"];

type Mode = "create" | "view" | "edit";

interface FormState {
  transaction_type: FinancialTransactionType;
  counterparty_type: FinancialCounterpartyType;
  category: string;
  subcategory: string;
  active: boolean;
  sort_order: number;
}

const emptyForm: FormState = {
  transaction_type: "Despesa",
  counterparty_type: "Empresa",
  category: "",
  subcategory: "",
  active: true,
  sort_order: 0,
};

function toForm(rule: FinancialCategoryRuleEntity): FormState {
  return {
    transaction_type: rule.transaction_type,
    counterparty_type: rule.counterparty_type,
    category: rule.category,
    subcategory: rule.subcategory ?? "",
    active: rule.active,
    sort_order: rule.sort_order,
  };
}

export default function FinancialCategories() {
  const { rules, setRules } = useFinancialCategoryRulesStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinancialCategoryRuleEntity | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [sortState, setSortState] = useState<TableSortState>(null);

  const baseRules = useMemo(
    () => [...rules].sort((a, b) => a.sort_order - b.sort_order || a.category.localeCompare(b.category, "pt-BR", { sensitivity: "base" })),
    [rules],
  );

  const visibleRules = useMemo(
    () => sortTableRows(baseRules, sortState, (rule, key) => {
      if (key === "category") return rule.category;
      if (key === "subcategory") return rule.subcategory ?? "";
      if (key === "transaction_type") return rule.transaction_type;
      if (key === "counterparty_type") return rule.counterparty_type;
      if (key === "active") return rule.active ? "Ativa" : "Inativa";
      return (rule as unknown as Record<string, unknown>)[key];
    }),
    [baseRules, sortState],
  );

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(visibleRules, 10);
  const allPageSelected = pageItems.length > 0 && pageItems.every((rule) => selectedIds.includes(rule.id));
  const selectedVisibleCount = visibleRules.filter((rule) => selectedIds.includes(rule.id)).length;

  const mainCategories = new Set(
    visibleRules.map((r) => `${r.transaction_type}:${r.counterparty_type}:${r.category}`),
  ).size;

  const openCreate = () => { setMode("create"); setSelectedId(null); setForm(emptyForm); setError(false); setModalOpen(true); };
  const openView = (r: FinancialCategoryRuleEntity) => { setMode("view"); setSelectedId(r.id); setForm(toForm(r)); setError(false); setModalOpen(true); };
  const openEdit = (r: FinancialCategoryRuleEntity) => { setMode("edit"); setSelectedId(r.id); setForm(toForm(r)); setError(false); setModalOpen(true); };

  const readOnly = mode === "view";
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.category.trim()) { setError(true); return; }
    const now = new Date().toISOString();
    if (mode === "create") {
      const novo: FinancialCategoryRuleEntity = {
        id: (globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}`),
        transaction_type: form.transaction_type,
        counterparty_type: form.counterparty_type,
        category: form.category.trim(),
        subcategory: form.subcategory.trim() || null,
        links: null,
        active: form.active,
        sort_order: Number(form.sort_order) || 0,
        created_at: now,
        updated_at: now,
      };
      setRules([...rules, novo]);
    } else if (mode === "edit" && selectedId) {
      setRules(rules.map((r) => r.id === selectedId ? {
        ...r,
        transaction_type: form.transaction_type,
        counterparty_type: form.counterparty_type,
        category: form.category.trim(),
        subcategory: form.subcategory.trim() || null,
        active: form.active,
        sort_order: Number(form.sort_order) || 0,
        updated_at: now,
      } : r));
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) setRules(rules.filter((r) => r.id !== deleteTarget.id));
    if (deleteTarget) setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = pageItems.map((rule) => rule.id);
    setSelectedIds((current) => {
      if (allPageSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const confirmBulkDelete = () => {
    if (selectedVisibleCount === 0) return;
    const selectedVisibleIds = new Set(visibleRules.filter((rule) => selectedIds.includes(rule.id)).map((rule) => rule.id));
    setRules(rules.filter((rule) => !selectedVisibleIds.has(rule.id)));
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const modalTitle = mode === "create" ? "Nova Categoria Financeira" : mode === "edit" ? "Editar Categoria" : "Detalhes da Categoria";

  return (
    <FeatureGate feature="moduleAccounting" featureName="Financeiro">
      <MainLayout
        title="Categorias Financeiras"
        description="Categorias e subcategorias da classificação de receitas e despesas"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/accounting"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Financeiro</Link>
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Criar
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{mainCategories} categorias</Badge>
            <Badge variant="outline">{visibleRules.length} regras/subcategorias</Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <ListSectionHeader
                title="Lista de Categorias Financeiras"
                count={visibleRules.length}
                description="Categorias e subcategorias cadastradas no sistema"
                action={visibleRules.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAllVisible}
                      aria-label="Selecionar todas as categorias visíveis"
                      data-testid="checkbox-select-all-categorias-financeiras"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedVisibleCount > 0 ? `${selectedVisibleCount} selecionada(s)` : "Selecionar todos"}
                    </span>
                    {selectedVisibleCount > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setBulkDeleteOpen(true)}
                        data-testid="button-delete-selected-categorias-financeiras"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Selecionados
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="select" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))} disabled className="w-8">
                      <span className="sr-only">Selecionar</span>
                    </SortableTableHead>
                    <SortableTableHead sortKey="category" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Categoria</SortableTableHead>
                    <SortableTableHead sortKey="subcategory" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Subcategoria</SortableTableHead>
                    <SortableTableHead sortKey="transaction_type" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Tipo</SortableTableHead>
                    <SortableTableHead sortKey="counterparty_type" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Contraparte</SortableTableHead>
                    <SortableTableHead sortKey="active" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Status</SortableTableHead>
                    <SortableTableHead sortKey="actions" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))} disabled className="text-right">Ações</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma categoria financeira cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(rule.id)}
                            onCheckedChange={() => toggleSelect(rule.id)}
                            aria-label={`Selecionar categoria ${rule.category}`}
                            data-testid={`checkbox-categoria-financeira-${rule.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{rule.category}</TableCell>
                        <TableCell>{rule.subcategory || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{rule.transaction_type}</TableCell>
                        <TableCell className="text-muted-foreground">{rule.counterparty_type}</TableCell>
                        <TableCell>
                          <Badge variant={rule.active ? "secondary" : "outline"}>
                            {rule.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ações">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openView(rule)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(rule)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(rule)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="categorias"
              />
            </CardContent>
          </Card>
        </div>

        {/* Modal Criar / Ver / Editar */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription>
                {readOnly ? "Visualização da categoria financeira." : "Defina a classificação de receita ou despesa."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Categoria *</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  placeholder="Ex.: Marketing Digital"
                  disabled={readOnly}
                />
                {error && <p className="text-[11px] text-destructive">Informe a categoria.</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Subcategoria</Label>
                <Input
                  value={form.subcategory}
                  onChange={(e) => setField("subcategory", e.target.value)}
                  placeholder="Opcional"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tipo de Transação</Label>
                <Select value={form.transaction_type} onValueChange={(v) => setField("transaction_type", v as FinancialTransactionType)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contraparte</Label>
                <Select value={form.counterparty_type} onValueChange={(v) => setField("counterparty_type", v as FinancialCounterpartyType)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTERPARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ordem</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setField("sort_order", Number(e.target.value))}
                  disabled={readOnly}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="cat-active"
                  checked={form.active}
                  onCheckedChange={(v) => setField("active", v === true)}
                  disabled={readOnly}
                />
                <Label htmlFor="cat-active" className="text-xs font-medium">Categoria ativa</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                {readOnly ? "Fechar" : "Cancelar"}
              </Button>
              {!readOnly && <Button onClick={handleSubmit}>{mode === "create" ? "Criar" : "Salvar"}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a categoria{deleteTarget ? ` "${deleteTarget.category}"` : ""}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir categorias selecionadas?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove {selectedVisibleCount} categoria(s) financeira(s) selecionada(s). Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </FeatureGate>
  );
}
