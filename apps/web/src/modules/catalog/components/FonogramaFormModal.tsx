import { useState, useRef, useEffect } from "react";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import { MUSICAL_GENRE_LABELS } from "@/constants/musicalGenres";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Search, ChevronDown, Trash2, Upload, FileAudio, Music, X, Eye, Link, Loader2 } from "lucide-react";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useObras";
import { useFonogramas, type FonogramaInsert, type FonogramaUpdate } from "@/modules/catalog/hooks/useFonogramas";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type { ProjectWithRelations as ProjetoWithRelations } from "@/modules/projects/hooks/useProjects";
import { ParticipanteViewModal } from "@/modules/catalog/components/ParticipanteViewModal";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import type { Json } from "@/shared/types/database";
import type { Fonograma } from "@/modules/catalog/hooks/useFonogramas";
import {
  dbStatusToSelect,
  normalizeStatusForDb,
  parseDuracao,
  formatDuracao,
  parseIsrc,
  joinIsrc,
  fonogramaToParticipacao,
  fonogramaToFormFields,
} from "@/modules/catalog/mappers";
import { fonogramaSchema } from "@/modules/catalog/lib/fonograma-schema";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";

type FonogramaRow = Fonograma;

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
  url?: string;
}

export type FonogramaFormInput = Partial<FonogramaRow> & {
  // camelCase aliases used by some callers / earlier in-memory shape
  codEcad?: string | null;
  codEntidade?: string | null;
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
  /** Chamado após salvar com sucesso — usado para abrir modal de contrato pré-preenchido */
  onSaved?: (info: { title: string; notes: string }) => void;
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
  const r = raw as { name?: unknown; size?: unknown; url?: unknown };
  if (typeof r.name === "string" && typeof r.size === "number") {
    return { name: r.name, size: r.size, url: typeof r.url === "string" ? r.url : undefined };
  }
  return null;
};

interface Participante {
  id: string;
  nome: string;
  percentual: string;
  artist_id?: string;
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

const generosMusicais = MUSICAL_GENRE_LABELS;
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

// ── Autocomplete: busca server-side por nome_artistico/nome_civil (Task I —
// antes filtrava só os primeiros 50 artistas do tenant carregados via
// useArtistas() sem filtro; agora cada tecla digitada (debounced) refaz a
// busca no backend). Texto livre continua permitido.
interface ArtistNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (a: { id: string; stageName: string; nome_civil?: string | null }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function ArtistNameInput({ value, onChange, onSelect, placeholder, disabled, className }: ArtistNameInputProps) {
  const [inputText, setInputText] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputText(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { items: suggestionsWire } = useEntityLookup<ArtistWireRecord>({
    table: "artistas",
    search: inputText,
    enabled: open && inputText.trim().length > 0,
  });
  const suggestions = suggestionsWire.map(wireToArtist);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (a: Artist) => {
    const display = a.legalName || a.stageName;
    setInputText(display);
    onChange(display);
    onSelect?.(a);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ""}`}>
      <Input
        value={inputText}
        onChange={handleChange}
        onFocus={() => inputText.trim() && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && inputText.trim() && suggestions.length > 0 && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md max-h-48 overflow-y-auto">
          {suggestions.map(a => (
            <button
              key={a.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted hover:text-foreground flex flex-col gap-0.5"
              onMouseDown={() => handleSelect(a)}
            >
              <span className="font-medium">{a.legalName || a.stageName}</span>
              <span className="text-xs text-muted-foreground">{a.stageName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FonogramaFormModal({ open, onOpenChange, fonograma, mode, onSaved }: FonogramaFormModalProps) {
  const { addFonograma, updateFonograma } = useFonogramas();
  const { orgId } = useCurrentOrgId();
  const [viewArtista, setViewArtista] = useState<Artist | null>(null);

  // Build initial obra vinculada from form-shape OR DB-shape (snake_case).
  // Em registros que vêm do banco apenas com work_id, a hidratação completa
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

  const [codEcad, setCodEcad] = useState(pickStr(fonograma?.codEcad, fonograma?.cod_ecad));
  const [codEntidade, setCodEntidade] = useState(pickStr(fonograma?.codEntidade, fonograma?.cod_entidade));
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
  const [generoMusical, setGeneroMusical] = useState(pickStr(fonograma?.generoMusical, fonograma?.musicGenre));
  const [classificacao, setClassificacao] = useState(pickStr(fonograma?.classificacao));
  const [midia, setMidia] = useState(pickStr(fonograma?.midia));
  const [nacional, setNacional] = useState<boolean>(pickBool(fonograma?.nacional) ?? true);
  const [pubSimultanea, setPubSimultanea] = useState<boolean>(pickBool(fonograma?.pubSimultanea, fonograma?.pub_simultanea) ?? false);
  const [status, setStatus] = useState(dbStatusToSelect(pickStr(fonograma?.status)));
  const [paisOrigem, setPaisOrigem] = useState(pickStr(fonograma?.paisOrigem, fonograma?.pais_origem));
  const [paisPublicacao, setPaisPublicacao] = useState(pickStr(fonograma?.paisPublicacao, fonograma?.pais_publicacao));
  const [title, setTitle] = useState(pickStr(fonograma?.title));
  const [gravadora, setGravadora] = useState(pickStr(fonograma?.gravadora));
  const [observacoes, setObservacoes] = useState(pickStr(fonograma?.notes));

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
  const [audioUploading, setAudioUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { upload: uploadAudioToR2 } = useUploadToR2();

  // Termos
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // Loading state for submit
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever the modal opens or the fonograma record changes
  useEffect(() => {
    if (!open) return;
    const f = fonogramaToFormFields(fonograma);
    setBuscaObra("");
    setBuscaOpen(false);
    setObraVinculada(initialObra());
    setCodEcad(f.codEcad);
    setCodEntidade(f.codEntidade);
    setAgregadora(f.agregadora);
    setIsrcPais(f.isrcPais);
    setIsrcRegistrante(f.isrcRegistrante);
    setIsrcAno(f.isrcAno);
    setIsrcDesignacao(f.isrcDesignacao);
    setCriadaPorIA(f.criadaPorIA);
    setEmissao(f.emissao);
    setGravacaoOriginal(f.gravacaoOriginal);
    setLancamento(f.lancamento);
    setDuracaoMin(f.duracaoMin);
    setDuracaoSeg(f.duracaoSeg);
    setInstrumental(f.instrumental);
    setGeneroMusical(f.generoMusical);
    setClassificacao(f.classificacao);
    setMidia(f.midia);
    setNacional(f.nacional);
    setPubSimultanea(f.pubSimultanea);
    setStatus(f.status);
    setPaisOrigem(f.paisOrigem);
    setPaisPublicacao(f.paisPublicacao);
    setTitle(f.title);
    setGravadora(f.gravadora);
    setObservacoes(f.observacoes);
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

  // Hidrata a obra vinculada a partir de fonograma.work_id — busca DIRETO por
  // ID (GET /works/:id via useEntityById), não depende da obra estar entre
  // os primeiros registros carregados por useObras() (Task I: antes a obra
  // ficava presa no placeholder "Obra vinculada" para sempre se estivesse
  // fora dos primeiros 50 do tenant).
  const hydratedObraId: string | undefined =
    (fonograma?.work_id as string | undefined) ??
    (fonograma as { workId?: string } | null | undefined)?.workId;
  const { entity: hydratedObra } = useEntityById<ObraWithRelations>(
    "obras",
    open && !fonograma?.obraVinculada ? hydratedObraId : undefined,
  );

  useEffect(() => {
    if (!open) return;
    // Se o caller já enviou um objeto pronto (legacy), usa ele
    if (fonograma?.obraVinculada) {
      setObraVinculada(toObraVinculada(fonograma.obraVinculada));
      return;
    }
    if (!hydratedObraId) {
      setObraVinculada(null);
      return;
    }
    if (hydratedObra) {
      setObraVinculada({
        id: hydratedObra.id,
        title: hydratedObra.title ?? "",
        genero: hydratedObra.genero ?? "",
        compositores: compositoresToString(hydratedObra.compositores),
        status: hydratedObra.status ?? "",
      });
    } else {
      // Ainda carregando — mantém ID com placeholder até a busca por ID resolver.
      setObraVinculada({
        id: hydratedObraId,
        title: "Obra vinculada",
        genero: "",
        compositores: "",
        status: "",
      });
    }
  }, [open, fonograma, hydratedObraId, hydratedObra]);

  // Debounce do termo digitado para evitar uma chamada ABRAMUS por tecla.
  const buscaObraDebounced = useDebounce(buscaObra, 300);

  // Busca server-side (Task I) — antes filtrava só as primeiras 50 obras do
  // tenant carregadas via useObras() sem filtro; agora cada tecla digitada
  // (debounced) refaz a busca no backend (títulos), alcançando qualquer
  // obra do tenant. Nota: a busca server-side casa só por título (o backend
  // não indexa compositores/gênero) — leve estreitamento face à busca local
  // anterior, mesma concessão já aceita nas demais migrações desta tarefa.
  const LOCAL_RESULTS_LIMIT = 20;
  const collatorFono = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const { items: obrasBusca, total: obrasRegistradasTotal } = useEntityLookup<ObraWithRelations>({
    table: "obras",
    search: buscaObraDebounced,
    pageSize: LOCAL_RESULTS_LIMIT,
    enabled: buscaOpen,
  });
  const obrasRegistradasFiltradas: ObraVinculada[] = obrasBusca
    .map((o) => ({
      id: o.id,
      title: o.title ?? "",
      genero: o.genero ?? "",
      compositores: compositoresToString(o.compositores),
      status: o.status ?? "",
    }))
    .sort((a, b) => collatorFono.compare(a.title, b.title));

  const isViewMode = mode === "view";
  const modalTitle = mode === "create" ? "Novo Fonograma" : mode === "edit" ? "Editar Fonograma" : "Detalhes do Fonograma";

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

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setAudioUploading(true);
    try {
      const publicUrl = await uploadAudioToR2({
        file,
        category: "audio",
        entity:   "phonogram",
        entityId: fonograma?.id as string | undefined,
      });
      setArquivoAudio({ name: file.name, size: file.size, url: publicUrl });
      toast.success("Áudio enviado e link gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof R2NotConfiguredError
        ? err.message
        : err instanceof Error ? err.message : "Erro no upload do áudio";
      toast.error(`Upload falhou: ${msg}`);
      setArquivoAudio(null);
    } finally {
      setAudioUploading(false);
    }
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
    const tituloFinal = (title && title.trim()) || obraVinculada?.title || "Sem título";
    // org_id não é campo do formulário — o tenant vem do contexto autenticado da API.
    return {
      title: tituloFinal,
      cod_ecad: codEcad || null,
      cod_entidade: codEntidade || null,
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
      musicGenre: generoMusical || null,
      midia: midia || null,
      classificacao: classificacao || null,
      pais_origem: paisOrigem || null,
      pais_publicacao: paisPublicacao || null,
      status: normalizeStatusForDb(status),
      gravadora: gravadora || null,
      notes: observacoes || null,
      work_id: obraVinculada && typeof obraVinculada.id === "string" ? obraVinculada.id : null,
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

    const isrcJoined = joinIsrc({ pais: isrcPais, registrante: isrcRegistrante, ano: isrcAno, designacao: isrcDesignacao });
    const validation = fonogramaSchema.safeParse({
      title: title || "",
      isrc: isrcJoined || "",
      genero: generoMusical || "",
      instrumental,
      criadaPorIA,
      pubSimultanea,
      aceitaTermos,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!orgId) {
      toast.error("Não foi possível identificar sua organização. Tente novamente.");
      return;
    }

    const payload = buildPayload();

    // Capture before mutating so we can warn after a successful save.
    const unlinkedTypedObra = buscaObra.trim() && !obraVinculada ? buscaObra.trim() : null;

    try {
      setSubmitting(true);
      if (mode === "create") {
        await addFonograma.mutateAsync(payload);
      } else if (mode === "edit" && fonograma?.id) {
        const updatePayload: { id: string } & FonogramaUpdate & { expectedUpdatedAt?: string } = {
          id: fonograma.id,
          ...payload,
          expectedUpdatedAt: getExpectedUpdatedAt(fonograma),
        };
        await updateFonograma.mutateAsync(updatePayload);
      }
      // Warn only after a successful save — avoids misleading the user on
      // failure. Wording uses "não foi vinculada" since the title may exist in
      // the catalog but was never selected from the search results.
      if (unlinkedTypedObra) {
        toast.warning(
          `"${unlinkedTypedObra}" não foi vinculada como Obra Vinculada. O fonograma foi salvo sem vínculo de obra.`,
          { duration: 6000 }
        );
      }

      const tituloSalvo = (title && title.trim()) || obraVinculada?.title || "Sem título";
      onOpenChange(false);

      // Abre modal de contrato pré-preenchido após fechar o modal de fonograma
      onSaved?.({
        title: `Contrato de Fonograma – ${tituloSalvo}`,
        notes: [
          `Fonograma: ${tituloSalvo}`,
          obraVinculada?.title ? `Obra vinculada: ${obraVinculada.title}` : null,
          obraVinculada?.compositores ? `Compositores: ${obraVinculada.compositores}` : null,
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      if (handleConcurrencyConflict(err, "fonograma")) return;
      // demais erros já são exibidos via toast pelo hook
    } finally {
      setSubmitting(false);
    }
  };

  const renderParticipacaoSection = (
    title: string,
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
            {title} - Percentual total: {percentualAtual.toFixed(2)}% de {percentualMax.toFixed(2)}%
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
                  <ArtistNameInput
                    value={p.nome}
                    onChange={(val) => updateParticipante(categoria, p.id, 'nome', val)}
                    onSelect={(a) => updateParticipante(categoria, p.id, 'artist_id', a.id)}
                    placeholder="Nome do participante"
                    disabled={isViewMode}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    title="Visualizar participante"
                    disabled={!p.nome}
                    onClick={async () => {
                      // Busca por ID direto — não depende do artista estar entre os
                      // primeiros carregados; cai para busca por nome só quando o
                      // participante nunca foi vinculado a um artista cadastrado.
                      const foundWire = p.artist_id
                        ? await storage.findById<ArtistWireRecord>("artistas", p.artist_id)
                        : p.nome
                          ? (await storage.listPaged<ArtistWireRecord>("artistas", { page: 1, pageSize: 5, filters: { search: p.nome } }))
                              .items.find(a => (a.nome_civil || a.nome_artistico) === p.nome)
                          : undefined;
                      if (foundWire) setViewArtista(wireToArtist(foundWire));
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
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
          <DialogTitle>{modalTitle}</DialogTitle>
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
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Music className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium" data-testid="text-obra-vinculada-title">
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
              <>
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
                          className="text-xs font-semibold text-muted-foreground  tracking-wide px-2 py-1"
                          role="presentation"
                          data-testid="local-section-heading"
                        >
                          Obras do sistema
                        </p>
                        {obrasRegistradasFiltradas.length > 0 ? (
                          obrasRegistradasFiltradas.map((obra) => {
                            const selectObra = async () => {
                              setObraVinculada(obra);
                              // Auto-fill título if blank
                              if (!title && obra.title) setTitle(obra.title);
                              // Normalize genre: match against Select options (accent+case insensitive)
                              if (obra.genero) {
                                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                const matched = generosMusicais.find(g => norm(g) === norm(obra.genero));
                                setGeneroMusical(matched ? matched.toLowerCase() : obra.genero.toLowerCase());
                              }
                              // Fill participação from full obra data
                              const fullObra = obrasBusca.find((o: ObraWithRelations) => o.id === obra.id);
                              if (fullObra) {
                                const compositoresStr = Array.isArray(fullObra.compositores)
                                  ? (fullObra.compositores as string[]).join(", ")
                                  : typeof fullObra.compositores === "string"
                                  ? fullObra.compositores
                                  : typeof fullObra.compositor === "string"
                                  ? fullObra.compositor
                                  : "";
                                // Resolve músico/arranjador from project producers — busca
                                // DIRETA por ID (Task J: antes escaneava o array `projetos`
                                // de useProjetos() sem filtro, truncado em 50 por tenant).
                                let musicosArr: Participante[] = [];
                                if ((fullObra.project_id as string | null | undefined)) {
                                  const projeto = await storage.findById<ProjetoWithRelations>("projects", fullObra.project_id as string);
                                  if (projeto?.descricao) {
                                    try {
                                      const normT = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                      const musicas = JSON.parse(projeto.descricao as string) as Array<{ nome?: string; produtores?: string[] }>;
                                      const musicaMatch = musicas.find(m =>
                                        normT(m.nome || "") === normT(fullObra.title || "") ||
                                        normT(m.nome || "") === normT(obra.title || "")
                                      );
                                      if (musicaMatch?.produtores?.length) {
                                        musicosArr = musicaMatch.produtores.map((nome: string) => ({
                                          id: crypto.randomUUID(), nome, percentual: "",
                                        }));
                                      }
                                    } catch { /* invalid JSON — leave blank */ }
                                  }
                                }
                                // Resolve artista for interprete:
                                // 1) DB join (non-mock), 2) busca DIRETA por ID (Task J \u2014 antes
                                // escaneava o array `artistas` de useArtistas() sem filtro,
                                // truncado em 50 artistas por tenant; GET /artists/:id alcan\u00e7a
                                // qualquer artista do tenant), 3) compositor name match (s\u00f3
                                // quando n\u00e3o h\u00e1 artist_id \u2014 mesma concess\u00e3o j\u00e1 aceita em
                                // outras migra\u00e7\u00f5es desta tarefa).
                                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                let artistaNome = fullObra.artistas?.nome_artistico as string | undefined;
                                let artistId = fullObra.artistas?.id as string | undefined;
                                if (!artistaNome && (fullObra.artist_id as string | null | undefined)) {
                                  const byId = await storage.findById<ArtistWireRecord>("artistas", fullObra.artist_id as string);
                                  if (byId) { const a = wireToArtist(byId); artistaNome = a.stageName; artistId = a.id; }
                                }
                                if (!artistaNome && compositoresStr) {
                                  const firstComp = compositoresStr.split(",")[0]?.trim();
                                  if (firstComp) {
                                    const { items: compMatches } = await storage.listPaged<ArtistWireRecord>("artistas", {
                                      page: 1, pageSize: 5, filters: { search: firstComp },
                                    });
                                    const byName = compMatches.map(wireToArtist).find((a: Artist) =>
                                      norm(a.stageName || "") === norm(firstComp) ||
                                      norm(a.legalName || "") === norm(firstComp) ||
                                      norm(a.name || "") === norm(firstComp)
                                    );
                                    if (byName) { artistaNome = byName.stageName; artistId = byName.id; }
                                  }
                                }
                                const interpretes: Participante[] = artistaNome
                                  ? [{ id: crypto.randomUUID(), nome: artistaNome, percentual: "", artist_id: artistId }]
                                  : [];
                                setParticipacao(prev => ({
                                  ...prev,
                                  // produtorFonografico: leave blank for manual fill
                                  interprete: prev.interprete.length === 0 ? interpretes : prev.interprete,
                                  musicoAcompanhante: prev.musicoAcompanhante.length === 0 ? musicosArr : prev.musicoAcompanhante,
                                }));
                              }
                              setBuscaObra("");
                              setBuscaOpen(false);
                              toast.success(`Obra "${obra.title}" vinculada! Campos preenchidos automaticamente.`);
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
                                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                  <Music className="h-4 w-4 text-primary-foreground" />
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
                              title: rec.title ?? "",
                              genero: rec.genero ?? "",
                              compositores: Array.isArray(rec.compositores)
                                ? rec.compositores.filter(Boolean).join(", ")
                                : "",
                              status: "registered",
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
              {!isViewMode && (
                <p
                  className="text-xs text-muted-foreground mt-1"
                  data-testid="hint-obra-vinculada-empty"
                >
                  Nenhuma obra vinculada — recomendado para rastreabilidade de recebimentos externos de direitos
                </p>
              )}
              </>
            )}
          </div>

          {/* Dados do Fonograma */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <h3 className="font-semibold text-base">Dados do Fonograma</h3>

            {/* Linha 1: Código de Cadastro da Sociedade | Código ECAD | Agregadora | ISRC | Criada por IA */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Código de Cadastro da Sociedade</span>
                <Input value={codEntidade} onChange={(e) => setCodEntidade(e.target.value)} disabled={isViewMode} placeholder="Código de Cadastro da Sociedade" className="h-8 text-sm min-w-0" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Código ECAD</span>
                <Input value={codEcad} onChange={(e) => setCodEcad(e.target.value)} disabled={isViewMode} placeholder="Código ECAD" className="h-8 text-sm min-w-0" data-testid="input-cod-ecad" />
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">Agregadora</span>
                <Select value={agregadora} onValueChange={setAgregadora} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {agregadoras.map(a => <SelectItem key={a} value={a.toLowerCase().replace(/ /g, "_")}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">ISRC</span>
                <div className="flex items-center gap-1">
                  <Input value={isrcPais} onChange={(e) => setIsrcPais(e.target.value)} disabled={isViewMode} placeholder="BR" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcRegistrante} onChange={(e) => setIsrcRegistrante(e.target.value)} disabled={isViewMode} placeholder="XXX" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={3} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcAno} onChange={(e) => setIsrcAno(e.target.value)} disabled={isViewMode} placeholder="00" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcDesignacao} onChange={(e) => setIsrcDesignacao(e.target.value)} disabled={isViewMode} placeholder="00000" className="h-8 px-2 text-sm flex-[1.5] min-w-0 text-center font-sans" maxLength={5} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Criada por IA</span>
                <div className="flex items-center h-8">
                  <Switch checked={criadaPorIA} onCheckedChange={setCriadaPorIA} disabled={isViewMode} />
                </div>
              </div>
            </div>

            {/* Linha 2: Instrumental | Emissão | Gravação Original | Lançamento | Duração */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Instrumental</span>
                <div className="flex items-center h-8">
                  <Switch checked={instrumental} onCheckedChange={setInstrumental} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Emissão</span>
                <DatePickerField value={emissao} onChange={setEmissao} disabled={isViewMode} placeholder="Data" data-testid="datepicker-emissao" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Gravação Original</span>
                <DatePickerField value={gravacaoOriginal} onChange={setGravacaoOriginal} disabled={isViewMode} placeholder="Data" data-testid="datepicker-gravacao-original" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Lançamento</span>
                <DatePickerField value={lancamento} onChange={setLancamento} disabled={isViewMode} placeholder="Data" data-testid="datepicker-lancamento" />
              </div>
              <div className="col-span-4">
                <span className="text-xs text-muted-foreground mb-1 block">Duração</span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${duracaoMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">min</span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${duracaoSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {generosMusicais.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Mídia</span>
                <Select value={midia} onValueChange={setMidia} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {midias.map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Nacional</span>
                <div className="flex items-center h-8">
                  <Switch checked={nacional} onCheckedChange={setNacional} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Pub. Simultânea</span>
                <div className="flex items-center h-8">
                  <Switch checked={pubSimultanea} onCheckedChange={setPubSimultanea} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Origem</span>
                <Select value={paisOrigem} onValueChange={setPaisOrigem} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paises.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Publicação</span>
                <Select value={paisPublicacao} onValueChange={setPaisPublicacao} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {classificacoes.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Status</span>
                <Select value={status} onValueChange={setStatus} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                      {audioUploading ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : (
                        <FileAudio className="w-8 h-8 text-primary" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{arquivoAudio.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(arquivoAudio.size)}
                          {audioUploading && " — enviando..."}
                          {!audioUploading && arquivoAudio.url && " — link gerado ✓"}
                        </p>
                        {!audioUploading && arquivoAudio.url && (
                          <a
                            href={arquivoAudio.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link className="w-3 h-3" /> Ver link de download
                          </a>
                        )}
                      </div>
                    </div>
                    {!isViewMode && (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => audioInputRef.current?.click()} disabled={audioUploading}>
                          Trocar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setArquivoAudio(null)} disabled={audioUploading}>
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
                className="border-primary data-[state=checked]:bg-primary"
              />
              <label htmlFor="termos" className="text-sm">
                Aceito o Termo * - <a href="#" className="text-primary hover:underline">Leia e aceite os Termos de Uso</a>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={hasDuracaoError || submitting} data-testid="button-submit-fonograma">
                {submitting
                  ? (mode === "create" ? "Cadastrando..." : "Atualizando...")
                  : (mode === "create" ? "Cadastrar Fonograma" : "Atualizar Fonograma")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
      <ParticipanteViewModal
        open={viewArtista !== null}
        onOpenChange={(o) => { if (!o) setViewArtista(null); }}
        artista={viewArtista}
      />
    </Dialog>
  );
}

