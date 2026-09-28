import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { isFinanceRuleTransactionType, parseKeywords } from "../utils/financialCategorizationRules.utils";
import type {
  FinanceCategoryRule,
  FinanceCategoryRuleDraft,
  FinanceRuleTransactionType,
} from "../types/financial-categories.types";

interface FinanceCategoryRuleModalProps {
  open: boolean;
  rule: FinanceCategoryRule | null;
  isSubmitting: boolean;
  categoriesByType: Record<FinanceRuleTransactionType, Array<{ id: string; name: string }>>;
  validationErrors: string[];
  onClose: () => void;
  onSubmit: (draft: FinanceCategoryRuleDraft) => void;
}

const EMPTY_DRAFT: FinanceCategoryRuleDraft = {
  keywords: [],
  transactionType: "EXPENSE",
  categoryId: "",
  categoryName: "",
  priority: 100,
  active: true,
};

export function FinanceCategoryRuleModal({
  open,
  rule,
  isSubmitting,
  categoriesByType,
  validationErrors,
  onClose,
  onSubmit,
}: FinanceCategoryRuleModalProps) {
  const [draft, setDraft] = useState<FinanceCategoryRuleDraft>(EMPTY_DRAFT);
  const [keywordText, setKeywordText] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = rule
      ? {
          keywords: rule.keywords,
          transactionType: rule.transactionType,
          categoryId: rule.categoryId,
          categoryName: rule.categoryName,
          priority: rule.priority ?? 100,
          active: rule.active,
        }
      : EMPTY_DRAFT;
    setDraft(next);
    setKeywordText(next.keywords.join(", "));
  }, [open, rule]);

  const categoryOptions = useMemo(
    () => categoriesByType[draft.transactionType] ?? [],
    [categoriesByType, draft.transactionType],
  );

  const handleTypeChange = (value: FinanceRuleTransactionType) => {
    setDraft((current) => ({
      ...current,
      transactionType: value,
      categoryId: "",
      categoryName: "",
    }));
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categoryOptions.find((item) => item.id === categoryId);
    setDraft((current) => ({
      ...current,
      categoryId,
      categoryName: category?.name ?? "",
    }));
  };

  const handleSubmit = () => {
    onSubmit({
      ...draft,
      keywords: parseKeywords(keywordText),
      priority: draft.priority === undefined ? undefined : Number(draft.priority),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra de categorização"}</DialogTitle>
          <DialogDescription>
            Configure palavras-chave para categorizar automaticamente receitas e despesas importadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo da transação</Label>
              <Select
                value={draft.transactionType}
                onValueChange={(value) => {
                  if (isFinanceRuleTransactionType(value)) handleTypeChange(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVENUE">Receita</SelectItem>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={draft.categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-keywords">Palavras-chave</Label>
            <Textarea
              id="rule-keywords"
              rows={3}
              value={keywordText}
              placeholder="Ex: spotify, deezer, distribuidora"
              onChange={(event) => setKeywordText(event.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {parseKeywords(keywordText).map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="rule-priority">Prioridade</Label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                value={draft.priority ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Regra ativa</p>
                <p className="text-xs text-muted-foreground">Regras inativas não categorizam transações.</p>
              </div>
              <Switch checked={draft.active} onCheckedChange={(active) => setDraft((current) => ({ ...current, active }))} />
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : rule ? "Salvar alterações" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
