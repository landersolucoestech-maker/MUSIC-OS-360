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
import { payrollEntrySchema } from "@/modules/rh/lib/folha-pagamento-schema";
import { usePayroll, PAYMENT_STATUS } from "@/modules/rh/hooks/usePayroll";
import type { PayrollEntry } from "@/modules/rh/hooks/usePayroll";
import type { Employee } from "@/modules/rh/hooks/useEmployees";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";

interface PayrollFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: PayrollEntry | null;
  mode: "create" | "edit" | "view";
}

export function PayrollFormModal({
  open,
  onOpenChange,
  registro,
  mode,
}: PayrollFormModalProps) {
  const { addPayrollEntry, updatePayrollEntry } = usePayroll();

  const [funcionarioId, setFuncionarioId] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [salarioBruto, setSalarioBruto] = useState<number | "">("");
  const [descontos, setDescontos] = useState<number | "">(0);
  const [bonus, setBonus] = useState<number | "">(0);
  const [dataPagamento, setDataPagamento] = useState("");
  const [status, setStatus] = useState("pending");
  const [observacoes, setObservacoes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewMode = mode === "view";

  const salarioLiquido =
    (typeof salarioBruto === "number" ? salarioBruto : 0) -
    (typeof descontos === "number" ? descontos : 0) +
    (typeof bonus === "number" ? bonus : 0);

  useEffect(() => {
    if (open && mode === "create") {
      setFuncionarioId("");
      setMesReferencia("");
      setSalarioBruto("");
      setDescontos(0);
      setBonus(0);
      setDataPagamento("");
      setStatus("pending");
      setObservacoes("");
    } else if (open && registro) {
      setFuncionarioId((registro.funcionario_id as string) || "");
      setMesReferencia((registro.mes_referencia as string) || "");
      setSalarioBruto((registro.salario_bruto as number) ?? "");
      setDescontos((registro.descontos as number) ?? 0);
      setBonus((registro.bonus as number) ?? 0);
      setDataPagamento((registro.data_pagamento as string) || "");
      setStatus((registro.status as string) || "pending");
      setObservacoes((registro.observacoes as string) || "");
    }
  }, [open, mode, registro]);

  const handleSalarioBrutoChange = (value: string) => {
    const num = value === "" ? "" : parseFloat(value);
    setSalarioBruto(num === "" || isNaN(num as number) ? "" : num);
  };

  const handleDescontosChange = (value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setDescontos(isNaN(num) ? 0 : num);
  };

  const handleBonusChange = (value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setBonus(isNaN(num) ? 0 : num);
  };

  const handleSubmit = async () => {
    const validation = payrollEntrySchema.safeParse({
      employeeId: funcionarioId,
      referenceMonth: mesReferencia,
      grossSalary: salarioBruto !== "" ? Number(salarioBruto) : null,
      descontos: descontos !== "" ? Number(descontos) : null,
      bonus: bonus !== "" ? Number(bonus) : null,
      paymentDate: dataPagamento || "",
      status: status as "pending" | "processed" | "paid" | "cancelled",
      observacoes: observacoes || "",
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!funcionarioId) {
      toast.error("Selecione um funcionário");
      return;
    }
    if (!mesReferencia) {
      toast.error("Informe o mês de referência");
      return;
    }
    if (salarioBruto === "" || salarioBruto <= 0) {
      toast.error("Informe o salário bruto");
      return;
    }

    setIsSubmitting(true);

    const data = {
      funcionario_id: funcionarioId,
      mes_referencia: mesReferencia,
      salario_bruto: typeof salarioBruto === "number" ? salarioBruto : 0,
      descontos: typeof descontos === "number" ? descontos : 0,
      bonus: typeof bonus === "number" ? bonus : 0,
      salario_liquido: salarioLiquido,
      data_pagamento: dataPagamento || null,
      status,
      observacoes: observacoes.trim() || null,
    };

    try {
      if (mode === "create") {
        await addPayrollEntry.mutateAsync(data);
      } else if (registro) {
        await updatePayrollEntry.mutateAsync({
          id: registro.id,
          ...data,
          expectedUpdatedAt: getExpectedUpdatedAt(registro),
        });
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "registro de pagamento")) return;
      // demais erros: toast já é exibido pelo hook
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

  // Task I: resolve por ID direto (não depende do funcionário estar entre
  // os primeiros carregados por useFuncionarios() sem filtro).
  const { entity: funcionarioSelecionado } = useEntityById<Employee>("funcionarios", funcionarioId || undefined);

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
              value={funcionarioId || null}
              getLabel={(f) => `${f.nome ?? ""} - ${f.cargo || "Sem cargo"}`}
              onChange={setFuncionarioId}
              placeholder="Selecione o funcionário"
              searchPlaceholder="Buscar por nome…"
              emptyText="Nenhum funcionário encontrado"
              disabled={isViewMode}
              data-testid="select-funcionario-id"
            />
            {funcionarioSelecionado && (
              <p className="text-xs text-muted-foreground">
                Salário base: R${" "}
                {funcionarioSelecionado.salario
                  ? Number(funcionarioSelecionado.salario).toLocaleString(
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
              value={mesReferencia}
              onChange={setMesReferencia}
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
                value={salarioBruto}
                onChange={(e) => handleSalarioBrutoChange(e.target.value)}
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
                value={descontos}
                onChange={(e) => handleDescontosChange(e.target.value)}
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
              value={`R$ ${salarioLiquido.toLocaleString("pt-BR", {
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
                value={dataPagamento}
                onChange={setDataPagamento}
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
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
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

