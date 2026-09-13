import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { toast } from "sonner";
import { useShares } from "@/modules/releases/hooks/useShares";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { shareSchema } from "@/modules/releases/lib/share-schema";
import { resolveShareType } from "@/modules/releases/lib/share-format";
import type { Share, ShareType } from "@/modules/releases/types";

interface SharePendenteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share?: Share;
  /** Pré-seleciona um lançamento (ex.: vindo do fluxo de release). */
  initialReleaseId?: string;
  onSuccess?: () => void;
}

interface ShareFormState {
  share_type: ShareType;
  // interno
  release_id: string;
  holder: string;       // participante
  recipient: string;
  funcao: string;
  // externo
  music_title: string;
  artista_externo: string;
  artista_project_id: string;
  pagador: string;
  pagador_contato: string;
  origem_acordo: string;
  data_prevista: string;
  documents: string;
  // comum
  percentage: string;
  valor_total: string;
  status: string;
  acordo_notas: string;
  acordo_url: string;
  notes: string;
}

const FUNCAO_OPTIONS = [
  { value: "compositor", label: "Compositor / Autor" },
  { value: "interprete", label: "Intérprete" },
  { value: "produtor", label: "Produtor" },
  { value: "editora", label: "Editora" },
  { value: "gravadora", label: "Gravadora" },
  { value: "empresario", label: "Empresário" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "enviado", label: "Enviado" },
  { value: "aceito", label: "Aceito" },
  { value: "recebido", label: "Recebido" },
  { value: "recusado", label: "Recusado" },
  { value: "erro", label: "Erro" },
  { value: "cancelado", label: "Cancelado" },
];

const EMPTY: ShareFormState = {
  share_type: "internal_release",
  release_id: "",
  holder: "",
  recipient: "",
  funcao: "interprete",
  music_title: "",
  artista_externo: "",
  artista_project_id: "",
  pagador: "",
  pagador_contato: "",
  origem_acordo: "",
  data_prevista: "",
  documents: "",
  percentage: "",
  valor_total: "",
  status: "pendente",
  acordo_notas: "",
  acordo_url: "",
  notes: "",
};

function shareToForm(share: Share & Record<string, unknown>): ShareFormState {
  const s = (k: string): string => {
    const v = share[k];
    return typeof v === "string" ? v : "";
  };
  return {
    share_type: resolveShareType(share),
    release_id: s("release_id"),
    holder: s("holder"),
    recipient: s("recipient"),
    funcao: s("type") || "interprete",
    music_title: s("music_title") || s("titulo_obra"),
    artista_externo: s("artista_externo"),
    artista_project_id: s("artista_project_id") || s("artist_id"),
    pagador: s("pagador"),
    pagador_contato: s("pagador_contato"),
    origem_acordo: s("origem_acordo"),
    data_prevista: s("data_prevista"),
    documents: s("documents"),
    percentage: share.percentage != null ? String(share.percentage) : "",
    valor_total: share.valor_total != null ? String(share.valor_total) : "",
    status: s("status") || "pendente",
    acordo_notas: s("acordo_notas"),
    acordo_url: s("acordo_url"),
    notes: s("observacoes"),
  };
}

export function SharePendenteFormModal({ open, onOpenChange, share, initialReleaseId, onSuccess }: SharePendenteFormModalProps) {
  const { addShare, updateShare, shares } = useShares();
  const { lancamentos } = useLancamentos();
  const [formData, setFormData] = useState<ShareFormState>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!share?.id;
  const isInternal = formData.share_type === "internal_release";

  const lancamentosDistribuidos = useMemo(
    () =>
      lancamentos
        .slice()
        .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR")),
    [lancamentos],
  );

  useEffect(() => {
    if (!open) return;
    if (share?.id) {
      setFormData(shareToForm(share as Share & Record<string, unknown>));
    } else {
      setFormData({
        ...EMPTY,
        ...(initialReleaseId ? { release_id: initialReleaseId, share_type: "internal_release" } : {}),
      });
    }
  }, [open, share, initialReleaseId]);

  const handleChange = (field: keyof ShareFormState, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    const validation = shareSchema.safeParse({
      share_type: formData.share_type,
      release_id: formData.release_id,
      holder: formData.holder,
      recipient: formData.recipient,
      funcao: formData.funcao as ShareFormState["funcao"],
      music_title: formData.music_title,
      artista_externo: formData.artista_externo,
      artista_project_id: formData.artista_project_id,
      pagador: formData.pagador,
      pagador_contato: formData.pagador_contato,
      origem_acordo: formData.origem_acordo,
      data_prevista: formData.data_prevista,
      documents: formData.documents,
      percentage: formData.percentage,
      valor_total: formData.valor_total,
      status: formData.status,
      acordo_notas: formData.acordo_notas,
      acordo_url: formData.acordo_url,
      notes: formData.notes,
    });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Preencha os campos obrigatórios");
      return;
    }

    // Bloqueia duplicidade no fluxo interno: release + participante + destinatário
    if (isInternal) {
      const dup = shares.find(
        (s) =>
          s.id !== share?.id &&
          (s as Record<string, unknown>)["release_id"] === formData.release_id &&
          (s.holder ?? "") === formData.holder &&
          ((s as Record<string, unknown>)["recipient"] ?? "") === formData.recipient,
      );
      if (dup) {
        toast.error("Já existe um share para este lançamento, participante e destinatário.");
        return;
      }
    }

    const percentageNum = formData.percentage ? parseFloat(formData.percentage) : null;
    const valorTotalNum = formData.valor_total ? parseFloat(formData.valor_total) : null;
    setIsSubmitting(true);
    try {
      const selectedRelease = lancamentosDistribuidos.find((l) => l.id === formData.release_id);
      const common = {
        share_type: formData.share_type,
        percentage: percentageNum,
        valor_total: valorTotalNum,
        status: formData.status,
        acordo_notas: formData.acordo_notas.trim() || null,
        acordo_url: formData.acordo_url.trim() || null,
        notes: formData.notes.trim() || null,
      };
      const payload: Record<string, unknown> = isInternal
        ? {
            ...common,
            // direction mantém semântica de fluxo de caixa (compat KPIs)
            direction: "a_enviar",
            release_id: formData.release_id || null,
            music_title: selectedRelease?.title ?? null,
            holder: formData.holder.trim() || null,
            recipient: formData.recipient.trim() || null,
            type: formData.funcao || null,
          }
        : {
            ...common,
            direction: "a_receber",
            music_title: formData.music_title.trim() || null,
            artista_externo: formData.artista_externo.trim() || null,
            artista_project_id: formData.artista_project_id || null,
            artist_id: formData.artista_project_id || null,
            pagador: formData.pagador.trim() || null,
            pagador_contato: formData.pagador_contato.trim() || null,
            origem_acordo: formData.origem_acordo.trim() || null,
            data_prevista: formData.data_prevista || null,
            documents: formData.documents.trim() || null,
          };

      if (isEditing && share?.id) {
        await updateShare.mutateAsync({ id: share.id, ...payload, expectedUpdatedAt: getExpectedUpdatedAt(share) });
        toast.success("Share atualizado com sucesso!");
      } else {
        const novaVersao = 1;
        await addShare.mutateAsync({
          ...payload,
          versao: novaVersao,
          historico:
            percentageNum != null
              ? [{
                  versao: novaVersao,
                  data: new Date().toISOString().split("T")[0],
                  percentage: percentageNum,
                  autor: "Sistema",
                  descricao: "Registro inicial",
                }]
              : [],
        });
        toast.success("Share registrado com sucesso!");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if (handleConcurrencyConflict(err, "share")) return;
      toast.error(isEditing ? "Erro ao atualizar share" : "Erro ao registrar share");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? "Editar Share" : "Registrar Share"}
          </DialogTitle>
          <DialogDescription>
            {isInternal
              ? "Participação de um lançamento interno cadastrado no sistema."
              : "Recebível de música externa — não depende de lançamento interno."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Tipo de Share */}
          <div className="space-y-2">
            <Label>Tipo de Share</Label>
            <Select value={formData.share_type} onValueChange={(v) => handleChange("share_type", v)}>
              <SelectTrigger data-testid="select-share-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_release">Release Interno</SelectItem>
                <SelectItem value="external_receivable">Share Externo a Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isInternal ? (
            <>
              <div className="space-y-2">
                <Label>Lançamento</Label>
                <Select value={formData.release_id} onValueChange={(v) => handleChange("release_id", v)}>
                  <SelectTrigger data-testid="select-lancamento-distribuido">
                    <SelectValue placeholder="Selecione o lançamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {lancamentosDistribuidos.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holder">Participante</Label>
                  <Input id="holder" placeholder="Nome do participante" value={formData.holder}
                    onChange={(e) => handleChange("holder", e.target.value)} data-testid="input-holder" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient">Destinatário</Label>
                  <Input id="recipient" placeholder="Quem recebe (envio)" value={formData.recipient}
                    onChange={(e) => handleChange("recipient", e.target.value)} data-testid="input-recipient" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={formData.funcao} onValueChange={(v) => handleChange("funcao", v)}>
                  <SelectTrigger data-testid="select-funcao">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCAO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="music_title">Nome da Música</Label>
                  <Input id="music_title" placeholder="Ex: Bohemian Rhapsody" value={formData.music_title}
                    onChange={(e) => handleChange("music_title", e.target.value)} data-testid="input-music-title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="artista_externo">Artista principal externo</Label>
                  <Input id="artista_externo" placeholder="Artista da música" value={formData.artista_externo}
                    onChange={(e) => handleChange("artista_externo", e.target.value)} data-testid="input-artista-externo" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Artista / Projeto vinculado à empresa</Label>
                {/* Task J: busca server-side (AsyncEntityCombobox) — antes populava
                    o Select com useArtistas() sem filtro, truncado nos primeiros
                    50 artistas do tenant. */}
                <AsyncEntityCombobox<Artist>
                  table="artistas"
                  getLabel={(a) => a.stageName ?? ""}
                  value={formData.artista_project_id || null}
                  onChange={(id) => handleChange("artista_project_id", id)}
                  placeholder="Selecione o vínculo"
                  searchPlaceholder="Buscar artista..."
                  data-testid="select-artista-projeto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pagador">Responsável pagador</Label>
                  <Input id="pagador" placeholder="Quem paga" value={formData.pagador}
                    onChange={(e) => handleChange("pagador", e.target.value)} data-testid="input-pagador" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagador_contato">Contato do pagador</Label>
                  <Input id="pagador_contato" placeholder="Email / telefone" value={formData.pagador_contato}
                    onChange={(e) => handleChange("pagador_contato", e.target.value)} data-testid="input-pagador-contato" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origem_acordo">Origem do acordo</Label>
                  <Input id="origem_acordo" placeholder="Como surgiu o acordo" value={formData.origem_acordo}
                    onChange={(e) => handleChange("origem_acordo", e.target.value)} data-testid="input-origem-acordo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_prevista">Data prevista de recebimento</Label>
                  <Input id="data_prevista" type="date" value={formData.data_prevista}
                    onChange={(e) => handleChange("data_prevista", e.target.value)} data-testid="input-data-prevista" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documents">Documentos / comprovantes (URL)</Label>
                <Input id="documents" placeholder="https://..." value={formData.documents}
                  onChange={(e) => handleChange("documents", e.target.value)} data-testid="input-documents" />
              </div>
            </>
          )}

          {/* Percentual + Valor + Status (comum) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="percentage">% Share</Label>
              <Input id="percentage" type="number" min="0" max="100" step="0.01" placeholder="Ex: 10.00"
                value={formData.percentage} onChange={(e) => handleChange("percentage", e.target.value)} data-testid="input-percentage" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor combinado (R$)</Label>
              <Input id="valor_total" type="number" min="0" step="0.01" placeholder="Ex: 1500.00"
                value={formData.valor_total} onChange={(e) => handleChange("valor_total", e.target.value)} data-testid="input-valor-total" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acordo_notas">Notas do Acordo</Label>
            <Textarea id="acordo_notas" placeholder="Termos do acordo, condições, vigência..."
              value={formData.acordo_notas} onChange={(e) => handleChange("acordo_notas", e.target.value)} rows={2} data-testid="textarea-acordo-notas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acordo_url">URL do Documento (opcional)</Label>
            <Input id="acordo_url" type="url" placeholder="https://..." value={formData.acordo_url}
              onChange={(e) => handleChange("acordo_url", e.target.value)} data-testid="input-acordo-url" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações adicionais</Label>
            <Textarea id="observacoes" placeholder="Informações adicionais sobre este share..."
              value={formData.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={2} data-testid="textarea-observacoes" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-salvar">
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Registrar Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
