import { useEffect, useMemo, useState } from "react";
import type { ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
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
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { shareSchema, type ShareFormData } from "@/modules/releases/lib/share-schema";
import { SHARE_FORM_STATUS_OPTIONS, SHARE_FUNCTION_OPTIONS, SHARE_TYPE_OPTIONS, resolveShareType } from "@/modules/releases/lib/share-format";
import { ShareStatus } from "@music-os-360/types";
import type { Share, ShareType } from "@/modules/releases/types";

interface ShareFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share?: Share;
  /** Preselects a release (e.g. coming from the release flow). */
  initialReleaseId?: string;
  onSuccess?: () => void;
}

interface ShareFormState {
  share_type: ShareType;
  // internal
  release_id: string;
  holder: string;       // participant
  recipient: string;
  participant_function: string;
  // external
  music_title: string;
  external_artist_name: string;
  artist_id: string;
  payer: string;
  payer_contact: string;
  agreement_source: string;
  expected_at: string;
  documents: string;
  // common
  percentage: string;
  total_amount: string;
  status: string;
  agreement_notes: string;
  agreement_url: string;
  notes: string;
}

const EMPTY: ShareFormState = {
  share_type: "internal_release",
  release_id: "",
  holder: "",
  recipient: "",
  participant_function: "performer",
  music_title: "",
  external_artist_name: "",
  artist_id: "",
  payer: "",
  payer_contact: "",
  agreement_source: "",
  expected_at: "",
  documents: "",
  percentage: "",
  total_amount: "",
  status: ShareStatus.PENDING,
  agreement_notes: "",
  agreement_url: "",
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
    participant_function: s("type") || "performer",
    music_title: s("music_title") || s("titulo_obra"),
    external_artist_name: s("external_artist_name"),
    artist_id: s("artist_id"),
    payer: s("payer"),
    payer_contact: s("payer_contact"),
    agreement_source: s("agreement_source"),
    expected_at: s("expected_at"),
    documents: s("documents"),
    percentage: share.percentage != null ? String(share.percentage) : "",
    total_amount: share.total_amount != null ? String(share.total_amount) : "",
    status: s("status") || ShareStatus.PENDING,
    agreement_notes: s("agreement_notes"),
    agreement_url: s("agreement_url"),
    notes: s("notes"),
  };
}

export function ShareFormModal({ open, onOpenChange, share, initialReleaseId, onSuccess }: ShareFormModalProps) {
  const { addShare, updateShare, shares } = useShares();
  const { releases } = useReleases();
  const [formData, setFormData] = useState<ShareFormState>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!share?.id;
  const isInternal = formData.share_type === "internal_release";

  const distributedReleases = useMemo(
    () =>
      releases
        .slice()
        .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR")),
    [releases],
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
      participant_function: (formData.participant_function || undefined) as ShareFormData["participant_function"],
      music_title: formData.music_title,
      external_artist_name: formData.external_artist_name,
      artist_id: formData.artist_id,
      payer: formData.payer,
      payer_contact: formData.payer_contact,
      agreement_source: formData.agreement_source,
      expected_at: formData.expected_at,
      documents: formData.documents,
      percentage: formData.percentage,
      total_amount: formData.total_amount,
      status: formData.status,
      agreement_notes: formData.agreement_notes,
      agreement_url: formData.agreement_url,
      notes: formData.notes,
    });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Preencha os campos obrigatórios");
      return;
    }

    // Blocks duplicates in the internal flow: release + participant + recipient
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
    const totalValueNum = formData.total_amount ? parseFloat(formData.total_amount) : null;
    setIsSubmitting(true);
    try {
      const selectedRelease = distributedReleases.find((l) => l.id === formData.release_id);
      const common = {
        share_type: formData.share_type,
        percentage: percentageNum,
        total_amount: totalValueNum,
        status: formData.status,
        agreement_notes: formData.agreement_notes.trim() || null,
        agreement_url: formData.agreement_url.trim() || null,
        notes: formData.notes.trim() || null,
      };
      const payload: Record<string, unknown> = isInternal
        ? {
            ...common,
            // direction keeps cash-flow semantics (KPI compat)
            direction: "payable",
            release_id: formData.release_id || null,
            music_title: selectedRelease?.title ?? null,
            holder: formData.holder.trim() || null,
            recipient: formData.recipient.trim() || null,
            type: formData.participant_function || null,
          }
        : {
            ...common,
            direction: "receivable",
            music_title: formData.music_title.trim() || null,
            external_artist_name: formData.external_artist_name.trim() || null,
            artist_id: formData.artist_id || null,
            payer: formData.payer.trim() || null,
            payer_contact: formData.payer_contact.trim() || null,
            agreement_source: formData.agreement_source.trim() || null,
            expected_at: formData.expected_at || null,
            documents: formData.documents.trim() || null,
          };

      if (isEditing && share?.id) {
        await updateShare.mutateAsync({ id: share.id, ...payload, expectedUpdatedAt: getExpectedUpdatedAt(share) });
        toast.success("Share atualizado com sucesso!");
      } else {
        const newVersion = 1;
        await addShare.mutateAsync({
          ...payload,
          version: newVersion,
          history:
            percentageNum != null
              ? [{
                  version: newVersion,
                  date: new Date().toISOString().split("T")[0],
                  percentage: percentageNum,
                  author: "Sistema",
                  description: "Registro inicial",
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
          {/* Share type */}
          <div className="space-y-2">
            <Label>Tipo de Share</Label>
            <Select value={formData.share_type} onValueChange={(v) => handleChange("share_type", v)}>
              <SelectTrigger data-testid="select-share-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isInternal ? (
            <>
              <div className="space-y-2">
                <Label>Lançamento</Label>
                <Select value={formData.release_id} onValueChange={(v) => handleChange("release_id", v)}>
                  <SelectTrigger data-testid="select-distributed-release">
                    <SelectValue placeholder="Selecione o lançamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {distributedReleases.map((l) => (
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
                <Select value={formData.participant_function} onValueChange={(v) => handleChange("participant_function", v)}>
                  <SelectTrigger data-testid="select-participant-function">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARE_FUNCTION_OPTIONS.map((o) => (
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
                  <Label htmlFor="external_artist_name">Artista principal externo</Label>
                  <Input id="external_artist_name" placeholder="Artista da música" value={formData.external_artist_name}
                    onChange={(e) => handleChange("external_artist_name", e.target.value)} data-testid="input-external-artist-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Artista / Projeto vinculado à empresa</Label>
                {/* Task J: server-side search (AsyncEntityCombobox) — it used to fill
                    the Select with useArtistas() without a filter, truncated to the first
                    50 artists of the tenant. */}
                <AsyncEntityCombobox<ArtistWireRecord>
                  table="artists"
                  getLabel={(a) => a.stage_name?.trim() || "Sem nome"}
                  value={formData.artist_id || null}
                  onChange={(id) => handleChange("artist_id", id)}
                  placeholder="Selecione o vínculo"
                  searchPlaceholder="Buscar artista..."
                  data-testid="select-artist-project"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payer">Responsável pagador</Label>
                  <Input id="payer" placeholder="Quem paga" value={formData.payer}
                    onChange={(e) => handleChange("payer", e.target.value)} data-testid="input-payer" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payer_contact">Contato do pagador</Label>
                  <Input id="payer_contact" placeholder="E-mail / telefone" value={formData.payer_contact}
                    onChange={(e) => handleChange("payer_contact", e.target.value)} data-testid="input-payer-contact" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agreement_source">Origem do acordo</Label>
                  <Input id="agreement_source" placeholder="Como surgiu o acordo" value={formData.agreement_source}
                    onChange={(e) => handleChange("agreement_source", e.target.value)} data-testid="input-agreement-source" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_at">Data prevista de recebimento</Label>
                  <Input id="expected_at" type="date" value={formData.expected_at}
                    onChange={(e) => handleChange("expected_at", e.target.value)} data-testid="input-expected-at" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documents">Documentos / comprovantes (URL)</Label>
                <Input id="documents" placeholder="https://..." value={formData.documents}
                  onChange={(e) => handleChange("documents", e.target.value)} data-testid="input-documents" />
              </div>
            </>
          )}

          {/* Percentage + Amount + Status (common) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="percentage">% Share</Label>
              <Input id="percentage" type="number" min="0" max="100" step="0.01" placeholder="Ex: 10.00"
                value={formData.percentage} onChange={(e) => handleChange("percentage", e.target.value)} data-testid="input-percentage" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_amount">Valor combinado (R$)</Label>
              <Input id="total_amount" type="number" min="0" step="0.01" placeholder="Ex: 1500.00"
                value={formData.total_amount} onChange={(e) => handleChange("total_amount", e.target.value)} data-testid="input-total-amount" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {SHARE_FORM_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreement_notes">Notas do Acordo</Label>
            <Textarea id="agreement_notes" placeholder="Termos do acordo, condições, vigência..."
              value={formData.agreement_notes} onChange={(e) => handleChange("agreement_notes", e.target.value)} rows={2} data-testid="textarea-agreement-notes" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agreement_url">URL do Documento (opcional)</Label>
            <Input id="agreement_url" type="url" placeholder="https://..." value={formData.agreement_url}
              onChange={(e) => handleChange("agreement_url", e.target.value)} data-testid="input-agreement-url" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações adicionais</Label>
            <Textarea id="observacoes" placeholder="Informações adicionais sobre este share..."
              value={formData.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={2} data-testid="textarea-notes" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-save">
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Registrar Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
