import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Plus, Trash2, Calculator } from "lucide-react";
import type { InvoiceFormData, InvoiceFormRules, InvoiceLineItem } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";
import type { InvoiceValidationErrors } from "@/modules/accounting/components/invoice-form/validation/invoice-form-validation";

const fmt = (v: number) =>
  `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface InvoiceItemsSectionProps {
  formData: InvoiceFormData;
  rules: InvoiceFormRules;
  validationErrors: InvoiceValidationErrors;
  disabled: boolean;
  updateField: <K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => void;
  updateItem: (index: number, field: keyof InvoiceLineItem, value: any) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  recalculateTaxes: () => void;
}

export function InvoiceItemsSection({
  formData,
  rules,
  validationErrors,
  disabled,
  updateField,
  updateItem,
  addItem,
  removeItem,
  recalculateTaxes,
}: InvoiceItemsSectionProps) {
  return (
    <>
      {/* ── SERVIÇOS / ITENS ── */}
      <section className="space-y-4" data-testid="section-servicos">
        <h3 className="text-base font-semibold border-b pb-1">Serviços</h3>

        <div className="space-y-2">
          <Label>Descrição dos Serviços</Label>
          <Textarea
            value={formData.service_description}
            onChange={(e) => updateField("service_description", e.target.value)}
            placeholder="Descrição completa dos serviços prestados..."
            rows={3}
            disabled={disabled}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Itens da Nota</CardTitle>
            {!disabled && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addItem}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.itens.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-lg"
                data-testid={`item-nota-${i}`}
              >
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <Label className="text-xs">Cód. Serviço</Label>
                  <Input
                    value={item.codigo_servico}
                    onChange={(e) => updateItem(i, "codigo_servico", e.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div className="col-span-3 md:col-span-1 space-y-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => updateItem(i, "quantidade", parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                  />
                </div>
                <div className="col-span-5 md:col-span-2 space-y-1">
                  <Label className="text-xs">Vlr Unit.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(i, "unit_price", parseFloat(e.target.value) || 0)
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="col-span-10 md:col-span-1 space-y-1">
                  <Label className="text-xs">Total</Label>
                  <p className="text-sm font-semibold pt-2">{fmt(item.total_amount)}</p>
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-end">
                  {!disabled && formData.itens.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(i)}
                      data-testid={`button-remove-item-${i}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-border">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total dos Serviços</p>
                <p
                  className="text-xl font-bold text-foreground"
                  data-testid="text-total-servicos"
                >
                  {fmt(formData.service_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── TRIBUTOS ── */}
      <section className="space-y-4" data-testid="section-tributos">
        <h3 className="text-base font-semibold border-b pb-1">Tributos</h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{rules.tributosSectionDesc}</p>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={recalculateTaxes}
              data-testid="button-recalcular"
            >
              <Calculator className="h-4 w-4 mr-1" />
              Recalcular
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Valor dos Serviços
              {validationErrors.service_amount && (
                <span className="text-destructive ml-1 text-xs">{validationErrors.service_amount}</span>
              )}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={formData.service_amount}
              onChange={(e) => updateField("service_amount", parseFloat(e.target.value) || 0)}
              disabled={disabled}
              aria-invalid={!!validationErrors.service_amount}
              className={validationErrors.service_amount ? "border-destructive" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Deduções</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.deductions_amount}
              onChange={(e) => updateField("deductions_amount", parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Base de Cálculo</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.base_calculo}
              onChange={(e) => updateField("base_calculo", parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ISS</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Alíquota ISS (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.aliquota_iss}
                onChange={(e) => updateField("aliquota_iss", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor ISS</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.iss_amount}
                onChange={(e) => updateField("iss_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>ISS Retido na Fonte?</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={formData.iss_retido}
                  onCheckedChange={(v) => updateField("iss_retido", v)}
                  disabled={disabled}
                />
                <span className="text-sm">
                  {formData.iss_retido
                    ? "Sim (retido pelo tomador)"
                    : "Não (recolhido pelo prestador)"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Retenções Federais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>PIS</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.pis_amount}
                onChange={(e) => updateField("pis_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>COFINS</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cofins_amount}
                onChange={(e) => updateField("cofins_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>IRRF</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.ir_amount}
                onChange={(e) => updateField("ir_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>CSLL</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.csll_amount}
                onChange={(e) => updateField("csll_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>INSS</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.inss_amount}
                onChange={(e) => updateField("inss_amount", parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{rules.valorLiquidoLabel}</p>
              <p className="text-2xl font-bold text-primary" data-testid="text-valor-liquido">
                {fmt(formData.net_amount)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Bruto: {fmt(formData.service_amount)}</p>
              <p>
                Total Retenções:{" "}
                {fmt(
                  (formData.iss_retido ? formData.iss_amount : 0) +
                    formData.pis_amount +
                    formData.cofins_amount +
                    formData.ir_amount +
                    formData.csll_amount +
                    (formData.inss_amount || 0),
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
