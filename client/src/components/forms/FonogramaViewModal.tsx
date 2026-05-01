import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown, FileAudio, Music } from "lucide-react";
import { useObras, type ObraWithRelations } from "@/hooks/useObras";
import { AbramusBadge } from "@/components/shared/AbramusBadge";

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
  // ABRAMUS / ECAD codes
  codAbramus?: string | null;
  cod_abramus?: string | null;
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
  obra_id?: string | null;
  obraId?: string | null;
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
  if (s === "registrado" || s === "cadastrado" || s === "ativo")
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white">
        {status}
      </Badge>
    );
  if (s === "em_analise" || s === "analise" || s === "análise")
    return (
      <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
        Em Análise
      </Badge>
    );
  if (s === "pendente")
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
        Pendente
      </Badge>
    );
  if (s === "rejeitado" || s === "inativo")
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-white">{status}</Badge>
    );
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
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
      <p className="font-mono text-sm font-medium text-primary">
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
  const { obras } = useObras();

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

  // Resolve obra vinculada: aceita objeto inline (legacy) ou resolve via obra_id
  // a partir da lista do Supabase.
  let obraVinculada: ObraVinculadaView | null =
    fonograma.obraVinculada ?? fonograma.obra ?? null;
  if (!obraVinculada) {
    const obraId = fonograma.obra_id ?? fonograma.obraId;
    if (obraId) {
      const found = obras.find((o: ObraWithRelations) => o.id === obraId);
      if (found) {
        obraVinculada = {
          title: found.titulo ?? "",
          genero: found.genero ?? "",
          compositores: compositoresToString(found.compositores),
        };
      } else {
        obraVinculada = { title: "Obra vinculada" };
      }
    }
  }

  const obraTitulo = obraVinculada?.title || obraVinculada?.titulo || "";

  const codAbramus = pickStr(fonograma.codAbramus, fonograma.cod_abramus);
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
    titulo: string,
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
            {titulo}{" "}
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
      <DialogContent
        className="max-w-2xl bg-card border-border"
        data-testid="dialog-fonograma-view"
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-foreground"
            data-testid="text-fonograma-view-title"
          >
            <Music className="h-5 w-5 text-primary" />
            Detalhes do Fonograma
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-5 pr-2">
            {/* Título + Status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {obraTitulo || "Fonograma sem obra vinculada"}
                </h2>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">
                  Fonograma
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={status} />
                <AbramusBadge
                  origem={fonograma.origem_externa}
                  sincronizadoEm={fonograma.origem_externa_sincronizado_em}
                />
              </div>
            </div>

            <Separator />

            {/* Obra Vinculada */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Obra Vinculada
              </p>
              {obraVinculada ? (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                    <Music className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-foreground truncate"
                      data-testid="text-obra-vinculada-titulo"
                    >
                      {obraTitulo || "—"}
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Informações Gerais
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero Musical" value={generoMusical} />
                <InfoField label="Mídia" value={midia} />
                <InfoField label="Duração" value={duracaoDisplay} />
                <InfoField label="Classificação" value={classificacao} />
                <InfoField label="Agregadora" value={agregadora} />
              </div>
            </div>

            <Separator />

            {/* Códigos de Registro */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Códigos de Registro
              </p>
              <div className="grid grid-cols-3 gap-3">
                <MonoField label="ISRC" value={isrcDisplay} />
                <MonoField label="Código ABRAMUS" value={codAbramus} />
                <MonoField label="Código ECAD" value={codEcad} />
              </div>
            </div>

            <Separator />

            {/* Datas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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

            {arquivoAudio && (
              <>
                <Separator />

                {/* Arquivo de Áudio */}
                <div>
                  <Collapsible open={uploadOpen} onOpenChange={setUploadOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Arquivo de Áudio
                      </p>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${uploadOpen ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <FileAudio className="w-8 h-8 text-red-500 shrink-0" />
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
