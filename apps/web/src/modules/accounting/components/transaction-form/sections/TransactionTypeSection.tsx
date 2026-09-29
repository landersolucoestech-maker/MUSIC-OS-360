import { formatDate } from "@/shared/lib/format-utils";
import { Button } from "@/shared/ui/button";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { FieldError } from "@/shared/components/FormField";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialRulesResult } from "@/modules/accounting/components/transaction-form/hooks/useFinancialRules";
import type { ValidationErrors } from "@/modules/accounting/components/transaction-form/validation/financial-form-validation";
import { FormSelectField } from "@/modules/accounting/components/transaction-form/components/FormSelectField";
import { FormInputField } from "@/modules/accounting/components/transaction-form/components/FormInputField";
import type { FinancialCategoryRuleEntity } from "@/modules/accounting/types/financial-category-rules.types";
import {
  getCategoriesByCounterparty,
  getCounterpartiesByType,
  getFinalRule,
  getLinkOptions,
  getSubcategoriesByCategory,
  getTransactionTypes,
  toRuleLink,
} from "@/modules/accounting/utils/financialRules.utils";

interface Artist { id: string; stage_name: string }
interface Project { id: string; title: string }
interface Event { id: string; title: string; starts_at?: string | null }

interface TransactionTypeSectionProps {
  formData: TransactionFormData;
  rules: FinancialRulesResult;
  categoryRules: FinancialCategoryRuleEntity[];
  errors: ValidationErrors;
  disabled: boolean;
  updateField: (field: keyof TransactionFormData, value: string) => void;
  filteredEvents: Event[];
  eventsStatus?: { isLoading: boolean; error: Error | null; truncated: boolean; refetch: () => void };
}

export function TransactionTypeSection({
  formData,
  rules,
  categoryRules,
  errors,
  disabled,
  updateField,
  filteredEvents,
  eventsStatus,
}: TransactionTypeSectionProps) {
  // The picker never claims "no events" while the artist's events load or after the sweep failed.
  const eventsPending = !!eventsStatus && (eventsStatus.isLoading || !!eventsStatus.error);
  const eventsPlaceholder = eventsStatus?.isLoading
    ? "Carregando eventos…"
    : eventsStatus?.error
      ? "Eventos indisponíveis"
      : filteredEvents.length === 0 ? "Nenhum evento encontrado" : "Selecione o evento";
  const transactionTypeOptions = useMemo(() => getTransactionTypes(categoryRules), [categoryRules]);
  const counterpartyOptions = useMemo(
    () => getCounterpartiesByType(categoryRules, formData.transactionType),
    [categoryRules, formData.transactionType],
  );
  const categoryOptions = useMemo(
    () => getCategoriesByCounterparty(categoryRules, formData.transactionType, formData.counterpartyType),
    [categoryRules, formData.counterpartyType, formData.transactionType],
  );
  const subcategoryOptions = useMemo(
    () => getSubcategoriesByCategory(categoryRules, formData.transactionType, formData.counterpartyType, formData.category),
    [categoryRules, formData.category, formData.counterpartyType, formData.transactionType],
  );
  const finalRule = useMemo(
    () => getFinalRule(
      categoryRules,
      formData.transactionType,
      formData.counterpartyType,
      formData.category,
      formData.subcategory,
    ),
    [categoryRules, formData.category, formData.subcategory, formData.counterpartyType, formData.transactionType],
  );
  const linkOptions = useMemo(() => getLinkOptions(finalRule), [finalRule]);
  const selectedLink = toRuleLink(formData.linkType ?? "");

  const showCounterparty = Boolean(formData.transactionType) && counterpartyOptions.length > 0;
  const showCategory = Boolean(formData.counterpartyType) && categoryOptions.length > 0;
  const showSubcategory = Boolean(formData.category) && subcategoryOptions.length > 0;
  const hasFinalRule = Boolean(finalRule);
  const showLinks = hasFinalRule && linkOptions.length > 0;

  const handleLinkChange = (value: string) => {
    updateField("linkType", value);
  };

  return (
    <Card className="bg-muted/30 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Classificação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <FormSelectField
            label="Tipo de Transação"
            value={formData.transactionType}
            onChange={(value) => updateField("transactionType", value)}
            options={transactionTypeOptions}
            placeholder="Ex: Receita, Despesa, Imposto..."
            error={errors.transactionType}
            disabled={disabled}
            required
          />

          {showCounterparty && (
            <FormSelectField
              label={formData.transactionType === "revenue" ? "Receber de" : "Pagar para"}
              value={formData.counterpartyType}
              onChange={(value) => updateField("counterpartyType", value)}
              options={counterpartyOptions}
              placeholder="Selecione"
              error={errors.counterpartyType}
              disabled={disabled}
              required
            />
          )}

          {showCategory && (
            <FormSelectField
              label="Categoria"
              value={formData.category}
              onChange={(value) => updateField("category", value)}
              options={categoryOptions}
              placeholder="Selecione a categoria"
              error={errors.category}
              disabled={disabled}
              required
            />
          )}

          {showSubcategory && (
            <FormSelectField
              label="Subcategoria"
              value={formData.subcategory}
              onChange={(value) => updateField("subcategory", value)}
              options={subcategoryOptions}
              placeholder="Selecione a subcategoria"
              error={errors.subcategory}
              disabled={disabled}
              required
            />
          )}

          {showLinks && (
            <FormSelectField
              label="Vinculações"
              value={formData.linkType ?? ""}
              onChange={handleLinkChange}
              options={linkOptions}
              placeholder="Selecione o vínculo"
              disabled={disabled}
              required
            />
          )}

          {selectedLink === "Artista" && (
            <div className="space-y-2">
              <Label className="text-sm">Artista Vinculado *</Label>
              <AsyncEntityCombobox<Artist>
                table="artists"
                getLabel={(a) => a.stage_name}
                value={formData.artistId}
                onChange={(id) => updateField("artistId", id)}
                placeholder="Selecione o artista"
                searchPlaceholder="Buscar artista…"
                disabled={disabled}
                invalid={Boolean(errors.artistId)}
                data-testid="combobox-artista-vinculado"
              />
              <FieldError error={errors.artistId} />
            </div>
          )}

          {selectedLink === "Projeto" && (
            <div className="space-y-2">
              <Label className="text-sm">Projeto Vinculado *</Label>
              <AsyncEntityCombobox<Project>
                table="projects"
                getLabel={(p) => p.title}
                value={formData.projectId}
                onChange={(id) => updateField("projectId", id)}
                placeholder="Selecione o projeto"
                searchPlaceholder="Buscar projeto…"
                disabled={disabled}
                invalid={Boolean(errors.projectId)}
                data-testid="combobox-projeto-vinculado"
              />
              <FieldError error={errors.projectId} />
            </div>
          )}

          {selectedLink === "Contrato" && (
            <FormInputField
              label="Contrato Vinculado"
              value={formData.contractId}
              onChange={(event) => updateField("contractId", event.target.value)}
              disabled={disabled}
              placeholder="Informe o contrato"
            />
          )}

          {selectedLink === "Evento" && (
            <FormSelectField
              label="Show / Evento"
              value={formData.eventId}
              onChange={(value) => updateField("eventId", value)}
              options={filteredEvents.map((event) => ({
                value: event.id,
                label: event.starts_at ? `${event.title} (${formatDate(event.starts_at)})` : event.title,
              }))}
              placeholder={eventsPlaceholder}
              error={errors.eventId}
              disabled={disabled || eventsPending || filteredEvents.length === 0}
              required
            />
          )}
          {selectedLink === "Evento" && eventsStatus?.error && (
            <div className="flex items-center gap-2 text-xs text-destructive" role="alert" data-testid="transaction-events-error">
              <span>Não foi possível carregar os eventos do artista.</span>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={eventsStatus.refetch}>
                Tentar novamente
              </Button>
            </div>
          )}
          {selectedLink === "Evento" && !eventsPending && eventsStatus?.truncated && (
            <p className="text-xs text-muted-foreground" role="status">A lista mostra apenas parte dos eventos deste artista.</p>
          )}

          {selectedLink === "Centro de custo" && (
            <FormInputField
              label="Centro de custo"
              value={formData.costCenter ?? ""}
              onChange={(event) => updateField("costCenter", event.target.value)}
              disabled={disabled}
              placeholder="Informe o centro de custo"
            />
          )}

          {selectedLink === "Competência" && (
            <FormInputField
              label="Competência"
              value={formData.referenceMonth ?? ""}
              onChange={(event) => updateField("referenceMonth", event.target.value)}
              disabled={disabled}
              placeholder="Ex: 05/2026"
              error={errors.referenceMonth}
            />
          )}

          {selectedLink === "Conta Origem" && (
            <FormInputField
              label="Conta Origem"
              value={formData.sourceBankAccount ?? ""}
              onChange={(event) => updateField("sourceBankAccount", event.target.value)}
              disabled={disabled}
              placeholder="Informe a conta de origem"
            />
          )}

          {selectedLink === "Conta Destino" && (
            <FormInputField
              label="Conta Destino"
              value={formData.destinationBankAccount ?? ""}
              onChange={(event) => updateField("destinationBankAccount", event.target.value)}
              disabled={disabled}
              placeholder="Informe a conta de destino"
            />
          )}

          {selectedLink === null && rules.exibirOrgaoArrecadador && formData.category && (
            <FormInputField
              label="Órgão Arrecadador"
              value={formData.taxAuthority}
              onChange={(event) => updateField("taxAuthority", event.target.value)}
              disabled={disabled}
              placeholder="Informe o órgão arrecadador"
              error={errors.taxAuthority}
            />
          )}

          {selectedLink === "Projeto" && rules.exibirProjeto && formData.artistId && (
            <div className="space-y-2">
              <Label className="text-sm">
                Projeto / Música{rules.projetoObrigatorio ? "" : " (opcional)"}
              </Label>
              <AsyncEntityCombobox<Project>
                table="projects"
                getLabel={(p) => p.title}
                value={formData.projectId}
                onChange={(id) => updateField("projectId", id)}
                filters={{ artistId: formData.artistId }}
                placeholder="Selecione o projeto"
                searchPlaceholder="Buscar projeto…"
                disabled={disabled}
                invalid={Boolean(errors.projectId)}
                data-testid="combobox-projeto-musica"
              />
              <FieldError error={errors.projectId} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

