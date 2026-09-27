import { useState, useEffect } from "react";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { MonthPickerField } from "@/shared/ui/month-picker-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { payrollEntrySchema } from "@/modules/hr/schemas/payroll-entry-schema";
import { usePayroll, PAYMENT_STATUS } from "@/modules/hr/hooks/usePayroll";
import type { PayrollEntry } from "@/modules/hr/hooks/usePayroll";
import type { Employee } from "@/modules/hr/hooks/useEmployees";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";

interface PayrollFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: PayrollEntry | null;
  mode: "create" | "edit" | "view";
}

export function PayrollFormModal({
  open,
  onOpenChange,
  record,
  mode,
}: PayrollFormModalProps) {
  const { addPayrollEntry, updatePayrollEntry } = usePayroll();

  const [employeeId, setEmployeeId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [grossSalary, setGrossSalary] = useState<number | "">("");
  const [discounts, setDiscounts] = useState<number | "">(0);
  const [bonus, setBonus] = useState<number | "">(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewMode = mode === "view";

  const netSalary =
    (typeof grossSalary === "number" ? grossSalary : 0) -
    (typeof discounts === "number" ? discounts : 0) +
    (typeof bonus === "number" ? bonus : 0);

  useEffect(() => {
    if (open && mode === "create") {
      setEmployeeId("");
      setReferenceMonth("");
      setGrossSalary("");
      setDiscounts(0);
      setBonus(0);
      setPaymentDate("");
      setStatus("pending");
      setNotes("");
    } else if (open && record) {
      setEmployeeId((record.funcionario_id as string) || "");
      setReferenceMonth((record.mes_referencia as string) || "");
      setGrossSalary((record.salario_bruto as number) ?? "");
      setDiscounts((record.descontos as number) ?? 0);
      setBonus((record.bonus as number) ?? 0);
      setPaymentDate((record.data_pagamento as string) || "");
      setStatus((record.status as string) || "pending");
      setNotes((record.observacoes as string) || "");
    }
  }, [open, mode, record]);

  const handleGrossSalaryChange = (value: string) => {
    const num = value === "" ? "" : parseFloat(value);
    setGrossSalary(num === "" || isNaN(num as number) ? "" : num);
  };

  const handleDiscountsChange = (value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setDiscounts(isNaN(num) ? 0 : num);
  };

  const handleBonusChange = (value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setBonus(isNaN(num) ? 0 : num);
  };

  const handleSubmit = async () => {
    const validation = payrollEntrySchema.safeParse({
      employeeId,
      referenceMonth,
      grossSalary: grossSalary !== "" ? Number(grossSalary) : null,
      descontos: discounts !== "" ? Number(discounts) : null,
      bonus: bonus !== "" ? Number(bonus) : null,
      paymentDate: paymentDate || "",
      status: status as "pending" | "processed" | "paid" | "cancelled",
      observacoes: notes || "",
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!employeeId) {
      toast.error("Selecione um funcionário");
      return;
    }
    if (!referenceMonth) {
      toast.error("Informe o mês de referência");
      return;
    }
    if (grossSalary === "" || grossSalary <= 0) {
      toast.error("Informe o salário bruto");
      return;
    }

    setIsSubmitting(true);

    const data = {
      funcionario_id: employeeId,
      mes_referencia: referenceMonth,
      salario_bruto: typeof grossSalary === "number" ? grossSalary : 0,
      descontos: typeof discounts === "number" ? discounts : 0,
      bonus: typeof bonus === "number" ? bonus : 0,
      salario_liquido: netSalary,
      data_pagamento: paymentDate || null,
      status,
      observacoes: notes.trim() || null,
    };

    try {
      if (mode === "create") {
        await addPayrollEntry.mutateAsync(data);
      } else if (record) {
        await updatePayrollEntry.mutateAsync({
          id: record.id,
          ...data,
          expectedUpdatedAt: getExpectedUpdatedAt(record),
        });
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "registro de pagamento")) return;
      // other errors: the toast is already shown by the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === "create"
      ? "Novo Registro de Pagamento"
      : mode === "edit"
        ? "Editar Registro de Pagamento"
        : "Visualizar Registro de Pagamento";

  // Task I: resolves by direct ID (does not depend on the employee being among
  // the first ones loaded by useFuncionarios() without a filter).
  const { entity: selectedEmployee } = useEntityById<Employee>("funcionarios", employeeId || undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="folha-pagamento-form-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="folha-pagamento-form-title">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <AsyncEntityCombobox<Employee>
              table="funcionarios"
              value={employeeId || null}
              getLabel={(f) => `${f.name ?? ""} - ${f.cargo || "Sem cargo"}`}
              onChange={setEmployeeId}
              placeholder="Selecione o funcionário"
              searchPlaceholder="Buscar por nome…"
              emptyText="Nenhum funcionário encontrado"
              disabled={isViewMode}
              data-testid="select-funcionario-id"
            />
            {selectedEmployee && (
              <p className="text-xs text-muted-foreground">
                Salário base: R${" "}
                {selectedEmployee.salario
                  ? Number(selectedEmployee.salario).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 }
                    )
                  : "N/A"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mês de Referência *</Label>
            <MonthPickerField
              value={referenceMonth}
              onChange={setReferenceMonth}
              disabled={isViewMode}
              placeholder="Selecione o mês"
              data-testid="monthpicker-mes-referencia"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Salário Bruto (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={grossSalary}
                onChange={(e) => handleGrossSalaryChange(e.target.value)}
                disabled={isViewMode}
                data-testid="input-salario-bruto"
              />
            </div>
            <div className="space-y-2">
              <Label>Descontos (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={discounts}
                onChange={(e) => handleDiscountsChange(e.target.value)}
                disabled={isViewMode}
                data-testid="input-descontos"
              />
            </div>
            <div className="space-y-2">
              <Label>Bônus (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={bonus}
                onChange={(e) => handleBonusChange(e.target.value)}
                disabled={isViewMode}
                data-testid="input-bonus"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Salário Líquido (R$)</Label>
            <Input
              type="text"
              value={`R$ ${netSalary.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}`}
              disabled
              className="font-semibold"
              data-testid="input-salario-liquido"
            />
            <p className="text-xs text-muted-foreground">
              Calculado automaticamente: Bruto - Descontos + Bônus
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Pagamento</Label>
              <DatePickerField
                value={paymentDate}
                onChange={setPaymentDate}
                disabled={isViewMode}
                placeholder="Selecione a data"
                data-testid="datepicker-data-pagamento"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={isViewMode}
              >
                <SelectTrigger data-testid="select-status-pagamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações sobre este pagamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isViewMode}
              rows={3}
              data-testid="input-observacoes-pagamento"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-pagamento"
          >
            {isViewMode ? "Fechar" : "Cancelar"}
          </Button>
          {!isViewMode && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-save-pagamento"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Criar Registro" : "Salvar Alterações"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

