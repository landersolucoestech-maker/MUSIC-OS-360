import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { Separator } from "@/shared/ui/separator";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { useState } from "react";
import { ChevronDown, FileAudio, Music } from "lucide-react";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useWorks";

import type { Phonogram, PhonogramParticipant } from "@/modules/catalog/types/catalog.types";
import { phonogramToFormFields } from "@/modules/catalog/mappers";
import {
  PHONOGRAM_PARTICIPATION_CATEGORIES,
  PHONOGRAM_PARTICIPATION_CATEGORY_LABELS,
  PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE,
  phonogramAggregatorLabel,
  phonogramCountryLabel,
  phonogramMediaTypeLabel,
  phonogramRecordingClassificationLabel,
  phonogramStatusLabel,
  type PhonogramParticipationCategory,
} from "@/modules/catalog/constants/phonogram-options";

// `composer_names` is typed as string[], but a legacy record may carry a
// string or null. Normalizes safely.
function composersToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface LinkedWorkView {
  title: string;
  musicGenre?: string;
  composers?: string;
}

interface PhonogramViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phonogram?: Partial<Phonogram> | null;
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/** `YYYY-MM-DD` → `DD/MM/YYYY` (no timezone conversion); "" when empty. */
const formatDateBR = (isoDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

function StatusBadge({ status }: { status: string }) {
  const label = phonogramStatusLabel(status);
  if (status === "registered" || status === "active")
    return <Badge variant="success">{label}</Badge>;
  if (status === "in_review" || status === "under_review" || status === "pending")
    return <Badge variant="warning">{label}</Badge>;
  if (status === "rejected" || status === "inactive")
    return <Badge variant="danger">{label}</Badge>;
  return <Badge variant="neutral">{label}</Badge>;
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function MonoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-sans text-sm font-medium text-primary">
        {value || "—"}
      </p>
    </div>
  );
}

function SwitchField({
  label,
  value,
}: {
  label: string;
  value?: boolean | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center h-9">
        <Switch checked={value === true} disabled />
      </div>
    </div>
  );
}

export function PhonogramViewModal({
  open,
  onOpenChange,
  phonogram,
}: PhonogramViewModalProps) {
  const [categoryOpen, setCategoryOpen] = useState<Record<PhonogramParticipationCategory, boolean>>({
    phonographic_producers: true,
    performers: true,
    session_musicians: true,
  });
  const [uploadOpen, setUploadOpen] = useState(true);

  // Resolves the linked work DIRECTLY by ID (GET /works/:id) — does not depend
  // on the work being among the first records loaded (Task J: it used to use an
  // unfiltered useWorks(), truncated at 50).
  const lookupWorkId = phonogram?.work_id ?? undefined;
  const { entity: foundWork } = useEntityById<ObraWithRelations>("obras", open ? lookupWorkId : undefined);

  if (!phonogram) return null;

  let linkedWork: LinkedWorkView | null = null;
  if (lookupWorkId) {
    linkedWork = foundWork
      ? {
          title: foundWork.title ?? "",
          musicGenre: foundWork.music_genre ?? "",
          composers: composersToString(foundWork.composer_names),
        }
      : { title: "Obra vinculada" };
  }

  const workTitle = linkedWork?.title ?? "";
  // Single reader of the canonical record (the same one the form uses).
  const fields = phonogramToFormFields(phonogram);

  const phonogramTitle = fields.title || undefined;
  const isrcParts = [fields.isrcCountryCode, fields.isrcRegistrantCode, fields.isrcYear, fields.isrcDesignationCode];
  const isrcDisplay = isrcParts.every(Boolean) ? isrcParts.join("-") : phonogram.isrc || undefined;

  const durationDisplay =
    fields.durationMinutes || fields.durationSeconds
      ? `${fields.durationMinutes || "0"}min ${fields.durationSeconds || "0"}seg`
      : undefined;

  const createdAt = phonogram.created_at;
  const participation = fields.participation;

  const calcCategory = (cat: PhonogramParticipant[]): number =>
    cat.reduce((t, p) => t + (parseFloat(p.percentage) || 0), 0);

  const percentageTotal = PHONOGRAM_PARTICIPATION_CATEGORIES.reduce(
    (total, category) => total + calcCategory(participation[category]),
    0,
  );

  const audioFile = fields.audioFile;

  const renderParticipationSection = (category: PhonogramParticipationCategory) => {
    const title = PHONOGRAM_PARTICIPATION_CATEGORY_LABELS[category];
    const percentageMax = PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE[category];
    const isOpen = categoryOpen[category];
    const setIsOpen = (value: boolean) => setCategoryOpen((prev) => ({ ...prev, [category]: value }));
    const list = participation[category];
    const currentPercentage = calcCategory(list);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium text-foreground">
            {title}{" "}
            <span className="text-muted-foreground font-normal">
              — {currentPercentage.toFixed(2)}% de {percentageMax.toFixed(2)}%
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {list.length > 0 ? (
            <div className="px-3">
              {list.map((p, idx) => (
                <div
                  key={p.id ?? idx}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-b-0"
                >
                  <span className="text-sm text-foreground">
                    {p.name || "—"}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {p.percentage ? `${p.percentage}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-3 py-2">
              Nenhum participante adicionado.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0" data-testid="dialog-fonograma-view">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle data-testid="text-fonograma-view-title">Detalhes do Fonograma</DialogTitle>
          <DialogDescription>Informações completas do fonograma</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Header do Fonograma */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Music className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">
                  {phonogramTitle || workTitle || "Fonograma sem título"}
                </h2>
                {phonogramTitle && workTitle && phonogramTitle !== workTitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">Obra: {workTitle}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={fields.status} />
                </div>
                {createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {new Date(createdAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Linked work */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Obra Vinculada
              </p>
              {linkedWork ? (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Music className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-foreground truncate"
                      data-testid="text-obra-vinculada-title"
                    >
                      {workTitle || "—"}
                    </p>
                    {(linkedWork.musicGenre || linkedWork.composers) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[linkedWork.musicGenre, linkedWork.composers]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma obra vinculada.
                </p>
              )}
            </div>

            <Separator />

            {/* General information */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Informações Gerais
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero Musical" value={fields.musicGenre} />
                <InfoField label="Mídia" value={phonogramMediaTypeLabel(fields.mediaType)} />
                <InfoField label="Duração" value={durationDisplay} />
                <InfoField label="Classificação" value={phonogramRecordingClassificationLabel(fields.recordingClassification)} />
                <InfoField label="Agregadora" value={phonogramAggregatorLabel(fields.aggregator)} />
                <InfoField label="Gravadora" value={fields.recordLabelName} />
              </div>
            </div>

            <Separator />

            {/* Registration codes */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Códigos de Registro
              </p>
              <div className="grid grid-cols-3 gap-3">
                <MonoField label="ISRC" value={isrcDisplay} />
                <MonoField label="Código de Cadastro da Sociedade" value={fields.societyCode} />
                <MonoField label="Código ECAD" value={fields.ecadCode} />
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Datas
              </p>
              <div className="grid grid-cols-3 gap-3">
                <InfoField label="Emissão" value={formatDateBR(fields.issueDate)} />
                <InfoField label="Gravação Original" value={formatDateBR(fields.recordingDate)} />
                <InfoField label="Lançamento" value={formatDateBR(fields.releaseDate)} />
              </div>
            </div>

            <Separator />

            {/* Characteristics */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Características
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SwitchField label="Criada por IA" value={fields.aiUsed} />
                <SwitchField label="Instrumental" value={fields.isInstrumental} />
                <SwitchField label="Nacional" value={fields.isNational} />
                <SwitchField label="Pub. Simultânea" value={fields.isSimultaneousPublication} />
                <InfoField label="País Origem" value={phonogramCountryLabel(fields.countryOfRecording)} />
                <InfoField label="País Publicação" value={phonogramCountryLabel(fields.publicationCountry)} />
              </div>
            </div>

            <Separator />

            {/* Participation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground  tracking-wide">
                  Participação
                </p>
                <span className="text-xs text-muted-foreground">
                  Total: {percentageTotal.toFixed(2)}% de 100%
                </span>
              </div>

              <div className="space-y-2">
                {PHONOGRAM_PARTICIPATION_CATEGORIES.map((category) => (
                  <div key={category}>{renderParticipationSection(category)}</div>
                ))}
              </div>
            </div>

            {fields.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                    Observações
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {fields.notes}
                  </p>
                </div>
              </>
            )}

            {audioFile && (
              <>
                <Separator />

                {/* Audio file */}
                <div>
                  <Collapsible open={uploadOpen} onOpenChange={setUploadOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full mb-3">
                      <p className="text-xs font-semibold text-muted-foreground  tracking-wide">
                        Arquivo de Áudio
                      </p>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${uploadOpen ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <FileAudio className="w-8 h-8 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {audioFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(audioFile.size)}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
