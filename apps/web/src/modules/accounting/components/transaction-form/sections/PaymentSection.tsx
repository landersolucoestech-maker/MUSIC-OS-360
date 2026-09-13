import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  transactionStatusOptions,
  paymentMethods,
  paymentTypes,
  installmentIntervals,
} from "@/modules/accounting/constants/transaction-constants";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialRulesResult } from "@/modules/accounting/components/transaction-form/hooks/useFinancialRules";
import type { ValidationErrors } from "@/modules/accounting/components/transaction-form/validation/financial-form-validation";
import { FormSelectField } from "@/modules/accounting/components/transaction-form/components/FormSelectField";
import { FormInputField } from "@/modules/accounting/components/transaction-form/components/FormInputField";
import { FormDateField } from "@/modules/accounting/components/transaction-form/components/FormDateField";

interface PaymentSectionProps {
  formData:    TransactionFormData;
  rules:       FinancialRulesResult;
  errors:      ValidationErrors;
  disabled:    boolean;
  updateField: (field: keyof TransactionFormData, value: string) => void;
}

export function PaymentSection({
  formData,
  rules,
  errors,
  disabled,
  updateField,
}: PaymentSectionProps) {
  return (
    <Card className="bg-muted/30 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Valores e Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormInputField
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            value={formData.valor}
            onChange={(e) => updateField("valor", e.target.value)}
            disabled={disabled}
            placeholder="0,00"
            error={errors.valor}
            required
          />

          <FormSelectField
            label="Tipo de Pagamento"
            value={formData.tipoPagamento}
            onChange={(v) => updateField("tipoPagamento", v)}
            options={paymentTypes}
            disabled={disabled}
          />

          <FormSelectField
            label="Método de Pagamento"
            value={formData.formaPagamento}
            onChange={(v) => updateField("formaPagamento", v)}
            options={paymentMethods}
            placeholder="Ex: PIX, Boleto, Cartão..."
            error={errors.formaPagamento}
            disabled={disabled}
            required
          />

          <FormDateField
            label="Data da Transação"
            value={formData.dataTransacao}
            onChange={(iso) => updateField("dataTransacao", iso)}
            disabled={disabled}
            placeholder="Selecione a data"
            error={errors.dataTransacao}
            required
            data-testid="datepicker-data-transacao"
          />

          <FormSelectField
            label="Status"
            value={formData.status}
            onChange={(v) => updateField("status", v)}
            options={transactionStatusOptions}
            disabled={disabled}
          />
        </div>

        {rules.exibirParcelamento && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
            <FormInputField
              label="Quantidade de Parcelas"
              type="number"
              min="2"
              value={formData.quantidadeParcelas}
              onChange={(e) => updateField("quantidadeParcelas", e.target.value)}
              disabled={disabled}
              placeholder="Mínimo 2"
              error={errors.quantidadeParcelas}
              required
            />

            <FormSelectField
              label="Intervalo"
              value={formData.intervaloParcelas}
              onChange={(v) => updateField("intervaloParcelas", v)}
              options={installmentIntervals}
              disabled={disabled}
            />

            <FormDateField
              label="Data da 1ª Parcela"
              value={formData.dataPrimeiraParcela}
              onChange={(iso) => updateField("dataPrimeiraParcela", iso)}
              disabled={disabled}
              placeholder="Selecione a data"
              error={errors.dataPrimeiraParcela}
              required
              data-testid="datepicker-data-primeira-parcela"
            />

            {rules.valorParcela && (
              <div className="space-y-2">
                <p className="text-sm">Valor por Parcela</p>
                <div className="h-8 px-3 py-1 border border-border rounded-md bg-muted/50 flex items-center">
                  <span className="text-sm font-medium">R$ {rules.valorParcela}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
