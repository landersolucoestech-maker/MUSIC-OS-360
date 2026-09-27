import { useState, useEffect, useMemo } from "react";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { leaveRequestSchema } from "@/modules/hr/schemas/leave-request-schema";
import {
  useLeaveRequests,
  LEAVE_TYPES,
  LEAVE_STATUS,
} from "@/modules/hr/hooks/useLeaveRequests";
import type { LeaveRequest, LeaveRequestInsert } from "@/modules/hr/hooks/useLeaveRequests";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useEmployees, type Employee } from "@/modules/hr/hooks/useEmployees";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";

interface LeaveRequestFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ausencia?: LeaveRequest | null;
  mode: "create" | "edit" | "view";
}

function countLeaveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const d1 = new Date(start + "T00:00:00");
  const d2 = new Date(end + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diff = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

export function LeaveRequestFormModal({
  open,
  onOpenChange,
  ausencia,
  mode,
}: LeaveRequestFormModalProps) {
  const { addLeaveRequest, updateLeaveRequest } = useLeaveRequests();
  const { isLoading: loadingEmployees } = useEmployees();

  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [approvedBy, setApprovedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isViewMode = mode === "view";

  const totalDays = useMemo(() => countLeaveDays(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    if (open && mode === "edit" && ausencia) {
      setEmployeeId((ausencia.funcionario_id as string) || "");
      setType((ausencia.type as string) || "");
      setStartDate((ausencia.start_date as string) || "");
      setEndDate((ausencia.end_date as string) || "");
      setStatus((ausencia.status as string) || "pending");
      setApprovedBy((ausencia.aprovado_por as string) || "");
      setNotes((ausencia.observacoes as string) || "");
      setErrors({});
    } else if (open && mode === "view" && ausencia) {
      setEmployeeId((ausencia.funcionario_id as string) || "");
      setType((ausencia.type as string) || "");
      setStartDate((ausencia.start_date as string) || "");
      setEndDate((ausencia.end_date as string) || "");
      setStatus((ausencia.status as string) || "pending");
      setApprovedBy((ausencia.aprovado_por as string) || "");
      setNotes((ausencia.observacoes as string) || "");
      setErrors({});
    } else if (open && mode === "create") {
      setEmployeeId("");
      setType("");
      setStartDate("");
      setEndDate("");
      setStatus("pending");
      setApprovedBy("");
      setNotes("");
      setErrors({});
    }
  }, [open, mode, ausencia]);

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const result = leaveRequestSchema.safeParse({
      employeeId,
      type,
      startDate,
      endDate,
      status: status as "pending" | "approved" | "rejected" | "in_progress" | "completed",
      approvedBy: approvedBy || "",
      observacoes: notes || "",
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field && !newErrors[String(field)]) {
          newErrors[String(field)] = err.message;
        }
      });
      // Map schema field names back to the original error keys
      if (newErrors.employeeId) newErrors.funcionario_id = newErrors.employeeId;
      if (newErrors.startDate) newErrors.start_date = newErrors.startDate;
      if (newErrors.endDate) newErrors.end_date = newErrors.endDate;
      setErrors(newErrors);
      return false;
    }

    // Extra date range check not covered by schema
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setErrors({ end_date: "Data fim deve ser igual ou posterior à data início" });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    const data: LeaveRequestInsert = {
      funcionario_id: employeeId,
      type: type || null,
      start_date: startDate,
      end_date: endDate,
      dias_totais: totalDays,
      status,
      aprovado_por: approvedBy.trim() || null,
      observacoes: notes.trim() || null,
    };

    if (mode === "create") {
      addLeaveRequest.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    } else if (mode === "edit" && ausencia) {
      updateLeaveRequest.mutate(
        { id: ausencia.id, ...data, expectedUpdatedAt: getExpectedUpdatedAt(ausencia) },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err) => { handleConcurrencyConflict(err, "registro de férias/ausência"); },
        }
      );
    }
  };

  const title =
    mode === "create"
      ? "Nova Férias/Ausência"
      : mode === "edit"
        ? "Editar Férias/Ausência"
        : "Visualizar Férias/Ausência";

  const isPending = addLeaveRequest.isPending || updateLeaveRequest.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="ferias-ausencias-form-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="ferias-ausencias-form-title">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Registre uma nova férias ou ausência"
              : mode === "edit"
                ? "Edite os dados da férias/ausência"
                : "Detalhes da férias/ausência"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <AsyncEntityCombobox<Employee>
              table="funcionarios"
              value={employeeId || null}
              getLabel={(f) => f.name ?? ""}
              onChange={(id) => {
                setEmployeeId(id);
                clearError("funcionario_id");
              }}
              placeholder={loadingEmployees ? "Carregando…" : "Selecione o funcionário"}
              searchPlaceholder="Buscar por nome…"
              emptyText="Nenhum funcionário encontrado"
              disabled={isViewMode}
              invalid={!!errors.funcionario_id}
              data-testid="select-funcionario-id"
            />
            {errors.funcionario_id && (
              <p className="text-sm text-destructive">{errors.funcionario_id}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de Ausência *</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                clearError("type");
              }}
              disabled={isViewMode}
            >
              <SelectTrigger
                className={errors.type ? "border-destructive" : ""}
                data-testid="select-type-ausencia"
              >
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <DatePickerField
                value={startDate}
                onChange={(iso) => { setStartDate(iso); clearError("start_date"); }}
                disabled={isViewMode}
                placeholder="Selecione a data"
                className={errors.start_date ? "border-destructive" : ""}
                data-testid="datepicker-data-inicio"
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <DatePickerField
                value={endDate}
                onChange={(iso) => { setEndDate(iso); clearError("end_date"); }}
                disabled={isViewMode}
                placeholder="Selecione a data"
                className={errors.end_date ? "border-destructive" : ""}
                data-testid="datepicker-data-fim"
              />
              {errors.end_date && (
                <p className="text-sm text-destructive">{errors.end_date}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias Totais (calculado automaticamente)</Label>
            <Input
              type="number"
              value={totalDays}
              readOnly
              disabled
              data-testid="input-dias-totais"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={isViewMode}
            >
              <SelectTrigger data-testid="select-status-ausencia">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aprovado por</Label>
            <Input
              placeholder="Nome de quem aprovou"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              disabled={isViewMode}
              data-testid="input-aprovado-por"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isViewMode}
              data-testid="input-observacoes-ausencia"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-ausencia"
          >
            {isViewMode ? "Fechar" : "Cancelar"}
          </Button>
          {!isViewMode && (
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-save-ausencia"
            >
              {isPending && <Loader2 className="mr-2 animate-spin" />}
              {mode === "create" ? "Criar" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
