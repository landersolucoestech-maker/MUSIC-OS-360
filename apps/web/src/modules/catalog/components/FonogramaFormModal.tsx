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
import { usePhonograms, type FonogramaInsert, type FonogramaUpdate } from "@/modules/catalog/hooks/useFonogramas";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type { ProjectWithRelations as ProjetoWithRelations } from "@/modules/projects/hooks/useProjects";
import { ParticipantViewModal } from "@/modules/catalog/components/ParticipanteViewModal";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import type { Json } from "@/shared/types/database";
import type { Fonograma } from "@/modules/catalog/hooks/useFonogramas";
import {
  dbStatusToSelect,
  normalizeStatusForDb,
  parseDurationText,
  formatDurationText,
  parseIsrc,
  joinIsrc,
  phonogramToParticipation,
  phonogramToFormFields,
} from "@/modules/catalog/mappers";
import { phonogramSchema } from "@/modules/catalog/lib/fonograma-schema";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";
import { toUserMessage } from "@/shared/lib/errors";

type PhonogramRow = Fonograma;

// `compositores` is typed as string[] in the schema, but in some legacy
// records it may arrive as a string or null. Normalizes safely.
function composersToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface LinkedWorkInput {
  id?: string | number | null;
  title?: string | null;
  titulo?: string | null;
  genero?: string | null;
  compositores?: string | string[] | null;
  status?: string | null;
}

interface ParticipationInput {
  produtorFonografico?: Participant[];
  interprete?: Participant[];
  musicoAcompanhante?: Participant[];
}

interface AudioFileInput {
  name: string;
  size: number;
  url?: string;
  fileId?: string;
}

export type PhonogramFormInput = Partial<PhonogramRow> & {
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
  obraVinculada?: LinkedWorkInput | null;
  obra?: LinkedWorkInput | null;
  participacao?: ParticipationInput | null;
  arquivoAudio?: AudioFileInput | null;
};

interface PhonogramFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fonograma?: PhonogramFormInput | null;
  mode: "create" | "edit" | "view";
  /** Called after a successful save — used to open a prefilled contract modal */
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

const toParticipationCategory = (
  raw: ParticipationInput | Json | null | undefined
): ParticipationCategory => {
  const empty: ParticipationCategory = { produtorFonografico: [], interprete: [], musicoAcompanhante: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const r = raw as ParticipationInput;
  return {
    produtorFonografico: Array.isArray(r.produtorFonografico) ? r.produtorFonografico : [],
    interprete: Array.isArray(r.interprete) ? r.interprete : [],
    musicoAcompanhante: Array.isArray(r.musicoAcompanhante) ? r.musicoAcompanhante : [],
  };
};

const toAudioFile = (
  raw: AudioFileInput | Json | null | undefined
): AudioFileInput | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as { name?: unknown; size?: unknown; url?: unknown; fileId?: unknown };
  if (typeof r.name === "string" && typeof r.size === "number") {
    return {
      name: r.name,
      size: r.size,
      url: typeof r.url === "string" ? r.url : undefined,
      fileId: typeof r.fileId === "string" ? r.fileId : undefined,
    };
  }
  return null;
};

interface Participant {
  id: string;
  name: string;
  percentual: string;
  artist_id?: string;
}

interface ParticipationCategory {
  produtorFonografico: Participant[];
  interprete: Participant[];
  musicoAcompanhante: Participant[];
}

interface LinkedWork {
  id: string;
  title: string;
  genero: string;
  compositores: string;
  status: string;
}

const musicGenres = MUSICAL_GENRE_LABELS;
const agregadoras = ["CD Baby", "DistroKid", "TuneCore", "Ditto Music", "ONErpm", "iMusics", "Symphonic", "Outro"];
const classificacoes = ["STUDIO", "LIVE", "REMIX", "DEMO", "OUTRO"];
const mediaItems = ["TODOS", "DIGITAL", "FÍSICO", "STREAMING"];
const statusOptions = ["Em Análise", "Pendente", "Registrado", "Rejeitado"];
const countries = ["BRAZIL", "USA", "UK", "PORTUGAL", "ARGENTINA", "OUTRO"];

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ── Autocomplete: server-side search by nome_artistico/nome_civil (Task I —
// it used to filter only the tenant's first 50 artists loaded via
// an unfiltered useArtistas(); now each typed (debounced) key re-runs the
// search in the backend). Free text is still allowed.
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

export function PhonogramFormModal({ open, onOpenChange, fonograma: phonogram, mode, onSaved }: PhonogramFormModalProps) {
  const { addPhonogram, updatePhonogram } = usePhonograms();
  const { orgId } = useCurrentOrgId();
  const [viewArtist, setViewArtist] = useState<Artist | null>(null);

  // Build the initial linked work from the form shape OR the DB shape (snake_case).
  // For records coming from the database with only work_id, the full hydration
  // happens in the useEffect below from the works list.
  const toLinkedWork = (o: LinkedWorkInput | null | undefined): LinkedWork | null => {
    if (!o) return null;
    return {
      id: String(o.id ?? ""),
      title: o.title ?? o.titulo ?? "",
      genero: o.genero ?? "",
      compositores: composersToString(o.compositores),
      status: o.status ?? "",
    };
  };

  const initialWork = (): LinkedWork | null => {
    if (phonogram?.obraVinculada) return toLinkedWork(phonogram.obraVinculada);
    if (phonogram?.obra) return toLinkedWork(phonogram.obra);
    return null;
  };

  // Linked work
  const [linkedWork, setLinkedWork] = useState<LinkedWork | null>(initialWork());
  const [searchWork, setSearchWork] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Sound recording data (supports the form's camelCase OR the database's snake_case)
  const initialDurationText = parseDurationText(phonogram?.duration_text);
  const initialIsrc = parseIsrc(phonogram?.isrc);

  const [codEcad, setCodEcad] = useState(pickStr(phonogram?.codEcad, phonogram?.cod_ecad));
  const [codEntidade, setCodEntidade] = useState(pickStr(phonogram?.codEntidade, phonogram?.cod_entidade));
  const [agregadora, setAgregadora] = useState(pickStr(phonogram?.agregadora) || pickStr(phonogram?.gravadora));
  const [isrcCountry, setIsrcCountry] = useState(pickStr(phonogram?.isrcPais, phonogram?.isrc_pais) || initialIsrc.pais || "BR");
  const [isrcRegistrante, setIsrcRegistrante] = useState(pickStr(phonogram?.isrcRegistrante, phonogram?.isrc_registrante) || initialIsrc.registrante);
  const [isrcAno, setIsrcAno] = useState(pickStr(phonogram?.isrcAno, phonogram?.isrc_ano) || initialIsrc.ano);
  const [isrcDesignacao, setIsrcDesignacao] = useState(pickStr(phonogram?.isrcDesignacao, phonogram?.isrc_designacao) || initialIsrc.designacao);
  const [criadaPorIA, setCriadaPorIA] = useState<boolean>(pickBool(phonogram?.criadaPorIA, phonogram?.criada_por_ia) ?? false);
  const [emissao, setEmissao] = useState(pickStr(phonogram?.emissao));
  const [recordingDate, setRecordingDate] = useState(pickStr(phonogram?.gravacaoOriginal, phonogram?.gravacao_original, phonogram?.data_registro));
  const [releaseDate, setReleaseDate] = useState(pickStr(phonogram?.lancamento, phonogram?.data_lancamento));
  const [durationMin, setDurationMin] = useState(pickStr(phonogram?.duracaoMin, phonogram?.duracao_min) || initialDurationText.min);
  const [durationSeg, setDurationSeg] = useState(pickStr(phonogram?.duracaoSeg, phonogram?.duracao_seg) || initialDurationText.seg);
  const [instrumental, setInstrumental] = useState<boolean>(pickBool(phonogram?.is_instrumental, phonogram?.instrumental) ?? false);
  const [musicGenre, setMusicGenre] = useState(pickStr(phonogram?.generoMusical, phonogram?.music_genre));
  const [classificacao, setClassificacao] = useState(pickStr(phonogram?.classificacao));
  const [media, setMedia] = useState(pickStr(phonogram?.midia));
  const [nacional, setNacional] = useState<boolean>(pickBool(phonogram?.nacional) ?? true);
  const [pubSimultanea, setPubSimultanea] = useState<boolean>(pickBool(phonogram?.pubSimultanea, phonogram?.pub_simultanea) ?? false);
  const [status, setStatus] = useState(dbStatusToSelect(pickStr(phonogram?.status)));
  const [sourceCountry, setSourceCountry] = useState(pickStr(phonogram?.paisOrigem, phonogram?.pais_origem));
  const [publicationCountry, setPublicationCountry] = useState(pickStr(phonogram?.paisPublicacao, phonogram?.pais_publicacao));
  const [title, setTitle] = useState(pickStr(phonogram?.title));
  const [recordLabel, setRecordLabel] = useState(pickStr(phonogram?.gravadora));
  const [notes, setNotes] = useState(pickStr(phonogram?.notes));

  // Participation
  const [participation, setParticipation] = useState<ParticipationCategory>(() => {
    const fromCat = toParticipationCategory(phonogram?.participacao);
    if (fromCat.produtorFonografico.length === 0 && (phonogram as any)?.produtores) {
      return phonogramToParticipation(phonogram);
    }
    return fromCat;
  }

  );
  const [producerOpen, setProducerOpen] = useState(true);
  const [performerOpen, setPerformerOpen] = useState(true);
  const [musicoOpen, setMusicoOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);

  // Audio upload
  const [audioFile, setAudioFile] = useState<AudioFileInput | null>(
    toAudioFile(phonogram?.arquivoAudio ?? phonogram?.arquivo_audio)
  );
  const [audioUploading, setAudioUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { upload: uploadAudioToR2 } = useUploadToR2();

  // Terms
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // Loading state for submit
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever the modal opens or the fonograma record changes
  useEffect(() => {
    if (!open) return;
    const f = phonogramToFormFields(phonogram);
    setSearchWork("");
    setSearchOpen(false);
    setLinkedWork(initialWork());
    setCodEcad(f.codEcad);
    setCodEntidade(f.codEntidade);
    setAgregadora(f.agregadora);
    setIsrcCountry(f.isrcPais);
    setIsrcRegistrante(f.isrcRegistrante);
    setIsrcAno(f.isrcAno);
    setIsrcDesignacao(f.isrcDesignacao);
    setCriadaPorIA(f.criadaPorIA);
    setEmissao(f.emissao);
    setRecordingDate(f.gravacaoOriginal);
    setReleaseDate(f.lancamento);
    setDurationMin(f.duracaoMin);
    setDurationSeg(f.duracaoSeg);
    setInstrumental(f.instrumental);
    setMusicGenre(f.generoMusical);
    setClassificacao(f.classificacao);
    setMedia(f.midia);
    setNacional(f.nacional);
    setPubSimultanea(f.pubSimultanea);
    setStatus(f.status);
    setSourceCountry(f.paisOrigem);
    setPublicationCountry(f.paisPublicacao);
    setTitle(f.title);
    setRecordLabel(f.gravadora);
    setNotes(f.notes);
    setParticipation(() => {
      const fromCat = toParticipationCategory(phonogram?.participacao);
      if (fromCat.produtorFonografico.length === 0 && (phonogram as any)?.produtores) {
        return phonogramToParticipation(phonogram);
      }
      return fromCat;
    });
    setAudioFile(toAudioFile(phonogram?.arquivoAudio ?? phonogram?.arquivo_audio));
    setAceitaTermos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phonogram]);

  // Hydrates the linked work from fonograma.work_id — fetches DIRECTLY by
  // ID (GET /works/:id via useEntityById), it does not depend on the work being among
  // the first records loaded by useObras() (Task I: the work used to
  // stay stuck on the "Obra vinculada" placeholder forever if it was
  // outside the tenant's first 50).
  const hydratedWorkId: string | undefined =
    (phonogram?.work_id as string | undefined) ??
    (phonogram as { workId?: string } | null | undefined)?.workId;
  const { entity: hydratedWork } = useEntityById<ObraWithRelations>(
    "obras",
    open && !phonogram?.obraVinculada ? hydratedWorkId : undefined,
  );

  useEffect(() => {
    if (!open) return;
    // If the caller already sent a ready object (legacy), use it
    if (phonogram?.obraVinculada) {
      setLinkedWork(toLinkedWork(phonogram.obraVinculada));
      return;
    }
    if (!hydratedWorkId) {
      setLinkedWork(null);
      return;
    }
    if (hydratedWork) {
      setLinkedWork({
        id: hydratedWork.id,
        title: hydratedWork.title ?? "",
        genero: hydratedWork.music_genre ?? "",
        compositores: composersToString(hydratedWork.compositores),
        status: hydratedWork.status ?? "",
      });
    } else {
      // Still loading — keeps the ID with a placeholder until the lookup by ID resolves.
      setLinkedWork({
        id: hydratedWorkId,
        title: "Obra vinculada",
        genero: "",
        compositores: "",
        status: "",
      });
    }
  }, [open, phonogram, hydratedWorkId, hydratedWork]);

  // Debounce of the typed term to avoid one ABRAMUS call per key.
  const searchWorkDebounced = useDebounce(searchWork, 300);

  // Server-side search (Task I) — it used to filter only the tenant's first 50 works
  // loaded via an unfiltered useObras(); now each typed (debounced) key
  // re-runs the search in the backend (titles), reaching any
  // work of the tenant. Note: the server-side search matches titles only (the backend
  // does not index composers/genre) — a slight narrowing compared to the previous local
  // search, the same concession already accepted in the other migrations of this task.
  const LOCAL_RESULTS_LIMIT = 20;
  const collatorFono = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const { items: worksSearch, total: registeredWorksTotal } = useEntityLookup<ObraWithRelations>({
    table: "obras",
    search: searchWorkDebounced,
    pageSize: LOCAL_RESULTS_LIMIT,
    enabled: searchOpen,
  });
  const filteredRegisteredWorks: LinkedWork[] = worksSearch
    .map((o) => ({
      id: o.id,
      title: o.title ?? "",
      genero: o.music_genre ?? "",
      compositores: composersToString(o.compositores),
      status: o.status ?? "",
    }))
    .sort((a, b) => collatorFono.compare(a.title, b.title));

  const isViewMode = mode === "view";
  const modalTitle = mode === "create" ? "Novo Fonograma" : mode === "edit" ? "Editar Fonograma" : "Detalhes do Fonograma";

  const calculateCategoryPercentage = (category: Participant[]) => {
    return category.reduce((total, p) => total + (parseFloat(p.percentual) || 0), 0);
  };

  const calculateTotalPercentage = () => {
    return calculateCategoryPercentage(participation.produtorFonografico) +
           calculateCategoryPercentage(participation.interprete) +
           calculateCategoryPercentage(participation.musicoAcompanhante);
  };

  const addParticipant = (category: keyof ParticipationCategory) => {
    setParticipation({
      ...participation,
      [category]: [...participation[category], { id: crypto.randomUUID(), name: "", percentual: "" }]
    });
  };

  const updateParticipant = (category: keyof ParticipationCategory, id: string, field: keyof Participant, value: string) => {
    setParticipation({
      ...participation,
      [category]: participation[category].map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const removeParticipant = (category: keyof ParticipationCategory, id: string) => {
    setParticipation({
      ...participation,
      [category]: participation[category].filter(p => p.id !== id)
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

    setAudioFile({ name: file.name, size: file.size });
    setAudioUploading(true);
    try {
      const { publicUrl, fileId } = await uploadAudioToR2({
        file,
        category: "audio",
        entity:   "phonogram",
        entityId: phonogram?.id as string | undefined,
      });
      setAudioFile({ name: file.name, size: file.size, url: publicUrl, fileId });
      toast.success("Áudio enviado e link gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof R2NotConfiguredError
        ? toUserMessage(err)
        : toUserMessage(err, "Erro no upload do áudio");
      toast.error(`Upload falhou: ${msg}`);
      setAudioFile(null);
    } finally {
      setAudioUploading(false);
    }
  };

  const durationMinNum = Number(durationMin);
  const durationSegNum = Number(durationSeg);
  const durationMinError = durationMin !== "" && (!Number.isInteger(durationMinNum) || durationMinNum < 0)
    ? "Minutos não pode ser negativo"
    : null;
  const durationSegError = durationSeg !== "" && (!Number.isInteger(durationSegNum) || durationSegNum < 0 || durationSegNum > 59)
    ? "Segundos deve estar entre 0 e 59"
    : null;
  const hasDurationError = !!(durationMinError || durationSegError);

  // Concatenated ISRC for legacy column (e.g. "BR-XXX-25-12345")
  const isrcConcat = joinIsrc({
    pais: isrcCountry,
    registrante: isrcRegistrante,
    ano: isrcAno,
    designacao: isrcDesignacao
  });

  // Duration in MM:SS, built from the separate minutes/seconds inputs
  const durationTextConcat = formatDurationText(durationMin, durationSeg);

  const buildPayload = (): FonogramaInsert => {
    const finalTitle = (title && title.trim()) || linkedWork?.title || "Sem título";
    // org_id is not a form field — the tenant comes from the API's authenticated context.
    return {
      title: finalTitle,
      cod_ecad: codEcad || null,
      cod_entidade: codEntidade || null,
      agregadora: agregadora || null,
      isrc: isrcConcat,
      isrc_pais: isrcCountry || null,
      isrc_registrante: isrcRegistrante || null,
      isrc_ano: isrcAno || null,
      isrc_designacao: isrcDesignacao || null,
      criada_por_ia: !!criadaPorIA,
      is_instrumental: !!instrumental,
      nacional: !!nacional,
      pub_simultanea: !!pubSimultanea,
      emissao: emissao || null,
      gravacao_original: recordingDate || null,
      data_lancamento: releaseDate || null,
      duration_text: durationTextConcat,
      duracao_min: durationMin === "" ? null : Number(durationMin),
      duracao_seg: durationSeg === "" ? null : Number(durationSeg),
      music_genre: musicGenre || null,
      midia: media || null,
      classificacao: classificacao || null,
      pais_origem: sourceCountry || null,
      pais_publicacao: publicationCountry || null,
      status: normalizeStatusForDb(status),
      gravadora: recordLabel || null,
      notes: notes || null,
      work_id: linkedWork && typeof linkedWork.id === "string" ? linkedWork.id : null,
      participacao: participation as unknown as Json,
      arquivo_audio: audioFile as unknown as Json,
      audio_file_id: audioFile?.fileId ?? null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDurationError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    const isrcJoined = joinIsrc({ pais: isrcCountry, registrante: isrcRegistrante, ano: isrcAno, designacao: isrcDesignacao });
    const validation = phonogramSchema.safeParse({
      title: title || "",
      isrc: isrcJoined || "",
      genero: musicGenre || "",
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
    const unlinkedTypedWork = searchWork.trim() && !linkedWork ? searchWork.trim() : null;

    try {
      setSubmitting(true);
      if (mode === "create") {
        await addPhonogram.mutateAsync(payload);
      } else if (mode === "edit" && phonogram?.id) {
        const updatePayload: { id: string } & FonogramaUpdate & { expectedUpdatedAt?: string } = {
          id: phonogram.id,
          ...payload,
          expectedUpdatedAt: getExpectedUpdatedAt(phonogram),
        };
        await updatePhonogram.mutateAsync(updatePayload);
      }
      // Warn only after a successful save — avoids misleading the user on
      // failure. Wording uses "não foi vinculada" since the title may exist in
      // the catalog but was never selected from the search results.
      if (unlinkedTypedWork) {
        toast.warning(
          `"${unlinkedTypedWork}" não foi vinculada como Obra Vinculada. O fonograma foi salvo sem vínculo de obra.`,
          { duration: 6000 }
        );
      }

      const savedTitle = (title && title.trim()) || linkedWork?.title || "Sem título";
      onOpenChange(false);

      // Opens the prefilled contract modal after closing the phonogram modal
      onSaved?.({
        title: `Contrato de Fonograma – ${savedTitle}`,
        notes: [
          `Fonograma: ${savedTitle}`,
          linkedWork?.title ? `Obra vinculada: ${linkedWork.title}` : null,
          linkedWork?.compositores ? `Compositores: ${linkedWork.compositores}` : null,
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      if (handleConcurrencyConflict(err, "fonograma")) return;
      // other errors are already shown via toast by the hook
    } finally {
      setSubmitting(false);
    }
  };

  const renderParticipationSection = (
    title: string,
    category: keyof ParticipationCategory,
    percentageMax: number,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void
  ) => {
    const currentPercentage = calculateCategoryPercentage(participation[category]);
    
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg border border-border">
          <span className="text-sm font-medium">
            {title} - Percentual total: {currentPercentage.toFixed(2)}% de {percentageMax.toFixed(2)}%
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={() => addParticipant(category)} disabled={isViewMode}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
          
          {participation[category].length > 0 ? (
            <div className="space-y-2">
              {participation[category].map((p) => (
                <div key={p.id} className="flex gap-3 items-center">
                  <ArtistNameInput
                    value={p.name}
                    onChange={(val) => updateParticipant(category, p.id, 'name', val)}
                    onSelect={(a) => updateParticipant(category, p.id, 'artist_id', a.id)}
                    placeholder="Nome do participante"
                    disabled={isViewMode}
                    className="flex-1"
                  />
                  <Input 
                    value={p.percentual} 
                    onChange={(e) => updateParticipant(category, p.id, 'percentual', e.target.value)}
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
                    disabled={!p.name}
                    onClick={async () => {
                      // Direct lookup by ID — does not depend on the artist being among the
                      // first loaded; falls back to a lookup by name only when the
                      // participant was never linked to a registered artist.
                      const foundWire = p.artist_id
                        ? await storage.findById<ArtistWireRecord>("artistas", p.artist_id)
                        : p.name
                          ? (await storage.listPaged<ArtistWireRecord>("artistas", { page: 1, pageSize: 5, filters: { search: p.name } }))
                              .items.find(a => (a.nome_civil || a.nome_artistico) === p.name)
                          : undefined;
                      if (foundWire) setViewArtist(wireToArtist(foundWire));
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeParticipant(category, p.id)} disabled={isViewMode}>
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
          {/* Linked work title */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <Label className="font-semibold text-sm">Título da Obra Vinculada</Label>
            
            {linkedWork ? (
              <div
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                data-testid="obra-vinculada-card"
              >
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Music className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium" data-testid="text-obra-vinculada-title">
                    {linkedWork.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {linkedWork.genero} • {linkedWork.compositores}
                  </p>
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLinkedWork(null)}
                    data-testid="button-remove-obra-vinculada"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
              <div className="flex gap-2">
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchWork}
                        onChange={(e) => {
                          setSearchWork(e.target.value);
                          setSearchOpen(true);
                        }}
                        onFocus={() => !isViewMode && setSearchOpen(true)}
                        onClick={() => !isViewMode && setSearchOpen(true)}
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
                        {filteredRegisteredWorks.length > 0 ? (
                          filteredRegisteredWorks.map((work) => {
                            const selectWork = async () => {
                              setLinkedWork(work);
                              // Auto-fill the title if blank
                              if (!title && work.title) setTitle(work.title);
                              // Normalize genre: match against Select options (accent+case insensitive)
                              if (work.genero) {
                                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                const matched = musicGenres.find(g => norm(g) === norm(work.genero));
                                setMusicGenre(matched ? matched.toLowerCase() : work.genero.toLowerCase());
                              }
                              // Fill the participation from the full work data
                              const fullWork = worksSearch.find((o: ObraWithRelations) => o.id === work.id);
                              if (fullWork) {
                                const composersStr = Array.isArray(fullWork.compositores)
                                  ? (fullWork.compositores as string[]).join(", ")
                                  : typeof fullWork.compositores === "string"
                                  ? fullWork.compositores
                                  : typeof fullWork.compositor === "string"
                                  ? fullWork.compositor
                                  : "";
                                // Resolve the musician/arranger from the project producers — DIRECT
                                // lookup by ID (Task J: it used to scan the `projetos` array
                                // of an unfiltered useProjetos(), truncated at 50 per tenant).
                                let musicosArr: Participant[] = [];
                                if ((fullWork.project_id as string | null | undefined)) {
                                  const project = await storage.findById<ProjetoWithRelations>("projects", fullWork.project_id as string);
                                  if (project?.description) {
                                    try {
                                      const normT = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                      const tracks = JSON.parse(project.description as string) as Array<{ nome?: string; produtores?: string[] }>;
                                      const trackMatch = tracks.find(m =>
                                        normT(m.nome || "") === normT(fullWork.title || "") ||
                                        normT(m.nome || "") === normT(work.title || "")
                                      );
                                      if (trackMatch?.produtores?.length) {
                                        musicosArr = trackMatch.produtores.map((name: string) => ({
                                          id: crypto.randomUUID(), name, percentual: "",
                                        }));
                                      }
                                    } catch { /* invalid JSON — leave blank */ }
                                  }
                                }
                                // Resolve the artist for the performer:
                                // 1) DB join (non-mock), 2) DIRECT lookup by ID (Task J — it used to
                                // scan the `artistas` array of an unfiltered useArtistas(),
                                // truncated at 50 artists per tenant; GET /artists/:id reaches
                                // any artist of the tenant), 3) composer name match (only
                                // when there is no artist_id — the same concession already accepted in
                                // other migrations of this task).
                                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                let artistName = fullWork.artistas?.nome_artistico as string | undefined;
                                let artistId = fullWork.artistas?.id as string | undefined;
                                if (!artistName && (fullWork.artist_id as string | null | undefined)) {
                                  const byId = await storage.findById<ArtistWireRecord>("artistas", fullWork.artist_id as string);
                                  if (byId) { const a = wireToArtist(byId); artistName = a.stageName; artistId = a.id; }
                                }
                                if (!artistName && composersStr) {
                                  const firstComp = composersStr.split(",")[0]?.trim();
                                  if (firstComp) {
                                    const { items: compMatches } = await storage.listPaged<ArtistWireRecord>("artistas", {
                                      page: 1, pageSize: 5, filters: { search: firstComp },
                                    });
                                    const byName = compMatches.map(wireToArtist).find((a: Artist) =>
                                      norm(a.stageName || "") === norm(firstComp) ||
                                      norm(a.legalName || "") === norm(firstComp) ||
                                      norm(a.name || "") === norm(firstComp)
                                    );
                                    if (byName) { artistName = byName.stageName; artistId = byName.id; }
                                  }
                                }
                                const performers: Participant[] = artistName
                                  ? [{ id: crypto.randomUUID(), name: artistName, percentual: "", artist_id: artistId }]
                                  : [];
                                setParticipation(prev => ({
                                  ...prev,
                                  // produtorFonografico: leave blank for manual fill
                                  interprete: prev.interprete.length === 0 ? performers : prev.interprete,
                                  musicoAcompanhante: prev.musicoAcompanhante.length === 0 ? musicosArr : prev.musicoAcompanhante,
                                }));
                              }
                              setSearchWork("");
                              setSearchOpen(false);
                              toast.success(`Obra "${work.title}" vinculada! Campos preenchidos automaticamente.`);
                            };
                            return (
                              <div
                                key={work.id}
                                role="option"
                                tabIndex={0}
                                aria-selected={false}
                                className="flex items-center gap-3 p-2 hover:bg-muted focus:bg-muted focus:outline-none rounded-lg cursor-pointer transition-colors"
                                onClick={selectWork}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectWork();
                                  }
                                }}
                                data-testid={`option-obra-${work.id}`}
                              >
                                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                  <Music className="h-4 w-4 text-primary-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {work.title || "—"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[work.genero, work.compositores]
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
                        {registeredWorksTotal > LOCAL_RESULTS_LIMIT && (
                          <p
                            className="text-xs text-muted-foreground italic px-2 py-1"
                            data-testid="text-local-overflow"
                          >
                            Mostrando {LOCAL_RESULTS_LIMIT} de {registeredWorksTotal} resultados — refine sua busca.
                          </p>
                        )}
                        <AbramusSearchRow
                          kind="obras"
                          query={searchWorkDebounced}
                          limit={LOCAL_RESULTS_LIMIT}
                          onImported={(rec) => {
                            if (!rec.localId) {
                              toast.error(
                                "Não foi possível resolver a obra importada."
                              );
                              return;
                            }
                            setLinkedWork({
                              id: rec.localId,
                              title: rec.title ?? "",
                              genero: rec.genero ?? "",
                              compositores: Array.isArray(rec.compositores)
                                ? rec.compositores.filter(Boolean).join(", ")
                                : "",
                              status: "registered",
                            });
                            setSearchWork("");
                            setSearchOpen(false);
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
                  onClick={() => setSearchOpen(true)}
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

          {/* Sound recording data */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <h3 className="font-semibold text-base">Dados do Fonograma</h3>

            {/* Row 1: Society registration code | ECAD code | Aggregator | ISRC | AI-created */}
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
                  <Input value={isrcCountry} onChange={(e) => setIsrcCountry(e.target.value)} disabled={isViewMode} placeholder="BR" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={2} />
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

            {/* Row 2: Instrumental | Issue | Original recording | Release | Duration */}
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
                <DatePickerField value={recordingDate} onChange={setRecordingDate} disabled={isViewMode} placeholder="Data" data-testid="datepicker-gravacao-original" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Lançamento</span>
                <DatePickerField value={releaseDate} onChange={setReleaseDate} disabled={isViewMode} placeholder="Data" data-testid="datepicker-lancamento" />
              </div>
              <div className="col-span-4">
                <span className="text-xs text-muted-foreground mb-1 block">Duração</span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">min</span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationSeg}
                    onChange={(e) => setDurationSeg(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">seg</span>
                </div>
                {(durationMinError || durationSegError) && (
                  <p className="text-xs text-destructive">{durationMinError || durationSegError}</p>
                )}
              </div>
            </div>

            {/* Row 3: Genre | Media | National | Simultaneous publication | Country of origin | Country of publication */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Gênero Musical</span>
                <Select value={musicGenre} onValueChange={setMusicGenre} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {musicGenres.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Mídia</span>
                <Select value={media} onValueChange={setMedia} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {mediaItems.map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}
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
                <Select value={sourceCountry} onValueChange={setSourceCountry} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {countries.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Publicação</span>
                <Select value={publicationCountry} onValueChange={setPublicationCountry} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {countries.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Classification | Status */}
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

          {/* Participation */}
          <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Participação</h3>
              <span className="text-sm text-muted-foreground">Percentual total: {calculateTotalPercentage().toFixed(2)}% de 100%</span>
            </div>
            
            <div className="space-y-3">
              {renderParticipationSection("Produtor Fonográfico", "produtorFonografico", 41.70, producerOpen, setProducerOpen)}
              {renderParticipationSection("Intérprete", "interprete", 41.70, performerOpen, setPerformerOpen)}
              {renderParticipationSection("Músico Acompanhante", "musicoAcompanhante", 16.60, musicoOpen, setMusicoOpen)}
            </div>
          </div>

          {/* Audio upload */}
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
                {audioFile ? (
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      {audioUploading ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : (
                        <FileAudio className="w-8 h-8 text-primary" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{audioFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(audioFile.size)}
                          {audioUploading && " — enviando..."}
                          {!audioUploading && audioFile.url && " — link gerado ✓"}
                        </p>
                        {!audioUploading && audioFile.url && (
                          <a
                            href={audioFile.url}
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAudioFile(null)} disabled={audioUploading}>
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

          {/* Terms of use */}
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
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={hasDurationError || submitting} data-testid="button-submit-fonograma">
                {submitting
                  ? (mode === "create" ? "Cadastrando..." : "Atualizando...")
                  : (mode === "create" ? "Cadastrar Fonograma" : "Atualizar Fonograma")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
      <ParticipantViewModal
        open={viewArtist !== null}
        onOpenChange={(o) => { if (!o) setViewArtist(null); }}
        artista={viewArtist}
      />
    </Dialog>
  );
}

