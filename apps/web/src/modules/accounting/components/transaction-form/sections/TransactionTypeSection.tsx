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

interface Artista { id: string; nome_artistico: string }
interface Projeto { id: string; title: string }
interface Event { id: string; title: string; start_date?: string | null }

interface TransactionTypeSectionProps {
  formData: TransactionFormData;
  rules: FinancialRulesResult;
  categoryRules: FinancialCategoryRuleEntity[];
  errors: ValidationErrors;
  disabled: boolean;
  updateField: (field: keyof TransactionFormData, value: string) => void;
  filteredEvents: Event[];
}

export function TransactionTypeSection({
  formData,
  rules,
  categoryRules,
  errors,
  disabled,
  updateField,
  filteredEvents,
}: TransactionTypeSectionProps) {
  const transactionTypeOptions = useMemo(() => getTransactionTypes(categoryRules), [categoryRules]);
  const counterpartyOptions = useMemo(
    () => getCounterpartiesByType(categoryRules, formData.tipoTransacao),
    [categoryRules, formData.tipoTransacao],
  );
  const categoryOptions = useMemo(
    () => getCategoriesByCounterparty(categoryRules, formData.tipoTransacao, formData.tipoCliente),
    [categoryRules, formData.tipoCliente, formData.tipoTransacao],
  );
  const subcategoryOptions = useMemo(
    () => getSubcategoriesByCategory(categoryRules, formData.tipoTransacao, formData.tipoCliente, formData.categoria),
    [categoryRules, formData.categoria, formData.tipoCliente, formData.tipoTransacao],
  );
  const finalRule = useMemo(
    () => getFinalRule(
      categoryRules,
      formData.tipoTransacao,
      formData.tipoCliente,
      formData.categoria,
      formData.subcategoria,
    ),
    [categoryRules, formData.categoria, formData.subcategoria, formData.tipoCliente, formData.tipoTransacao],
  );
  const linkOptions = useMemo(() => getLinkOptions(finalRule), [finalRule]);
  const selectedLink = toRuleLink(formData.tipoVinculacao ?? "");

  const showCounterparty = Boolean(formData.tipoTransacao) && counterpartyOptions.length > 0;
  const showCategory = Boolean(formData.tipoCliente) && categoryOptions.length > 0;
  const showSubcategory = Boolean(formData.categoria) && subcategoryOptions.length > 0;
  const hasFinalRule = Boolean(finalRule);
  const showLinks = hasFinalRule && linkOptions.length > 0;

  const handleLinkChange = (value: string) => {
    updateField("tipoVinculacao", value);
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
            value={formData.tipoTransacao}
            onChange={(value) => updateField("tipoTransacao", value)}
            options={transactionTypeOptions}
            placeholder="Ex: Receita, Despesa, Imposto..."
            error={errors.tipoTransacao}
            disabled={disabled}
            required
          />

          {showCounterparty && (
            <FormSelectField
              label={formData.tipoTransacao === "receita" ? "Receber de" : "Pagar para"}
              value={formData.tipoCliente}
              onChange={(value) => updateField("tipoCliente", value)}
              options={counterpartyOptions}
              placeholder="Selecione"
              error={errors.tipoCliente}
              disabled={disabled}
              required
            />
          )}

          {showCategory && (
            <FormSelectField
              label="Categoria"
              value={formData.categoria}
              onChange={(value) => updateField("categoria", value)}
              options={categoryOptions}
              placeholder="Selecione a categoria"
              error={errors.categoria}
              disabled={disabled}
              required
            />
          )}

          {showSubcategory && (
            <FormSelectField
              label="Subcategoria"
              value={formData.subcategoria}
              onChange={(value) => updateField("subcategoria", value)}
              options={subcategoryOptions}
              placeholder="Selecione a subcategoria"
              error={errors.subcategoria}
              disabled={disabled}
              required
            />
          )}

          {showLinks && (
            <FormSelectField
              label="Vinculações"
              value={formData.tipoVinculacao ?? ""}
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
              <AsyncEntityCombobox<Artista>
                table="artistas"
                getLabel={(a) => a.nome_artistico}
                value={formData.artistaVinculado}
                onChange={(id) => updateField("artistaVinculado", id)}
                placeholder="Selecione o artista"
                searchPlaceholder="Buscar artista…"
                disabled={disabled}
                invalid={Boolean(errors.artistaVinculado)}
                data-testid="combobox-artista-vinculado"
              />
              <FieldError error={errors.artistaVinculado} />
            </div>
          )}

          {selectedLink === "Projeto" && (
            <div className="space-y-2">
              <Label className="text-sm">Projeto Vinculado *</Label>
              <AsyncEntityCombobox<Projeto>
                table="projects"
                getLabel={(p) => p.title}
                value={formData.projetoVinculado}
                onChange={(id) => updateField("projetoVinculado", id)}
                placeholder="Selecione o projeto"
                searchPlaceholder="Buscar projeto…"
                disabled={disabled}
                invalid={Boolean(errors.projetoVinculado)}
                data-testid="combobox-projeto-vinculado"
              />
              <FieldError error={errors.projetoVinculado} />
            </div>
          )}

          {selectedLink === "Contrato" && (
            <FormInputField
              label="Contrato Vinculado"
              value={formData.contratoVinculado}
              onChange={(event) => updateField("contratoVinculado", event.target.value)}
              disabled={disabled}
              placeholder="Informe o contrato"
            />
          )}

          {selectedLink === "Evento" && (
            <FormSelectField
              label="Show / Evento"
              value={formData.eventoVinculado}
              onChange={(value) => updateField("eventoVinculado", value)}
              options={(formData.artistaVinculado ? filteredEvents : filteredEvents).map((event) => ({
                value: event.id,
                label: event.start_date ? `${event.title} (${event.start_date})` : event.title,
              }))}
              placeholder={filteredEvents.length === 0 ? "Nenhum evento encontrado" : "Selecione o evento"}
              error={errors.eventoVinculado}
              disabled={disabled || filteredEvents.length === 0}
              required
            />
          )}

          {selectedLink === "Centro de custo" && (
            <FormInputField
              label="Centro de custo"
              value={formData.centroCusto ?? ""}
              onChange={(event) => updateField("centroCusto", event.target.value)}
              disabled={disabled}
              placeholder="Informe o centro de custo"
            />
          )}

          {selectedLink === "Competência" && (
            <FormInputField
              label="Competência"
              value={formData.competencia ?? ""}
              onChange={(event) => updateField("competencia", event.target.value)}
              disabled={disabled}
              placeholder="Ex: 05/2026"
            />
          )}

          {selectedLink === "Conta Origem" && (
            <FormInputField
              label="Conta Origem"
              value={formData.contaOrigem ?? ""}
              onChange={(event) => updateField("contaOrigem", event.target.value)}
              disabled={disabled}
              placeholder="Informe a conta de origem"
            />
          )}

          {selectedLink === "Conta Destino" && (
            <FormInputField
              label="Conta Destino"
              value={formData.contaDestino ?? ""}
              onChange={(event) => updateField("contaDestino", event.target.value)}
              disabled={disabled}
              placeholder="Informe a conta de destino"
            />
          )}

          {selectedLink === null && rules.exibirOrgaoArrecadador && formData.categoria && (
            <FormInputField
              label="Órgão Arrecadador"
              value={formData.orgaoArrecadador}
              onChange={(event) => updateField("orgaoArrecadador", event.target.value)}
              disabled={disabled}
              placeholder="Informe o órgão arrecadador"
              error={errors.orgaoArrecadador}
            />
          )}

          {selectedLink === "Projeto" && rules.exibirProjeto && formData.artistaVinculado && (
            <div className="space-y-2">
              <Label className="text-sm">
                Projeto / Música{rules.projetoObrigatorio ? "" : " (opcional)"}
              </Label>
              <AsyncEntityCombobox<Projeto>
                table="projects"
                getLabel={(p) => p.title}
                value={formData.projetoVinculado}
                onChange={(id) => updateField("projetoVinculado", id)}
                filters={{ artistId: formData.artistaVinculado }}
                placeholder="Selecione o projeto"
                searchPlaceholder="Buscar projeto…"
                disabled={disabled}
                invalid={Boolean(errors.projetoVinculado)}
                data-testid="combobox-projeto-musica"
              />
              <FieldError error={errors.projetoVinculado} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

