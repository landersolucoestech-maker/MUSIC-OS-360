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
import { ParticipantViewModal } from "@/modules/catalog/components/ParticipanteViewModal";
import { useWorks } from "@/modules/catalog/hooks/useObras";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import { useDebounce } from "@/shared/hooks/useDebounce";
import type { WorkType } from "@/modules/catalog/components/ObraTipoSelectorModal";
import {
  dbStatusToSelect,
  parseDurationText,
  workToParticipants,
  workTitle,
  workOtherTitles,
  workRelatedReferences,
  workFullLyrics,
  workCreatedByAi,
  workTypeAiValue,
  workAiHarmony,
  workAiMelody,
  workAiLyrics,
  workToFormFields,
  formToWorkPayload,
} from "@/modules/catalog/mappers";
import { workSchema } from "@/modules/catalog/lib/obra-schema";

// ── Autocomplete: server-side search by nome_artistico/nome_civil (Task I —
// it used to filter only the tenant's first 50 artists, loaded via
// an unfiltered useArtistas(); now each typed (debounced) key re-runs the
// search in the backend, reaching any artist of the tenant). Free text
// is still allowed — not every participant needs to be registered.
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

export const WorkTypeBadge = ({
  type,
}: {
  type?: WorkType | string | null;
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

interface SelectedProject {
  id: string;
  nome: string;
  artistaNome?: string | null;
}

interface WorkFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
  mode: "create" | "edit" | "view";
  /**
   * Work type chosen in the selector (Task #288). When given,
   * it forces the classification in the header. In "edit"/"view" mode it is
   * derived from the `obra.tipo_obra` record.
   */
  tipoObra?: WorkType;
  /** Called after a successful save — used to open a prefilled contract modal */
  onSaved?: (info: { title: string; notes: string }) => void;
}

interface Participant {
  id: string;
  name: string;
  classeFuncao: string;
  link: string;
  percentual: string;
  artist_id?: string;
}

interface IAElement {
  ferramenta: string;
  prompt: string;
}

const musicGenres = MUSICAL_GENRE_LABELS;
const idiomas = LANGUAGE_LABELS;
const situacoes = ["Em Análise", "Pendente", "Registrado", "Rejeitado"];
const classesFuncao = [
  "Editor",
  "Administrador",
  "Compositor/Autor",
  "Tradutor",
];

export function WorkFormModal({
  open,
  onOpenChange,
  obra: work,
  mode,
  tipoObra: workTypeProp,
  onSaved,
}: WorkFormModalProps) {
  const { addWork, updateWork } = useWorks();
  const { orgId } = useCurrentOrgId();

  // Resolution of the work type. On creation it comes from the selector (prop). On
  // edit/view it comes from the record itself. Default = referencia.
  const workType: WorkType = (workTypeProp ??
    (work?.tipo_obra as WorkType | undefined) ??
    "referencia") as WorkType;
  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [searchProject, setSearchProject] = useState("");
  const debouncedSearchProject = useDebounce(searchProject, 300);
  const [searchProjectOpen, setSearchProjectOpen] = useState(false);
  const initialDurationText = parseDurationText(work?.duration_text);
  const [codEcad, setCodEcad] = useState(work?.cod_ecad ?? work?.codEcad ?? "");
  const [codEntidade, setCodEntidade] = useState(
    work?.cod_entidade ?? work?.codEntidade ?? "",
  );
  const [iswc, setIswc] = useState(work?.iswc || "");
  const [workTitleValue, setWorkTitle] = useState(workTitle(work));
  const [situacao, setSituacao] = useState(dbStatusToSelect(work?.status));
  const [musicGenre, setMusicGenre] = useState(
    work?.music_genre?.toLowerCase() || "",
  );
  const [idioma, setIdioma] = useState(work?.idioma || "");
  const [durationMin, setDurationMin] = useState(
    work?.duracaoMin ?? initialDurationText.min,
  );
  const [durationSeg, setDurationSeg] = useState(
    work?.duracaoSeg ?? initialDurationText.seg,
  );
  const [instrumental, setInstrumental] = useState(work?.instrumental || "nao");
  const [criadaPorIA, setCriadaPorIA] = useState(() => workCreatedByAi(work));
  const [aiType, setAiType] = useState(() => workTypeAiValue(work));
  const [iaHarmonia, setIaHarmonia] = useState<IAElement>(() => workAiHarmony(work));
  const [iaMelodia, setIaMelodia] = useState<IAElement>(() => workAiMelody(work));
  const [aiLyrics, setAiLyrics] = useState<IAElement>(() => workAiLyrics(work));
  const [participants, setParticipants] = useState<Participant[]>(() =>
    workToParticipants(work),
  );
  const [otherTitles, setOtherTitles] = useState<string[]>(() => workOtherTitles(work));
  const [referenciasConexas, setReferenciasConexas] = useState<string[]>(() => workRelatedReferences(work));
  const [fullLyrics, setFullLyrics] = useState(() => workFullLyrics(work));
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [viewArtist, setViewArtist] = useState<Artist | null>(null);

  // Sync state whenever the modal opens or the obra record changes
  useEffect(() => {
    if (!open) return;
    const f = workToFormFields(work);
    setSearchProject("");
    setSearchProjectOpen(false);
    setWorkTitle(f.title);
    setSituacao(f.situacao);
    setMusicGenre(f.generoMusical);
    setIdioma(f.idioma);
    setDurationMin(f.duracaoMin);
    setDurationSeg(f.duracaoSeg);
    setInstrumental(f.instrumental);
    setCodEcad(f.codEcad);
    setCodEntidade(f.codEntidade);
    setIswc(f.iswc);
    setCriadaPorIA(f.criadaPorIA);
    setAiType(f.tipoIA);
    setIaHarmonia(f.iaHarmonia);
    setIaMelodia(f.iaMelodia);
    setAiLyrics(f.iaLetra);
    setParticipants(f.participantes);
    setOtherTitles(f.outrosTitulos);
    setReferenciasConexas(f.referenciasConexas);
    setFullLyrics(f.letraCompleta);
    setAceitaTermos(false);
  }, [open, work]);

  // Hydrates the linked project from obra.project_id — fetches DIRECTLY by
  // ID (GET /projects/:id), does not depend on the project being among the first
  // records loaded (Task J: it used to use an unfiltered useProjetos(), which
  // truncated at 50 projects per tenant).
  const linkedProjectId: string | undefined = work?.project_id ?? work?.projectId;
  const { entity: linkedProject } = useEntityById<ProjetoWithRelations>(
    "projects",
    open ? linkedProjectId : undefined,
  );
  useEffect(() => {
    if (!open) return;
    if (!linkedProjectId) {
      setSelectedProject(null);
      return;
    }
    if (linkedProject) {
      setSelectedProject({
        id: linkedProject.id,
        nome: linkedProject.title ?? (linkedProject.nome as string) ?? "",
        artistaNome: (linkedProject.artistas?.nome_artistico ?? null) as string | null,
      });
    } else {
      // Still loading — keeps the ID with a placeholder until the lookup by ID resolves.
      setSelectedProject({ id: linkedProjectId, nome: "Projeto vinculado" });
    }
  }, [open, linkedProjectId, linkedProject]);

  // Server-side search of completed projects (Task J) — it used to filter
  // locally only the tenant's first 50 projects loaded via an
  // unfiltered useProjetos(); now each typed (internally debounced)
  // key re-runs the search in the backend, reaching any completed
  // project of the tenant.
  const { items: filteredCompletedProjects } = useEntityLookup<ProjetoWithRelations>({
    table: "projects",
    search: searchProject,
    filters: { status: "concluido" },
    enabled: searchProjectOpen,
  });

  const [participacaoOpen, setParticipacaoOpen] = useState(true);
  const [otherTitlesOpen, setOtherTitlesOpen] = useState(false);
  const [referenciasOpen, setReferenciasOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);

  const isViewMode = mode === "view";
  const title =
    mode === "create"
      ? "Nova Obra"
      : mode === "edit"
        ? "Editar Música"
        : "Detalhes da Obra";

  const calculateTotalPercentage = () => {
    return participants.reduce(
      (total, p) => total + (parseFloat(p.percentual) || 0),
      0,
    );
  };

  const addParticipant = () => {
    setParticipants([
      ...participants,
      {
        id: crypto.randomUUID(),
        name: "",
        classeFuncao: "",
        link: "",
        percentual: "",
      },
    ]);
  };

  const updateParticipant = (
    id: string,
    field: keyof Participant,
    value: string,
  ) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const addOtherTitle = () => {
    setOtherTitles([...otherTitles, ""]);
  };

  const updateOtherTitle = (index: number, value: string) => {
    const newTitles = [...otherTitles];
    newTitles[index] = value;
    setOtherTitles(newTitles);
  };

  const removeOtherTitle = (index: number) => {
    setOtherTitles(otherTitles.filter((_, i) => i !== index));
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

  const durationMinNum = Number(durationMin);
  const durationSegNum = Number(durationSeg);
  const durationMinError =
    durationMin !== "" && (!Number.isInteger(durationMinNum) || durationMinNum < 0)
      ? "Minutos não pode ser negativo"
      : null;
  const durationSegError =
    durationSeg !== "" &&
    (!Number.isInteger(durationSegNum) ||
      durationSegNum < 0 ||
      durationSegNum > 59)
      ? "Segundos deve estar entre 0 e 59"
      : null;
  const hasDurationError = !!(durationMinError || durationSegError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDurationError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    const validation = workSchema.safeParse({
      tituloObra: workTitleValue,
      generoMusical: musicGenre,
      idioma,
      situacao,
      iswc,
      codEcad,
      codEntidade,
      duracaoMin: String(durationMin),
      duracaoSeg: String(durationSeg),
      instrumental: instrumental as "sim" | "nao",
      criadaPorIA,
      letraCompleta: fullLyrics,
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

    const payload = formToWorkPayload({
      title: workTitleValue,
      generoMusical: musicGenre,
      idioma,
      iswc,
      codEcad,
      codEntidade,
      duracaoMin: durationMin,
      duracaoSeg: durationSeg,
      instrumental,
      criadaPorIA,
      tipoIA: aiType,
      iaHarmonia,
      iaMelodia,
      iaLetra: aiLyrics,
      outrosTitulos: otherTitles,
      referenciasConexas,
      letraCompleta: fullLyrics,
      participantes: participants,
      situacao,
      projectId: selectedProject?.id ?? null,
      artistId: null,
      tipoObra: workType,
      orgId: orgId as string,
    });

    try {
      if (mode === "edit" && work?.id) {
        await updateWork.mutateAsync({ id: work.id, ...payload, expectedUpdatedAt: getExpectedUpdatedAt(work) });
      } else {
        await addWork.mutateAsync(payload as any);
      }

      onOpenChange(false);

      // Opens the prefilled contract modal after closing the work modal
      const todayDate = new Date().toISOString().split("T")[0];
      const participantRows = participants
        .filter((p) => p.name || p.classeFuncao)
        .map((p) => {
          const parties = [p.name, p.classeFuncao, p.percentual ? `${p.percentual}%` : ""].filter(Boolean);
          return parties.join(" – ");
        });
      const obsLinhas: string[] = [
        `Obra: ${workTitleValue}`,
        iswc ? `ISWC: ${iswc}` : null,
        musicGenre ? `Gênero: ${musicGenre}` : null,
        `Data: ${todayDate}`,
        participantRows.length > 0 ? "" : null,
        participantRows.length > 0 ? "Participantes:" : null,
        ...participantRows,
      ].filter((l): l is string => l !== null);

      onSaved?.({
        title: `Cessão de Obras – ${workTitleValue}`,
        notes: obsLinhas.join("\n"),
      });
    } catch (err) {
      if (handleConcurrencyConflict(err, "obra")) return;
      // other errors are already shown via toast by the useDataQuery hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{title}</DialogTitle>
            <WorkTypeBadge type={workType} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Link to a completed project */}
          <div className="border border-border rounded-lg p-5 space-y-3 bg-muted/10">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                Vincular a Projeto Concluído
              </span>
            </div>

            {selectedProject ? (
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
                    {selectedProject.nome}
                  </p>
                  {selectedProject.artistaNome && (
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedProject.artistaNome}
                    </p>
                  )}
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedProject(null)}
                    data-testid="button-remove-projeto-vinculado"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Popover
                open={searchProjectOpen}
                onOpenChange={setSearchProjectOpen}
              >
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchProject}
                      onChange={(e) => {
                        setSearchProject(e.target.value);
                        setSearchProjectOpen(true);
                      }}
                      onFocus={() => !isViewMode && setSearchProjectOpen(true)}
                      onClick={() => !isViewMode && setSearchProjectOpen(true)}
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
                        {searchProject
                          ? `Resultados para "${searchProject}"`
                          : "Projetos concluídos disponíveis"}
                      </p>
                      {filteredCompletedProjects.length > 0 ? (
                        (filteredCompletedProjects as ProjetoWithRelations[]).map((p) => {
                          const pId = p.id as string;
                          const pNameDisplay = (p.title ??
                            (p as { nome?: string }).nome ??
                            "") as string;
                          const pArtistNameDisplay = (p.artistas?.nome_artistico ?? "") as string;
                          const selectProject = async () => {
                            setSelectedProject({
                              id: pId,
                              nome: pNameDisplay,
                              artistaNome: pArtistNameDisplay || null,
                            });
                            // Auto-fill fields from project registration
                            if (!workTitleValue && p.title) setWorkTitle(p.title as string);
                            if (p.music_genre) {
                              const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                              const genreRaw = p.music_genre as string;
                              const matched = musicGenres.find(g => norm(g) === norm(genreRaw));
                              setMusicGenre(matched ? matched.toLowerCase() : genreRaw.toLowerCase());
                            }
                            // Resolves the artist directly by ID — does not depend on the artist being
                            // among the first loaded records (Task J).
                            const artistId = p.artist_id as string | null | undefined;
                            const artistFoundWire = artistId
                              ? await storage.findById<ArtistWireRecord>("artistas", artistId)
                              : undefined;
                            const artistFound = artistFoundWire ? wireToArtist(artistFoundWire) : undefined;
                            const artistNameResolved = artistFound?.stageName || pArtistNameDisplay;
                            // Parse descricao JSON for composers/producers from project songs
                            let autoParticipants: Participant[] = [];
                            try {
                              const tracks = JSON.parse(p.descricao as string || "[]");
                              if (Array.isArray(tracks) && tracks.length > 0) {
                                const seen = new Set<string>();
                                const composersArr: string[] = tracks
                                  .flatMap((m: any) => m.compositores || [])
                                  .filter((name: string) => { const k = name.trim(); return k && !seen.has(k) && seen.add(k); });
                                autoParticipants = composersArr.map((name: string) => ({
                                  id: crypto.randomUUID(),
                                  name: name.trim(),
                                  classeFuncao: "compositor/autor",
                                  link: "",
                                  percentual: "",
                                }));
                              }
                            } catch {}
                            // Fallback: use resolved artista name as single compositor
                            if (autoParticipants.length === 0 && artistNameResolved) {
                              autoParticipants = [{
                                id: crypto.randomUUID(),
                                name: artistNameResolved,
                                classeFuncao: "compositor/autor",
                                link: "",
                                percentual: "100",
                                artist_id: artistId ?? undefined,
                              }];
                            }
                            if (autoParticipants.length > 0 && participants.length === 0) {
                              setParticipants(autoParticipants);
                            }
                            setSearchProject("");
                            setSearchProjectOpen(false);
                            toast.success(
                              `Projeto "${pNameDisplay}" vinculado! Campos preenchidos automaticamente.`,
                            );
                          };
                          return (
                            <div
                              key={pId}
                              role="option"
                              tabIndex={0}
                              aria-selected={(selectedProject as SelectedProject | null)?.id === pId}
                              className="flex items-center gap-3 p-2 hover:bg-muted focus:bg-muted focus:outline-none rounded-lg cursor-pointer transition-colors"
                              onClick={selectProject}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectProject();
                                }
                              }}
                              data-testid={`option-projeto-${p.id}`}
                            >
                              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-primary-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {pNameDisplay}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {pArtistNameDisplay || "—"}
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
                        query={debouncedSearchProject}
                        onImported={() => {
                          setSearchProject("");
                          setSearchProjectOpen(false);
                        }}
                      />
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Main work data */}
          <div className="border border-border rounded-lg p-5 bg-muted/10">
            <h3 className="font-semibold text-sm mb-4">
              Dados Principais da Obra
            </h3>
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Society registration code — col-span-2 | Row 1 */}
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

              {/* ECAD code — col-span-2 | Row 1 */}
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

              {/* Work title — col-span-3 | Row 1 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Título da Obra *
                </span>
                <Input
                  className="h-8 text-sm min-w-0"
                  value={workTitleValue}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  disabled={isViewMode}
                />
              </div>

              {/* Musical genre — col-span-2 | Row 1 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Gênero Musical
                </span>
                <Select
                  value={musicGenre}
                  onValueChange={setMusicGenre}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicGenres.map((g) => (
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

              {/* Duration — col-span-3 | Row 2 */}
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Duração
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-duracao-minutos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationMinError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    min
                  </span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationSegError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationSeg}
                    onChange={(e) => setDurationSeg(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    seg
                  </span>
                </div>
                {(durationMinError || durationSegError) && (
                  <p className="text-xs text-destructive">
                    {durationMinError || durationSegError}
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

              {/* Created by AI — col-span-2 | Row 2 */}
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

              {/* Status — col-span-3 | Row 2 */}
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

          {/* Created by generative AI - conditional */}
          {criadaPorIA === "sim" && (
            <div className="border border-border rounded-lg p-6 space-y-5 bg-muted/10">
              <h3 className="font-semibold">Criado por IA Generativa</h3>

              <RadioGroup
                value={aiType}
                onValueChange={setAiType}
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

              {aiType && (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Elementos da obra musical criados por inteligência
                    artificial generativa:
                  </p>

                  {/* Harmony */}
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

                  {/* Melody */}
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

                  {/* Lyrics */}
                  <div className="space-y-2">
                    <Label className="font-semibold">LETRA:</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Ferramenta
                        </Label>
                        <Input
                          value={aiLyrics.ferramenta}
                          onChange={(e) =>
                            setAiLyrics({
                              ...aiLyrics,
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
                            value={aiLyrics.prompt}
                            onChange={(e) =>
                              setAiLyrics({ ...aiLyrics, prompt: e.target.value })
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
                            setAiLyrics({ ferramenta: "", prompt: "" })
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

          {/* Participation */}
          <Collapsible
            open={participacaoOpen}
            onOpenChange={setParticipacaoOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Participação</span>
                  <span className="text-sm text-muted-foreground">
                    Percentual total: {calculateTotalPercentage().toFixed(2)}% de
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
                    onClick={addParticipant}
                    disabled={isViewMode}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar participante
                  </Button>
                </div>

                {participants.length > 0 ? (
                  <div className="space-y-3">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 gap-3 items-end"
                      >
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Nome *</Label>
                          <ArtistNameInput
                            value={p.name}
                            onChange={(val) => updateParticipant(p.id, "name", val)}
                            onSelect={(a) => updateParticipant(p.id, "artist_id", a.id)}
                            placeholder="Nome do participante"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Classe/Função *</Label>
                          <Select
                            value={p.classeFuncao}
                            onValueChange={(v) =>
                              updateParticipant(p.id, "classeFuncao", v)
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
                              updateParticipant(p.id, "link", e.target.value)
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
                              updateParticipant(
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
                            disabled={!p.name}
                            onClick={async () => {
                              // Direct lookup by ID (does not depend on the artist being among the
                              // first loaded) — falls back to a lookup by name only when the
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
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeParticipant(p.id)}
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

          {/* Other titles */}
          <Collapsible
            open={otherTitlesOpen}
            onOpenChange={setOtherTitlesOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <div className="flex items-center gap-2 p-5">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between">
                  <span className="font-semibold">Outros Títulos</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${otherTitlesOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOtherTitle}
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {otherTitles.length > 0 ? (
                  otherTitles.map((title, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={title}
                        onChange={(e) =>
                          updateOtherTitle(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="Título alternativo"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOtherTitle(index)}
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

          {/* Related reference */}
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

          {/* Song lyrics */}
          <Collapsible open={lyricsOpen} onOpenChange={setLyricsOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
                <span className="font-semibold">Letra da Música</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${lyricsOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                <Label>Letra Completa</Label>
                <Textarea
                  value={fullLyrics}
                  onChange={(e) => setFullLyrics(e.target.value)}
                  disabled={isViewMode}
                  rows={6}
                  placeholder="Digite a letra completa da música aqui..."
                />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Terms of use */}
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
                  hasDurationError || addWork.isPending || updateWork.isPending
                }
                data-testid="button-submit-obra"
              >
                {addWork.isPending || updateWork.isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Criar Obra"
                    : "Atualizar Obra"}
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

