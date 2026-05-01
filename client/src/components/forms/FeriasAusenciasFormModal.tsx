import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useFeriasAusencias,
  TIPOS_AUSENCIA,
  STATUS_AUSENCIA,
} from "@/hooks/useFeriasAusencias";
import type { FeriasAusencia, FeriasAusenciaInsert } from "@/hooks/useFeriasAusencias";
import { useFuncionarios, type Funcionario } from "@/hooks/useFuncionarios";

interface FeriasAusenciasFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ausencia?: FeriasAusencia | null;
  mode: "create" | "edit" | "view";
}

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diff = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

export function FeriasAusenciasFormModal({
  open,
  onOpenChange,
  ausencia,
  mode,
}: FeriasAusenciasFormModalProps) {
  const { addFeriasAusencia, updateFeriasAusencia } = useFeriasAusencias();
  const { funcionarios, isLoading: loadingFuncionarios } = useFuncionarios();

  const [funcionarioId, setFuncionarioId] = useState("");
  const [tipo, setTipo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("pendente");
  const [aprovadoPor, setAprovadoPor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isViewMode = mode === "view";

  const diasTotais = useMemo(() => calcDias(dataInicio, dataFim), [dataInicio, dataFim]);

  useEffect(() => {
    if (open && mode === "edit" && ausencia) {
      setFuncionarioId(ausencia.funcionario_id || "");
      setTipo(ausencia.tipo || "");
      setDataInicio(ausencia.data_inicio || "");
      setDataFim(ausencia.data_fim || "");
      setStatus(ausencia.status || "pendente");
      setAprovadoPor(ausencia.aprovado_por || "");
      setObservacoes(ausencia.observacoes || "");
      setErrors({});
    } else if (open && mode === "view" && ausencia) {
      setFuncionarioId(ausencia.funcionario_id || "");
      setTipo(ausencia.tipo || "");
      setDataInicio(ausencia.data_inicio || "");
      setDataFim(ausencia.data_fim || "");
      setStatus(ausencia.status || "pendente");
      setAprovadoPor(ausencia.aprovado_por || "");
      setObservacoes(ausencia.observacoes || "");
      setErrors({});
    } else if (open && mode === "create") {
      setFuncionarioId("");
      setTipo("");
      setDataInicio("");
      setDataFim("");
      setStatus("pendente");
      setAprovadoPor("");
      setObservacoes("");
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
    const newErrors: Record<string, string> = {};
    if (!funcionarioId) newErrors.funcionario_id = "Selecione um funcionário";
    if (!tipo) newErrors.tipo = "Selecione o tipo de ausência";
    if (!dataInicio) newErrors.data_inicio = "Data de início é obrigatória";
    if (!dataFim) newErrors.data_fim = "Data de fim é obrigatória";
    if (dataInicio && dataFim && new Date(dataFim) < new Date(dataInicio)) {
      newErrors.data_fim = "Data fim deve ser igual ou posterior à data início";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    const data: FeriasAusenciaInsert = {
      funcionario_id: funcionarioId,
      tipo: tipo || null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dias_totais: diasTotais,
      status,
      aprovado_por: aprovadoPor.trim() || null,
      observacoes: observacoes.trim() || null,
    };

    if (mode === "create") {
      addFeriasAusencia.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    } else if (mode === "edit" && ausencia) {
      updateFeriasAusencia.mutate(
        { id: ausencia.id, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const funcionariosAtivos = funcionarios.filter(
    (f: Funcionario) => f.status === "ativo" || f.status === "férias" || f.id === funcionarioId
  );

  const title =
    mode === "create"
      ? "Nova Férias/Ausência"
      : mode === "edit"
        ? "Editar Férias/Ausência"
        : "Visualizar Férias/Ausência";

  const isPending = addFeriasAusencia.isPending || updateFeriasAusencia.isPending;

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
            <Select
              value={funcionarioId}
              onValueChange={(v) => {
                setFuncionarioId(v);
                clearError("funcionario_id");
              }}
              disabled={isViewMode}
            >
              <SelectTrigger
                className={errors.funcionario_id ? "border-destructive" : ""}
                data-testid="select-funcionario-id"
              >
                <SelectValue placeholder={loadingFuncionarios ? "Carregando..." : "Selecione o funcionário"} />
              </SelectTrigger>
              <SelectContent>
                {funcionariosAtivos.map((f: Funcionario) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.funcionario_id && (
              <p className="text-sm text-destructive">{errors.funcionario_id}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de Ausência *</Label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v);
                clearError("tipo");
              }}
              disabled={isViewMode}
            >
              <SelectTrigger
                className={errors.tipo ? "border-destructive" : ""}
                data-testid="select-tipo-ausencia"
              >
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_AUSENCIA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo && (
              <p className="text-sm text-destructive">{errors.tipo}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  clearError("data_inicio");
                }}
                disabled={isViewMode}
                className={errors.data_inicio ? "border-destructive" : ""}
                data-testid="input-data-inicio"
              />
              {errors.data_inicio && (
                <p className="text-sm text-destructive">{errors.data_inicio}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  clearError("data_fim");
                }}
                disabled={isViewMode}
                className={errors.data_fim ? "border-destructive" : ""}
                data-testid="input-data-fim"
              />
              {errors.data_fim && (
                <p className="text-sm text-destructive">{errors.data_fim}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias Totais (calculado automaticamente)</Label>
            <Input
              type="number"
              value={diasTotais}
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
                {STATUS_AUSENCIA.map((s) => (
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
              value={aprovadoPor}
              onChange={(e) => setAprovadoPor(e.target.value)}
              disabled={isViewMode}
              data-testid="input-aprovado-por"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
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
