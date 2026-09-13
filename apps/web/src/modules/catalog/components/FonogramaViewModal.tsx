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

// `compositores` é tipado como string[] no schema, mas em alguns registros
// legados pode chegar como string ou null. Normaliza com segurança.
function compositoresToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface ParticipanteView {
  id?: string;
  nome?: string;
  percentual?: string;
}

interface ParticipacaoView {
  produtorFonografico?: ParticipanteView[];
  interprete?: ParticipanteView[];
  musicoAcompanhante?: ParticipanteView[];
}

interface ObraVinculadaView {
  title?: string;
  titulo?: string;
  genero?: string;
  compositores?: string;
}

interface ArquivoAudioView {
  name: string;
  size: number;
}

export interface FonogramaViewData {
  // Identity
  title?: string | null;
  gravadora?: string | null;
  observacoes?: string | null;
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
  duracao?: string | null;
  // Categorization
  generoMusical?: string | null;
  genero_musical?: string | null;
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
  obraVinculada?: ObraVinculadaView | null;
  obra?: ObraVinculadaView | null;
  work_id?: string | null;
  workId?: string | null;
  participacao?: ParticipacaoView | null;
  arquivoAudio?: ArquivoAudioView | null;
  arquivo_audio?: ArquivoAudioView | null;
}

interface FonogramaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fonograma?: FonogramaViewData | null;
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

export function FonogramaViewModal({
  open,
  onOpenChange,
  fonograma,
}: FonogramaViewModalProps) {
  const [produtorOpen, setProdutorOpen] = useState(true);
  const [interpreteOpen, setInterpreteOpen] = useState(true);
  const [musicoOpen, setMusicoOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);

  // Resolve obra vinculada DIRETO por ID (GET /works/:id) quando não veio um
  // objeto inline — não depende da obra estar entre os primeiros registros
  // carregados (Task J: antes usava useObras() sem filtro, truncado em 50).
  const inlineObra = fonograma?.obraVinculada ?? fonograma?.obra ?? null;
  const lookupObraId = !inlineObra ? (fonograma?.work_id ?? fonograma?.workId) : undefined;
  const { entity: foundObra } = useEntityById<ObraWithRelations>("obras", open ? lookupObraId : undefined);

  if (!fonograma) return null;

  // Pick the first non-empty string value from a list of optional fields
  const pickStr = (
    ...values: (string | null | undefined)[]
  ): string | undefined => {
    for (const v of values) {
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  // Resolve obra vinculada: aceita objeto inline (legacy) ou resolve via work_id.
  let obraVinculada: ObraVinculadaView | null = inlineObra;
  if (!obraVinculada && lookupObraId) {
    obraVinculada = foundObra
      ? {
          title: foundObra.title ?? "",
          genero: foundObra.genero ?? "",
          compositores: compositoresToString(foundObra.compositores),
        }
      : { title: "Obra vinculada" };
  }

  const obraTitle = obraVinculada?.title || obraVinculada?.titulo || "";

  const fonogramaTitle = pickStr(fonograma.title);
  const gravadora = pickStr(fonograma.gravadora);
  const observacoes = pickStr(fonograma.observacoes);

  const codEntidade = pickStr(fonograma.codEntidade, fonograma.cod_entidade);
  const codEcad = pickStr(fonograma.codEcad, fonograma.cod_ecad);
  const agregadora = pickStr(fonograma.agregadora);

  // ISRC: try parts first, otherwise split full ISRC string
  let isrcPais = pickStr(fonograma.isrcPais);
  let isrcRegistrante = pickStr(fonograma.isrcRegistrante);
  let isrcAno = pickStr(fonograma.isrcAno);
  let isrcDesignacao = pickStr(fonograma.isrcDesignacao);
  const isrcFull = pickStr(fonograma.isrc);
  if (!isrcPais && !isrcRegistrante && !isrcAno && !isrcDesignacao && isrcFull) {
    const clean = isrcFull.replace(/[\s-]/g, "");
    if (clean.length >= 12) {
      isrcPais = clean.slice(0, 2);
      isrcRegistrante = clean.slice(2, 5);
      isrcAno = clean.slice(5, 7);
      isrcDesignacao = clean.slice(7, 12);
    }
  }

  const isrcDisplay =
    isrcPais && isrcRegistrante && isrcAno && isrcDesignacao
      ? `${isrcPais}-${isrcRegistrante}-${isrcAno}-${isrcDesignacao}`
      : isrcFull ?? undefined;

  const criadaPorIA = (fonograma.criadaPorIA ?? fonograma.criada_por_ia) === true;
  const instrumental = (fonograma.instrumental ?? false) === true;
  const nacional = (fonograma.nacional ?? true) === true;
  const pubSimultanea =
    (fonograma.pubSimultanea ?? fonograma.pub_simultanea ?? false) === true;

  const emissao = formatDateBR(pickStr(fonograma.emissao));
  const gravacaoOriginal = formatDateBR(
    pickStr(
      fonograma.gravacaoOriginal,
      fonograma.gravacao_original,
      fonograma.data_registro,
    ),
  );
  const lancamento = formatDateBR(
    pickStr(fonograma.lancamento, fonograma.data_lancamento),
  );

  // Duração
  let duracaoMin = pickStr(fonograma.duracaoMin, fonograma.duracao_min);
  let duracaoSeg = pickStr(fonograma.duracaoSeg, fonograma.duracao_seg);
  const duracaoFull = pickStr(fonograma.duracao);
  if ((duracaoMin === undefined || duracaoSeg === undefined) && duracaoFull) {
    const parts = duracaoFull.split(":");
    if (parts.length === 2) {
      duracaoMin = duracaoMin ?? parts[0];
      duracaoSeg = duracaoSeg ?? parts[1];
    }
  }
  const duracaoDisplay =
    duracaoMin || duracaoSeg
      ? `${duracaoMin || "0"}min ${duracaoSeg || "0"}seg`
      : undefined;

  const generoMusical = pickStr(
    fonograma.generoMusical,
    fonograma.genero_musical,
    fonograma.genero,
  );
  const midia = pickStr(fonograma.midia);
  const paisOrigem = pickStr(fonograma.paisOrigem, fonograma.pais_origem);
  const paisPublicacao = pickStr(
    fonograma.paisPublicacao,
    fonograma.pais_publicacao,
  );
  const classificacao = pickStr(fonograma.classificacao);
  const status = pickStr(fonograma.status);
  const createdAt = (fonograma as { created_at?: string }).created_at;

  const participacao: Required<ParticipacaoView> = {
    produtorFonografico: fonograma.participacao?.produtorFonografico ?? [],
    interprete: fonograma.participacao?.interprete ?? [],
    musicoAcompanhante: fonograma.participacao?.musicoAcompanhante ?? [],
  };

  const calcCategoria = (cat: ParticipanteView[]): number =>
    cat.reduce((t, p) => t + (parseFloat(p.percentual ?? "") || 0), 0);

  const totalPercentual =
    calcCategoria(participacao.produtorFonografico) +
    calcCategoria(participacao.interprete) +
    calcCategoria(participacao.musicoAcompanhante);

  const arquivoAudio = fonograma.arquivoAudio ?? fonograma.arquivo_audio ?? null;

  const renderParticipacaoSection = (
    title: string,
    categoria: keyof Required<ParticipacaoView>,
    percentualMax: number,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
  ) => {
    const lista: ParticipanteView[] = participacao[categoria] ?? [];
    const percentualAtual = calcCategoria(lista);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium text-foreground">
            {title}{" "}
            <span className="text-muted-foreground font-normal">
              — {percentualAtual.toFixed(2)}% de {percentualMax.toFixed(2)}%
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {lista.length > 0 ? (
            <div className="px-3">
              {lista.map((p, idx) => (
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
                  {fonogramaTitle || obraTitle || "Fonograma sem título"}
                </h2>
                {fonogramaTitle && obraTitle && fonogramaTitle !== obraTitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">Obra: {obraTitle}</p>
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

            {/* Obra Vinculada */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Obra Vinculada
              </p>
              {obraVinculada ? (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Music className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-foreground truncate"
                      data-testid="text-obra-vinculada-title"
                    >
                      {obraTitle || "—"}
                    </p>
                    {(obraVinculada.genero || obraVinculada.compositores) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[obraVinculada.genero, obraVinculada.compositores]
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

            {/* Informações Gerais */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Informações Gerais
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero Musical" value={generoMusical} />
                <InfoField label="Mídia" value={midia} />
                <InfoField label="Duração" value={duracaoDisplay} />
                <InfoField label="Classificação" value={classificacao} />
                <InfoField label="Agregadora" value={agregadora} />
                <InfoField label="Gravadora" value={gravadora} />
              </div>
            </div>

            <Separator />

            {/* Códigos de Registro */}
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

            {/* Datas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Datas
              </p>
              <div className="grid grid-cols-3 gap-3">
                <InfoField label="Emissão" value={emissao} />
                <InfoField label="Gravação Original" value={gravacaoOriginal} />
                <InfoField label="Lançamento" value={lancamento} />
              </div>
            </div>

            <Separator />

            {/* Características */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                Características
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SwitchField label="Criada por IA" value={criadaPorIA} />
                <SwitchField label="Instrumental" value={instrumental} />
                <SwitchField label="Nacional" value={nacional} />
                <SwitchField label="Pub. Simultânea" value={pubSimultanea} />
                <InfoField label="País Origem" value={paisOrigem} />
                <InfoField label="País Publicação" value={paisPublicacao} />
              </div>
            </div>

            <Separator />

            {/* Participação */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground  tracking-wide">
                  Participação
                </p>
                <span className="text-xs text-muted-foreground">
                  Total: {totalPercentual.toFixed(2)}% de 100%
                </span>
              </div>

              <div className="space-y-2">
                {renderParticipacaoSection(
                  "Produtor Fonográfico",
                  "produtorFonografico",
                  41.7,
                  produtorOpen,
                  setProdutorOpen,
                )}
                {renderParticipacaoSection(
                  "Intérprete",
                  "interprete",
                  41.7,
                  interpreteOpen,
                  setInterpreteOpen,
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

            {observacoes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
                    Observações
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {observacoes}
                  </p>
                </div>
              </>
            )}

            {arquivoAudio && (
              <>
                <Separator />

                {/* Arquivo de Áudio */}
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
                            {arquivoAudio.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(arquivoAudio.size)}
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
