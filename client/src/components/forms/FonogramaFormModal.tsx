import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/forms/FormField";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Search, ChevronDown, Trash2, Upload, FileAudio, Music, X } from "lucide-react";
import { useObras, type ObraWithRelations } from "@/hooks/useObras";
import { useFonogramas, type FonogramaInsert, type FonogramaUpdate } from "@/hooks/useFonogramas";
import { useCurrentOrgId } from "@/hooks/useCurrentOrgId";
import { useDebounce } from "@/hooks/useDebounce";
import { AbramusSearchRow } from "@/components/forms/AbramusSearchRow";
import type { Json, Tables } from "@/types/database";
import {
  dbStatusToSelect,
  normalizeStatusForDb,
  parseDuracao,
  formatDuracao,
  parseIsrc,
  joinIsrc,
  fonogramaToParticipacao,
} from "@/components/forms/registroMusicasMappers";

type FonogramaRow = Tables<"fonogramas">;

// `compositores` é tipado como string[] no schema, mas em alguns registros
// legados pode chegar como string ou null. Normaliza com segurança.
function compositoresToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface ObraVinculadaInput {
  id?: string | number | null;
  title?: string | null;
  titulo?: string | null;
  genero?: string | null;
  compositores?: string | string[] | null;
  status?: string | null;
}

interface ParticipacaoInput {
  produtorFonografico?: Participante[];
  interprete?: Participante[];
  musicoAcompanhante?: Participante[];
}

interface ArquivoAudioInput {
  name: string;
  size: number;
}

type FonogramaFormInput = Partial<FonogramaRow> & {
  // camelCase aliases used by some callers / earlier in-memory shape
  codAbramus?: string | null;
  codEcad?: string | null;
  isrcPais?: string | null;
  isrcRegistrante?: string | null;
  isrcAno?: string | null;
  isrcDesignacao?: string | null;
  criadaPorIA?: boolean | null;
  gravacaoOriginal?: string | null;
  lancamento?: string | null;
  duracaoMin?: string | number | null;
  duracaoSeg?: string | number | null;
  generoMusical?: string | null;
  pubSimultanea?: boolean | null;
  paisOrigem?: string | null;
  paisPublicacao?: string | null;
  obraVinculada?: ObraVinculadaInput | null;
  obra?: ObraVinculadaInput | null;
  participacao?: ParticipacaoInput | null;
  arquivoAudio?: ArquivoAudioInput | null;
};

interface FonogramaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fonograma?: FonogramaFormInput | null;
  mode: "create" | "edit" | "view";
}

const pickStr = (...values: Array<unknown>): string => {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
};

const pickBool = (...values: Array<unknown>): boolean | undefined => {
  for (const v of values) {
    if (v === true || v === false) return v;
  }
  return undefined;
};

const toParticipacaoCategoria = (
  raw: ParticipacaoInput | Json | null | undefined
): ParticipacaoCategoria => {
  const empty: ParticipacaoCategoria = { produtorFonografico: [], interprete: [], musicoAcompanhante: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const r = raw as ParticipacaoInput;
  return {
    produtorFonografico: Array.isArray(r.produtorFonografico) ? r.produtorFonografico : [],
    interprete: Array.isArray(r.interprete) ? r.interprete : [],
    musicoAcompanhante: Array.isArray(r.musicoAcompanhante) ? r.musicoAcompanhante : [],
  };
};

const toArquivoAudio = (
  raw: ArquivoAudioInput | Json | null | undefined
): ArquivoAudioInput | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as { name?: unknown; size?: unknown };
  if (typeof r.name === "string" && typeof r.size === "number") {
    return { name: r.name, size: r.size };
  }
  return null;
};

interface Participante {
  id: string;
  nome: string;
  percentual: string;
}

interface ParticipacaoCategoria {
  produtorFonografico: Participante[];
  interprete: Participante[];
  musicoAcompanhante: Participante[];
}

interface ObraVinculada {
  id: string;
  title: string;
  genero: string;
  compositores: string;
  status: string;
}

const generosMusicais = ["Funk", "Pop", "Rock", "Sertanejo", "Trap", "Rap/Hip-Hop", "Pagode", "Forró", "MPB", "Eletrônica", "Gospel", "Reggaeton", "R&B", "Outro"];
const agregadoras = ["CD Baby", "DistroKid", "TuneCore", "Ditto Music", "ONErpm", "iMusics", "Symphonic", "Outro"];
const classificacoes = ["STUDIO", "LIVE", "REMIX", "DEMO", "OUTRO"];
const midias = ["TODOS", "DIGITAL", "FÍSICO", "STREAMING"];
const statusOptions = ["Em Análise", "Pendente", "Registrado", "Rejeitado"];
const paises = ["BRAZIL", "USA", "UK", "PORTUGAL", "ARGENTINA", "OUTRO"];

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FonogramaFormModal({ open, onOpenChange, fonograma, mode }: FonogramaFormModalProps) {
  // Obras vindas do Supabase
  const { obras } = useObras();
  const { addFonograma, updateFonograma } = useFonogramas();
  const { orgId } = useCurrentOrgId();

  // Build initial obra vinculada from form-shape OR DB-shape (snake_case).
  // Em registros que vêm do banco apenas com obra_id, a hidratação completa
  // acontece no useEffect abaixo a partir da lista de obras.
  const toObraVinculada = (o: ObraVinculadaInput | null | undefined): ObraVinculada | null => {
    if (!o) return null;
    return {
      id: String(o.id ?? ""),
      title: o.title ?? o.titulo ?? "",
      genero: o.genero ?? "",
      compositores: compositoresToString(o.compositores),
      status: o.status ?? "",
    };
  };

  const initialObra = (): ObraVinculada | null => {
    if (fonograma?.obraVinculada) return toObraVinculada(fonograma.obraVinculada);
    if (fonograma?.obra) return toObraVinculada(fonograma.obra);
    return null;
  };

  // Obra vinculada
  const [obraVinculada, setObraVinculada] = useState<ObraVinculada | null>(initialObra());
  const [buscaObra, setBuscaObra] = useState("");
  const [buscaOpen, setBuscaOpen] = useState(false);
  // Dados do Fonograma (suportam camelCase do form OU snake_case do banco)
  const initialDuracao = parseDuracao(fonograma?.duracao);
  const initialIsrc = parseIsrc(fonograma?.isrc);

  const [codAbramus, setCodAbramus] = useState(pickStr(fonograma?.codAbramus, fonograma?.cod_abramus));
  const [codEcad, setCodEcad] = useState(pickStr(fonograma?.codEcad, fonograma?.cod_ecad));
  const [agregadora, setAgregadora] = useState(pickStr(fonograma?.agregadora) || pickStr(fonograma?.gravadora));
  const [isrcPais, setIsrcPais] = useState(pickStr(fonograma?.isrcPais, fonograma?.isrc_pais) || initialIsrc.pais || "BR");
  const [isrcRegistrante, setIsrcRegistrante] = useState(pickStr(fonograma?.isrcRegistrante, fonograma?.isrc_registrante) || initialIsrc.registrante);
  const [isrcAno, setIsrcAno] = useState(pickStr(fonograma?.isrcAno, fonograma?.isrc_ano) || initialIsrc.ano);
  const [isrcDesignacao, setIsrcDesignacao] = useState(pickStr(fonograma?.isrcDesignacao, fonograma?.isrc_designacao) || initialIsrc.designacao);
  const [criadaPorIA, setCriadaPorIA] = useState<boolean>(pickBool(fonograma?.criadaPorIA, fonograma?.criada_por_ia) ?? false);
  const [emissao, setEmissao] = useState(pickStr(fonograma?.emissao));
  const [gravacaoOriginal, setGravacaoOriginal] = useState(pickStr(fonograma?.gravacaoOriginal, fonograma?.gravacao_original, fonograma?.data_registro));
  const [lancamento, setLancamento] = useState(pickStr(fonograma?.lancamento, fonograma?.data_lancamento));
  const [duracaoMin, setDuracaoMin] = useState(pickStr(fonograma?.duracaoMin, fonograma?.duracao_min) || initialDuracao.min);
  const [duracaoSeg, setDuracaoSeg] = useState(pickStr(fonograma?.duracaoSeg, fonograma?.duracao_seg) || initialDuracao.seg);
  const [instrumental, setInstrumental] = useState<boolean>(pickBool(fonograma?.instrumental) ?? false);
  const [generoMusical, setGeneroMusical] = useState(pickStr(fonograma?.generoMusical, fonograma?.genero_musical));
  const [classificacao, setClassificacao] = useState(pickStr(fonograma?.classificacao));
  const [midia, setMidia] = useState(pickStr(fonograma?.midia));
  const [nacional, setNacional] = useState<boolean>(pickBool(fonograma?.nacional) ?? true);
  const [pubSimultanea, setPubSimultanea] = useState<boolean>(pickBool(fonograma?.pubSimultanea, fonograma?.pub_simultanea) ?? false);
  const [status, setStatus] = useState(dbStatusToSelect(pickStr(fonograma?.status)));
  const [paisOrigem, setPaisOrigem] = useState(pickStr(fonograma?.paisOrigem, fonograma?.pais_origem));
  const [paisPublicacao, setPaisPublicacao] = useState(pickStr(fonograma?.paisPublicacao, fonograma?.pais_publicacao));
  const [titulo, setTitulo] = useState(pickStr(fonograma?.titulo));
  const [gravadora, setGravadora] = useState(pickStr(fonograma?.gravadora));
  const [observacoes, setObservacoes] = useState(pickStr(fonograma?.observacoes));

  // Participação
  const [participacao, setParticipacao] = useState<ParticipacaoCategoria>(() => {
    const fromCat = toParticipacaoCategoria(fonograma?.participacao);
    if (fromCat.produtorFonografico.length === 0 && (fonograma as any)?.produtores) {
      return fonogramaToParticipacao(fonograma);
    }
    return fromCat;
  }

  );
  const [produtorOpen, setProdutorOpen] = useState(true);
  const [interpreteOpen, setInterpreteOpen] = useState(true);
  const [musicoOpen, setMusicoOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);

  // Upload de áudio
  const [arquivoAudio, setArquivoAudio] = useState<ArquivoAudioInput | null>(
    toArquivoAudio(fonograma?.arquivoAudio ?? fonograma?.arquivo_audio)
  );
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Termos
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // Loading state for submit
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever the modal opens or the fonograma record changes
  useEffect(() => {
    if (!open) return;
    const dur = parseDuracao(fonograma?.duracao);
    const isrc = parseIsrc(fonograma?.isrc);
    setBuscaObra("");
    setBuscaOpen(false);
    setObraVinculada(initialObra());
    setCodAbramus(pickStr(fonograma?.codAbramus, fonograma?.cod_abramus));
    setCodEcad(pickStr(fonograma?.codEcad, fonograma?.cod_ecad));
    setAgregadora(pickStr(fonograma?.agregadora) || pickStr(fonograma?.gravadora));
    setIsrcPais(pickStr(fonograma?.isrcPais, fonograma?.isrc_pais) || isrc.pais || "BR");
    setIsrcRegistrante(pickStr(fonograma?.isrcRegistrante, fonograma?.isrc_registrante) || isrc.registrante);
    setIsrcAno(pickStr(fonograma?.isrcAno, fonograma?.isrc_ano) || isrc.ano);
    setIsrcDesignacao(pickStr(fonograma?.isrcDesignacao, fonograma?.isrc_designacao) || isrc.designacao);
    setCriadaPorIA(pickBool(fonograma?.criadaPorIA, fonograma?.criada_por_ia) ?? false);
    setEmissao(pickStr(fonograma?.emissao));
    setGravacaoOriginal(pickStr(fonograma?.gravacaoOriginal, fonograma?.gravacao_original, fonograma?.data_registro));
    setLancamento(pickStr(fonograma?.lancamento, fonograma?.data_lancamento));
    setDuracaoMin(pickStr(fonograma?.duracaoMin, fonograma?.duracao_min) || dur.min);
    setDuracaoSeg(pickStr(fonograma?.duracaoSeg, fonograma?.duracao_seg) || dur.seg);
    setInstrumental(pickBool(fonograma?.instrumental) ?? false);
    setGeneroMusical(pickStr(fonograma?.generoMusical, fonograma?.genero_musical));
    setClassificacao(pickStr(fonograma?.classificacao));
    setMidia(pickStr(fonograma?.midia));
    setNacional(pickBool(fonograma?.nacional) ?? true);
    setPubSimultanea(pickBool(fonograma?.pubSimultanea, fonograma?.pub_simultanea) ?? false);
    setStatus(dbStatusToSelect(pickStr(fonograma?.status)));
    setPaisOrigem(pickStr(fonograma?.paisOrigem, fonograma?.pais_origem));
    setPaisPublicacao(pickStr(fonograma?.paisPublicacao, fonograma?.pais_publicacao));
    setTitulo(pickStr(fonograma?.titulo));
    setGravadora(pickStr(fonograma?.gravadora));
    setObservacoes(pickStr(fonograma?.observacoes));
    setParticipacao(() => {
      const fromCat = toParticipacaoCategoria(fonograma?.participacao);
      if (fromCat.produtorFonografico.length === 0 && (fonograma as any)?.produtores) {
        return fonogramaToParticipacao(fonograma);
      }
      return fromCat;
    });
    setArquivoAudio(toArquivoAudio(fonograma?.arquivoAudio ?? fonograma?.arquivo_audio));
    setAceitaTermos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [open, fonograma]);

  // Hidrata a obra vinculada a partir de fonograma.obra_id assim que a lista
  // de obras chegar (ou quando o registro mudar). Em modo create, fica null.
  useEffect(() => {
    if (!open) return;
    const obraId: string | undefined =
      (fonograma?.obra_id as string | undefined) ??
      (fonograma as { obraId?: string } | null | undefined)?.obraId;
    // Se o caller já enviou um objeto pronto (legacy), usa ele
    if (fonograma?.obraVinculada) {
      setObraVinculada(toObraVinculada(fonograma.obraVinculada));
      return;
    }
    if (!obraId) {
      setObraVinculada(null);
      return;
    }
    const found = obras.find((o: ObraWithRelations) => o.id === obraId);
    if (found) {
      setObraVinculada({
        id: found.id,
        title: found.titulo ?? "",
        genero: found.genero ?? "",
        compositores: compositoresToString(found.compositores),
        status: found.status ?? "",
      });
    } else {
      // Ainda carregando ou obra fora do filtro — mantém ID com placeholder.
      setObraVinculada({
        id: obraId,
        title: "Obra vinculada",
        genero: "",
        compositores: "",
        status: "",
      });
    }
  }, [open, fonograma, obras]);

  // Debounce do termo digitado para evitar uma chamada ABRAMUS por tecla.
  const buscaObraDebounced = useDebounce(buscaObra, 300);

  // Lista de obras registradas filtrada pelo termo digitado (busca local
  // continua respondendo instantaneamente em memória) — limitada a 20.
  const LOCAL_RESULTS_LIMIT = 20;
  const obrasRegistradasFiltradasFull: ObraVinculada[] = obras
    .filter((o: ObraWithRelations) => o.status === "registrado")
    .filter((o: ObraWithRelations) => {
      if (!buscaObra) return true;
      const termo = buscaObra.toLowerCase();
      const compositoresStr = compositoresToString(o.compositores).toLowerCase();
      return (
        (o.titulo ?? "").toLowerCase().includes(termo) ||
        compositoresStr.includes(termo) ||
        (o.genero ?? "").toLowerCase().includes(termo)
      );
    })
    .map((o: ObraWithRelations) => ({
      id: o.id,
      title: o.titulo ?? "",
      genero: o.genero ?? "",
      compositores: compositoresToString(o.compositores),
      status: o.status ?? "",
    }));
  const obrasRegistradasTotal = obrasRegistradasFiltradasFull.length;
  const obrasRegistradasFiltradas: ObraVinculada[] =
    obrasRegistradasFiltradasFull.slice(0, LOCAL_RESULTS_LIMIT);

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Fonograma" : mode === "edit" ? "Editar Fonograma" : "Detalhes do Fonograma";

  const calcularPercentualCategoria = (categoria: Participante[]) => {
    return categoria.reduce((total, p) => total + (parseFloat(p.percentual) || 0), 0);
  };

  const calcularPercentualTotal = () => {
    return calcularPercentualCategoria(participacao.produtorFonografico) +
           calcularPercentualCategoria(participacao.interprete) +
           calcularPercentualCategoria(participacao.musicoAcompanhante);
  };

  const addParticipante = (categoria: keyof ParticipacaoCategoria) => {
    setParticipacao({
      ...participacao,
      [categoria]: [...participacao[categoria], { id: crypto.randomUUID(), nome: "", percentual: "" }]
    });
  };

  const updateParticipante = (categoria: keyof ParticipacaoCategoria, id: string, field: keyof Participante, value: string) => {
    setParticipacao({
      ...participacao,
      [categoria]: participacao[categoria].map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const removeParticipante = (categoria: keyof ParticipacaoCategoria, id: string) => {
    setParticipacao({
      ...participacao,
      [categoria]: participacao[categoria].filter(p => p.id !== id)
    });
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 100 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 100MB");
      return;
    }
    
    if (!['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-flac'].includes(file.type)) {
      toast.error("Formato inválido. Use MP3, WAV ou FLAC");
      return;
    }

    setArquivoAudio({ name: file.name, size: file.size });
    toast.success("Arquivo de áudio carregado!");
  };

  const duracaoMinNum = Number(duracaoMin);
  const duracaoSegNum = Number(duracaoSeg);
  const duracaoMinError = duracaoMin !== "" && (!Number.isInteger(duracaoMinNum) || duracaoMinNum < 0)
    ? "Minutos não pode ser negativo"
    : null;
  const duracaoSegError = duracaoSeg !== "" && (!Number.isInteger(duracaoSegNum) || duracaoSegNum < 0 || duracaoSegNum > 59)
    ? "Segundos deve estar entre 0 e 59"
    : null;
  const hasDuracaoError = !!(duracaoMinError || duracaoSegError);

  // Concatenated ISRC for legacy column (e.g. "BR-XXX-25-12345")
  const isrcConcat = joinIsrc({
    pais: isrcPais,
    registrante: isrcRegistrante,
    ano: isrcAno,
    designacao: isrcDesignacao
  });

  // Duration in MM:SS for legacy column
  const duracaoConcat = formatDuracao(duracaoMin, duracaoSeg);

  const buildPayload = (): FonogramaInsert => {
    const tituloFinal = (titulo && titulo.trim()) || obraVinculada?.title || "Sem título";
    return {
      titulo: tituloFinal,
      org_id: orgId as string,
      cod_abramus: codAbramus || null,
      cod_ecad: codEcad || null,
      agregadora: agregadora || null,
      isrc: isrcConcat,
      isrc_pais: isrcPais || null,
      isrc_registrante: isrcRegistrante || null,
      isrc_ano: isrcAno || null,
      isrc_designacao: isrcDesignacao || null,
      criada_por_ia: !!criadaPorIA,
      instrumental: !!instrumental,
      nacional: !!nacional,
      pub_simultanea: !!pubSimultanea,
      emissao: emissao || null,
      gravacao_original: gravacaoOriginal || null,
      data_lancamento: lancamento || null,
      duracao: duracaoConcat,
      duracao_min: duracaoMin === "" ? null : Number(duracaoMin),
      duracao_seg: duracaoSeg === "" ? null : Number(duracaoSeg),
      genero_musical: generoMusical || null,
      midia: midia || null,
      classificacao: classificacao || null,
      pais_origem: paisOrigem || null,
      pais_publicacao: paisPublicacao || null,
      status: normalizeStatusForDb(status),
      gravadora: gravadora || null,
      observacoes: observacoes || null,
      obra_id: obraVinculada && typeof obraVinculada.id === "string" ? obraVinculada.id : null,
      participacao: participacao as unknown as Json,
      arquivo_audio: arquivoAudio as unknown as Json,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDuracaoError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    if (!aceitaTermos) {
      toast.error("Você precisa aceitar os termos de uso!");
      return;
    }

    if (!orgId) {
      toast.error("Não foi possível identificar sua organização. Tente novamente.");
      return;
    }

    const payload = buildPayload();

    try {
      setSubmitting(true);
      if (mode === "create") {
        await addFonograma.mutateAsync(payload);
      } else if (mode === "edit" && fonograma?.id) {
        const updatePayload: { id: string } & FonogramaUpdate = { id: fonograma.id, ...payload };
        await updateFonograma.mutateAsync(updatePayload);
      }
      onOpenChange(false);
    } catch (err) {
      // toast já é exibido pelo hook
    } finally {
      setSubmitting(false);
    }
  };

  const renderParticipacaoSection = (
    titulo: string,
    categoria: keyof ParticipacaoCategoria,
    percentualMax: number,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void
  ) => {
    const percentualAtual = calcularPercentualCategoria(participacao[categoria]);
    
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg border border-border">
          <span className="text-sm font-medium">
            {titulo} - Percentual total: {percentualAtual.toFixed(2)}% de {percentualMax.toFixed(2)}%
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={() => addParticipante(categoria)} disabled={isViewMode}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
          
          {participacao[categoria].length > 0 ? (
            <div className="space-y-2">
              {participacao[categoria].map((p) => (
                <div key={p.id} className="flex gap-3 items-center">
                  <Input 
                    value={p.nome} 
                    onChange={(e) => updateParticipante(categoria, p.id, 'nome', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Nome do participante" 
                    className="flex-1"
                  />
                  <Input 
                    value={p.percentual} 
                    onChange={(e) => updateParticipante(categoria, p.id, 'percentual', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="%" 
                    type="number"
                    className="w-20"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeParticipante(categoria, p.id)} disabled={isViewMode}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Título da Obra Vinculada */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <Label className="font-semibold text-sm">Título da Obra Vinculada</Label>
            
            {obraVinculada ? (
              <div
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                data-testid="obra-vinculada-card"
              >
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium" data-testid="text-obra-vinculada-titulo">
                    {obraVinculada.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {obraVinculada.genero} • {obraVinculada.compositores}
                  </p>
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setObraVinculada(null)}
                    data-testid="button-remove-obra-vinculada"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Popover open={buscaOpen} onOpenChange={setBuscaOpen}>
                  <PopoverTrigger asChild>
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={buscaObra}
                        onChange={(e) => {
                          setBuscaObra(e.target.value);
                          setBuscaOpen(true);
                        }}
                        onFocus={() => !isViewMode && setBuscaOpen(true)}
                        onClick={() => !isViewMode && setBuscaOpen(true)}
                        disabled={isViewMode}
                        placeholder="Digite para buscar uma obra..."
                        className="pl-10"
                        data-testid="input-buscar-obra"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[500px] p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-2" role="listbox">
                        <p
                          className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1"
                          role="presentation"
                          data-testid="local-section-heading"
                        >
                          Obras do sistema
                        </p>
                        {obrasRegistradasFiltradas.length > 0 ? (
                          obrasRegistradasFiltradas.map((obra) => {
                            const selectObra = () => {
                              setObraVinculada(obra);
                              setBuscaObra("");
                              setBuscaOpen(false);
                              toast.success(`Obra "${obra.title}" vinculada!`);
                            };
                            return (
                              <div
                                key={obra.id}
                                role="option"
                                tabIndex={0}
                                aria-selected={false}
                                className="flex items-center gap-3 p-2 hover:bg-muted focus:bg-muted focus:outline-none rounded-lg cursor-pointer transition-colors"
                                onClick={selectObra}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectObra();
                                  }
                                }}
                                data-testid={`option-obra-${obra.id}`}
                              >
                                <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                                  <Music className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {obra.title || "—"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[obra.genero, obra.compositores]
                                      .filter(Boolean)
                                      .join(" • ") || "—"}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p
                            className="text-sm text-muted-foreground text-center py-4"
                            data-testid="text-empty-obras"
                          >
                            Nenhuma obra registrada encontrada.
                          </p>
                        )}
                        {obrasRegistradasTotal > LOCAL_RESULTS_LIMIT && (
                          <p
                            className="text-xs text-muted-foreground italic px-2 py-1"
                            data-testid="text-local-overflow"
                          >
                            Mostrando {LOCAL_RESULTS_LIMIT} de {obrasRegistradasTotal} resultados — refine sua busca.
                          </p>
                        )}
                        <AbramusSearchRow
                          kind="obras"
                          query={buscaObraDebounced}
                          limit={LOCAL_RESULTS_LIMIT}
                          onImported={(rec) => {
                            if (!rec.localId) {
                              toast.error(
                                "Não foi possível resolver a obra importada."
                              );
                              return;
                            }
                            setObraVinculada({
                              id: rec.localId,
                              title: rec.titulo ?? "",
                              genero: rec.genero ?? "",
                              compositores: Array.isArray(rec.compositores)
                                ? rec.compositores.filter(Boolean).join(", ")
                                : "",
                              status: "registrado",
                            });
                            setBuscaObra("");
                            setBuscaOpen(false);
                          }}
                        />
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isViewMode}
                  onClick={() => setBuscaOpen(true)}
                  data-testid="button-buscar-obra"
                >
                  <Search className="w-4 h-4 mr-2" /> Buscar
                </Button>
              </div>
            )}
          </div>

          {/* Dados do Fonograma */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <h3 className="font-semibold text-base">Dados do Fonograma</h3>

            {/* Linha 1: Código ABRAMUS | Código ECAD | Agregadora | ISRC | Criada por IA */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Código ABRAMUS</span>
                <Input value={codAbramus} onChange={(e) => setCodAbramus(e.target.value)} disabled={isViewMode} placeholder="Código ABRAMUS" className="h-9 px-2 text-sm min-w-0" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Código ECAD</span>
                <Input value={codEcad} onChange={(e) => setCodEcad(e.target.value)} disabled={isViewMode} placeholder="Código ECAD" className="h-9 px-2 text-sm min-w-0" />
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">Agregadora</span>
                <Select value={agregadora} onValueChange={setAgregadora} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {agregadoras.map(a => <SelectItem key={a} value={a.toLowerCase().replace(/ /g, "_")}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">ISRC</span>
                <div className="flex items-center gap-1">
                  <Input value={isrcPais} onChange={(e) => setIsrcPais(e.target.value)} disabled={isViewMode} placeholder="BR" className="h-9 px-2 text-sm flex-1 min-w-0 text-center font-mono" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcRegistrante} onChange={(e) => setIsrcRegistrante(e.target.value)} disabled={isViewMode} placeholder="XXX" className="h-9 px-2 text-sm flex-1 min-w-0 text-center font-mono" maxLength={3} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcAno} onChange={(e) => setIsrcAno(e.target.value)} disabled={isViewMode} placeholder="00" className="h-9 px-2 text-sm flex-1 min-w-0 text-center font-mono" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcDesignacao} onChange={(e) => setIsrcDesignacao(e.target.value)} disabled={isViewMode} placeholder="00000" className="h-9 px-2 text-sm flex-[1.5] min-w-0 text-center font-mono" maxLength={5} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Criada por IA</span>
                <div className="flex items-center h-9">
                  <Switch checked={criadaPorIA} onCheckedChange={setCriadaPorIA} disabled={isViewMode} />
                </div>
              </div>
            </div>

            {/* Linha 2: Instrumental | Emissão | Gravação Original | Lançamento | Duração */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Instrumental</span>
                <div className="flex items-center h-9">
                  <Switch checked={instrumental} onCheckedChange={setInstrumental} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Emissão</span>
                <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} disabled={isViewMode} className="h-9 px-2 text-sm min-w-0" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Gravação Original</span>
                <Input type="date" value={gravacaoOriginal} onChange={(e) => setGravacaoOriginal(e.target.value)} disabled={isViewMode} className="h-9 px-2 text-sm min-w-0" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Lançamento</span>
                <Input type="date" value={lancamento} onChange={(e) => setLancamento(e.target.value)} disabled={isViewMode} className="h-9 px-2 text-sm min-w-0" />
              </div>
              <div className="col-span-4">
                <span className="text-xs text-muted-foreground mb-1 block">Duração</span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-9 w-12 min-w-0 text-center px-2 text-sm ${duracaoMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">min</span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-9 w-12 min-w-0 text-center px-2 text-sm ${duracaoSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoSeg}
                    onChange={(e) => setDuracaoSeg(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">seg</span>
                </div>
                {(duracaoMinError || duracaoSegError) && (
                  <p className="text-xs text-destructive">{duracaoMinError || duracaoSegError}</p>
                )}
              </div>
            </div>

            {/* Linha 3: Gênero | Mídia | Nacional | Pub. Simultânea | País Origem | País Publicação */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Gênero Musical</span>
                <Select value={generoMusical} onValueChange={setGeneroMusical} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {generosMusicais.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Mídia</span>
                <Select value={midia} onValueChange={setMidia} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {midias.map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Nacional</span>
                <div className="flex items-center h-9">
                  <Switch checked={nacional} onCheckedChange={setNacional} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Pub. Simultânea</span>
                <div className="flex items-center h-9">
                  <Switch checked={pubSimultanea} onCheckedChange={setPubSimultanea} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Origem</span>
                <Select value={paisOrigem} onValueChange={setPaisOrigem} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paises.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Publicação</span>
                <Select value={paisPublicacao} onValueChange={setPaisPublicacao} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paises.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 4: Classificação | Status */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Classificação</span>
                <Select value={classificacao} onValueChange={setClassificacao} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {classificacoes.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Status</span>
                <Select value={status} onValueChange={setStatus} disabled={isViewMode}>
                  <SelectTrigger className="h-9 px-2 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s.toLowerCase().replace(/ /g, "_")}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Participação */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Participação</h3>
              <span className="text-sm text-muted-foreground">Percentual total: {calcularPercentualTotal().toFixed(2)}% de 100%</span>
            </div>
            
            <div className="space-y-3">
              {renderParticipacaoSection("Produtor Fonográfico", "produtorFonografico", 41.70, produtorOpen, setProdutorOpen)}
              {renderParticipacaoSection("Intérprete", "interprete", 41.70, interpreteOpen, setInterpreteOpen)}
              {renderParticipacaoSection("Músico Acompanhante", "musicoAcompanhante", 16.60, musicoOpen, setMusicoOpen)}
            </div>
          </div>

          {/* Upload de Áudio */}
          <Collapsible open={uploadOpen} onOpenChange={setUploadOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-6">
                <span className="font-semibold">Upload de Áudio</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${uploadOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/flac,audio/x-flac"
                  onChange={handleAudioUpload}
                  className="hidden"
                  disabled={isViewMode}
                />
                {arquivoAudio ? (
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <FileAudio className="w-8 h-8 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">{arquivoAudio.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(arquivoAudio.size)}</p>
                      </div>
                    </div>
                    {!isViewMode && (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => audioInputRef.current?.click()}>
                          Trocar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setArquivoAudio(null)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-background cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => !isViewMode && audioInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para fazer upload do arquivo de áudio</p>
                    <p className="text-xs text-muted-foreground mt-1">MP3, WAV, FLAC, etc.</p>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Termos de Uso */}
          {!isViewMode && (
            <div className="flex items-center gap-2 p-4 bg-muted/10 rounded-lg border border-border">
              <Checkbox 
                id="termos" 
                checked={aceitaTermos} 
                onCheckedChange={(checked) => setAceitaTermos(checked as boolean)} 
                className="border-red-500 data-[state=checked]:bg-red-500"
              />
              <label htmlFor="termos" className="text-sm">
                Aceito o Termo * - <a href="#" className="text-red-500 hover:underline">Leia e aceite os Termos de Uso</a>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={hasDuracaoError || submitting} data-testid="button-submit-fonograma">
                {submitting
                  ? (mode === "create" ? "Cadastrando..." : "Atualizando...")
                  : (mode === "create" ? "Cadastrar Fonograma" : "Atualizar Fonograma")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
