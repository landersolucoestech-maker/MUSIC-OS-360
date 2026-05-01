import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFolhaPagamento, STATUS_PAGAMENTO } from "@/hooks/useFolhaPagamento";
import type { FolhaPagamento } from "@/hooks/useFolhaPagamento";
import { useFuncionarios } from "@/hooks/useFuncionarios";

interface FolhaPagamentoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: FolhaPagamento | null;
  mode: "create" | "edit" | "view";
}

export function FolhaPagamentoFormModal({
  open,
  onOpenChange,
  registro,
  mode,
}: FolhaPagamentoFormModalProps) {
  const { addFolhaPagamento, updateFolhaPagamento } = useFolhaPagamento();
  const { funcionarios } = useFuncionarios();

  const [funcionarioId, setFuncionarioId] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [salarioBruto, setSalarioBruto] = useState<number | "">("");
  const [descontos, setDescontos] = useState<number | "">(0);
  const [bonus, setBonus] = useState<number | "">(0);
  const [dataPagamento, setDataPagamento] = useState("");
  const [status, setStatus] = useState("pendente");
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
      setStatus("pendente");
      setObservacoes("");
    } else if (open && registro) {
      setFuncionarioId(registro.funcionario_id || "");
      setMesReferencia(registro.mes_referencia || "");
      setSalarioBruto(registro.salario_bruto ?? "");
      setDescontos(registro.descontos ?? 0);
      setBonus(registro.bonus ?? 0);
      setDataPagamento(registro.data_pagamento || "");
      setStatus(registro.status || "pendente");
      setObservacoes(registro.observacoes || "");
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
        await addFolhaPagamento.mutateAsync(data);
      } else if (registro) {
        await updateFolhaPagamento.mutateAsync({ id: registro.id, ...data });
      }
      onOpenChange(false);
    } catch {
      // error handled by hook
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

  const funcionariosAtivos = (funcionarios || []).filter(
    (f) => f.status === "ativo" || f.status === "férias"
  );

  const funcionarioSelecionado = (funcionarios || []).find(
    (f) => f.id === funcionarioId
  );

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
            <Select
              value={funcionarioId}
              onValueChange={setFuncionarioId}
              disabled={isViewMode}
            >
              <SelectTrigger data-testid="select-funcionario-id">
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionariosAtivos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome_completo} - {f.cargo || "Sem cargo"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {funcionarioSelecionado && (
              <p className="text-xs text-muted-foreground">
                Salário base: R${" "}
                {funcionarioSelecionado.salario_base
                  ? Number(funcionarioSelecionado.salario_base).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 }
                    )
                  : "N/A"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mês de Referência *</Label>
            <Input
              type="month"
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              disabled={isViewMode}
              data-testid="input-mes-referencia"
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
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                disabled={isViewMode}
                data-testid="input-data-pagamento"
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
                  {STATUS_PAGAMENTO.map((s) => (
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
