import { useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { FieldError } from "@/shared/components/FormField";
import { toast } from "sonner";
import { FileText, Music, DollarSign, Building } from "lucide-react";
import { licenseSchema, type LicenseFormData } from "@/modules/licensing/lib/license-schema";
import { useLicenses } from "@/modules/licensing/hooks/useLicenses";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import {
  LICENSE_STATUS_VALUES,
  LICENSE_TYPE_OPTIONS,
  TARGET_MEDIA_OPTIONS,
  TERRITORY_OPTIONS,
  licenseStatusLabel,
  workArtistLabel,
} from "@/modules/licensing/lib/license-format";
import type { Work } from "@/modules/catalog/types/catalog.types";
import { LicenseStatus } from "@music-os-360/types";

interface ClientOption { id: string; name: string }

interface LicenseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenca?: any;
  mode: "create" | "edit" | "view";
}

const statusOptions = LICENSE_STATUS_VALUES.map((value) => ({ value, label: licenseStatusLabel(value) }));

const DEFAULT_VALUES: LicenseFormData = {
  title: "",
  licenseType: "",
  workId: "",
  clientId: "",
  projectName: "",
  targetMedia: "",
  territory: "",
  status: LicenseStatus.NEGOTIATION,
  startDate: "",
  endDate: "",
  remunerationType: "FIXED",
  currency: "BRL",
  amount: "",
  percentage: "",
  notes: "",
};

export function LicenseFormModal({ open, onOpenChange, licenca: license, mode }: LicenseFormModalProps) {
  const isViewMode = mode === "view";
  const title = mode === "create" ? "Nova Licença de Sync" : mode === "edit" ? "Editar Licença" : "Detalhes da Licença";
  const { addLicense, updateLicense } = useLicenses();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // The artist is derived from the selected work (read-only, not persisted) —
  // fetched DIRECTLY by ID (GET /works/:id), it does not depend on the work being among
  // the first 50 loaded by useWorks() without a filter (Task J).
  const workId = useWatch({ control, name: "workId" });
  const remunerationType = useWatch({ control, name: "remunerationType" });
  const { entity: selectedWork } = useEntityById<Work>("works", workId || undefined);
  const derivedArtist = useMemo(() => workArtistLabel(selectedWork), [selectedWork]);
  const showMonetary = remunerationType === "FIXED" || remunerationType === "FIXED_PLUS_PERCENTAGE";
  const showPercentage = remunerationType === "PERCENTAGE" || remunerationType === "FIXED_PLUS_PERCENTAGE";

  useEffect(() => {
    if (!open) return;
    if (license) {
      reset({
        title: license.title || "",
        licenseType: license.type || "",
        workId: license.work_id || "",
        clientId: license.client_id || "",
        projectName: license.project_name || "",
        targetMedia: license.target_media || "",
        territory: license.territory || "",
        status: license.status || LicenseStatus.NEGOTIATION,
        startDate: license.start_date || "",
        endDate: license.end_date || "",
        remunerationType: license.remuneration_type || "FIXED",
        currency: license.currency || "BRL",
        amount: license.amount != null ? String(license.amount) : "",
        percentage: license.percentage != null ? String(license.percentage) : "",
        notes: license.notes || "",
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [open, license, reset]);

  const buildPayload = (data: LicenseFormData) => {
    const isFixed = data.remunerationType === "FIXED";
    const isPct = data.remunerationType === "PERCENTAGE";
    const isBoth = data.remunerationType === "FIXED_PLUS_PERCENTAGE";
    const amountNum = data.amount ? Number(data.amount) : null;
    const pctNum = data.percentage ? Number(data.percentage) : null;
    return {
      title:            data.title,
      type:              data.licenseType || undefined,
      work_id:           data.workId,
      client_id:        data.clientId,
      project_name:      data.projectName || undefined,
      target_media:      data.targetMedia || undefined,
      territory:         data.territory || undefined,
      status:            data.status || LicenseStatus.NEGOTIATION,
      start_date:       data.startDate || undefined,
      end_date:          data.endDate || undefined,
      remuneration_type: data.remunerationType,
      currency:          isFixed || isBoth ? data.currency : null,
      amount:            isFixed || isBoth ? amountNum : null,
      percentage:        isPct || isBoth ? pctNum : null,
      notes:             data.notes || undefined,
    };
  };

  const onSubmit = async (data: LicenseFormData) => {
    if (isViewMode) return;
    try {
      const payload = buildPayload(data);
      if (mode === "edit" && license?.id) {
        await updateLicense.mutateAsync({
          id: license.id as string,
          data: payload as never,
          expectedUpdatedAt: getExpectedUpdatedAt(license),
        });
        toast.success("Licença atualizada com sucesso.");
      } else {
        await addLicense.mutateAsync(payload as never);
        toast.success("Licença criada com sucesso.");
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "licença")) return;
      toast.error("Erro ao salvar licença");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* License information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Informações da Licença
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título da Licença *</Label>
                <Input
                  {...register("title")}
                  disabled={isViewMode}
                  placeholder="Nome/Título da licença"
                  className={errors.title ? "border-destructive" : ""}
                  data-testid="input-title"
                />
                <FieldError error={errors.title?.message} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Licença</Label>
                <Controller
                  name="licenseType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-license-type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {LICENSE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Obra Musical *</Label>
                <Controller
                  name="workId"
                  control={control}
                  render={({ field }) => (
                    <AsyncEntityCombobox<Work>
                      table="works"
                      getLabel={(o) => o.title ?? ""}
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      placeholder="Selecione a obra"
                      searchPlaceholder="Buscar obra…"
                      disabled={isViewMode}
                      invalid={!!errors.workId}
                      data-testid="select-obra-musical"
                    />
                  )}
                />
                <FieldError error={errors.workId?.message} />
              </div>
              <div className="space-y-2">
                <Label>Artista <span className="text-muted-foreground font-normal">(da obra)</span></Label>
                <Input
                  value={derivedArtist}
                  readOnly
                  disabled
                  placeholder="Definido pela obra selecionada"
                  data-testid="input-artist"
                />
              </div>
            </div>
          </div>

          {/* Client and project */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Cliente e Projeto
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <AsyncEntityCombobox<ClientOption>
                      table="clients"
                      getLabel={(c) => c.name ?? ""}
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      placeholder="Selecione o cliente"
                      searchPlaceholder="Buscar cliente…"
                      disabled={isViewMode}
                      invalid={!!errors.clientId}
                      data-testid="select-client"
                    />
                  )}
                />
                <FieldError error={errors.clientId?.message} />
              </div>
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Input
                  {...register("projectName")}
                  disabled={isViewMode}
                  placeholder="Nome do projeto/campanha"
                  data-testid="input-project-name"
                />
                <FieldError error={errors.projectName?.message} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mídia de Destino</Label>
                <Controller
                  name="targetMedia"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-target-media">
                        <SelectValue placeholder="Selecione a mídia" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_MEDIA_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Território</Label>
                <Controller
                  name="territory"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-territory">
                        <SelectValue placeholder="Selecione o território" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERRITORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Period and compensation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Período e Remuneração
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField value={field.value ?? ""} onChange={field.onChange} disabled={isViewMode} placeholder="Selecione a data" displayFormat="dd/MM/yyyy" data-testid="datepicker-data-inicio" />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField value={field.value ?? ""} onChange={field.onChange} disabled={isViewMode} placeholder="Selecione a data" displayFormat="dd/MM/yyyy" data-testid="datepicker-data-fim" />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Remuneração</Label>
                <Controller
                  name="remunerationType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? "FIXED"} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-remuneration-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Valor Fixo</SelectItem>
                        <SelectItem value="PERCENTAGE">Percentual</SelectItem>
                        <SelectItem value="FIXED_PLUS_PERCENTAGE">Fixo + Percentual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {showMonetary && (
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="flex gap-2">
                    <Controller
                      name="currency"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? "BRL"} onValueChange={field.onChange} disabled={isViewMode}>
                          <SelectTrigger className="w-20" data-testid="select-currency"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BRL">R$</SelectItem>
                            <SelectItem value="USD">US$</SelectItem>
                            <SelectItem value="EUR">€</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      type="number"
                      {...register("amount")}
                      disabled={isViewMode}
                      placeholder="0,00"
                      className={`flex-1 ${errors.amount ? "border-destructive" : ""}`}
                      data-testid="input-amount"
                    />
                  </div>
                  <FieldError error={errors.amount?.message} />
                </div>
              )}

              {showPercentage && (
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input
                    type="number"
                    {...register("percentage")}
                    disabled={isViewMode}
                    placeholder="0"
                    className={errors.percentage ? "border-destructive" : ""}
                    data-testid="input-percentage"
                  />
                  <FieldError error={errors.percentage?.message} />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              {...register("notes")}
              disabled={isViewMode}
              placeholder="Observações adicionais..."
              rows={3}
              data-testid="textarea-notes"
            />
            <FieldError error={errors.notes?.message} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={isSubmitting} data-testid="button-submit">
                {mode === "create" ? "Criar Licença" : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
