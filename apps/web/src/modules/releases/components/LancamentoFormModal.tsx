import { useState, useEffect, useRef } from "react";
import { MUSICAL_GENRES } from "@/constants/musicalGenres";
import { safeImageSrc } from "@/shared/lib/safe-url";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Folder,
  Music,
  Plus,
  Upload,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
} from "lucide-react";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { Lancamento } from "@/modules/releases/types";
import { useDistributionPlatforms } from "@/modules/releases/hooks/useDistributionPlatforms";
import { resolveReleaseStatus, releaseStatusLabel } from "@/modules/releases/lib/release-status";
import { formatReleaseDate } from "@/modules/releases/lib/release-format";
import type { ProjectWithRelations } from "@/modules/projects/hooks/useProjects";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type { FonogramaWithRelations } from "@/modules/catalog/hooks/useFonogramas";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import {
  lancamentoToFormFields,
  emptyLancamentoFormFields,
  formToLancamentoPayload,
  projetoToLancamentoSeed,
} from "@/modules/releases/mappers";

// ─────────────────────────────────────────────────────────────────────────────
// STEP LABELS
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  "Album Info",
  "Track Upload",
  "Album Art",
  "Distribution Preferences",
  "Preview",
];

// ─────────────────────────────────────────────────────────────────────────────
// GENRE HELPERS  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const sortOptionsByLabel = <T extends { label: string }>(items: T[]) =>
  [...items].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

const GENERO_OPTIONS = MUSICAL_GENRES;
const GENERO_OPTS = GENERO_OPTIONS.map((o) => o.value);
const GENERO_LABELS: Record<string, string> = Object.fromEntries(
  GENERO_OPTIONS.map((o) => [o.value, o.label]),
);
const GENERO_ALIASES: Record<string, string> = {
  eletronico: "eletronica",
  electronico: "eletronica",
  electronica: "eletronica",
  "hip hop": "hip-hop",
  rap: "rap",
  "bossa nova": "bossa-nova",
  "mpb/bossa nova": "bossa-nova",
  forro: "forro",
};
const normStr = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const matchGenero = (raw: string): string => {
  if (!raw) return "";
  const n = normStr(raw);
  const exact = GENERO_OPTS.find((g) => normStr(g) === n);
  if (exact) return exact;
  if (GENERO_ALIASES[n]) return GENERO_ALIASES[n];
  const partial = GENERO_OPTS.find(
    (g) => n.startsWith(normStr(g)) || normStr(g).startsWith(n),
  );
  return partial ?? raw.toLowerCase();
};
const splitNames = (s: string | null | undefined): string[] => {
  if (!s) return [""];
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [""];
};

/**
 * Resolve um fonograma pelo título exato (após normalização) — busca
 * server-side (ILIKE) em vez de escanear a lista capped de useFonogramas()
 * sem filtro (Task J). Usado só para autofill best-effort (ISRC de uma faixa
 * de projeto); poucos resultados bastam, `pageSize` pequeno é intencional.
 */
async function findFonogramaByTitle(title: string): Promise<FonogramaWithRelations | undefined> {
  if (!title.trim()) return undefined;
  const alvo = normStr(title);
  const { items } = await storage.listPaged<FonogramaWithRelations & { id: string }>("fonogramas", {
    page: 1,
    pageSize: 5,
    filters: { search: title },
  });
  return items.find((f) => normStr(f.title ?? "") === alvo);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW OPTION LISTS
// ─────────────────────────────────────────────────────────────────────────────
const AI_ASSISTANCE_OPTS = [
  { value: "human_no_ai", label: "Criação Humana, Sem IA" },
  { value: "human_ai_assisted", label: "Criação Humana, Assistida por IA" },
  { value: "ai_human_edited", label: "Gerado por IA, Editado por Humano" },
  { value: "ai_generated", label: "Gerado por IA" },
];

const EXPLICIT_OPTS = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim (Explícito)" },
  { value: "clean", label: "Versão Limpa" },
];

const VERSION_TYPE_OPTS = [
  { value: "remix", label: "Remix" },
  { value: "live", label: "Ao Vivo" },
  { value: "acoustic", label: "Acústico" },
  { value: "instrumental_ver", label: "Instrumental" },
  { value: "karaoke", label: "Karaokê" },
  { value: "radio_edit", label: "Edição para Rádio" },
  { value: "extended", label: "Mix Estendido" },
  { value: "demo", label: "Demonstração" },
  { value: "cover", label: "Cover" },
  { value: "other", label: "Outro" },
];

const ARTIST_ROLES = [
  "Artista Principal",
  "Featuring",
  "Intérprete",
  "Remixer",
  "DJ",
  "Coro",
];
const PRODUCER_ROLES = [
  "Produtor",
  "Co-Produtor",
  "Produtor Executivo",
  "Mixagem",
  "Engenheiro de Masterização",
  "Engenheiro de Gravação",
];
const INSTRUMENT_OPTS = [
  "Guitar",
  "Bass",
  "Drums",
  "Piano",
  "Keyboard",
  "Violin",
  "Trumpet",
  "Saxophone",
  "DJ",
  "Vocals",
  "Backing Vocals",
  "Percussion",
  "Strings",
  "Other",
];

const IDIOMA_OPTS = sortOptionsByLabel([
  { value: "de", label: "Alemão" },
  { value: "ar", label: "Árabe" },
  { value: "zh", label: "Chinês" },
  { value: "ko", label: "Coreano" },
  { value: "es", label: "Espanhol" },
  { value: "fr", label: "Francês" },
  { value: "en", label: "Inglês" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japonês" },
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "pt", label: "Português" },
]);

const TIMEZONE_OPTS = [
  {
    value: "America/Sao_Paulo",
    label: "(GMT -3:00) Brazil, Buenos Aires, Georgetown",
  },
  {
    value: "America/New_York",
    label: "(GMT -5:00) Eastern Time (US & Canada)",
  },
  { value: "America/Chicago", label: "(GMT -6:00) Central Time (US & Canada)" },
  {
    value: "America/Los_Angeles",
    label: "(GMT -8:00) Pacific Time (US & Canada)",
  },
  { value: "Europe/London", label: "(GMT +0:00) London, Dublin, Lisbon" },
  { value: "Europe/Paris", label: "(GMT +1:00) Paris, Madrid, Berlin" },
  { value: "Asia/Tokyo", label: "(GMT +9:00) Tokyo, Seoul" },
];

const PRICING_OPTS = [
  { value: "custom", label: "Custom" },
  { value: "standard", label: "Standard" },
  { value: "free", label: "Free" },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ────────────────────────────────────────────────────────────────────────────
interface ArtistEntry {
  nome: string;
  role: string;
}
interface MusicianEntry {
  nome: string;
  instrumento: string;
}

interface Faixa {
  id: number;
  title: string;
  artista: string;
  isrc: string;
  // version
  isVersionAlternativa: boolean;
  tipoVersao: string;
  versionCustomName: string;
  // credits
  artistasAdicionais: ArtistEntry[];
  produtores: ArtistEntry[];
  compositores: string[];
  musicos: MusicianEntry[];
  // AI / content
  aiAssistanceLevel: string;
  instrumental: boolean;
  idioma: string;
  letra: string;
  explicit: string;
  // file
  arquivoAudio: File | null;
  audioUrl?: string;
  _uploading?: boolean;
}

interface ExtraFields {
  // Album Info
  variosArtistas: boolean;
  artistasAdicionaisAlbum: ArtistEntry[];
  generoSecundario: string;
  copyrightDataLancamento: string;
  copyrightDataGravacao: string;
  ownUpc: boolean;
  // Distribution
  territory: string;
  releaseTime: string;
  releaseTimezone: string;
  preOrder: boolean;
  noPreviewsDuringPreOrder: boolean;
  pricing: string;
}

interface LancamentoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento?: Lancamento;
  mode: "create" | "edit" | "view";
  onCreatedAndDistributed?: (lancamento: Lancamento) => void | Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────
const mkFaixa = (id = Date.now()): Faixa => ({
  id,
  title: "",
  artista: "",
  isrc: "",
  isVersionAlternativa: false,
  tipoVersao: "",
  versionCustomName: "",
  artistasAdicionais: [],
  produtores: [],
  compositores: [""],
  musicos: [],
  aiAssistanceLevel: "",
  instrumental: false,
  idioma: "pt-br",
  letra: "",
  explicit: "no",
  arquivoAudio: null,
});

const DEFAULT_EXTRA: ExtraFields = {
  variosArtistas: false,
  artistasAdicionaisAlbum: [],
  generoSecundario: "",
  copyrightDataLancamento: "",
  copyrightDataGravacao: "",
  ownUpc: false,
  territory: "world",
  releaseTime: "",
  releaseTimezone: "America/Sao_Paulo",
  preOrder: false,
  noPreviewsDuringPreOrder: false,
  pricing: "custom",
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start mb-6 overflow-x-auto pb-1 -mx-1 px-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${
                  i < current
                    ? "bg-primary border-primary text-primary-foreground"
                    : i === current
                      ? "border-primary text-primary bg-background"
                      : "border-muted-foreground/40 text-muted-foreground/60 bg-background"
                }`}
            >
              {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`mt-1 text-[10px] font-medium hidden sm:block whitespace-nowrap
                ${i === current ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px w-4 lg:w-8 mx-1 mb-4 transition-colors
                ${i < current ? "bg-primary" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO BOX helper
// ─────────────────────────────────────────────────────────────────────────────
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 border rounded-md p-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArtistAutocompleteInput — texto com dropdown que abre no foco. Task J:
// antes recebia uma lista `suggestions: string[]` pré-computada a partir de
// useArtistas() sem filtro (primeiros 50 artistas do tenant); agora busca
// server-side (debounced internamente) a cada tecla, alcançando qualquer
// artista do tenant. Texto livre continua permitido — nem todo colaborador
// precisa estar cadastrado.
// ─────────────────────────────────────────────────────────────────────────────
function ArtistAutocompleteInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { items: suggestionsData } = useEntityLookup<ArtistWireRecord>({
    table: "artistas",
    search: value,
    enabled: open && value.trim().length > 0,
  });
  const filtered = suggestionsData.map((a) => wireToArtist(a).stageName ?? "").filter(Boolean);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        className="w-full"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-muted hover:text-foreground cursor-pointer text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function LancamentoFormModal({
  open,
  onOpenChange,
  lancamento,
  mode,
  onCreatedAndDistributed,
}: LancamentoFormModalProps) {
  const { addLancamento, updateLancamento } = useLancamentos();
  const { upload: uploadToR2, isUploading: isUploadingCoverR2 } = useUploadToR2();

  // ── Core state ────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(emptyLancamentoFormFields);
  const [extraFields, setExtraFields] = useState<ExtraFields>({
    ...DEFAULT_EXTRA,
  });
  const [faixas, setFaixas] = useState<Faixa[]>([mkFaixa(1)]);
  const [capaPrincipal, setCapaPrincipal] = useState<File | null>(null);
  const isUploadingCover = isUploadingCoverR2;

  // ── Combobox state (unchanged) ────────────────────────────────────────────
  const [projetoSearch, setProjetoSearch] = useState("");
  const [projetoOpen, setProjetoOpen] = useState(false);
  const [artistaSearch, setArtistaSearch] = useState("");
  const [artistaOpen, setArtistaOpen] = useState(false);

  // ── Plataformas de distribuição (fonte única: serviço/hook) ────────────────
  // Apenas plataformas realmente conectadas aparecem como selecionáveis.
  const { enabledPlatforms: connectedDistributors, hasAnyConnected } = useDistributionPlatforms();

  // ── Helper to update extraFields ──────────────────────────────────────────
  const setExtra = <K extends keyof ExtraFields>(k: K, v: ExtraFields[K]) =>
    setExtraFields((prev) => ({ ...prev, [k]: v }));

  // ── Derived labels ────────────────────────────────────────────────────────
  // Task J: busca direto por ID (GET /projects/:id) — não depende do projeto
  // estar entre os primeiros carregados por useProjetos() sem filtro.
  const { entity: selectedProjeto } = useEntityById<ProjectWithRelations>("projects", formData.projetoSeed || undefined);
  const projetoLabel: string = selectedProjeto
    ? ((selectedProjeto.title ?? (selectedProjeto.nome as string | undefined) ?? "") as string)
    : "";
  // Task I: busca direto por ID (não depende do artista estar entre os
  // primeiros carregados por useArtistas() sem filtro).
  const { entity: selectedArtistaWire } = useEntityById<ArtistWireRecord>("artistas", formData.artist_id || undefined);
  const selectedArtista: Artist | undefined = selectedArtistaWire ? wireToArtist(selectedArtistaWire) : undefined;
  const artistaLabel = selectedArtista?.stageName ?? "";

  // ── Filtered lists ────────────────────────────────────────────────────────
  const TIPOS_MUSICAIS = ["album", "ep", "single"];
  // Task J: busca server-side (debounced internamente) — antes filtrava só
  // os primeiros 50 projetos do tenant carregados via useProjetos() sem
  // filtro. O filtro por type (album/ep/single) continua client-side sobre
  // os resultados já buscados — o backend só suporta um único `type=` por
  // vez, não uma lista (ver QueryProjectDto), então filtrar os 3 tipos
  // musicais aqui é a mesma concessão já aceita em outras migrações desta
  // tarefa (leve estreitamento, nunca um cap de 50 no tenant inteiro).
  const { items: projetosBusca } = useEntityLookup<ProjectWithRelations>({
    table: "projects",
    search: projetoSearch,
    enabled: projetoOpen,
  });
  const projetosFiltrados = projetosBusca.filter(
    (p) => !p.type || TIPOS_MUSICAIS.includes(String(p.type).toLowerCase()),
  );
  // Task I: busca server-side (debounced internamente) — antes filtrava só
  // os primeiros 50 artistas do tenant carregados via useArtistas() sem filtro.
  const { items: artistasFiltradosWire } = useEntityLookup<ArtistWireRecord>({
    table: "artistas",
    search: artistaSearch,
    enabled: artistaOpen,
  });
  const artistasFiltrados = artistasFiltradosWire.map(wireToArtist);

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setCurrentStep(0);
    setFormData(lancamentoToFormFields(lancamento ?? null));

    const meta = lancamento
      ? ((lancamento as Record<string, unknown>)["metadata"] as Record<string, unknown> | undefined) ?? {}
      : {};

    if (lancamento && Array.isArray(meta["faixas"]) && (meta["faixas"] as unknown[]).length > 0) {
      setFaixas((meta["faixas"] as Faixa[]).map(f => ({ ...f, arquivoAudio: null })));
    } else {
      setFaixas([mkFaixa(1)]);
    }

    setExtraFields({
      ...DEFAULT_EXTRA,
      ...(meta["variosArtistas"] !== undefined ? { variosArtistas: meta["variosArtistas"] as boolean } : {}),
      ...(Array.isArray(meta["artistasAdicionaisAlbum"]) ? { artistasAdicionaisAlbum: meta["artistasAdicionaisAlbum"] as ArtistEntry[] } : {}),
      ...(meta["generoSecundario"] ? { generoSecundario: String(meta["generoSecundario"]) } : {}),
      ...(meta["copyrightDataLancamento"] ? { copyrightDataLancamento: String(meta["copyrightDataLancamento"]) } : {}),
      ...(meta["copyrightDataGravacao"] ? { copyrightDataGravacao: String(meta["copyrightDataGravacao"]) } : {}),
      ...(meta["ownUpc"] !== undefined ? { ownUpc: Boolean(meta["ownUpc"]) } : {}),
      ...(meta["territory"] ? { territory: String(meta["territory"]) } : {}),
      ...(meta["releaseTimezone"] ? { releaseTimezone: String(meta["releaseTimezone"]) } : {}),
      ...(meta["pricing"] ? { pricing: String(meta["pricing"]) } : {}),
    });

    setCapaPrincipal(null);
    setProjetoSearch("");
    setArtistaSearch("");
    setProjetoOpen(false);
    setArtistaOpen(false);
  }, [open, lancamento]);

  const isViewMode = mode === "view";

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-FILL HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  // Task J: recebe o projeto já resolvido (o item clicado veio direto dos
  // resultados de busca server-side em `projetosBusca`) em vez de reescanear
  // um array `projetos` capped por ID — elimina o risco de "not found" para
  // projetos fora dos primeiros 50 do tenant. O nome/gênero do artista
  // vinculado e o fonograma cujo título bate com o do projeto/faixa também
  // são resolvidos por busca direta (storage.findById / busca por título),
  // nunca varrendo useArtistas()/useFonogramas() sem filtro.
  const handleSelectProjeto = async (projeto: ProjectWithRelations) => {
    const projectId = projeto.id;
    const seed = projetoToLancamentoSeed(projeto);
    const linkedArtistaWire = projeto.artist_id
      ? await storage.findById<ArtistWireRecord>("artistas", projeto.artist_id as string)
      : undefined;
    const linkedArtista = linkedArtistaWire ? wireToArtist(linkedArtistaWire) : undefined;
    const rawGenero = seed.genero?.trim() || linkedArtista?.musicGenre || "";
    const fonoDosProjeto = projeto.title
      ? await findFonogramaByTitle(projeto.title)
      : undefined;
    setFormData((prev) => ({
      ...prev,
      projetoSeed: projectId,
      title: !prev.title.trim() ? (seed.title ?? "") : prev.title,
      artist_id: !prev.artist_id.trim()
        ? (seed.artist_id ?? "")
        : prev.artist_id,
      genero: !prev.genero.trim() ? matchGenero(rawGenero) : prev.genero,
      type: !prev.type.trim() ? (seed.type ?? "") : prev.type,
      isrcGlobal: !prev.isrcGlobal.trim()
        ? (fonoDosProjeto?.isrc ?? "")
        : prev.isrcGlobal,
    }));
    if (projeto.descricao) {
      try {
        const musicas = JSON.parse(projeto.descricao) as Array<{
          nome?: string;
          compositores?: string[];
          produtores?: string[];
          isrc?: string;
          letra?: string;
        }>;
        if (musicas.length > 0) {
          const artistaNome = linkedArtista?.stageName ?? "";
          const faixasResolvidas = await Promise.all(
            musicas.map(async (m, i) => {
              const isrcFaixa =
                m.isrc?.trim() || (m.nome ? (await findFonogramaByTitle(m.nome))?.isrc ?? "" : "");
              return {
                ...mkFaixa(i + 1),
                title: m.nome ?? "",
                artista: artistaNome,
                isrc: isrcFaixa,
                compositores: m.compositores?.length ? m.compositores : [""],
                produtores: m.produtores?.length
                  ? m.produtores.map((p) => ({ nome: p, role: "Producer" }))
                  : [],
                letra: m.letra ?? "",
              };
            }),
          );
          setFaixas(faixasResolvidas);
        }
      } catch {
        /* invalid JSON */
      }
    }
    setProjetoOpen(false);
    setProjetoSearch("");
  };

  const handleSelectArtista = (artistId: string) => {
    setFormData((prev) => ({ ...prev, artist_id: artistId }));
    setArtistaOpen(false);
    setArtistaSearch("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP VALIDATION & NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────
  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 0:
        return (
          !!formData.title.trim() &&
          (extraFields.variosArtistas || !!formData.artist_id.trim())
        );
      case 1:
        return faixas.every((f) => !!f.title.trim() && !!f.aiAssistanceLevel);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!canAdvance()) {
      toast.error("Preencha os campos obrigatórios antes de avançar.");
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  // ─────────────────────────────────────────────────────────────────────────
  // FAIXA HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const addFaixa = () =>
    setFaixas((prev) => [...prev, mkFaixa(prev.length + 1)]);
  const removeFaixa = (id: number) => {
    if (faixas.length > 1) setFaixas((prev) => prev.filter((f) => f.id !== id));
  };
  const updF = <K extends keyof Faixa>(id: number, k: K, v: Faixa[K]) =>
    setFaixas((prev) => prev.map((f) => (f.id === id ? { ...f, [k]: v } : f)));

  const handleFaixaAudioUpload = async (faixaId: number, file: File) => {
    updF(faixaId, "arquivoAudio", file);
    updF(faixaId, "_uploading", true);
    try {
      const { publicUrl } = await uploadToR2({
        file,
        category: "audio",
        entity:   "release",
        entityId: lancamento?.id,
      });
      updF(faixaId, "audioUrl", publicUrl);
      toast.success("Áudio enviado e link gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof R2NotConfiguredError
        ? err.message
        : err instanceof Error ? err.message : "Erro no upload do áudio";
      toast.error(`Upload falhou: ${msg}`);
      updF(faixaId, "arquivoAudio", null);
    } finally {
      updF(faixaId, "_uploading", false);
    }
  };

  // Compositores (string[])
  const addComp = (fid: number) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid ? { ...f, compositores: [...f.compositores, ""] } : f,
      ),
    );
  const updComp = (fid: number, i: number, v: string) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? {
              ...f,
              compositores: f.compositores.map((c, idx) => (idx === i ? v : c)),
            }
          : f,
      ),
    );
  const removeComp = (fid: number, i: number) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? { ...f, compositores: f.compositores.filter((_, idx) => idx !== i) }
          : f,
      ),
    );

  // ArtistEntry[] fields
  const addAE = (
    fid: number,
    field: "artistasAdicionais" | "produtores",
    defaultRole: string,
  ) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? { ...f, [field]: [...f[field], { nome: "", role: defaultRole }] }
          : f,
      ),
    );
  const updAE = (
    fid: number,
    field: "artistasAdicionais" | "produtores",
    i: number,
    k: "nome" | "role",
    v: string,
  ) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? {
              ...f,
              [field]: (f[field] as ArtistEntry[]).map((e, idx) =>
                idx === i ? { ...e, [k]: v } : e,
              ),
            }
          : f,
      ),
    );
  const removeAE = (
    fid: number,
    field: "artistasAdicionais" | "produtores",
    i: number,
  ) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? {
              ...f,
              [field]: (f[field] as ArtistEntry[]).filter(
                (_, idx) => idx !== i,
              ),
            }
          : f,
      ),
    );

  // Músicos
  const addMus = (fid: number) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? { ...f, musicos: [...f.musicos, { nome: "", instrumento: "" }] }
          : f,
      ),
    );
  const updMus = (
    fid: number,
    i: number,
    k: "nome" | "instrumento",
    v: string,
  ) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? {
              ...f,
              musicos: f.musicos.map((m, idx) =>
                idx === i ? { ...m, [k]: v } : m,
              ),
            }
          : f,
      ),
    );
  const removeMus = (fid: number, i: number) =>
    setFaixas((prev) =>
      prev.map((f) =>
        f.id === fid
          ? { ...f, musicos: f.musicos.filter((_, idx) => idx !== i) }
          : f,
      ),
    );

  // Album-level additional artists
  const addAlbumArtist = () =>
    setExtra("artistasAdicionaisAlbum", [
      ...extraFields.artistasAdicionaisAlbum,
      { nome: "", role: "Performer" },
    ]);
  const updAlbumArtist = (i: number, k: "nome" | "role", v: string) =>
    setExtra(
      "artistasAdicionaisAlbum",
      extraFields.artistasAdicionaisAlbum.map((e, idx) =>
        idx === i ? { ...e, [k]: v } : e,
      ),
    );
  const removeAlbumArtist = (i: number) =>
    setExtra(
      "artistasAdicionaisAlbum",
      extraFields.artistasAdicionaisAlbum.filter((_, idx) => idx !== i),
    );


  // ─────────────────────────────────────────────────────────────────────────
  // COVER UPLOAD  — directo ao Cloudflare R2 via presigned URL do backend
  // ─────────────────────────────────────────────────────────────────────────
  const handleCoverUpload = async (file: File) => {
    setCapaPrincipal(file);
    try {
      const { publicUrl } = await uploadToR2({
        file,
        category: "images",
        entity:   "release",
        entityId: lancamento?.id,
      });
      setFormData((prev) => ({ ...prev, assetCapaUrl: publicUrl }));
    } catch (err) {
      console.error("[CoverUpload R2]", err);
      if (err instanceof R2NotConfiguredError) {
        toast.error("Upload indisponível — armazenamento R2 não configurado no servidor.", {
          description: "Contate o administrador para habilitar uploads de capa.",
        });
      } else if (err instanceof Error) {
        toast.error("Falha ao enviar capa", { description: err.message });
      } else {
        toast.error("Falha desconhecida ao enviar capa.");
      }
      // Limpa preview para indicar que o upload não foi concluído
      setCapaPrincipal(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (mode === "view") return;
    if (!formData.title.trim()) {
      toast.error("Informe o título do lançamento.");
      return;
    }
    try {
      const payload = formToLancamentoPayload(formData, mode === "edit" ? "edit" : "create");
      // Persist faixas and extraFields in metadata for edit round-trips
      const savableFaixas = faixas.map(({ arquivoAudio: _a, _uploading: _u, ...f }) => f);
      const enrichedMeta: Record<string, unknown> = {
        ...(typeof payload["metadata"] === "object" && payload["metadata"] !== null
          ? (payload["metadata"] as Record<string, unknown>)
          : {}),
        faixas: savableFaixas,
        territory: extraFields.territory,
        releaseTimezone: extraFields.releaseTimezone,
        pricing: extraFields.pricing,
        generoSecundario: extraFields.generoSecundario,
        copyrightDataLancamento: extraFields.copyrightDataLancamento,
        copyrightDataGravacao: extraFields.copyrightDataGravacao,
        ownUpc: extraFields.ownUpc,
        variosArtistas: extraFields.variosArtistas,
        artistasAdicionaisAlbum: extraFields.artistasAdicionaisAlbum,
      };
      payload["metadata"] = enrichedMeta;
      if (mode === "edit" && lancamento?.id) {
        // Only send status if it actually changed — backend workflow rejects same-state transitions
        if (payload["status"] === lancamento.status) {
          delete payload["status"];
        }
        await updateLancamento.mutateAsync({
          id: lancamento.id,
          ...payload,
          expectedUpdatedAt: getExpectedUpdatedAt(lancamento),
        } as never);
        toast.success("Lançamento atualizado!");
      } else {
        const created = (await addLancamento.mutateAsync(payload as never)) as (Lancamento & { id?: string }) | undefined;
        // Integração desacoplada: oferecer iniciar o fluxo de shares (via navegação),
        // somente se houver participantes/créditos suficientes. Sem acoplamento direto.
        if (created?.id) {
          const releaseId = created.id;
          const distributedAt = new Date().toISOString();
          const updated = await updateLancamento.mutateAsync({
            id: releaseId,
            status: "distributed",
            metadata: {
              ...enrichedMeta,
              distributedAt,
              distributionCompletedAt: distributedAt,
            },
          } as never) as Lancamento;
          toast.success("Lançamento criado e distribuído!");
          await onCreatedAndDistributed?.(updated ?? ({ ...created, status: "distributed" } as Lancamento));
        } else {
          toast.success("Lançamento criado!");
        }
      }
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "lançamento")) return;
      // demais erros: mutation onError já exibe o toast — evita toast duplicado
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REUSABLE: ArtistEntry rows
  // ─────────────────────────────────────────────────────────────────────────
  const ArtistRows = ({
    entries,
    roles,
    addLabel,
    onAdd,
    onUpdate,
    onRemove,
    withArtistSuggestions,
  }: {
    entries: ArtistEntry[];
    roles: string[];
    addLabel: string;
    onAdd: () => void;
    onUpdate: (i: number, k: "nome" | "role", v: string) => void;
    onRemove: (i: number) => void;
    /** Habilita sugestão de artistas cadastrados (busca server-side) neste campo. */
    withArtistSuggestions?: boolean;
  }) => {
    return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div key={i} className="flex gap-2 items-center">
          {withArtistSuggestions ? (
            <ArtistAutocompleteInput
              value={e.nome}
              onChange={(v) => onUpdate(i, "nome", v)}
              placeholder="Nome"
              disabled={isViewMode}
            />
          ) : (
            <Input
              value={e.nome}
              onChange={(ev) => onUpdate(i, "nome", ev.target.value)}
              placeholder="Nome"
              disabled={isViewMode}
              className="flex-1"
            />
          )}
          <Select
            value={e.role}
            onValueChange={(v) => onUpdate(i, "role", v)}
            disabled={isViewMode}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isViewMode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(i)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!isViewMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 0 — ALBUM INFO
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-6">
      {/* Vinculações */}
      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Vinculações</CardTitle>
          </div>
          <CardDescription>
            Selecione o projeto para pré-carregar informações automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Popover
              open={projetoOpen}
              onOpenChange={isViewMode ? undefined : setProjetoOpen}
            >
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={projetoOpen ? projetoSearch : projetoLabel}
                    onChange={(e) => {
                      setProjetoSearch(e.target.value);
                      setProjetoOpen(true);
                    }}
                    onFocus={() => !isViewMode && setProjetoOpen(true)}
                    onClick={() => !isViewMode && setProjetoOpen(true)}
                    disabled={isViewMode}
                    placeholder="Buscar projeto..."
                    className="pl-10"
                    data-testid="input-buscar-projeto"
                  />
                  {formData.projetoSeed && !isViewMode && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, projetoSeed: "" }));
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-[480px] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <ScrollArea className="max-h-[280px]">
                  <div className="p-2">
                    {projetosFiltrados.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum projeto encontrado.
                      </p>
                    ) : (
                      projetosFiltrados.map((p) => (
                        <div
                          key={p.id}
                          role="option"
                          tabIndex={0}
                          className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                          onClick={() => handleSelectProjeto(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectProjeto(p);
                            }
                          }}
                          data-testid={`option-projeto-${p.id}`}
                        >
                          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center shrink-0">
                            <Folder className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {String(p.title ?? p.nome ?? "—")}
                            </p>
                            {/* ponytail: subtítulo com nome do artista removido — a API real
                                não embute o artista no /projects (sem join), e resolvê-lo por
                                linha exigiria N lookups por página de resultados. O valor
                                selecionado (projectId) continua correto independentemente
                                deste subtítulo. Upgrade path: endpoint dedicado que devolva
                                id+title+nome_artistico já agregados, se a UX exigir. */}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {formData.projetoSeed && (
              <p className="text-xs text-muted-foreground">
                Faixas, artista e gênero preenchidos a partir do projeto.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metadata</CardTitle>
          <CardDescription>
            Original Album Information — todos os campos são obrigatórios,
            exceto onde indicado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label>Título do Álbum / Single / EP *</Label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Título do lançamento"
              disabled={isViewMode}
              required
              data-cy="input-album-single-ep-title"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Lançamento *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v })}
              disabled={isViewMode}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="ep">EP</SelectItem>
                <SelectItem value="album">Álbum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Various Artists */}
          <div className="space-y-2">
            <Label>Various Artists</Label>
            <InfoBox>
              Marque esta opção se o álbum é uma coletânea com 5 ou mais
              artistas principais diferentes.
            </InfoBox>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={extraFields.variosArtistas}
                onCheckedChange={(checked) => setExtra("variosArtistas", checked === true)}
                disabled={isViewMode}
                data-cy="checkbox-various-artists"
              />
              <span className="text-sm">Various Artists</span>
            </label>
          </div>

          {/* Primary Artist */}
          {!extraFields.variosArtistas && (
            <div className="space-y-2">
              <Label>Artista Principal *</Label>
              <Popover
                open={artistaOpen}
                onOpenChange={isViewMode ? undefined : setArtistaOpen}
              >
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={artistaOpen ? artistaSearch : artistaLabel}
                      onChange={(e) => {
                        setArtistaSearch(e.target.value);
                        setArtistaOpen(true);
                      }}
                      onFocus={() => !isViewMode && setArtistaOpen(true)}
                      onClick={() => !isViewMode && setArtistaOpen(true)}
                      disabled={isViewMode}
                      placeholder="Buscar artista..."
                      className="pl-10"
                      data-testid="input-buscar-artista"
                    />
                    {formData.artist_id && !isViewMode && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData((prev) => ({ ...prev, artist_id: "" }));
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[360px] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <ScrollArea className="max-h-[280px]">
                    <div className="p-2">
                      {artistasFiltrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum artista encontrado.
                        </p>
                      ) : (
                        artistasFiltrados.map((a) => (
                          <div
                            key={a.id}
                            role="option"
                            tabIndex={0}
                            className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                            onClick={() => handleSelectArtista(a.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectArtista(a.id);
                              }
                            }}
                            data-testid={`option-artista-${a.id}`}
                          >
                            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center shrink-0">
                              <Music className="h-4 w-4 text-foreground" />
                            </div>
                            <p className="text-sm font-medium truncate">
                              {a.stageName ?? "—"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Additional Artists (album level) */}
          <div className="space-y-2">
            <Label>Artistas Adicionais</Label>
            <InfoBox>
              Adicione artistas no nível do álbum com o papel correspondente.
              Eles aparecerão em <strong>todas</strong> as faixas. Para artistas
              de faixas específicas, adicione na etapa Track Upload. Apenas
              artistas devem ser listados — não inclua selos ou produtoras.
            </InfoBox>
            <ArtistRows
              entries={extraFields.artistasAdicionaisAlbum}
              roles={ARTIST_ROLES}
              addLabel="Adicionar Artista"
              onAdd={addAlbumArtist}
              onUpdate={updAlbumArtist}
              onRemove={removeAlbumArtist}
              withArtistSuggestions
            />
          </div>

          <Separator />

          {/* Genres */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gênero Principal *</Label>
              <Select
                value={formData.genero}
                onValueChange={(v) => setFormData({ ...formData, genero: v })}
                disabled={isViewMode}
              >
                <SelectTrigger data-testid="select-genero">
                  <SelectValue placeholder="Selecione o gênero" />
                </SelectTrigger>
                <SelectContent>
                  {[...GENERO_OPTS]
                    .sort((a, b) =>
                      (GENERO_LABELS[a] ?? a).localeCompare(
                        GENERO_LABELS[b] ?? b,
                        "pt-BR",
                      ),
                    )
                    .map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENERO_LABELS[g] ?? g}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gênero Secundário *</Label>
              <Select
                value={extraFields.generoSecundario}
                onValueChange={(v) => setExtra("generoSecundario", v)}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gênero" />
                </SelectTrigger>
                <SelectContent>
                  {[...GENERO_OPTS]
                    .sort((a, b) =>
                      (GENERO_LABELS[a] ?? a).localeCompare(
                        GENERO_LABELS[b] ?? b,
                        "pt-BR",
                      ),
                    )
                    .map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENERO_LABELS[g] ?? g}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>
              Idioma *{" "}
              <span className="text-muted-foreground text-xs font-normal">
                (idioma do álbum, título e faixas)
              </span>
            </Label>
            <InfoBox>
              Idioma do álbum, título do álbum e títulos das faixas.
            </InfoBox>
            <Select
              value={formData.idioma}
              onValueChange={(v) => setFormData({ ...formData, idioma: v })}
              disabled={isViewMode}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione o idioma" />
              </SelectTrigger>
              <SelectContent>
                {IDIOMA_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Copyright Info */}
      <Card className="bg-muted/30 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Copyright Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Label */}
          <div className="space-y-2">
            <Label>Gravadora / Selo *</Label>
            <InfoBox>
              Se você é um artista independente, pode usar seu nome artístico
              como selo.
            </InfoBox>
            <Input
              value={formData.gravadora}
              onChange={(e) =>
                setFormData({ ...formData, gravadora: e.target.value })
              }
              placeholder="Nome da gravadora ou selo"
              disabled={isViewMode}
            />
          </div>

          {/* Copyright dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ano de Copyright — Lançamento *</Label>
              <Input
                value={extraFields.copyrightDataLancamento}
                onChange={(e) =>
                  setExtra("copyrightDataLancamento", e.target.value)
                }
                placeholder="Ex: 2026"
                disabled={isViewMode}
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Ano de Copyright — Gravação *</Label>
              <Input
                value={extraFields.copyrightDataGravacao}
                onChange={(e) =>
                  setExtra("copyrightDataGravacao", e.target.value)
                }
                placeholder="Ex: 2025"
                disabled={isViewMode}
                maxLength={4}
              />
            </div>
          </div>

          {/* Titular */}
          <div className="space-y-2">
            <Label>Titular do Copyright</Label>
            <Input
              value={formData.copyright}
              onChange={(e) =>
                setFormData({ ...formData, copyright: e.target.value })
              }
              placeholder="© 2026 Nome do detentor"
              disabled={isViewMode}
            />
          </div>

          {/* UPC */}
          <div className="space-y-2">
            <Label>Bar Code (UPC)</Label>
            <InfoBox>
              Se você não tiver um código UPC, geraremos um automaticamente.
            </InfoBox>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <Checkbox
                checked={extraFields.ownUpc}
                onCheckedChange={(checked) => setExtra("ownUpc", checked === true)}
                disabled={isViewMode}
                data-cy="checkbox-own-upc"
              />
              <span className="text-sm">Tenho meu próprio UPC</span>
            </label>
            {extraFields.ownUpc && (
              <Input
                value={formData.codigoUPC}
                onChange={(e) =>
                  setFormData({ ...formData, codigoUPC: e.target.value })
                }
                placeholder="Digite o código UPC"
                disabled={isViewMode}
                maxLength={14}
                data-cy="input-upc"
              />
            )}
          </div>

          {/* Status interno — controlado pelo sistema (não editável manualmente).
              O status de plataforma é atualizado apenas por integração real. */}
          <div className="space-y-2">
            <Label>Status interno</Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <Badge variant="neutral">
                {lancamento ? releaseStatusLabel(resolveReleaseStatus(lancamento)) : "Incompleto"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Controlado pelo sistema. O status de distribuição é definido pela plataforma.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — TRACK UPLOAD
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      {faixas.map((faixa, index) => (
        <Card key={faixa.id} className="bg-muted/30 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {index + 1}. {faixa.title || "Nova Faixa"}
              </CardTitle>
              {faixas.length > 1 && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFaixa(faixa.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label>
                Título da Faixa *{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (máx. 200 caracteres)
                </span>
              </Label>
              <Input
                value={faixa.title}
                onChange={(e) => updF(faixa.id, "title", e.target.value)}
                placeholder="Nome da música"
                disabled={isViewMode}
                maxLength={200}
                data-cy="input-title"
              />
            </div>

            {/* Alternative version */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={faixa.isVersionAlternativa}
                onCheckedChange={(checked) =>
                  updF(faixa.id, "isVersionAlternativa", checked === true)
                }
                disabled={isViewMode}
                data-cy="checkbox-alternative-version"
              />
              <span className="text-sm">
                Marcar como versão alternativa do lançamento original
              </span>
            </label>

            {faixa.isVersionAlternativa && (
              <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                <Label>Tipo de Versão</Label>
                <InfoBox>
                  <strong>Nota:</strong> Tipos como "New Release", "Original",
                  "Studio", "Official" não estão disponíveis para versões
                  alternativas.
                </InfoBox>
                <div className="flex items-end gap-3">
                  <Select
                    value={faixa.tipoVersao}
                    onValueChange={(v) => updF(faixa.id, "tipoVersao", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger
                      className="w-64"
                      data-cy="dropdown-version-type"
                    >
                      <SelectValue placeholder="Selecione o tipo de versão" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERSION_TYPE_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {faixa.tipoVersao === "other" && (
                    <div className="flex-1 space-y-2">
                      <Label>Descrição da Versão Customizada</Label>
                      <Input
                        placeholder="Ex: Versão extended, remix especial, etc."
                        value={faixa.versionCustomName || ""}
                        onChange={(e) => updF(faixa.id, "versionCustomName", e.target.value)}
                        disabled={isViewMode}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Album-level artists (read-only display) */}
            {(artistaLabel ||
              extraFields.artistasAdicionaisAlbum.length > 0) && (
              <div className="space-y-2">
                <Label>
                  Artistas do Álbum{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (aparecem em todas as faixas — altere na etapa Album Info)
                  </span>
                </Label>
                <div className="bg-muted/50 border rounded-md p-3 space-y-1">
                  {artistaLabel && (
                    <p className="text-sm">
                      <span className="font-medium">{artistaLabel}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — Main Artist
                      </span>
                    </p>
                  )}
                  {extraFields.artistasAdicionaisAlbum.map((a, i) => (
                    <p key={i} className="text-sm">
                      <span className="font-medium">{a.nome || "—"}</span>
                      <span className="text-muted-foreground"> — {a.role}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Additional artists (track level) */}
            <div className="space-y-2">
              <Label>Adicionar Artistas ou Colaboradores</Label>
              <InfoBox>
                Adicione colaboradores no nível da faixa e selecione o papel.
                Artistas do álbum aparecem automaticamente em todas as faixas.
              </InfoBox>
              <ArtistRows
                entries={faixa.artistasAdicionais}
                roles={ARTIST_ROLES}
                addLabel="Adicionar Artista / Colaborador"
                onAdd={() => addAE(faixa.id, "artistasAdicionais", "Performer")}
                onUpdate={(i, k, v) =>
                  updAE(faixa.id, "artistasAdicionais", i, k, v)
                }
                onRemove={(i) => removeAE(faixa.id, "artistasAdicionais", i)}
                withArtistSuggestions
              />
            </div>

            {/* Producers */}
            <div className="space-y-2">
              <Label>Produtores & Engenharia</Label>
              <InfoBox>
                Adicione produtores e engenheiros que trabalharam nesta faixa.
              </InfoBox>
              <ArtistRows
                entries={faixa.produtores}
                roles={PRODUCER_ROLES}
                addLabel="Adicionar Produtor / Engenheiro"
                onAdd={() => addAE(faixa.id, "produtores", "Producer")}
                onUpdate={(i, k, v) => updAE(faixa.id, "produtores", i, k, v)}
                onRemove={(i) => removeAE(faixa.id, "produtores", i)}
              />
            </div>

            {/* Songwriters */}
            <div className="space-y-2">
              <Label>Compositores</Label>
              <InfoBox>
                Se todos os membros de uma dupla ou banda são compositores,
                liste-os individualmente.
              </InfoBox>
              {faixa.compositores.map((c, i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <Input
                    value={c}
                    onChange={(e) => updComp(faixa.id, i, e.target.value)}
                    placeholder="Nome do compositor"
                    disabled={isViewMode}
                    className="flex-1"
                  />
                  {faixa.compositores.length > 1 && !isViewMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeComp(faixa.id, i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {!isViewMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => addComp(faixa.id)}
                >
                  <Plus className="h-4 w-4" /> Adicionar Compositor
                </Button>
              )}
            </div>

            {/* Musicians */}
            <div className="space-y-2">
              <Label>Músicos</Label>
              <InfoBox>
                Adicione os músicos que tocaram nesta faixa e o instrumento
                correspondente.
              </InfoBox>
              {faixa.musicos.map((m, i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <Input
                    value={m.nome}
                    onChange={(e) =>
                      updMus(faixa.id, i, "nome", e.target.value)
                    }
                    placeholder="Nome do músico"
                    disabled={isViewMode}
                    className="flex-1"
                  />
                  <Select
                    value={m.instrumento}
                    onValueChange={(v) => updMus(faixa.id, i, "instrumento", v)}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Instrumento" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTRUMENT_OPTS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isViewMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMus(faixa.id, i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {!isViewMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => addMus(faixa.id)}
                >
                  <Plus className="h-4 w-4" /> Adicionar Músico
                </Button>
              )}
            </div>

            <Separator />

            {/* AI-Assisted Materials — REQUIRED by DSPs */}
            <div className="space-y-2">
              <Label>Materiais com Uso de IA *</Label>
              <InfoBox>
                Escolha a opção que melhor descreve o processo criativo desta
                faixa. Declarações incorretas podem causar atrasos ou restrições
                nas DSPs.{" "}
                <a
                  href="#"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Saiba mais sobre classificação de uso de IA
                </a>
              </InfoBox>
              <Select
                value={faixa.aiAssistanceLevel}
                onValueChange={(v) => updF(faixa.id, "aiAssistanceLevel", v)}
                disabled={isViewMode}
              >
                <SelectTrigger data-cy="dropdown-ai-assistance-level">
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  {AI_ASSISTANCE_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Lyric info */}
            <div className="space-y-4">
              <Label>Informações de Letra</Label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={faixa.instrumental}
                  onCheckedChange={(checked) =>
                    updF(faixa.id, "instrumental", checked === true)
                  }
                  disabled={isViewMode}
                  data-cy="checkbox-instrumental-track"
                />
                <span className="text-sm">Faixa Instrumental (sem letra)</span>
              </label>

              {!faixa.instrumental && (
                <>
                  <div className="space-y-2">
                    <Label>Idioma da Faixa *</Label>
                    <Select
                      value={faixa.idioma}
                      onValueChange={(v) => updF(faixa.id, "idioma", v)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Selecione o idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        {IDIOMA_OPTS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Letra</Label>
                    <p className="text-xs text-muted-foreground">
                      Separe linhas com Enter. Separe estrofes com uma linha em
                      branco.
                    </p>
                    <Textarea
                      value={faixa.letra}
                      onChange={(e) => updF(faixa.id, "letra", e.target.value)}
                      placeholder="Letra da música..."
                      rows={5}
                      disabled={isViewMode}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Conteúdo Explícito *</Label>
                    <Select
                      value={faixa.explicit}
                      onValueChange={(v) => updF(faixa.id, "explicit", v)}
                      disabled={isViewMode}
                    >
                      <SelectTrigger
                        className="w-48"
                        data-cy="dropdown-explicit"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPLICIT_OPTS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* ISRC */}
            <div className="space-y-2">
              <Label>
                ISRC{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                value={faixa.isrc}
                onChange={(e) =>
                  updF(faixa.id, "isrc", e.target.value.toUpperCase())
                }
                placeholder="BR-ABC-26-00001"
                disabled={isViewMode}
                className="w-48 font-sans "
                maxLength={15}
                data-cy="input-isrc"
              />
            </div>

            {/* Artista da faixa */}
            <div className="space-y-2">
              <Label>
                Nome do Artista na Faixa{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (se diferente do artista principal)
                </span>
              </Label>
              <Input
                value={faixa.artista}
                onChange={(e) => updF(faixa.id, "artista", e.target.value)}
                placeholder="Nome do artista"
                disabled={isViewMode}
              />
            </div>

            {/* Audio upload */}
            <div className="space-y-2">
              <Label>Arquivo de Áudio</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() =>
                  !isViewMode &&
                  document.getElementById(`audio-${faixa.id}`)?.click()
                }
              >
                <p className="text-sm text-muted-foreground">
                  WAV (recomendado) ou MP3 — máx. 25 MB
                </p>
                {faixa.arquivoAudio ? (
                  <div className="mt-2">
                    <p className="text-sm text-foreground font-medium">
                      {faixa.arquivoAudio.name}
                      {faixa._uploading && " — enviando..."}
                      {!faixa._uploading && faixa.audioUrl && " — link gerado ✓"}
                    </p>
                    {!faixa._uploading && faixa.audioUrl && (
                      <a
                        href={faixa.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver link de download
                      </a>
                    )}
                  </div>
                ) : (
                  !isViewMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                    >
                      <Upload className="h-4 w-4" /> Selecionar Áudio
                    </Button>
                  )
                )}
                <input
                  id={`audio-${faixa.id}`}
                  type="file"
                  accept=".mp3,.wav"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFaixaAudioUpload(faixa.id, f);
                  }}
                  disabled={isViewMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {!isViewMode && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={addFaixa}
        >
          <Plus className="h-4 w-4" /> Adicionar Faixa
        </Button>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — ALBUM ART
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <Card className="bg-muted/30 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Upload da Arte do Álbum</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Preview */}
          <div className="shrink-0">
            <div className="w-44 h-44 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center relative">
              {capaPrincipal ? (
                <>
                  <img
                    src={URL.createObjectURL(capaPrincipal)}
                    alt="Capa"
                    className="w-full h-full object-cover"
                  />
                  {isUploadingCover && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                    </div>
                  )}
                </>
              ) : formData.assetCapaUrl ? (
                <img
                  src={safeImageSrc(formData.assetCapaUrl)}
                  alt="Capa"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              )}
            </div>
          </div>

          {/* Requirements + Upload */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="font-semibold text-sm mb-2">Requisitos de Upload</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>
                  Formato: <strong>JPG, PNG</strong> (WebP não aceito)
                </li>
                <li>
                  Tamanho mínimo: <strong>3000 × 3000 pixels</strong>
                </li>
                <li>
                  Tamanho máximo do arquivo: <strong>35 MB</strong>
                </li>
                <li>
                  Modo de cor: <strong>RGB</strong> (incluindo preto e branco)
                </li>
                <li>
                  Resolução: <strong>72 dpi</strong>
                </li>
                <li>
                  A capa <strong>não pode conter</strong> logotipos, URLs, datas
                  de lançamento ou anúncios de qualquer type.
                </li>
              </ul>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() =>
                !isViewMode && !isUploadingCover &&
                document.getElementById("capa-principal")?.click()
              }
            >
              {isUploadingCover ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Enviando capa…</p>
                </div>
              ) : capaPrincipal ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium">{capaPrincipal.name}</p>
                  {!isViewMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCapaPrincipal(null);
                        setFormData((prev) => ({ ...prev, assetCapaUrl: "" }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : formData.assetCapaUrl ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium truncate max-w-[200px]">Capa salva</p>
                  {!isViewMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, assetCapaUrl: "" }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Clique para selecionar ou arraste e solte
                  </p>
                  {!isViewMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" /> Selecionar Capa
                    </Button>
                  )}
                </>
              )}
            </div>

            <input
              id="capa-principal"
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCoverUpload(f);
              }}
              disabled={isViewMode || isUploadingCover}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — DISTRIBUTION PREFERENCES
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep3 = () => {
    return (
      <div className="space-y-6">
        {/* Distribuidora */}
        <Card className="bg-muted/30 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuidora</CardTitle>
            <CardDescription>
              Opcional. Sem plataforma conectada, o lançamento é salvo para controle interno.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasAnyConnected ? (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Nenhuma plataforma de distribuição conectada. Este lançamento
                  será salvo apenas para controle interno.
                </span>
              </div>
            ) : (
              <Select
                value={formData.distribuidora}
                onValueChange={(v) =>
                  setFormData({ ...formData, distribuidora: v })
                }
                disabled={isViewMode}
              >
                <SelectTrigger data-testid="select-distribuidora">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Selecione uma distribuidora conectada" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {connectedDistributors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(() => {
              const sel = connectedDistributors.find(
                (d) => d.id === formData.distribuidora,
              );
              if (!sel) return null;
              const conn = sel.username ? { username: sel.username } : null;
              return (
                <div className="border border-border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Music className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{sel.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sel.description}
                      </p>
                      {conn?.username && (
                        <p className="text-xs text-muted-foreground">
                          Conta: {conn.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> Conectado
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Release Preferences */}
        <Card className="bg-muted/30 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Preferências de Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Territory */}
            <div className="space-y-2">
              <Label>Território</Label>
              <Select
                value={extraFields.territory}
                onValueChange={(v) => setExtra("territory", v)}
                disabled={isViewMode}
              >
                <SelectTrigger className="w-72" data-cy="dropdown-territory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="world">World (Global)</SelectItem>
                  <SelectItem value="br">Brasil</SelectItem>
                  <SelectItem value="us">Estados Unidos</SelectItem>
                  <SelectItem value="latam">América Latina</SelectItem>
                  <SelectItem value="eu">Europa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Info box */}
            <InfoBox>
              <strong>Data de Lançamento:</strong> Defina com pelo menos 21 dias
              de antecedência para anunciar o lançamento, compartilhar o
              pré-save e fazer o pitching para playlists.
              <br />
              <br />
              <strong>Hora:</strong> O lançamento estará disponível a partir de
              00h em cada território.
              <br />
              <br />
              <strong>Importante:</strong> A Apple não permite lançamentos com
              hora agendada — seu álbum estará disponível à 00h em cada país no
              Apple Music e iTunes.
            </InfoBox>

            {/* Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Lançamento</Label>
                <DatePickerField
                  value={formData.dataLancamento}
                  onChange={(iso) =>
                    setFormData({ ...formData, dataLancamento: iso })
                  }
                  disabled={isViewMode}
                  placeholder="DD/MM/YYYY"
                  displayFormat="dd/MM/yyyy"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Hora de Lançamento{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </Label>
                <Input
                  type="time"
                  value={extraFields.releaseTime}
                  onChange={(e) => setExtra("releaseTime", e.target.value)}
                  disabled={isViewMode}
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label>
                Fuso Horário{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Select
                value={extraFields.releaseTimezone}
                onValueChange={(v) => setExtra("releaseTimezone", v)}
                disabled={isViewMode}
              >
                <SelectTrigger
                  className="w-full max-w-md"
                  data-cy="dropdown-release-timezone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pre-order */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={extraFields.preOrder}
                  onCheckedChange={(checked) => setExtra("preOrder", checked === true)}
                  disabled={isViewMode}
                />
                <span className="text-sm font-medium">Pre-order</span>
              </label>
              {extraFields.preOrder && (
                <label className="flex items-center gap-2 cursor-pointer pl-6">
                  <Checkbox
                    checked={extraFields.noPreviewsDuringPreOrder}
                    onCheckedChange={(checked) =>
                      setExtra("noPreviewsDuringPreOrder", checked === true)
                    }
                    disabled={isViewMode}
                  />
                  <span className="text-sm">
                    Sem prévias durante o pré-lançamento
                  </span>
                </label>
              )}
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <Label>Precificação</Label>
              <InfoBox>Instruções de precificação.</InfoBox>
              <Select
                value={extraFields.pricing}
                onValueChange={(v) => setExtra("pricing", v)}
                disabled={isViewMode}
              >
                <SelectTrigger className="w-48" data-cy="dropdown-pricing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-muted/30 border-border">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <Label>Notas de Distribuição</Label>
              <Textarea
                value={formData.notasDistribuicao ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notasDistribuicao: e.target.value,
                  })
                }
                placeholder="Notas especiais (ex: data preferencial, territórios, exclusividades...)"
                rows={3}
                disabled={isViewMode}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — PREVIEW / DISTRIBUTE
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep4 = () => {
    const artistaNome =
      artistaLabel || (extraFields.variosArtistas ? "Various Artists" : "—");

    const warnings: string[] = [];
    if (!formData.title.trim()) warnings.push("Título do lançamento ausente.");
    if (!extraFields.variosArtistas && !formData.artist_id)
      warnings.push("Artista principal não selecionado.");
    if (!formData.genero) warnings.push("Gênero principal não informado.");
    if (!extraFields.generoSecundario)
      warnings.push("Gênero secundário não informado.");
    if (!formData.gravadora) warnings.push("Gravadora / Selo não informado.");
    if (!extraFields.copyrightDataLancamento)
      warnings.push("Ano de copyright (lançamento) ausente.");
    if (!extraFields.copyrightDataGravacao)
      warnings.push("Ano de copyright (gravação) ausente.");
    if (!capaPrincipal) warnings.push("Capa do álbum não enviada.");
    if (!formData.dataLancamento)
      warnings.push("Data de lançamento não definida.");
    faixas.forEach((f, i) => {
      if (!f.title.trim()) warnings.push(`Faixa ${i + 1}: título ausente.`);
      if (!f.aiAssistanceLevel)
        warnings.push(`Faixa ${i + 1}: AI-Assisted Materials não declarado.`);
    });

    return (
      <div className="space-y-6">
        <Card className="bg-muted/30 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévia do Lançamento</CardTitle>
            <CardDescription>
              Aqui está como seu álbum será exibido nas plataformas. Caso veja
              erros, volte às etapas anteriores para editar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-6 mb-4">
              <div className="shrink-0">
                {capaPrincipal ? (
                  <img
                    src={URL.createObjectURL(capaPrincipal)}
                    alt="Capa"
                    className="w-36 h-36 rounded-lg object-cover border border-border"
                  />
                ) : formData.assetCapaUrl ? (
                  <img
                    src={safeImageSrc(formData.assetCapaUrl)}
                    alt="Capa"
                    className="w-36 h-36 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-lg border border-border bg-muted/50 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-bold">
                    {formData.title || "—"}
                    {formData.type ? ` — ${formData.type.toUpperCase()}` : ""}
                  </h3>
                  <p className="text-muted-foreground">por {artistaNome}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Gravadora:</span>
                  <span>{formData.gravadora || "—"}</span>

                  <span className="text-muted-foreground">Gêneros:</span>
                  <span>
                    {[
                      GENERO_LABELS[formData.genero] ?? formData.genero,
                      GENERO_LABELS[extraFields.generoSecundario] ??
                        extraFields.generoSecundario,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>

                  <span className="text-muted-foreground">
                    Data de Lançamento:
                  </span>
                  <span>{formatReleaseDate(formData.dataLancamento) || "—"}</span>

                  {extraFields.releaseTime && (
                    <>
                      <span className="text-muted-foreground">Hora:</span>
                      <span>{extraFields.releaseTime}</span>
                    </>
                  )}

                  <span className="text-muted-foreground">Fuso horário:</span>
                  <span>
                    {TIMEZONE_OPTS.find(
                      (t) => t.value === extraFields.releaseTimezone,
                    )?.label ?? extraFields.releaseTimezone}
                  </span>

                  <span className="text-muted-foreground">Território:</span>
                  <span>{extraFields.territory}</span>

                  {formData.codigoUPC && (
                    <>
                      <span className="text-muted-foreground">UPC:</span>
                      <span className="font-sans">{formData.codigoUPC}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Track list */}
            <div className="space-y-1">
              {faixas.map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <span className="text-muted-foreground text-sm w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {f.title || "Sem título"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.artista || artistaNome}
                    </p>
                  </div>
                  {f.isrc && (
                    <span className="text-xs text-muted-foreground font-sans shrink-0">
                      {f.isrc}
                    </span>
                  )}
                  {f.explicit === "yes" && (
                    <span className="text-xs border border-border rounded px-1 shrink-0">
                      E
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Copyright lines */}
            {(extraFields.copyrightDataLancamento ||
              extraFields.copyrightDataGravacao) && (
              <>
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground space-y-1">
                  {extraFields.copyrightDataLancamento && (
                    <p>
                      © {extraFields.copyrightDataLancamento}{" "}
                      {formData.gravadora || formData.copyright}
                    </p>
                  )}
                  {extraFields.copyrightDataGravacao && (
                    <p>
                      ℗ {extraFields.copyrightDataGravacao}{" "}
                      {formData.gravadora || formData.copyright}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Validation summary */}
        {warnings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Tudo certo! O lançamento está pronto para ser criado.
          </div>
        ) : (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 mb-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {warnings.length} alerta(s) encontrado(s):
            </div>
            {warnings.map((w, i) => (
              <p
                key={i}
                className="text-xs text-yellow-700 pl-6"
              >
                • {w}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const stepContent = [
    renderStep0,
    renderStep1,
    renderStep2,
    renderStep3,
    renderStep4,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Novo Lançamento"
              : mode === "edit"
                ? "Editar Lançamento"
                : "Detalhes do Lançamento"}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator current={currentStep} />

        <div>{stepContent[currentStep]?.()}</div>

        <DialogFooter className="mt-6 flex flex-row justify-between sm:justify-between gap-2">
          {/* Back / Cancel */}
          <Button
            type="button"
            variant="outline"
            className="gap-1"
            onClick={currentStep === 0 ? () => onOpenChange(false) : handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? "Cancelar" : STEPS[currentStep - 1]}
          </Button>

          {/* Next / Submit */}
          <div className="flex gap-2">
            {currentStep < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} className="gap-1">
                {STEPS[currentStep + 1]}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : !isViewMode ? (
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/90"
                disabled={isUploadingCover}
              >
                {isUploadingCover
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando capa…</>
                  : mode === "create" ? "Criar Lançamento" : "Salvar Alterações"
                }
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

