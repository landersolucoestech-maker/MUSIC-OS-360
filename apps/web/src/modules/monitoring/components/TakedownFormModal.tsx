import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { AlertTriangle, Link2, FileText } from "lucide-react";
import { takedownSchema, type TakedownFormData } from "@/modules/monitoring/lib/takedown-schema";
import { useTakedowns } from "@/modules/monitoring/hooks/useTakedowns";
import { normalizeTakedown } from "@/modules/monitoring/lib/takedown-format";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";

interface TakedownFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  takedown?: any;
  mode: "create" | "edit" | "view";
}

const platforms = ["YouTube", "Spotify", "Apple Music", "Deezer", "SoundCloud", "TikTok", "Instagram", "Facebook", "Twitter/X", "Outra"];
const reasons = ["Uso não autorizado", "Violação de direitos autorais", "Plágio", "Sample não autorizado", "Distribuição ilegal", "Outro"];

export function TakedownFormModal({ open, onOpenChange, takedown, mode }: TakedownFormModalProps) {
  const isViewMode = mode === "view";
  const title = mode === "create" ? "Registrar Takedown" : mode === "edit" ? "Editar Takedown" : "Detalhes do Takedown";
  const { addTakedown, updateTakedown } = useTakedowns();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TakedownFormData>({
    resolver: zodResolver(takedownSchema),
    defaultValues: {
      title: "",
      type: "sent",
      affectedWork: "",
      artistName: "",
      platform: "",
      infringingUrl: "",
      reason: "",
      description: "",
      priority: "medium",
      status: "pending",
      identifiedAt: new Date().toISOString().split("T")[0],
      evidence: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (takedown) {
      const n = normalizeTakedown(takedown);
      reset({
        title: n.title,
        type: n.type || "sent",
        affectedWork: n.affectedWork,
        artistName: n.artistName,
        platform: n.platform,
        infringingUrl: n.infringingUrl,
        reason: n.reason,
        description: n.description,
        priority: (n.priority || "medium") as TakedownFormData["priority"],
        status: (n.status || "pending") as TakedownFormData["status"],
        identifiedAt: n.identifiedAt || new Date().toISOString().split("T")[0],
        evidence: n.evidence,
        notes: n.notes,
      });
    } else {
      reset({
        title: "",
        type: "sent",
        affectedWork: "",
        artistName: "",
        platform: "",
        infringingUrl: "",
        reason: "",
        description: "",
        priority: "medium",
        status: "pending",
        identifiedAt: new Date().toISOString().split("T")[0],
        evidence: "",
        notes: "",
      });
    }
  }, [open, takedown, reset]);

  /** Converts the form fields into the persisted canonical snake_case shape. */
  const buildPayload = (data: TakedownFormData) => ({
    title: data.title,
    type: data.type || null,
    affected_work: data.affectedWork || null,
    artist_name: data.artistName || null,
    platform: data.platform,
    priority: data.priority,
    infringing_url: data.infringingUrl || null,
    reason: data.reason,
    description: data.description || null,
    evidence: data.evidence || null,
    identified_at: data.identifiedAt || null,
    status: data.status,
    notes: data.notes || null,
  });

  const onSubmit = async (data: TakedownFormData) => {
    if (isViewMode) return;
    try {
      const payload = buildPayload(data);
      if (mode === "edit" && takedown?.id) {
        await updateTakedown.mutateAsync({
          id: takedown.id as string,
          data: { ...payload, expectedUpdatedAt: getExpectedUpdatedAt(takedown) } as never,
        });
      } else {
        await addTakedown.mutateAsync(payload as never);
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "takedown")) return;
      toast.error("Erro ao salvar takedown");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Informações do Takedown
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título/Identificação *</Label>
                <Input
                  {...register("title")}
                  disabled={isViewMode}
                  placeholder="Identificação do takedown"
                  className={errors.title ? "border-destructive" : ""}
                  data-testid="input-title"
                />
                <FieldError error={errors.title?.message} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sent">Enviado por nós</SelectItem>
                        <SelectItem value="received">Recebido (Claim)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Obra Afetada</Label>
                <Input
                  {...register("affectedWork")}
                  disabled={isViewMode}
                  placeholder="Nome da obra"
                  data-testid="input-affected-work"
                />
                <FieldError error={errors.affectedWork?.message} />
              </div>
              <div className="space-y-2">
                <Label>Artista</Label>
                <Input
                  {...register("artistName")}
                  disabled={isViewMode}
                  placeholder="Nome do artista"
                  data-testid="input-artist-name"
                />
                <FieldError error={errors.artistName?.message} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? "pending"} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? "medium"} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Platform and URL */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Plataforma e Localização
            </h3>

            <div className="space-y-2">
              <Label>Plataforma *</Label>
              <Controller
                name="platform"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                    <SelectTrigger className={errors.platform ? "border-destructive" : ""} data-testid="select-platform">
                      <SelectValue placeholder="Selecione a plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError error={errors.platform?.message} />
            </div>

            <div className="space-y-2">
              <Label>URL do Conteúdo Infrator</Label>
              <Input
                {...register("infringingUrl")}
                disabled={isViewMode}
                placeholder="https://..."
                data-testid="input-infringing-url"
              />
              <FieldError error={errors.infringingUrl?.message} />
            </div>
          </div>

          {/* Reason and description */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Motivo e Descrição
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isViewMode}>
                      <SelectTrigger className={errors.reason ? "border-destructive" : ""} data-testid="select-reason">
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {reasons.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError error={errors.reason?.message} />
              </div>
              <div className="space-y-2">
                <Label>Data de Identificação</Label>
                <Controller
                  name="identifiedAt"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={isViewMode}
                      placeholder="Selecione a data"
                      displayFormat="dd/MM/yyyy"
                      data-testid="datepicker-identified-at"
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição Detalhada</Label>
              <Textarea
                {...register("description")}
                disabled={isViewMode}
                placeholder="Descreva detalhadamente a infração..."
                rows={3}
                data-testid="textarea-description"
              />
              <FieldError error={errors.description?.message} />
            </div>

            <div className="space-y-2">
              <Label>Evidências/Links de Prova</Label>
              <Textarea
                {...register("evidence")}
                disabled={isViewMode}
                placeholder="Links para evidências, capturas de tela etc."
                rows={2}
                data-testid="textarea-evidence"
              />
              <FieldError error={errors.evidence?.message} />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                {...register("notes")}
                disabled={isViewMode}
                placeholder="Observações adicionais..."
                rows={2}
                data-testid="textarea-notes"
              />
              <FieldError error={errors.notes?.message} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={isSubmitting} data-testid="button-submit">
                {mode === "create" ? "Registrar Takedown" : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
