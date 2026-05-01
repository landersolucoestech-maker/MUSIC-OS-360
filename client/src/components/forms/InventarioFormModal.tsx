import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventarioSchema, type InventarioFormData } from "@/lib/validation-schemas";
import { FieldError } from "@/components/forms/FormField";

interface InventarioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  mode: "create" | "edit" | "view";
}

const setoresOptions = [
  "Administrativo / Corporativo",
  "Arquivo e Documentação",
  "Artístico (A&R – Artistas & Repertório)",
  "Comercial / Vendas",
  "Comunicação e Imprensa (PR)",
  "Distribuição Digital",
  "Editora Musical (Publishing)",
  "Eventos e Shows",
  "Financeiro",
  "Jurídico",
  "Logística e Operações",
  "Marketing",
  "Produção Audiovisual",
  "Produção Musical",
  "Recursos Humanos (RH)",
  "Tecnologia / TI",
];

const categoriasOptions = [
  "Áudio",
  "Computador",
  "Escritório",
  "Estrutura",
  "Iluminação",
  "Mobília",
  "Software",
  "Vídeo",
  "Outros",
];

const statusOptions = [
  { value: "disponivel", label: "Disponível" },
  { value: "em_uso", label: "Em Uso" },
  { value: "emprestado", label: "Emprestado" },
  { value: "manutencao", label: "Em Manutenção" },
  { value: "danificado", label: "Danificado" },
  { value: "descartado", label: "Descartado" },
];

export function InventarioFormModal({ open, onOpenChange, item, mode }: InventarioFormModalProps) {
  const isViewMode = mode === "view";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventarioFormData & { setor?: string; responsavel?: string; localCompra?: string; numeroNotaFiscal?: string; dataEntrada?: string }>({
    resolver: zodResolver(inventarioSchema),
    mode: "onChange",
    defaultValues: {
      nome: "",
      categoria: "",
      quantidade: 1,
      localizacao: "",
      status: "disponivel",
      valor_unitario: 0,
      observacoes: "",
      setor: "",
      responsavel: "",
      localCompra: "",
      numeroNotaFiscal: "",
      dataEntrada: new Date().toISOString().split("T")[0],
    },
  });

  const quantidade = watch("quantidade");
  const valorUnitario = watch("valor_unitario");

  // Calcular valor total automaticamente
  const valorTotal = useMemo(() => {
    const qtd = quantidade || 0;
    const valor = valorUnitario || 0;
    const total = qtd * valor;
    return total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [quantidade, valorUnitario]);

  // Atualizar dados quando item mudar (modo edição)
  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          nome: item.nome || "",
          categoria: item.categoria || "",
          quantidade: item.quantidade || 1,
          localizacao: item.localizacao || "",
          status: item.status || "disponivel",
          valor_unitario: item.valor_unitario || 0,
          observacoes: item.observacoes || "",
          setor: item.setor || "",
          responsavel: item.responsavel || "",
          localCompra: item.localCompra || "",
          numeroNotaFiscal: item.numeroNotaFiscal || "",
          dataEntrada: item.dataEntrada || new Date().toISOString().split("T")[0],
        });
      } else {
        reset({
          nome: "",
          categoria: "",
          quantidade: 1,
          localizacao: "",
          status: "disponivel",
          valor_unitario: 0,
          observacoes: "",
          setor: "",
          responsavel: "",
          localCompra: "",
          numeroNotaFiscal: "",
          dataEntrada: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [item, open, reset]);

  const onSubmit = async (data: InventarioFormData) => {
    if (isViewMode) return;

    // Simular envio
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast.success(
      mode === "create"
        ? "Item cadastrado com sucesso!"
        : "Item atualizado com sucesso!"
    );
    onOpenChange(false);
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    // Se já está no formato YYYY-MM-DD, retorna direto
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // Tenta converter de DD/MM/YYYY para YYYY-MM-DD
    const parts = dateString.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Novo Item no Inventário"
              : mode === "edit"
              ? "Editar Item"
              : "Detalhes do Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Seção 1 — Informações Básicas */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Grid responsivo: 1 col mobile, 2 col tablet, 3 col desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select
                    value={watch("setor") || ""}
                    onValueChange={(v) => setValue("setor", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setoresOptions.map((setor) => (
                        <SelectItem key={setor} value={setor}>
                          {setor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={watch("categoria") || ""}
                    onValueChange={(v) => setValue("categoria", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.categoria?.message} />
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label>
                    Nome do Item <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...register("nome")}
                    placeholder="Ex: Microfone Condensador AKG C414"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.nome?.message} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Quantidade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    {...register("quantidade", { valueAsNumber: true })}
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.quantidade?.message} />
                </div>

                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    {...register("localizacao")}
                    placeholder="Ex: Estúdio A, Sala 201, Depósito"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.localizacao?.message} />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    {...register("responsavel")}
                    placeholder="Nome da pessoa responsável pelo item"
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={watch("status") || "disponivel"}
                    onValueChange={(v) => setValue("status", v as any)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.status?.message} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção 2 — Informações de Compra */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações de Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local de Compra</Label>
                  <Input
                    {...register("localCompra")}
                    placeholder="Ex: Loja de Música ABC"
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número da Nota Fiscal</Label>
                  <Input
                    {...register("numeroNotaFiscal")}
                    placeholder="Ex: NF-123456"
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data de Entrada</Label>
                  <Input
                    type="date"
                    {...register("dataEntrada")}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("valor_unitario", { valueAsNumber: true })}
                    placeholder="0,00"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.valor_unitario?.message} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (Calculado)</Label>
                  <Input
                    value={valorTotal}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção 3 — Informações Adicionais */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  {...register("observacoes")}
                  placeholder="Garantia, especificações técnicas, observações gerais..."
                  rows={4}
                  disabled={isViewMode}
                  className="resize-none"
                />
                <FieldError error={errors.observacoes?.message} />
              </div>
            </CardContent>
          </Card>

          {!isViewMode && (
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Salvando..."
                  : mode === "create"
                  ? "Cadastrar Item"
                  : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
