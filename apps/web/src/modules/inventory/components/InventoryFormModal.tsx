import { useEffect, useMemo } from "react";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventorySchema, type InventoryFormData } from "@/modules/inventory/lib/inventory-schema";
import { INVENTORY_STATUS_VALUES, isInventoryStatus } from "@/modules/inventory/constants";
import { InventoryStatus, INVENTORY_STATUS_LABELS_PT_BR } from "@music-os-360/types";
import { FieldError } from "@/shared/components/FormField";
import { useInventory } from "@/modules/inventory/hooks/useInventory";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";

interface InventoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  mode: "create" | "edit" | "view";
}

const departmentOptions = [
  "Administrativo / Corporativo",
  "Arquivo e Documentação",
  "Artístico (A&R – Artistas & Repertório)",
  "Comercial",
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

const categoryOptions = [
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

const statusOptions = INVENTORY_STATUS_VALUES.map((value) => ({ value, label: INVENTORY_STATUS_LABELS_PT_BR[value] }));

export function InventoryFormModal({ open, onOpenChange, item, mode }: InventoryFormModalProps) {
  const isViewMode = mode === "view";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      category: "",
      quantity: 1,
      storageLocation: "",
      status: InventoryStatus.AVAILABLE,
      unitPrice: 0,
      notes: "",
      sector: "",
      responsiblePerson: "",
      purchaseLocation: "",
      invoiceNumber: "",
      entryDate: new Date().toISOString().split("T")[0],
    },
  });

  const quantity = watch("quantity");
  const unitValue = watch("unitPrice");

  // Compute the total value automatically
  const totalValue = useMemo(() => {
    const quantityValue = quantity || 0;
    const unitAmount = unitValue || 0;
    const total = quantityValue * unitAmount;
    return total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [quantity, unitValue]);

  // Update the data when the item changes (edit mode)
  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          name: item.name || "",
          category: item.category || "",
          quantity: item.quantity || 1,
          storageLocation: item.storage_location || "",
          status: isInventoryStatus(item.status) ? item.status : InventoryStatus.AVAILABLE,
          unitPrice: item.unit_price != null ? Number(item.unit_price) : 0,
          notes: item.notes || "",
          sector: item.sector || "",
          responsiblePerson: item.responsible_person || "",
          purchaseLocation: item.purchase_location || "",
          invoiceNumber: item.numero_nota_fiscal || "",
          entryDate: item.entry_date || new Date().toISOString().split("T")[0],
        });
      } else {
        reset({
          name: "",
          category: "",
          quantity: 1,
          storageLocation: "",
          status: InventoryStatus.AVAILABLE,
          unitPrice: 0,
          notes: "",
          sector: "",
          responsiblePerson: "",
          purchaseLocation: "",
          invoiceNumber: "",
          entryDate: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [item, open, reset]);

  const { addInventoryItem, updateInventoryItem } = useInventory();

  const onSubmit = async (data: InventoryFormData) => {
    if (isViewMode) return;
    try {
      const payload = {
        name:                data.name,
        category:            data.category || undefined,
        quantity:            data.quantity ?? 1,
        unit_price:          data.unitPrice ?? undefined,
        storage_location:    data.storageLocation || undefined,
        status:              data.status || InventoryStatus.AVAILABLE,
        responsible_person:  data.responsiblePerson || undefined,
        sector:              data.sector || undefined,
        entry_date:          data.entryDate || undefined,
        purchase_location:   data.purchaseLocation || undefined,
        numero_nota_fiscal:  data.invoiceNumber || undefined,
        notes:               data.notes || undefined,
      };
      if (mode === "edit" && item?.id) {
        await updateInventoryItem.mutateAsync({
          id: item.id as string,
          data: { ...payload, expectedUpdatedAt: getExpectedUpdatedAt(item) } as never,
        });
      } else {
        await addInventoryItem.mutateAsync(payload as never);
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "item de inventário")) return;
      toast.error("Erro ao salvar item. Tente novamente.");
    }
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    // If it is already in YYYY-MM-DD format, return it as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // Tries to convert from DD/MM/YYYY to YYYY-MM-DD
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
          {/* Section 1 — Basic information */}
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
                    value={watch("sector") || ""}
                    onValueChange={(v) => setValue("sector", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={watch("category") || ""}
                    onValueChange={(v) => setValue("category", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.category?.message} />
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label>
                    Nome do Item <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...register("name")}
                    placeholder="Ex: Microfone Condensador AKG C414"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.name?.message} />
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
                    {...register("quantity", { valueAsNumber: true })}
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.quantity?.message} />
                </div>

                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    {...register("storageLocation")}
                    placeholder="Ex: Estúdio A, Sala 201, Depósito"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.storageLocation?.message} />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    {...register("responsiblePerson")}
                    placeholder="Nome da pessoa responsável pelo item"
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={watch("status") || InventoryStatus.AVAILABLE}
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

          {/* Section 2 — Purchase information */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações de Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Local de Compra</Label>
                  <Input
                    {...register("purchaseLocation")}
                    placeholder="Ex: Loja de Música ABC"
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número da Nota Fiscal</Label>
                  <Input
                    {...register("invoiceNumber")}
                    placeholder="Ex: NF-123456"
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data de Entrada</Label>
                  <DatePickerField
                    value={watch("entryDate") ?? ""}
                    onChange={(iso) => setValue("entryDate", iso)}
                    disabled={isViewMode}
                    placeholder="Selecione a data"
                    data-testid="datepicker-entry-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("unitPrice", { valueAsNumber: true })}
                    placeholder="0,00"
                    disabled={isViewMode}
                  />
                  <FieldError error={errors.unitPrice?.message} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (Calculado)</Label>
                  <Input
                    value={totalValue}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 — Additional information */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  {...register("notes")}
                  placeholder="Garantia, especificações técnicas, observações gerais..."
                  rows={4}
                  disabled={isViewMode}
                  className="resize-none"
                />
                <FieldError error={errors.notes?.message} />
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
                size="sm"
                className="h-8 text-xs gap-1.5"
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

