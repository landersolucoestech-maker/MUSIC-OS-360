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
import type { ObraWithRelations } from "@/modules/catalog/hooks/useObras";

// `compositores` is typed as string[] in the schema, but in some legacy
// records it may arrive as a string or null. Normalizes safely.
function composersToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface ParticipantView {
  id?: string;
  nome?: string;
  percentual?: string;
}

interface ParticipacaoView {
  produtorFonografico?: ParticipantView[];
  interprete?: ParticipantView[];
  musicoAcompanhante?: ParticipantView[];
}

interface LinkedWorkView {
  title?: string;
  titulo?: string;
  genero?: string;
  compositores?: string;
}

interface AudioFileView {
  name: string;
  size: number;
}

export interface PhonogramViewData {
  // Identity
  title?: string | null;
  gravadora?: string | null;
  notes?: string | null;
  // ABRAMUS / ECAD codes
  codEntidade?: string | null;
  cod_entidade?: string | null;
  codEcad?: string | null;
  cod_ecad?: string | null;
  agregadora?: string | null;
  // ISRC parts and full
  isrcPais?: string | null;
  isrcRegistrante?: string | null;
  isrcAno?: string | null;
  isrcDesignacao?: string | null;
  isrc?: string | null;
  // Booleans
  criadaPorIA?: boolean | null;
  criada_por_ia?: boolean | null;
  instrumental?: boolean | null;
  is_instrumental?: boolean | null;
  nacional?: boolean | null;
  pubSimultanea?: boolean | null;
  pub_simultanea?: boolean | null;
  // Dates
  emissao?: string | null;
  gravacaoOriginal?: string | null;
  gravacao_original?: string | null;
  data_registro?: string | null;
  lancamento?: string | null;
  data_lancamento?: string | null;
  // Duration
  duracaoMin?: string | null;
  duracao_min?: string | null;
  duracaoSeg?: string | null;
  duracao_seg?: string | null;
  duration_text?: string | null;
  // Categorization
  generoMusical?: string | null;
  music_genre?: string | null;
  genero?: string | null;
  midia?: string | null;
  paisOrigem?: string | null;
  pais_origem?: string | null;
  paisPublicacao?: string | null;
  pais_publicacao?: string | null;
  classificacao?: string | null;
  status?: string | null;
  origem_externa?: string | null;
  origem_externa_sincronizado_em?: string | null;
  // Composite
  obraVinculada?: LinkedWorkView | null;
  obra?: LinkedWorkView | null;
  work_id?: string | null;
  workId?: string | null;
  participacao?: ParticipacaoView | null;
  arquivoAudio?: AudioFileView | null;
  arquivo_audio?: AudioFileView | null;
}

interface PhonogramViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fonograma?: PhonogramViewData | null;
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDateBR = (d?: string | null) => {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  if (s === "registered" || s === "cadastrado" || s === "active")
    return <Badge variant="success">{status}</Badge>;
  if (s === "in_review" || s === "under_review")
    return <Badge variant="warning">Em Análise</Badge>;
  if (s === "pending")
    return <Badge variant="warning">Pendente</Badge>;
  if (s === "rejected" || s === "inactive")
    return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="neutral">{status ?? "—"}</Badge>;
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
  fonograma: phonogram,
}: PhonogramViewModalProps) {
  const [producerOpen, setProducerOpen] = useState(true);
  const [performerOpen, setPerformerOpen] = useState(true);
  const [musicoOpen, setMusicoOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);

  // Resolves the linked work DIRECTLY by ID (GET /works/:id) when no inline
  // object came — does not depend on the work being among the first records
  // loaded (Task J: it used to use an unfiltered useObras(), truncated at 50).
  const inlineWork = phonogram?.obraVinculada ?? phonogram?.obra ?? null;
  const lookupWorkId = !inlineWork ? (phonogram?.work_id ?? phonogram?.workId) : undefined;
  const { entity: foundWork } = useEntityById<ObraWithRelations>("obras", open ? lookupWorkId : undefined);

  if (!phonogram) return null;

  // Pick the first non-empty string value from a list of optional fields
  const pickStr = (
    ...values: (string | null | undefined)[]
  ): string | undefined => {
    for (const v of values) {
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  // Resolves the linked work: accepts an inline object (legacy) or resolves via work_id.
  let linkedWork: LinkedWorkView | null = inlineWork;
  if (!linkedWork && lookupWorkId) {
    linkedWork = foundWork
      ? {
          title: foundWork.title ?? "",
          genero: foundWork.music_genre ?? "",
          compositores: composersToString(foundWork.compositores),
        }
      : { title: "Obra vinculada" };
  }

  const workTitle = linkedWork?.title || linkedWork?.titulo || "";

  const phonogramTitle = pickStr(phonogram.title);
  const recordLabel = pickStr(phonogram.gravadora);
  const notes = pickStr(phonogram.notes);

  const codEntidade = pickStr(phonogram.codEntidade, phonogram.cod_entidade);
  const codEcad = pickStr(phonogram.codEcad, phonogram.cod_ecad);
  const agregadora = pickStr(phonogram.agregadora);

  // ISRC: try parts first, otherwise split full ISRC string
  let isrcCountry = pickStr(phonogram.isrcPais);
  let isrcRegistrante = pickStr(phonogram.isrcRegistrante);
  let isrcAno = pickStr(phonogram.isrcAno);
  let isrcDesignacao = pickStr(phonogram.isrcDesignacao);
  const isrcFull = pickStr(phonogram.isrc);
  if (!isrcCountry && !isrcRegistrante && !isrcAno && !isrcDesignacao && isrcFull) {
    const clean = isrcFull.replace(/[\s-]/g, "");
    if (clean.length >= 12) {
      isrcCountry = clean.slice(0, 2);
      isrcRegistrante = clean.slice(2, 5);
      isrcAno = clean.slice(5, 7);
      isrcDesignacao = clean.slice(7, 12);
    }
  }

  const isrcDisplay =
    isrcCountry && isrcRegistrante && isrcAno && isrcDesignacao
      ? `${isrcCountry}-${isrcRegistrante}-${isrcAno}-${isrcDesignacao}`
      : isrcFull ?? undefined;

  const criadaPorIA = (phonogram.criadaPorIA ?? phonogram.criada_por_ia) === true;
  const instrumental = (phonogram.is_instrumental ?? phonogram.instrumental ?? false) === true;
  const nacional = (phonogram.nacional ?? true) === true;
  const pubSimultanea =
    (phonogram.pubSimultanea ?? phonogram.pub_simultanea ?? false) === true;

  const emissao = formatDateBR(pickStr(phonogram.emissao));
  const recordingDate = formatDateBR(
    pickStr(
      phonogram.gravacaoOriginal,
      phonogram.gravacao_original,
      phonogram.data_registro,
    ),
  );
  const releaseDate = formatDateBR(
    pickStr(phonogram.lancamento, phonogram.data_lancamento),
  );

  // Duration
  let durationMin = pickStr(phonogram.duracaoMin, phonogram.duracao_min);
  let durationSeg = pickStr(phonogram.duracaoSeg, phonogram.duracao_seg);
  const durationFull = pickStr(phonogram.duration_text);
  if ((durationMin === undefined || durationSeg === undefined) && durationFull) {
    const parts = durationFull.split(":");
    if (parts.length === 2) {
      durationMin = durationMin ?? parts[0];
      durationSeg = durationSeg ?? parts[1];
    }
  }
  const durationDisplay =
    durationMin || durationSeg
      ? `${durationMin || "0"}min ${durationSeg || "0"}seg`
      : undefined;

  const musicGenre = pickStr(
    phonogram.generoMusical,
    phonogram.music_genre,
    phonogram.genero,
  );
  const media = pickStr(phonogram.midia);
  const sourceCountry = pickStr(phonogram.paisOrigem, phonogram.pais_origem);
  const publicationCountry = pickStr(
    phonogram.paisPublicacao,
    phonogram.pais_publicacao,
  );
  const classificacao = pickStr(phonogram.classificacao);
  const status = pickStr(phonogram.status);
  const createdAt = (phonogram as { created_at?: string }).created_at;

  const participacao: Required<ParticipacaoView> = {
    produtorFonografico: phonogram.participacao?.produtorFonografico ?? [],
    interprete: phonogram.participacao?.interprete ?? [],
    musicoAcompanhante: phonogram.participacao?.musicoAcompanhante ?? [],
  };

  const calcCategory = (cat: ParticipantView[]): number =>
    cat.reduce((t, p) => t + (parseFloat(p.percentual ?? "") || 0), 0);

  const percentageTotal =
    calcCategory(participacao.produtorFonografico) +
    calcCategory(participacao.interprete) +
    calcCategory(participacao.musicoAcompanhante);

  const audioFile = phonogram.arquivoAudio ?? phonogram.arquivo_audio ?? null;

  const renderParticipacaoSection = (
    title: string,
    category: keyof Required<ParticipacaoView>,
    percentageMax: number,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
  ) => {
    const list: ParticipantView[] = participacao[category] ?? [];
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
                    {p.nome || "—"}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {p.percentual ? `${p.percentual}%` : "—"}
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
                  <StatusBadge status={status} />
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
                    {(linkedWork.genero || linkedWork.compositores) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[linkedWork.genero, linkedWork.compositores]
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
                <InfoField label="Gênero Musical" value={musicGenre} />
                <InfoField label="Mídia" value={media} />
                <InfoField label="Duração" value={durationDisplay} />
                <InfoField label="Classificação" value={classificacao} />
                <InfoField label="Agregadora" value={agregadora} />
                <InfoField label="Gravadora" value={recordLabel} />
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
                <MonoField label="Código de Cadastro da Sociedade" value={codEntidade} />
                <MonoField label="Código ECAD" value={codEcad} />
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Datas
              </p>
              <div className="grid grid-cols-3 gap-3">
                <InfoField label="Emissão" value={emissao} />
                <InfoField label="Gravação Original" value={recordingDate} />
                <InfoField label="Lançamento" value={releaseDate} />
              </div>
            </div>

            <Separator />

            {/* Characteristics */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Características
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SwitchField label="Criada por IA" value={criadaPorIA} />
                <SwitchField label="Instrumental" value={instrumental} />
                <SwitchField label="Nacional" value={nacional} />
                <SwitchField label="Pub. Simultânea" value={pubSimultanea} />
                <InfoField label="País Origem" value={sourceCountry} />
                <InfoField label="País Publicação" value={publicationCountry} />
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
                {renderParticipacaoSection(
                  "Produtor Fonográfico",
                  "produtorFonografico",
                  41.7,
                  producerOpen,
                  setProducerOpen,
                )}
                {renderParticipacaoSection(
                  "Intérprete",
                  "interprete",
                  41.7,
                  performerOpen,
                  setPerformerOpen,
                )}
                {renderParticipacaoSection(
                  "Músico Acompanhante",
                  "musicoAcompanhante",
                  16.6,
                  musicoOpen,
                  setMusicoOpen,
                )}
              </div>
            </div>

            {notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                    Observações
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {notes}
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
