import { useState, useEffect, useRef } from "react";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import { MUSICAL_GENRE_LABELS } from "@/constants/musicalGenres";
import { LANGUAGE_LABELS } from "@/constants/languages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Switch } from "@/shared/ui/switch";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ChevronDown,
  Trash2,
  X,
  Briefcase,
  Eye,
} from "lucide-react";
import type { ProjectWithRelations as ProjetoWithRelations } from "@/modules/projects/hooks/useProjects";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { ParticipanteViewModal } from "@/modules/catalog/components/ParticipanteViewModal";
import { useObras } from "@/modules/catalog/hooks/useObras";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import { useDebounce } from "@/shared/hooks/useDebounce";
import type { TipoObra } from "@/modules/catalog/components/ObraTipoSelectorModal";
import {
  dbStatusToSelect,
  parseDuracao,
  obraToParticipantes,
  obraTitle,
  obraOutrosTitulos,
  obraReferenciasConexas,
  obraLetraCompleta,
  obraCriadaPorIA,
  obraTipoIAValue,
  obraIaHarmonia,
  obraIaMelodia,
  obraIaLetra,
  obraToFormFields,
  formToObraPayload,
} from "@/modules/catalog/mappers";
import { obraSchema } from "@/modules/catalog/lib/obra-schema";

// ── Autocomplete: busca server-side por nome_artistico/nome_civil (Task I —
// antes filtrava só os primeiros 50 artistas do tenant, carregados via
// useArtistas() sem filtro; agora cada tecla digitada (debounced) refaz a
// busca no backend, alcançando qualquer artista do tenant). Texto livre
// continua permitido — nem todo participante precisa estar cadastrado.
interface ArtistNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (a: { id: string; stageName: string; nome_civil?: string | null }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function ArtistNameInput({ value, onChange, onSelect, placeholder, disabled }: ArtistNameInputProps) {
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
    <div ref={containerRef} className="relative w-full">
      <Input
        value={inputText}
        onChange={handleChange}
        onFocus={() => inputText.trim() && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="min-w-0"
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

export const ObraTipoBadge = ({
  type,
}: {
  type?: TipoObra | string | null;
}) => {
  if (type === "autoral") {
    return (
      <Badge variant="info" data-testid="badge-type-obra-autoral">
        Obra Autoral
      </Badge>
    );
  }
  return (
    <Badge variant="warning" data-testid="badge-type-obra-referencia">
      Obra por Referência
    </Badge>
  );
};

interface ProjetoSelecionado {
  id: string;
  nome: string;
  artistaNome?: string | null;
}

interface ObraFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
  mode: "create" | "edit" | "view";
  /**
   * Tipo da obra escolhido no seletor (Task #288). Quando informado,
   * força a classificação no cabeçalho. Em modo "edit"/"view" é
   * derivado do registro `obra.tipo_obra`.
   */
  tipoObra?: TipoObra;
  /** Chamado após salvar com sucesso — usado para abrir modal de contrato pré-preenchido */
  onSaved?: (info: { title: string; notes: string }) => void;
}

interface Participante {
  id: string;
  nome: string;
  classeFuncao: string;
  link: string;
  percentual: string;
  artist_id?: string;
}

interface IAElement {
  ferramenta: string;
  prompt: string;
}

const generosMusicais = MUSICAL_GENRE_LABELS;
const idiomas = LANGUAGE_LABELS;
const situacoes = ["Em Análise", "Pendente", "Registrado", "Rejeitado"];
const classesFuncao = [
  "Editor",
  "Administrador",
  "Compositor/Autor",
  "Tradutor",
];

export function ObraFormModal({
  open,
  onOpenChange,
  obra,
  mode,
  tipoObra: tipoObraProp,
  onSaved,
}: ObraFormModalProps) {
  const { addObra, updateObra } = useObras();
  const { orgId } = useCurrentOrgId();

  // Resolução do type da obra. Em criação vem do seletor (prop). Em
  // edição/visualização vem do próprio registro. Default = referencia.
  const tipoObra: TipoObra = (tipoObraProp ??
    (obra?.tipo_obra as TipoObra | undefined) ??
    "referencia") as TipoObra;
  const [projetoSelecionado, setProjetoSelecionado] =
    useState<ProjetoSelecionado | null>(null);
  const [buscaProjeto, setBuscaProjeto] = useState("");
  const debouncedBuscaProjeto = useDebounce(buscaProjeto, 300);
  const [buscaProjetoOpen, setBuscaProjetoOpen] = useState(false);
  const initialDuracao = parseDuracao(obra?.duracao);
  const [codEcad, setCodEcad] = useState(obra?.cod_ecad ?? obra?.codEcad ?? "");
  const [codEntidade, setCodEntidade] = useState(
    obra?.cod_entidade ?? obra?.codEntidade ?? "",
  );
  const [iswc, setIswc] = useState(obra?.iswc || "");
  const [tituloObra, setTitleObra] = useState(obraTitle(obra));
  const [situacao, setSituacao] = useState(dbStatusToSelect(obra?.status));
  const [generoMusical, setGeneroMusical] = useState(
    obra?.genero?.toLowerCase() || "",
  );
  const [idioma, setIdioma] = useState(obra?.idioma || "");
  const [duracaoMin, setDuracaoMin] = useState(
    obra?.duracaoMin ?? initialDuracao.min,
  );
  const [duracaoSeg, setDuracaoSeg] = useState(
    obra?.duracaoSeg ?? initialDuracao.seg,
  );
  const [instrumental, setInstrumental] = useState(obra?.instrumental || "nao");
  const [criadaPorIA, setCriadaPorIA] = useState(() => obraCriadaPorIA(obra));
  const [tipoIA, setTipoIA] = useState(() => obraTipoIAValue(obra));
  const [iaHarmonia, setIaHarmonia] = useState<IAElement>(() => obraIaHarmonia(obra));
  const [iaMelodia, setIaMelodia] = useState<IAElement>(() => obraIaMelodia(obra));
  const [iaLetra, setIaLetra] = useState<IAElement>(() => obraIaLetra(obra));
  const [participantes, setParticipantes] = useState<Participante[]>(() =>
    obraToParticipantes(obra),
  );
  const [outrosTitulos, setOutrosTitulos] = useState<string[]>(() => obraOutrosTitulos(obra));
  const [referenciasConexas, setReferenciasConexas] = useState<string[]>(() => obraReferenciasConexas(obra));
  const [letraCompleta, setLetraCompleta] = useState(() => obraLetraCompleta(obra));
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [viewArtista, setViewArtista] = useState<Artist | null>(null);

  // Sync state whenever the modal opens or the obra record changes
  useEffect(() => {
    if (!open) return;
    const f = obraToFormFields(obra);
    setBuscaProjeto("");
    setBuscaProjetoOpen(false);
    setTitleObra(f.title);
    setSituacao(f.situacao);
    setGeneroMusical(f.generoMusical);
    setIdioma(f.idioma);
    setDuracaoMin(f.duracaoMin);
    setDuracaoSeg(f.duracaoSeg);
    setInstrumental(f.instrumental);
    setCodEcad(f.codEcad);
    setCodEntidade(f.codEntidade);
    setIswc(f.iswc);
    setCriadaPorIA(f.criadaPorIA);
    setTipoIA(f.tipoIA);
    setIaHarmonia(f.iaHarmonia);
    setIaMelodia(f.iaMelodia);
    setIaLetra(f.iaLetra);
    setParticipantes(f.participantes);
    setOutrosTitulos(f.outrosTitulos);
    setReferenciasConexas(f.referenciasConexas);
    setLetraCompleta(f.letraCompleta);
    setAceitaTermos(false);
  }, [open, obra]);

  // Hidrata o projeto vinculado a partir de obra.project_id — busca DIRETO por
  // ID (GET /projects/:id), não depende do projeto estar entre os primeiros
  // registros carregados (Task J: antes usava useProjetos() sem filtro, que
  // truncava em 50 projetos por tenant).
  const linkedProjectId: string | undefined = obra?.project_id ?? obra?.projectId;
  const { entity: linkedProjeto } = useEntityById<ProjetoWithRelations>(
    "projects",
    open ? linkedProjectId : undefined,
  );
  useEffect(() => {
    if (!open) return;
    if (!linkedProjectId) {
      setProjetoSelecionado(null);
      return;
    }
    if (linkedProjeto) {
      setProjetoSelecionado({
        id: linkedProjeto.id,
        nome: linkedProjeto.title ?? (linkedProjeto.nome as string) ?? "",
        artistaNome: (linkedProjeto.artistas?.nome_artistico ?? null) as string | null,
      });
    } else {
      // Ainda carregando — mantém ID com placeholder até a busca por ID resolver.
      setProjetoSelecionado({ id: linkedProjectId, nome: "Projeto vinculado" });
    }
  }, [open, linkedProjectId, linkedProjeto]);

  // Busca server-side de projetos concluídos (Task J) — antes filtrava
  // localmente só os primeiros 50 projetos do tenant carregados via
  // useProjetos() sem filtro; agora cada tecla digitada (debounced
  // internamente) refaz a busca no backend, alcançando qualquer projeto
  // concluído do tenant.
  const { items: projetosConcluidosFiltrados } = useEntityLookup<ProjetoWithRelations>({
    table: "projects",
    search: buscaProjeto,
    filters: { status: "concluido" },
    enabled: buscaProjetoOpen,
  });

  const [participacaoOpen, setParticipacaoOpen] = useState(true);
  const [outrosTitulosOpen, setOutrosTitulosOpen] = useState(false);
  const [referenciasOpen, setReferenciasOpen] = useState(false);
  const [letraOpen, setLetraOpen] = useState(true);

  const isViewMode = mode === "view";
  const title =
    mode === "create"
      ? "Nova Obra"
      : mode === "edit"
        ? "Editar Música"
        : "Detalhes da Obra";

  const calcularPercentualTotal = () => {
    return participantes.reduce(
      (total, p) => total + (parseFloat(p.percentual) || 0),
      0,
    );
  };

  const addParticipante = () => {
    setParticipantes([
      ...participantes,
      {
        id: crypto.randomUUID(),
        nome: "",
        classeFuncao: "",
        link: "",
        percentual: "",
      },
    ]);
  };

  const updateParticipante = (
    id: string,
    field: keyof Participante,
    value: string,
  ) => {
    setParticipantes(
      participantes.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const removeParticipante = (id: string) => {
    setParticipantes(participantes.filter((p) => p.id !== id));
  };

  const addOutroTitulo = () => {
    setOutrosTitulos([...outrosTitulos, ""]);
  };

  const updateOutroTitulo = (index: number, value: string) => {
    const newTitulos = [...outrosTitulos];
    newTitulos[index] = value;
    setOutrosTitulos(newTitulos);
  };

  const removeOutroTitulo = (index: number) => {
    setOutrosTitulos(outrosTitulos.filter((_, i) => i !== index));
  };

  const addReferenciaConexas = () => {
    setReferenciasConexas([...referenciasConexas, ""]);
  };

  const updateReferenciaConexas = (index: number, value: string) => {
    const newRefs = [...referenciasConexas];
    newRefs[index] = value;
    setReferenciasConexas(newRefs);
  };

  const removeReferenciaConexas = (index: number) => {
    setReferenciasConexas(referenciasConexas.filter((_, i) => i !== index));
  };

  const duracaoMinNum = Number(duracaoMin);
  const duracaoSegNum = Number(duracaoSeg);
  const duracaoMinError =
    duracaoMin !== "" && (!Number.isInteger(duracaoMinNum) || duracaoMinNum < 0)
      ? "Minutos não pode ser negativo"
      : null;
  const duracaoSegError =
    duracaoSeg !== "" &&
    (!Number.isInteger(duracaoSegNum) ||
      duracaoSegNum < 0 ||
      duracaoSegNum > 59)
      ? "Segundos deve estar entre 0 e 59"
      : null;
  const hasDuracaoError = !!(duracaoMinError || duracaoSegError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDuracaoError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    const validation = obraSchema.safeParse({
      tituloObra,
      generoMusical,
      idioma,
      situacao,
      iswc,
      codEcad,
      codEntidade,
      duracaoMin: String(duracaoMin),
      duracaoSeg: String(duracaoSeg),
      instrumental: instrumental as "sim" | "nao",
      criadaPorIA,
      letraCompleta,
      aceitaTermos,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!orgId) {
      toast.error(
        "Não foi possível identificar sua organização. Tente novamente.",
      );
      return;
    }

    const payload = formToObraPayload({
      title: tituloObra,
      generoMusical,
      idioma,
      iswc,
      codEcad,
      codEntidade,
      duracaoMin,
      duracaoSeg,
      instrumental,
      criadaPorIA,
      tipoIA,
      iaHarmonia,
      iaMelodia,
      iaLetra,
      outrosTitulos,
      referenciasConexas,
      letraCompleta,
      participantes,
      situacao,
      projectId: projetoSelecionado?.id ?? null,
      artistId: null,
      tipoObra,
      orgId: orgId as string,
    });

    try {
      if (mode === "edit" && obra?.id) {
        await updateObra.mutateAsync({ id: obra.id, ...payload, expectedUpdatedAt: getExpectedUpdatedAt(obra) });
      } else {
        await addObra.mutateAsync(payload as any);
      }

      onOpenChange(false);

      // Abre modal de contrato pré-preenchido após fechar o modal de obra
      const dataHoje = new Date().toISOString().split("T")[0];
      const linhasParticipantes = participantes
        .filter((p) => p.nome || p.classeFuncao)
        .map((p) => {
          const partes = [p.nome, p.classeFuncao, p.percentual ? `${p.percentual}%` : ""].filter(Boolean);
          return partes.join(" – ");
        });
      const obsLinhas: string[] = [
        `Obra: ${tituloObra}`,
        iswc ? `ISWC: ${iswc}` : null,
        generoMusical ? `Gênero: ${generoMusical}` : null,
        `Data: ${dataHoje}`,
        linhasParticipantes.length > 0 ? "" : null,
        linhasParticipantes.length > 0 ? "Participantes:" : null,
        ...linhasParticipantes,
      ].filter((l): l is string => l !== null);

      onSaved?.({
        title: `Cessão de Obras – ${tituloObra}`,
        notes: obsLinhas.join("\n"),
      });
    } catch (err) {
      if (handleConcurrencyConflict(err, "obra")) return;
      // demais erros já são exibidos via toast pelo hook useDataQuery.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{title}</DialogTitle>
            <ObraTipoBadge type={tipoObra} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Vincular a Projeto Concluído */}
          <div className="border border-border rounded-lg p-5 space-y-3 bg-muted/10">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                Vincular a Projeto Concluído
              </span>
            </div>

            {projetoSelecionado ? (
              <div
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                data-testid="projeto-vinculado-card"
              >
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    data-testid="text-projeto-vinculado-nome"
                  >
                    {projetoSelecionado.nome}
                  </p>
                  {projetoSelecionado.artistaNome && (
                    <p className="text-xs text-muted-foreground truncate">
                      {projetoSelecionado.artistaNome}
                    </p>
                  )}
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setProjetoSelecionado(null)}
                    data-testid="button-remove-projeto-vinculado"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Popover
                open={buscaProjetoOpen}
                onOpenChange={setBuscaProjetoOpen}
              >
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={buscaProjeto}
                      onChange={(e) => {
                        setBuscaProjeto(e.target.value);
                        setBuscaProjetoOpen(true);
                      }}
                      onFocus={() => !isViewMode && setBuscaProjetoOpen(true)}
                      onClick={() => !isViewMode && setBuscaProjetoOpen(true)}
                      disabled={isViewMode}
                      placeholder="Digite para buscar um projeto concluído..."
                      className="pl-10"
                      data-testid="input-buscar-projeto"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[480px] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <ScrollArea className="max-h-[320px]">
                    <div className="p-2" role="listbox">
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        {buscaProjeto
                          ? `Resultados para "${buscaProjeto}"`
                          : "Projetos concluídos disponíveis"}
                      </p>
                      {projetosConcluidosFiltrados.length > 0 ? (
                        (projetosConcluidosFiltrados as ProjetoWithRelations[]).map((p) => {
                          const pId = p.id as string;
                          const pNomeDisplay = (p.title ??
                            (p as { nome?: string }).nome ??
                            "") as string;
                          const pArtistaNomeDisplay = (p.artistas?.nome_artistico ?? "") as string;
                          const selectProjeto = async () => {
                            setProjetoSelecionado({
                              id: pId,
                              nome: pNomeDisplay,
                              artistaNome: pArtistaNomeDisplay || null,
                            });
                            // Auto-fill fields from project registration
                            if (!tituloObra && p.title) setTitleObra(p.title as string);
                            if (p.genero) {
                              const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                              const generoRaw = p.genero as string;
                              const matched = generosMusicais.find(g => norm(g) === norm(generoRaw));
                              setGeneroMusical(matched ? matched.toLowerCase() : generoRaw.toLowerCase());
                            }
                            // Resolve artista por ID direto \u2014 n\u00e3o depende do artista estar
                            // entre os primeiros registros carregados (Task J).
                            const artistId = p.artist_id as string | null | undefined;
                            const artistaFoundWire = artistId
                              ? await storage.findById<ArtistWireRecord>("artistas", artistId)
                              : undefined;
                            const artistaFound = artistaFoundWire ? wireToArtist(artistaFoundWire) : undefined;
                            const artistaNomeResolved = artistaFound?.stageName || pArtistaNomeDisplay;
                            // Parse descricao JSON for composers/producers from project songs
                            let autoParticipantes: Participante[] = [];
                            try {
                              const musicas = JSON.parse(p.descricao as string || "[]");
                              if (Array.isArray(musicas) && musicas.length > 0) {
                                const seen = new Set<string>();
                                const compositoresArr: string[] = musicas
                                  .flatMap((m: any) => m.compositores || [])
                                  .filter((nome: string) => { const k = nome.trim(); return k && !seen.has(k) && seen.add(k); });
                                autoParticipantes = compositoresArr.map((nome: string) => ({
                                  id: crypto.randomUUID(),
                                  nome: nome.trim(),
                                  classeFuncao: "compositor/autor",
                                  link: "",
                                  percentual: "",
                                }));
                              }
                            } catch {}
                            // Fallback: use resolved artista name as single compositor
                            if (autoParticipantes.length === 0 && artistaNomeResolved) {
                              autoParticipantes = [{
                                id: crypto.randomUUID(),
                                nome: artistaNomeResolved,
                                classeFuncao: "compositor/autor",
                                link: "",
                                percentual: "100",
                                artist_id: artistId ?? undefined,
                              }];
                            }
                            if (autoParticipantes.length > 0 && participantes.length === 0) {
                              setParticipantes(autoParticipantes);
                            }
                            setBuscaProjeto("");
                            setBuscaProjetoOpen(false);
                            toast.success(
                              `Projeto "${pNomeDisplay}" vinculado! Campos preenchidos automaticamente.`,
                            );
                          };
                          return (
                            <div
                              key={pId}
                              role="option"
                              tabIndex={0}
                              aria-selected={(projetoSelecionado as ProjetoSelecionado | null)?.id === pId}
                              className="flex items-center gap-3 p-2 hover:bg-muted focus:bg-muted focus:outline-none rounded-lg cursor-pointer transition-colors"
                              onClick={selectProjeto}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectProjeto();
                                }
                              }}
                              data-testid={`option-projeto-${p.id}`}
                            >
                              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-primary-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {pNomeDisplay}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {pArtistaNomeDisplay || "—"}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p
                          className="text-sm text-muted-foreground text-center py-4"
                          data-testid="text-empty-projetos"
                        >
                          Nenhum projeto concluído encontrado.
                        </p>
                      )}
                      <AbramusSearchRow
                        kind="obras"
                        query={debouncedBuscaProjeto}
                        onImported={() => {
                          setBuscaProjeto("");
                          setBuscaProjetoOpen(false);
                        }}
                      />
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Dados Principais da Obra */}
          <div className="border border-border rounded-lg p-5 bg-muted/10">
            <h3 className="font-semibold text-sm mb-4">
              Dados Principais da Obra
            </h3>
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Código de Cadastro da Entidade — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Código de Cadastro da Sociedade
                </span>
                <Input
                  className="h-8 text-sm min-w-0"
                  value={codEntidade}
                  onChange={(e) => setCodEntidade(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* Código ECAD — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Código ECAD
                </span>
                <Input
                  className="h-8 text-sm min-w-0"
                  value={codEcad}
                  onChange={(e) => setCodEcad(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* ISWC — col-span-3 | Row 1 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  ISWC
                </span>
                <Input
                  className="h-8 text-sm min-w-0"
                  value={iswc}
                  onChange={(e) => setIswc(e.target.value)}
                  disabled={isViewMode}
                  placeholder="T-123.456.789-0"
                />
              </div>

              {/* Título da Obra — col-span-3 | Row 1 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Título da Obra *
                </span>
                <Input
                  className="h-8 text-sm min-w-0"
                  value={tituloObra}
                  onChange={(e) => setTitleObra(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* Gênero Musical — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Gênero Musical
                </span>
                <Select
                  value={generoMusical}
                  onValueChange={setGeneroMusical}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {generosMusicais.map((g) => (
                      <SelectItem key={g} value={g.toLowerCase()}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Idioma — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Idioma
                </span>
                <Select
                  value={idioma}
                  onValueChange={setIdioma}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {idiomas.map((i) => (
                      <SelectItem key={i} value={i.toLowerCase()}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duração — col-span-3 | Row 2 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Duração
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${duracaoMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    min
                  </span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${duracaoSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={duracaoSeg}
                    onChange={(e) => setDuracaoSeg(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    seg
                  </span>
                </div>
                {(duracaoMinError || duracaoSegError) && (
                  <p className="text-xs text-destructive">
                    {duracaoMinError || duracaoSegError}
                  </p>
                )}
              </div>

              {/* Instrumental — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Instrumental?
                </span>
                <div className="flex items-center h-8">
                  <Switch
                    checked={instrumental === "sim"}
                    onCheckedChange={(v) => setInstrumental(v ? "sim" : "nao")}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Criada por IA — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Criada por IA?
                </span>
                <div className="flex items-center h-8">
                  <Switch
                    checked={criadaPorIA === "sim"}
                    onCheckedChange={(v) => setCriadaPorIA(v ? "sim" : "nao")}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Situação — col-span-3 | Row 2 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Situação
                </span>
                <Select
                  value={situacao}
                  onValueChange={setSituacao}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {situacoes.map((s) => (
                      <SelectItem
                        key={s}
                        value={s.toLowerCase().replace(/ /g, "_")}
                      >
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Criado por IA Generativa - Condicional */}
          {criadaPorIA === "sim" && (
            <div className="border border-border rounded-lg p-6 space-y-5 bg-muted/10">
              <h3 className="font-semibold">Criado por IA Generativa</h3>

              <RadioGroup
                value={tipoIA}
                onValueChange={setTipoIA}
                className="flex gap-6"
                disabled={isViewMode}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="totalmente"
                    id="ia_total"
                    className="border-primary text-primary"
                  />
                  <label htmlFor="ia_total" className="text-sm">
                    A obra foi totalmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parcialmente" id="ia_parcial" />
                  <label htmlFor="ia_parcial" className="text-sm">
                    A obra foi parcialmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
              </RadioGroup>

              {tipoIA && (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Elementos da obra musical criados por inteligência
                    artificial generativa:
                  </p>

                  {/* Harmonia */}
                  <div className="space-y-2">
                    <Label className="font-semibold">HARMONIA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaHarmonia.ferramenta}
                          onChange={(e) =>
                            setIaHarmonia({
                              ...iaHarmonia,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaHarmonia.prompt}
                            onChange={(e) =>
                              setIaHarmonia({
                                ...iaHarmonia,
                                prompt: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaHarmonia({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Melodia */}
                  <div className="space-y-2">
                    <Label className="font-semibold">MELODIA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaMelodia.ferramenta}
                          onChange={(e) =>
                            setIaMelodia({
                              ...iaMelodia,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaMelodia.prompt}
                            onChange={(e) =>
                              setIaMelodia({
                                ...iaMelodia,
                                prompt: e.target.value,
                              })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaMelodia({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Letra */}
                  <div className="space-y-2">
                    <Label className="font-semibold">LETRA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={iaLetra.ferramenta}
                          onChange={(e) =>
                            setIaLetra({
                              ...iaLetra,
                              ferramenta: e.target.value,
                            })
                          }
                          disabled={isViewMode}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Prompt
                          </Label>
                          <Input
                            value={iaLetra.prompt}
                            onChange={(e) =>
                              setIaLetra({ ...iaLetra, prompt: e.target.value })
                            }
                            disabled={isViewMode}
                            placeholder="Prompt utilizado"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() =>
                            setIaLetra({ ferramenta: "", prompt: "" })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participação */}
          <Collapsible
            open={participacaoOpen}
            onOpenChange={setParticipacaoOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Participação</span>
                  <span className="text-sm text-muted-foreground">
                    Percentual total: {calcularPercentualTotal().toFixed(2)}% de
                    100%
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${participacaoOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addParticipante}
                    disabled={isViewMode}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar participante
                  </Button>
                </div>

                {participantes.length > 0 ? (
                  <div className="space-y-3">
                    {participantes.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 gap-3 items-end"
                      >
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Nome *</Label>
                          <ArtistNameInput
                            value={p.nome}
                            onChange={(val) => updateParticipante(p.id, "nome", val)}
                            onSelect={(a) => updateParticipante(p.id, "artist_id", a.id)}
                            placeholder="Nome do participante"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Classe/Função *</Label>
                          <Select
                            value={p.classeFuncao}
                            onValueChange={(v) =>
                              updateParticipante(p.id, "classeFuncao", v)
                            }
                            disabled={isViewMode}
                          >
                            <SelectTrigger className="min-w-0">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {classesFuncao.map((c) => (
                                <SelectItem key={c} value={c.toLowerCase()}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Link</Label>
                          <Input
                            value={p.link}
                            onChange={(e) =>
                              updateParticipante(p.id, "link", e.target.value)
                            }
                            disabled={isViewMode}
                            placeholder="Link 1"
                            className="min-w-0"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">% Part. *</Label>
                          <Input
                            value={p.percentual}
                            onChange={(e) =>
                              updateParticipante(
                                p.id,
                                "percentual",
                                e.target.value,
                              )
                            }
                            disabled={isViewMode}
                            placeholder="100"
                            type="number"
                            className="min-w-0"
                          />
                        </div>
                        <div className="col-span-1 flex items-end gap-0.5 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Visualizar participante"
                            disabled={!p.nome}
                            onClick={async () => {
                              // Busca por ID direto (não depende do artista estar entre os
                              // primeiros carregados) — cai para busca por nome só quando o
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
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeParticipante(p.id)}
                            disabled={isViewMode}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum participante adicionado.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Outros Títulos */}
          <Collapsible
            open={outrosTitulosOpen}
            onOpenChange={setOutrosTitulosOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <div className="flex items-center gap-2 p-5">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between">
                  <span className="font-semibold">Outros Títulos</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${outrosTitulosOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOutroTitulo}
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {outrosTitulos.length > 0 ? (
                  outrosTitulos.map((title, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={title}
                        onChange={(e) =>
                          updateOutroTitulo(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="Título alternativo"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOutroTitulo(index)}
                        disabled={isViewMode}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum título alternativo adicionado.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Referência Conexa */}
          <Collapsible open={referenciasOpen} onOpenChange={setReferenciasOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <div className="flex items-center gap-2 p-5">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between">
                  <span className="font-semibold">Referência Conexa</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${referenciasOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addReferenciaConexas}
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {referenciasConexas.length > 0 ? (
                  referenciasConexas.map((ref, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={ref}
                        onChange={(e) =>
                          updateReferenciaConexas(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="URL ou referência"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeReferenciaConexas(index)}
                        disabled={isViewMode}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma referência conexa adicionada.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Letra da Música */}
          <Collapsible open={letraOpen} onOpenChange={setLetraOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <span className="font-semibold">Letra da Música</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${letraOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                <Label>Letra Completa</Label>
                <Textarea
                  value={letraCompleta}
                  onChange={(e) => setLetraCompleta(e.target.value)}
                  disabled={isViewMode}
                  rows={6}
                  placeholder="Digite a letra completa da música aqui..."
                />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Termos de Uso */}
          {!isViewMode && (
            <div className="flex items-center gap-2 p-4 bg-muted/10 rounded-lg border border-border">
              <Checkbox
                id="termos"
                checked={aceitaTermos}
                onCheckedChange={(checked) =>
                  setAceitaTermos(checked as boolean)
                }
                className="border-primary data-[state=checked]:bg-primary"
              />
              <label htmlFor="termos" className="text-sm">
                Aceito o Termo -{" "}
                <a href="#" className="text-primary hover:underline">
                  Leia e aceite os Termos de Uso
                </a>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={
                  hasDuracaoError || addObra.isPending || updateObra.isPending
                }
                data-testid="button-submit-obra"
              >
                {addObra.isPending || updateObra.isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Criar Obra"
                    : "Atualizar Obra"}
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

