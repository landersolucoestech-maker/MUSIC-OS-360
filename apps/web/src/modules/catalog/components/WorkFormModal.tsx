import { useState, useEffect, useRef } from "react";
import { parseTracksFromProject, type TrackData } from "@/modules/projects/lib/track-helpers";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import { MUSICAL_GENRE_LABELS } from "@/constants/musicalGenres";
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
import type { ProjectWithRelations } from "@/modules/projects/hooks/useProjects";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { ParticipantViewModal } from "@/modules/catalog/components/ParticipantViewModal";
import { useWorks } from "@/modules/catalog/hooks/useWorks";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { WorkOriginBadge } from "@/modules/catalog/components/WorkOriginBadge";
import {
  WORK_LANGUAGE_OPTIONS,
  WORK_PARTICIPANT_ROLE_OPTIONS,
  WORK_STATUS_OPTIONS,
  isWorkAiUsageLevel,
  isWorkOrigin,
  workParticipantRoleLabel,
  type WorkAiUsageLevel,
  type WorkOrigin,
} from "@/modules/catalog/constants/work-options";
import type { Work, WorkAiElement } from "@/modules/catalog/types/catalog.types";
import {
  workToFormFields,
  formToWorkPayload,
  type ParticipantForm,
} from "@/modules/catalog/mappers";
import { workSchema } from "@/modules/catalog/lib/work-schema";

// ── Autocomplete: server-side search by stage_name/full_name (Task I —
// it used to filter only the tenant's first 50 artists, loaded via
// an unfiltered useArtists(); now each typed (debounced) key re-runs the
// search in the backend, reaching any artist of the tenant). Free text
// is still allowed — not every participant needs to be registered.
interface ArtistNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (a: { id: string; stageName: string; fullName?: string | null }) => void;
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
    table: "artists",
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
    const display = a.fullName || a.stageName;
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
              <span className="font-medium">{a.fullName || a.stageName}</span>
              <span className="text-xs text-muted-foreground">{a.stageName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SelectedProject {
  id: string;
  name: string;
  artistName?: string | null;
}

interface WorkFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persisted work (edit/view) or a work-shaped seed (e.g. projectToWorkSeed). */
  work?: Partial<Work> | null;
  mode: "create" | "edit" | "view";
  /**
   * Work origin chosen in the selector (Task #288). When given,
   * it forces the classification in the header. In "edit"/"view" mode it is
   * derived from the record's `work_origin`.
   */
  workOrigin?: WorkOrigin;
  /** Called after a successful save — used to open a prefilled contract modal */
  onSaved?: (info: { title: string; notes: string }) => void;
}

/** Form row of a participant; `artist_id` only links the row to a registered artist in the form. */
interface Participant extends ParticipantForm {
  artist_id?: string;
}

const EMPTY_AI_ELEMENT: WorkAiElement = { tool: "", prompt: "" };

const musicGenres = MUSICAL_GENRE_LABELS;

export function WorkFormModal({
  open,
  onOpenChange,
  work,
  mode,
  workOrigin: workOriginProp,
  onSaved,
}: WorkFormModalProps) {
  const { addWork, updateWork } = useWorks();
  const { orgId } = useCurrentOrgId();

  // Resolution of the work origin. On creation it comes from the selector (prop). On
  // edit/view it comes from the record itself. Default = reference.
  const persistedOrigin = work?.work_origin;
  const workOrigin: WorkOrigin =
    workOriginProp ?? (isWorkOrigin(persistedOrigin) ? persistedOrigin : "reference");
  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [searchProject, setSearchProject] = useState("");
  const debouncedSearchProject = useDebounce(searchProject, 300);
  const [searchProjectOpen, setSearchProjectOpen] = useState(false);
  const [initialFields] = useState(() => workToFormFields(work));
  const [ecadCode, setEcadCode] = useState(initialFields.ecadCode);
  const [societyCode, setSocietyCode] = useState(initialFields.societyCode);
  const [iswc, setIswc] = useState(initialFields.iswc);
  const [workTitleValue, setWorkTitle] = useState(initialFields.title);
  const [status, setStatus] = useState(initialFields.status);
  const [musicGenre, setMusicGenre] = useState(initialFields.musicGenre);
  const [language, setLanguage] = useState(initialFields.language);
  const [durationMinutes, setDurationMinutes] = useState(initialFields.durationMinutes);
  const [durationSeconds, setDurationSeconds] = useState(initialFields.durationSeconds);
  const [isInstrumental, setIsInstrumental] = useState(initialFields.isInstrumental);
  const [aiUsed, setAiUsed] = useState(initialFields.aiUsed);
  const [aiUsageLevel, setAiUsageLevel] = useState<WorkAiUsageLevel | "">(initialFields.aiUsageLevel);
  const [aiHarmony, setAiHarmony] = useState<WorkAiElement>(initialFields.aiHarmony);
  const [aiMelody, setAiMelody] = useState<WorkAiElement>(initialFields.aiMelody);
  const [aiLyrics, setAiLyrics] = useState<WorkAiElement>(initialFields.aiLyrics);
  const [participants, setParticipants] = useState<Participant[]>(initialFields.participants);
  const [alternativeTitles, setAlternativeTitles] = useState<string[]>(initialFields.alternativeTitles);
  const [relatedReferences, setRelatedReferences] = useState<string[]>(initialFields.relatedReferences);
  const [lyrics, setLyrics] = useState(initialFields.lyrics);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [viewArtist, setViewArtist] = useState<Artist | null>(null);

  // Sync state whenever the modal opens or the work record changes
  useEffect(() => {
    if (!open) return;
    const f = workToFormFields(work);
    setSearchProject("");
    setSearchProjectOpen(false);
    setWorkTitle(f.title);
    setStatus(f.status);
    setMusicGenre(f.musicGenre);
    setLanguage(f.language);
    setDurationMinutes(f.durationMinutes);
    setDurationSeconds(f.durationSeconds);
    setIsInstrumental(f.isInstrumental);
    setEcadCode(f.ecadCode);
    setSocietyCode(f.societyCode);
    setIswc(f.iswc);
    setAiUsed(f.aiUsed);
    setAiUsageLevel(f.aiUsageLevel);
    setAiHarmony(f.aiHarmony);
    setAiMelody(f.aiMelody);
    setAiLyrics(f.aiLyrics);
    setParticipants(f.participants);
    setAlternativeTitles(f.alternativeTitles);
    setRelatedReferences(f.relatedReferences);
    setLyrics(f.lyrics);
    setTermsAccepted(false);
  }, [open, work]);

  // Hydrates the linked project from work.project_id — fetches DIRECTLY by
  // ID (GET /projects/:id), does not depend on the project being among the first
  // records loaded (Task J: it used to use an unfiltered useProjects(), which
  // truncated at 50 projects per tenant).
  const linkedProjectId: string | undefined = work?.project_id ?? undefined;
  const { entity: linkedProject } = useEntityById<ProjectWithRelations>(
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
        name: linkedProject.title ?? "",
        artistName: (linkedProject.artist?.stage_name ?? null) as string | null,
      });
    } else {
      // Still loading — keeps the ID with a placeholder until the lookup by ID resolves.
      setSelectedProject({ id: linkedProjectId, name: "Projeto vinculado" });
    }
  }, [open, linkedProjectId, linkedProject]);

  // Server-side search of completed projects (Task J) — it used to filter
  // locally only the tenant's first 50 projects loaded via an
  // unfiltered useProjects(); now each typed (internally debounced)
  // key re-runs the search in the backend, reaching any completed
  // project of the tenant.
  const { items: filteredCompletedProjects } = useEntityLookup<ProjectWithRelations>({
    table: "projects",
    search: searchProject,
    filters: { status: "completed" },
    enabled: searchProjectOpen,
  });

  const [participationOpen, setParticipationOpen] = useState(true);
  const [alternativeTitlesOpen, setAlternativeTitlesOpen] = useState(false);
  const [relatedReferencesOpen, setRelatedReferencesOpen] = useState(false);
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
      (total, p) => total + (parseFloat(p.percentage) || 0),
      0,
    );
  };

  const addParticipant = () => {
    setParticipants([
      ...participants,
      {
        id: crypto.randomUUID(),
        name: "",
        role: "unspecified",
        link: "",
        percentage: "",
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

  const addAlternativeTitle = () => {
    setAlternativeTitles([...alternativeTitles, ""]);
  };

  const updateAlternativeTitle = (index: number, value: string) => {
    const newTitles = [...alternativeTitles];
    newTitles[index] = value;
    setAlternativeTitles(newTitles);
  };

  const removeAlternativeTitle = (index: number) => {
    setAlternativeTitles(alternativeTitles.filter((_, i) => i !== index));
  };

  const addRelatedReference = () => {
    setRelatedReferences([...relatedReferences, ""]);
  };

  const updateRelatedReference = (index: number, value: string) => {
    const newRefs = [...relatedReferences];
    newRefs[index] = value;
    setRelatedReferences(newRefs);
  };

  const removeRelatedReference = (index: number) => {
    setRelatedReferences(relatedReferences.filter((_, i) => i !== index));
  };

  const durationMinutesNum = Number(durationMinutes);
  const durationSecondsNum = Number(durationSeconds);
  const durationMinutesError =
    durationMinutes !== "" && (!Number.isInteger(durationMinutesNum) || durationMinutesNum < 0)
      ? "Minutos não pode ser negativo"
      : null;
  const durationSecondsError =
    durationSeconds !== "" &&
    (!Number.isInteger(durationSecondsNum) ||
      durationSecondsNum < 0 ||
      durationSecondsNum > 59)
      ? "Segundos deve estar entre 0 e 59"
      : null;
  const hasDurationError = !!(durationMinutesError || durationSecondsError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDurationError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    const validation = workSchema.safeParse({
      title: workTitleValue,
      musicGenre,
      language,
      status,
      iswc,
      ecadCode,
      societyCode,
      durationMinutes: String(durationMinutes),
      durationSeconds: String(durationSeconds),
      isInstrumental,
      aiUsed,
      lyrics,
      termsAccepted,
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
      musicGenre,
      language,
      iswc,
      ecadCode,
      societyCode,
      durationMinutes,
      durationSeconds,
      isInstrumental,
      aiUsed,
      aiUsageLevel,
      aiHarmony,
      aiMelody,
      aiLyrics,
      alternativeTitles,
      relatedReferences,
      lyrics,
      participants,
      status,
      projectId: selectedProject?.id ?? null,
      artistId: null,
      workOrigin,
    });

    try {
      if (mode === "edit" && work?.id) {
        await updateWork.mutateAsync({ id: work.id, ...payload, expectedUpdatedAt: getExpectedUpdatedAt(work) });
      } else {
        await addWork.mutateAsync(payload);
      }

      onOpenChange(false);

      // Opens the prefilled contract modal after closing the work modal
      const todayDate = new Date().toISOString().split("T")[0];
      const participantRows = participants
        .filter((p) => p.name || p.role !== "unspecified")
        .map((p) => {
          const parties = [
            p.name,
            p.role !== "unspecified" ? workParticipantRoleLabel(p.role) : "",
            p.percentage ? `${p.percentage}%` : "",
          ].filter(Boolean);
          return parties.join(" – ");
        });
      const noteLines: string[] = [
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
        notes: noteLines.join("\n"),
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
            <WorkOriginBadge origin={workOrigin} />
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
                data-testid="linked-project-card"
              >
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    data-testid="text-linked-project-name"
                  >
                    {selectedProject.name}
                  </p>
                  {selectedProject.artistName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedProject.artistName}
                    </p>
                  )}
                </div>
                {!isViewMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedProject(null)}
                    data-testid="button-remove-linked-project"
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
                      data-testid="input-search-project"
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
                        (filteredCompletedProjects as ProjectWithRelations[]).map((p) => {
                          const pId = p.id as string;
                          const pNameDisplay = (p.title ?? "") as string;
                          const pArtistNameDisplay = (p.artist?.stage_name ?? "") as string;
                          const selectProject = async () => {
                            setSelectedProject({
                              id: pId,
                              name: pNameDisplay,
                              artistName: pArtistNameDisplay || null,
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
                              ? await storage.findById<ArtistWireRecord>("artists", artistId)
                              : undefined;
                            const artistFound = artistFoundWire ? wireToArtist(artistFoundWire) : undefined;
                            const artistNameResolved = artistFound?.stageName || pArtistNameDisplay;
                            // Composers from the project tracks (the API returns the hydrated `tracks` array)
                            let autoParticipants: Participant[] = [];
                            {
                              const tracks = parseTracksFromProject(p as { tracks?: TrackData[] });
                              if (tracks.length > 0) {
                                const seen = new Set<string>();
                                const composersArr: string[] = tracks
                                  .flatMap((m) => m.composers ?? [])
                                  .filter((name: string) => { const k = name.trim(); return k && !seen.has(k) && seen.add(k); });
                                autoParticipants = composersArr.map((name: string) => ({
                                  id: crypto.randomUUID(),
                                  name: name.trim(),
                                  role: "composer_author",
                                  link: "",
                                  percentage: "",
                                }));
                              }
                            }
                            // Fallback: use resolved artista name as single compositor
                            if (autoParticipants.length === 0 && artistNameResolved) {
                              autoParticipants = [{
                                id: crypto.randomUUID(),
                                name: artistNameResolved,
                                role: "composer_author",
                                link: "",
                                percentage: "100",
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
                              data-testid={`option-project-${p.id}`}
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
                          data-testid="text-empty-projects"
                        >
                          Nenhum projeto concluído encontrado.
                        </p>
                      )}
                      <AbramusSearchRow
                        kind="works"
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
                  value={societyCode}
                  onChange={(e) => setSocietyCode(e.target.value)}
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
                  value={ecadCode}
                  onChange={(e) => setEcadCode(e.target.value)}
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

              {/* Language — col-span-2 | Row 2 */}
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Idioma
                </span>
                <Select
                  value={language}
                  onValueChange={setLanguage}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0" data-testid="trigger-work-language">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                    data-testid="input-duration-minutes"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationMinutesError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    min
                  </span>
                  <Input
                    data-testid="input-duration-seconds"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationSecondsError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    seg
                  </span>
                </div>
                {(durationMinutesError || durationSecondsError) && (
                  <p className="text-xs text-destructive">
                    {durationMinutesError || durationSecondsError}
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
                    checked={isInstrumental}
                    onCheckedChange={setIsInstrumental}
                    data-testid="switch-work-instrumental"
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
                    checked={aiUsed}
                    onCheckedChange={setAiUsed}
                    data-testid="switch-work-ai-used"
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
                  value={status}
                  onValueChange={setStatus}
                  disabled={isViewMode}
                >
                  <SelectTrigger className="h-8 text-sm min-w-0" data-testid="trigger-work-status">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Created by generative AI - conditional */}
          {aiUsed && (
            <div className="border border-border rounded-lg p-6 space-y-5 bg-muted/10">
              <h3 className="font-semibold">Criado por IA Generativa</h3>

              <RadioGroup
                value={aiUsageLevel}
                onValueChange={(value) => setAiUsageLevel(isWorkAiUsageLevel(value) ? value : "")}
                className="flex gap-6"
                disabled={isViewMode}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="full"
                    id="ai_usage_full"
                    className="border-primary text-primary"
                  />
                  <label htmlFor="ai_usage_full" className="text-sm">
                    A obra foi totalmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="partial" id="ai_usage_partial" />
                  <label htmlFor="ai_usage_partial" className="text-sm">
                    A obra foi parcialmente gerada pela inteligência artificial
                    generativa.
                  </label>
                </div>
              </RadioGroup>

              {aiUsageLevel && (
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
                          value={aiHarmony.tool}
                          onChange={(e) =>
                            setAiHarmony({
                              ...aiHarmony,
                              tool: e.target.value,
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
                            value={aiHarmony.prompt}
                            onChange={(e) =>
                              setAiHarmony({
                                ...aiHarmony,
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
                          onClick={() => setAiHarmony(EMPTY_AI_ELEMENT)}
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
                          value={aiMelody.tool}
                          onChange={(e) =>
                            setAiMelody({
                              ...aiMelody,
                              tool: e.target.value,
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
                            value={aiMelody.prompt}
                            onChange={(e) =>
                              setAiMelody({
                                ...aiMelody,
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
                          onClick={() => setAiMelody(EMPTY_AI_ELEMENT)}
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
                          value={aiLyrics.tool}
                          onChange={(e) =>
                            setAiLyrics({
                              ...aiLyrics,
                              tool: e.target.value,
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
                          onClick={() => setAiLyrics(EMPTY_AI_ELEMENT)}
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
            open={participationOpen}
            onOpenChange={setParticipationOpen}
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
                  className={`w-4 h-4 transition-transform ${participationOpen ? "rotate-180" : ""}`}
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
                            value={p.role === "unspecified" ? "" : p.role}
                            onValueChange={(v) =>
                              updateParticipant(p.id, "role", v)
                            }
                            disabled={isViewMode}
                          >
                            <SelectTrigger className="min-w-0" data-testid={`trigger-participant-role-${p.id}`}>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {WORK_PARTICIPANT_ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
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
                            value={p.percentage}
                            onChange={(e) =>
                              updateParticipant(
                                p.id,
                                "percentage",
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
                                ? await storage.findById<ArtistWireRecord>("artists", p.artist_id)
                                : p.name
                                  ? (await storage.listPaged<ArtistWireRecord>("artists", { page: 1, pageSize: 5, filters: { search: p.name } }))
                                      .items.find(a => (a.full_name || a.stage_name) === p.name)
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
            open={alternativeTitlesOpen}
            onOpenChange={setAlternativeTitlesOpen}
          >
            <div className="border border-border rounded-lg bg-muted/10">
              <div className="flex items-center gap-2 p-5">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between">
                  <span className="font-semibold">Outros Títulos</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${alternativeTitlesOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAlternativeTitle}
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {alternativeTitles.length > 0 ? (
                  alternativeTitles.map((title, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={title}
                        onChange={(e) =>
                          updateAlternativeTitle(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="Título alternativo"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAlternativeTitle(index)}
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
          <Collapsible open={relatedReferencesOpen} onOpenChange={setRelatedReferencesOpen}>
            <div className="border border-border rounded-lg bg-muted/10">
              <div className="flex items-center gap-2 p-5">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between">
                  <span className="font-semibold">Referência Conexa</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${relatedReferencesOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRelatedReference}
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <CollapsibleContent className="px-5 pb-5 space-y-3">
                {relatedReferences.length > 0 ? (
                  relatedReferences.map((ref, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={ref}
                        onChange={(e) =>
                          updateRelatedReference(index, e.target.value)
                        }
                        disabled={isViewMode}
                        placeholder="URL ou referência"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRelatedReference(index)}
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
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
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
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <label htmlFor="terms" className="text-sm">
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
                data-testid="button-submit-work"
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
        artist={viewArtist}
      />
    </Dialog>
  );
}

