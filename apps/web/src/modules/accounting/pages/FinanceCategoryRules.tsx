import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { FinanceCategoryRuleModal } from "../components/FinanceCategoryRuleModal";
import {
  FINANCE_CATEGORY_OPTIONS,
  FINANCE_RULE_TRANSACTION_LABEL,
  SYSTEM_FINANCE_CATEGORY_RULES,
} from "../data/finance-category-rules.config";
import { financeCategoryRulesService } from "../services/finance-category-rules.service";
import { financialCategoriesService } from "../services/financial-categories.service";
import type {
  FinanceCategoryRule,
  FinanceCategoryRuleDraft,
  FinanceRuleTransactionType,
  FinancialCategory,
} from "../types/financial-categories.types";
import {
  isFinanceCategoryRuleOrigin,
  isFinanceRuleTransactionType,
  parseKeywords,
  validateRule,
} from "../utils/financialCategorizationRules.utils";

const QUERY_KEY_RULES = ["finance-category-rules"] as const;
const QUERY_KEY_CATEGORIES = ["finance-category-rule-categories"] as const;

const TYPE_BADGE: Record<FinanceRuleTransactionType, BadgeVariant> = {
  RECEITA: "success",
  DESPESA: "danger",
};

const ORIGIN_BADGE: Record<"SISTEMA" | "PERSONALIZADA", BadgeVariant> = {
  SISTEMA: "info",
  PERSONALIZADA: "neutral",
};

function isRuleStatusFilter(value: string): value is "all" | "active" | "inactive" {
  return ["all", "active", "inactive"].includes(value);
}

function transactionTypeFromCategory(category: FinancialCategory): FinanceRuleTransactionType | null {
  if (category.transaction_types.includes("REVENUE")) return "RECEITA";
  if (category.transaction_types.includes("EXPENSE")) return "DESPESA";
  return null;
}

function buildCategoriesByType(categories: FinancialCategory[]) {
  const next: Record<FinanceRuleTransactionType, Array<{ id: string; name: string }>> = {
    RECEITA: [...FINANCE_CATEGORY_OPTIONS.RECEITA],
    DESPESA: [...FINANCE_CATEGORY_OPTIONS.DESPESA],
  };

  categories
    .filter((category) => category.active && !category.archived && category.allow_manual_usage)
    .forEach((category) => {
      const type = transactionTypeFromCategory(category);
      if (!type) return;
      if (next[type].some((item) => item.id === category.id)) return;
      next[type].push({ id: category.id, name: category.name });
    });

  return {
    RECEITA: next.RECEITA.sort((a, b) => a.name.localeCompare(b.name)),
    DESPESA: next.DESPESA.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export default function FinanceCategoryRules() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FinanceRuleTransactionType | "all">("all");
  const [filterOrigin, setFilterOrigin] = useState<FinanceCategoryRule["origin"] | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FinanceCategoryRule | null>(null);
  const [viewingRule, setViewingRule] = useState<FinanceCategoryRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<FinanceCategoryRule | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [bulkDeletingRuleIds, setBulkDeletingRuleIds] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const categoriesQuery = useQuery({
    queryKey: QUERY_KEY_CATEGORIES,
    queryFn: () => financialCategoriesService.list({ limit: 300 }),
  });

  const categories = categoriesQuery.data ?? [];
  const categoriesByType = useMemo(() => buildCategoriesByType(categories), [categories]);

  const rulesQuery = useQuery({
    queryKey: QUERY_KEY_RULES,
    queryFn: () => financeCategoryRulesService.list(categories),
  });

  const customRules = rulesQuery.data ?? [];
  const allRules = useMemo(
    () => [...SYSTEM_FINANCE_CATEGORY_RULES, ...customRules],
    [customRules],
  );

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRules.filter((rule) => {
      const searchable = `${rule.keywords.join(" ")} ${rule.categoryName}`.toLowerCase();
      if (term && !searchable.includes(term)) return false;
      if (filterType !== "all" && rule.transactionType !== filterType) return false;
      if (filterOrigin !== "all" && rule.origin !== filterOrigin) return false;
      if (filterStatus === "active" && !rule.active) return false;
      if (filterStatus === "inactive" && rule.active) return false;
      return true;
    });
  }, [allRules, filterOrigin, filterStatus, filterType, search]);

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filteredRules, 10);
  const visibleSelectableRuleIds = pageItems.filter((rule) => rule.origin !== "SISTEMA").map((rule) => rule.id);
  const selectedVisibleRuleIds = visibleSelectableRuleIds.filter((id) => selectedRuleIds.includes(id));
  const allVisibleSelectableSelected = visibleSelectableRuleIds.length > 0 && visibleSelectableRuleIds.every((id) => selectedRuleIds.includes(id));

  const createMutation = useMutation({
    mutationFn: financeCategoryRulesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_RULES });
      toast.success("Regra personalizada criada");
      setModalOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft, expectedUpdatedAt }: { id: string; draft: FinanceCategoryRuleDraft; expectedUpdatedAt?: string }) =>
      financeCategoryRulesService.update(id, draft, expectedUpdatedAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_RULES });
      toast.success("Regra personalizada atualizada");
      setModalOpen(false);
      setEditingRule(null);
    },
    onError: (error: Error) => {
      if (handleConcurrencyConflict(error, "regra de categorização")) return;
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: financeCategoryRulesService.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_RULES });
      toast.success("Regra personalizada removida");
      setDeletingRule(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => runBulkAction(ids, (id) => financeCategoryRulesService.remove(id)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_RULES });
      reportBulkResult(result, "removida", "regra personalizada");
      setSelectedRuleIds((current) => current.filter((id) => !result.succeeded.includes(id)));
      setBulkDeletingRuleIds([]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingRule(null);
    setValidationErrors([]);
    setModalOpen(true);
  };

  const openEdit = (rule: FinanceCategoryRule) => {
    setEditingRule(rule);
    setValidationErrors([]);
    setModalOpen(true);
  };

  const toggleRuleSelection = (id: string) => {
    setSelectedRuleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllRuleSelection = () => {
    setSelectedRuleIds((current) => {
      if (allVisibleSelectableSelected) return current.filter((id) => !visibleSelectableRuleIds.includes(id));
      return Array.from(new Set([...current, ...visibleSelectableRuleIds]));
    });
  };

  const confirmBulkDeleteRules = () => {
    if (bulkDeletingRuleIds.length === 0) return;
    bulkDeleteMutation.mutate(bulkDeletingRuleIds);
  };

  const handleSubmit = (draft: FinanceCategoryRuleDraft) => {
    const normalizedDraft = { ...draft, keywords: parseKeywords(draft.keywords) };
    const validation = validateRule(normalizedDraft, allRules, editingRule?.id);
    setValidationErrors(validation.errors);
    if (!validation.valid) return;

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, draft: normalizedDraft, expectedUpdatedAt: getExpectedUpdatedAt(editingRule) });
      return;
    }
    createMutation.mutate(normalizedDraft);
  };

  const canSubmit = createMutation.isPending || updateMutation.isPending;

  return (
    <MainLayout
      title="Regras de Categorização Financeira"
      description="Categorize receitas e despesas automaticamente por palavras-chave, type e prioridade."
      actions={
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nova Regra
        </Button>
      }
    >
      <FeatureGate feature="moduleAccounting" featureName="Financeiro">
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap rounded-lg bg-muted/30 p-3">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 h-8 text-sm bg-card border-border"
                value={search}
                placeholder="Buscar por palavra-chave ou categoria"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={filterType}
              onValueChange={(value) => {
                if (value === "all" || isFinanceRuleTransactionType(value)) setFilterType(value);
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="RECEITA">Receita</SelectItem>
                <SelectItem value="DESPESA">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterOrigin}
              onValueChange={(value) => {
                if (value === "all" || isFinanceCategoryRuleOrigin(value)) setFilterOrigin(value);
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="SISTEMA">Sistema</SelectItem>
                <SelectItem value="PERSONALIZADA">Personalizada</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                if (isRuleStatusFilter(value)) setFilterStatus(value);
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <ListSectionHeader
                title="Regras de Categorização"
                count={filteredRules.length}
                action={visibleSelectableRuleIds.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={allVisibleSelectableSelected}
                      onCheckedChange={toggleAllRuleSelection}
                      aria-label="Selecionar todas as regras personalizadas"
                      data-testid="checkbox-select-all-rules"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedVisibleRuleIds.length > 0 ? `${selectedVisibleRuleIds.length} selecionada(s)` : "Selecionar todos"}
                    </span>
                    {selectedVisibleRuleIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setBulkDeletingRuleIds(selectedVisibleRuleIds)}
                        data-testid="button-delete-selected-rules"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Selecionados
                      </Button>
                    )}
                  </div>
                ) : undefined}
                description="Acompanhe regras, palavras-chave, categorias, origem e status"
                className="px-6 pt-6"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Palavras-chave</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-20 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesQuery.isLoading ? (
                    Array.from({ length: 4 }, (_, index) => (
                      <TableRow key={`rule-skeleton-${index}`}>
                        {Array.from({ length: 6 }, (_unused, cellIndex) => (
                          <TableCell key={`rule-skeleton-${index}-${cellIndex}`}>
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        Nenhuma regra encontrada com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRuleIds.includes(rule.id)}
                            disabled={rule.origin === "SISTEMA"}
                            onCheckedChange={() => toggleRuleSelection(rule.id)}
                            aria-label={`Selecionar regra ${rule.categoryName}`}
                            data-testid={`checkbox-rule-${rule.id}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[420px]">
                          <div className="flex flex-wrap gap-1.5">
                            {rule.keywords.map((keyword) => (
                              <Badge key={`${rule.id}-${keyword}`} variant="secondary">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{rule.categoryName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Atualizada em {new Date(rule.updatedAt).toLocaleDateString("pt-BR")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={TYPE_BADGE[rule.transactionType]}>
                            {FINANCE_RULE_TRANSACTION_LABEL[rule.transactionType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={ORIGIN_BADGE[rule.origin]}>
                              {rule.origin === "SISTEMA" ? "Sistema" : "Personalizada"}
                            </Badge>
                            {!rule.active && <Badge variant="outline">Inativa</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ações da regra">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingRule(rule)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={rule.origin === "SISTEMA"} onClick={() => openEdit(rule)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={rule.origin === "SISTEMA"} onClick={() => setDeletingRule(rule)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredRules.length > 0 && (
                <TablePagination
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="regras"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <FinanceCategoryRuleModal
          open={modalOpen}
          rule={editingRule}
          isSubmitting={canSubmit}
          categoriesByType={categoriesByType}
          validationErrors={validationErrors}
          onClose={() => {
            setModalOpen(false);
            setEditingRule(null);
            setValidationErrors([]);
          }}
          onSubmit={handleSubmit}
        />

        <AlertDialog open={bulkDeletingRuleIds.length > 0} onOpenChange={(open) => !open && setBulkDeletingRuleIds([])}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir regras selecionadas?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação remove as regras personalizadas selecionadas. As regras de sistema continuam protegidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  confirmBulkDeleteRules();
                }}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(deletingRule)} onOpenChange={(open) => !open && setDeletingRule(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir regra personalizada?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação remove a regra do backend. Regras de sistema continuam protegidas e não podem ser excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingRule && deleteMutation.mutate(deletingRule.id)}
                disabled={deleteMutation.isPending}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={Boolean(viewingRule)} onOpenChange={(open) => !open && setViewingRule(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Detalhes da regra financeira</DialogTitle>
              <DialogDescription>
                Visualização da regra de categorização automática.
              </DialogDescription>
            </DialogHeader>
            {viewingRule && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs  tracking-wide text-muted-foreground">Tipo</p>
                    <Badge variant={TYPE_BADGE[viewingRule.transactionType]}>
                      {FINANCE_RULE_TRANSACTION_LABEL[viewingRule.transactionType]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs  tracking-wide text-muted-foreground">Origem</p>
                    <Badge variant={ORIGIN_BADGE[viewingRule.origin]}>
                      {viewingRule.origin === "SISTEMA" ? "Sistema" : "Personalizada"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs  tracking-wide text-muted-foreground">Categoria</p>
                  <p className="mt-1 font-medium">{viewingRule.categoryName}</p>
                </div>
                <div>
                  <p className="text-xs  tracking-wide text-muted-foreground">Palavras-chave</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {viewingRule.keywords.map((keyword) => (
                      <Badge key={`view-${viewingRule.id}-${keyword}`} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs  tracking-wide text-muted-foreground">Status</p>
                    <p>{viewingRule.active ? "Ativa" : "Inativa"}</p>
                  </div>
                  <div>
                    <p className="text-xs  tracking-wide text-muted-foreground">Prioridade</p>
                    <p>{viewingRule.priority ?? "Padrão"}</p>
                  </div>
                  <div>
                    <p className="text-xs  tracking-wide text-muted-foreground">Atualização</p>
                    <p>{new Date(viewingRule.updatedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </MainLayout>
  );
}

