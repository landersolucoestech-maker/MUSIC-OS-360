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
import type { ObraWithRelations } from "@/modules/catalog/hooks/useWorks";
import { usePhonograms, type FonogramaUpdate } from "@/modules/catalog/hooks/usePhonograms";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type { ProjectWithRelations as ProjetoWithRelations } from "@/modules/projects/hooks/useProjects";
import { ParticipantViewModal } from "@/modules/catalog/components/ParticipantViewModal";
import { useCurrentOrgId } from "@/shared/hooks/useCurrentOrgId";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { AbramusSearchRow } from "@/modules/catalog/components/AbramusSearchRow";
import type {
  Phonogram,
  PhonogramAudioFile,
  PhonogramParticipant,
  PhonogramParticipation,
} from "@/modules/catalog/types/catalog.types";
import {
  joinIsrc,
  formToPhonogramPayload,
  phonogramToFormFields,
} from "@/modules/catalog/mappers";
import {
  PHONOGRAM_AGGREGATOR_OPTIONS,
  PHONOGRAM_COUNTRY_OPTIONS,
  PHONOGRAM_MEDIA_TYPE_OPTIONS,
  PHONOGRAM_PARTICIPATION_CATEGORIES,
  PHONOGRAM_PARTICIPATION_CATEGORY_LABELS,
  PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE,
  PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS,
  PHONOGRAM_STATUS_OPTIONS,
  type PhonogramParticipationCategory,
} from "@/modules/catalog/constants/phonogram-options";
import { phonogramSchema } from "@/modules/catalog/lib/phonogram-schema";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";
import { toUserMessage } from "@/shared/lib/errors";

// `composer_names` is typed as string[], but a legacy record may carry a
// string or null. Normalizes safely.
function composersToString(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

interface PhonogramFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persisted phonogram (edit) or a seed (e.g. `{ work_id }` when registering from a work). */
  phonogram?: Partial<Phonogram> | null;
  mode: "create" | "edit" | "view";
  /** Called after a successful save — used to open a prefilled contract modal */
  onSaved?: (info: { title: string; notes: string }) => void;
}

interface LinkedWork {
  id: string;
  title: string;
  musicGenre: string;
  composers: string;
  status: string;
}

const musicGenres = MUSICAL_GENRE_LABELS;

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ── Autocomplete: server-side search by stage_name/full_name (Task I —
// it used to filter only the tenant's first 50 artists loaded via
// an unfiltered useArtistas(); now each typed (debounced) key re-runs the
// search in the backend). Free text is still allowed.
interface ArtistNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (a: { id: string; stageName: string; fullName?: string | null }) => void;
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
              <span className="font-medium">{a.fullName || a.stageName}</span>
              <span className="text-xs text-muted-foreground">{a.stageName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhonogramFormModal({ open, onOpenChange, phonogram, mode, onSaved }: PhonogramFormModalProps) {
  const { addPhonogram, updatePhonogram } = usePhonograms();
  const { orgId } = useCurrentOrgId();
  const [viewArtist, setViewArtist] = useState<Artist | null>(null);

  // Linked work (hydrated from phonogram.work_id in the effect below)
  const [linkedWork, setLinkedWork] = useState<LinkedWork | null>(null);
  const [searchWork, setSearchWork] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Phonogram data — initial values from the canonical record (phonogramToFormFields)
  const initial = phonogramToFormFields(phonogram);
  const [ecadCode, setEcadCode] = useState(initial.ecadCode);
  const [societyCode, setSocietyCode] = useState(initial.societyCode);
  const [aggregator, setAggregator] = useState(initial.aggregator);
  const [isrcCountryCode, setIsrcCountryCode] = useState(initial.isrcCountryCode);
  const [isrcRegistrantCode, setIsrcRegistrantCode] = useState(initial.isrcRegistrantCode);
  const [isrcYear, setIsrcYear] = useState(initial.isrcYear);
  const [isrcDesignationCode, setIsrcDesignationCode] = useState(initial.isrcDesignationCode);
  const [aiUsed, setAiUsed] = useState<boolean>(initial.aiUsed);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [recordingDate, setRecordingDate] = useState(initial.recordingDate);
  const [releaseDate, setReleaseDate] = useState(initial.releaseDate);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [durationSeconds, setDurationSeconds] = useState(initial.durationSeconds);
  const [isInstrumental, setIsInstrumental] = useState<boolean>(initial.isInstrumental);
  const [musicGenre, setMusicGenre] = useState(initial.musicGenre);
  const [recordingClassification, setRecordingClassification] = useState(initial.recordingClassification);
  const [mediaType, setMediaType] = useState(initial.mediaType);
  const [isNational, setIsNational] = useState<boolean>(initial.isNational);
  const [isSimultaneousPublication, setIsSimultaneousPublication] = useState<boolean>(initial.isSimultaneousPublication);
  const [status, setStatus] = useState(initial.status);
  const [countryOfRecording, setCountryOfRecording] = useState(initial.countryOfRecording);
  const [publicationCountry, setPublicationCountry] = useState(initial.publicationCountry);
  const [title, setTitle] = useState(initial.title);
  const [recordLabelName, setRecordLabelName] = useState(initial.recordLabelName);
  const [notes, setNotes] = useState(initial.notes);

  // Participation
  const [participation, setParticipation] = useState<PhonogramParticipation>(initial.participation);
  const [categoryOpen, setCategoryOpen] = useState<Record<PhonogramParticipationCategory, boolean>>({
    phonographic_producers: true,
    performers: true,
    session_musicians: true,
  });
  const [uploadOpen, setUploadOpen] = useState(true);

  // Audio upload
  const [audioFile, setAudioFile] = useState<PhonogramAudioFile | null>(initial.audioFile);
  const [audioUploading, setAudioUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { upload: uploadAudioToR2 } = useUploadToR2();

  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Loading state for submit
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever the modal opens or the phonogram record changes
  useEffect(() => {
    if (!open) return;
    const f = phonogramToFormFields(phonogram);
    setSearchWork("");
    setSearchOpen(false);
    setEcadCode(f.ecadCode);
    setSocietyCode(f.societyCode);
    setAggregator(f.aggregator);
    setIsrcCountryCode(f.isrcCountryCode);
    setIsrcRegistrantCode(f.isrcRegistrantCode);
    setIsrcYear(f.isrcYear);
    setIsrcDesignationCode(f.isrcDesignationCode);
    setAiUsed(f.aiUsed);
    setIssueDate(f.issueDate);
    setRecordingDate(f.recordingDate);
    setReleaseDate(f.releaseDate);
    setDurationMinutes(f.durationMinutes);
    setDurationSeconds(f.durationSeconds);
    setIsInstrumental(f.isInstrumental);
    setMusicGenre(f.musicGenre);
    setRecordingClassification(f.recordingClassification);
    setMediaType(f.mediaType);
    setIsNational(f.isNational);
    setIsSimultaneousPublication(f.isSimultaneousPublication);
    setStatus(f.status);
    setCountryOfRecording(f.countryOfRecording);
    setPublicationCountry(f.publicationCountry);
    setTitle(f.title);
    setRecordLabelName(f.recordLabelName);
    setNotes(f.notes);
    setParticipation(f.participation);
    setAudioFile(f.audioFile);
    setTermsAccepted(false);
  }, [open, phonogram]);

  // Hydrates the linked work from phonogram.work_id — fetches DIRECTLY by
  // ID (GET /works/:id via useEntityById), it does not depend on the work being among
  // the first records loaded by useWorks() (Task I: the work used to
  // stay stuck on the "Obra vinculada" placeholder forever if it was
  // outside the tenant's first 50).
  const hydratedWorkId: string | undefined = phonogram?.work_id ?? undefined;
  const { entity: hydratedWork } = useEntityById<ObraWithRelations>(
    "works",
    open ? hydratedWorkId : undefined,
  );

  useEffect(() => {
    if (!open) return;
    if (!hydratedWorkId) {
      setLinkedWork(null);
      return;
    }
    if (hydratedWork) {
      setLinkedWork({
        id: hydratedWork.id,
        title: hydratedWork.title ?? "",
        musicGenre: hydratedWork.music_genre ?? "",
        composers: composersToString(hydratedWork.composer_names),
        status: hydratedWork.status ?? "",
      });
    } else {
      // Still loading — keeps the ID with a placeholder until the lookup by ID resolves.
      setLinkedWork({
        id: hydratedWorkId,
        title: "Obra vinculada",
        musicGenre: "",
        composers: "",
        status: "",
      });
    }
  }, [open, hydratedWorkId, hydratedWork]);

  // Debounce of the typed term to avoid one ABRAMUS call per key.
  const searchWorkDebounced = useDebounce(searchWork, 300);

  // Server-side search (Task I) — it used to filter only the tenant's first 50 works
  // loaded via an unfiltered useWorks(); now each typed (debounced) key
  // re-runs the search in the backend (titles), reaching any
  // work of the tenant. Note: the server-side search matches titles only (the backend
  // does not index composers/genre) — a slight narrowing compared to the previous local
  // search, the same concession already accepted in the other migrations of this task.
  const LOCAL_RESULTS_LIMIT = 20;
  const titleCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const { items: worksSearch, total: registeredWorksTotal } = useEntityLookup<ObraWithRelations>({
    table: "works",
    search: searchWorkDebounced,
    pageSize: LOCAL_RESULTS_LIMIT,
    enabled: searchOpen,
  });
  const filteredRegisteredWorks: LinkedWork[] = worksSearch
    .map((o) => ({
      id: o.id,
      title: o.title ?? "",
      musicGenre: o.music_genre ?? "",
      composers: composersToString(o.composer_names),
      status: o.status ?? "",
    }))
    .sort((a, b) => titleCollator.compare(a.title, b.title));

  const isViewMode = mode === "view";
  const modalTitle = mode === "create" ? "Novo Fonograma" : mode === "edit" ? "Editar Fonograma" : "Detalhes do Fonograma";

  const calculateCategoryPercentage = (category: PhonogramParticipant[]) => {
    return category.reduce((total, p) => total + (parseFloat(p.percentage) || 0), 0);
  };

  const calculateTotalPercentage = () =>
    PHONOGRAM_PARTICIPATION_CATEGORIES.reduce(
      (total, category) => total + calculateCategoryPercentage(participation[category]),
      0,
    );

  const addParticipant = (category: PhonogramParticipationCategory) => {
    setParticipation({
      ...participation,
      [category]: [...participation[category], { id: crypto.randomUUID(), name: "", percentage: "" }]
    });
  };

  const updateParticipant = (
    category: PhonogramParticipationCategory,
    id: string,
    field: "name" | "percentage" | "artist_id",
    value: string,
  ) => {
    setParticipation({
      ...participation,
      [category]: participation[category].map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const removeParticipant = (category: PhonogramParticipationCategory, id: string) => {
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
        entityId: phonogram?.id || undefined,
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

  const durationMinutesNum = Number(durationMinutes);
  const durationSecondsNum = Number(durationSeconds);
  const durationMinutesError = durationMinutes !== "" && (!Number.isInteger(durationMinutesNum) || durationMinutesNum < 0)
    ? "Minutos não pode ser negativo"
    : null;
  const durationSecondsError = durationSeconds !== "" && (!Number.isInteger(durationSecondsNum) || durationSecondsNum < 0 || durationSecondsNum > 59)
    ? "Segundos deve estar entre 0 e 59"
    : null;
  const hasDurationError = !!(durationMinutesError || durationSecondsError);

  const buildPayload = () => {
    const finalTitle = (title && title.trim()) || linkedWork?.title || "Sem título";
    // org_id is not a form field — the tenant comes from the API's authenticated context.
    return formToPhonogramPayload({
      title: finalTitle,
      status,
      workId: linkedWork && typeof linkedWork.id === "string" && linkedWork.id ? linkedWork.id : null,
      ecadCode,
      societyCode,
      aggregator,
      isrcCountryCode,
      isrcRegistrantCode,
      isrcYear,
      isrcDesignationCode,
      aiUsed,
      isInstrumental,
      isNational,
      isSimultaneousPublication,
      issueDate,
      recordingDate,
      releaseDate,
      durationMinutes,
      durationSeconds,
      musicGenre,
      mediaType,
      recordingClassification,
      countryOfRecording,
      publicationCountry,
      recordLabelName,
      notes,
      participation,
      audioFile,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (hasDurationError) {
      toast.error("Corrija os erros no campo Duração antes de continuar.");
      return;
    }

    const isrcJoined = joinIsrc({
      countryCode: isrcCountryCode,
      registrantCode: isrcRegistrantCode,
      year: isrcYear,
      designationCode: isrcDesignationCode,
    });
    const validation = phonogramSchema.safeParse({
      title: title || "",
      isrc: isrcJoined || "",
      musicGenre: musicGenre || "",
      isInstrumental,
      aiUsed,
      isSimultaneousPublication,
      termsAccepted,
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
          linkedWork?.composers ? `Compositores: ${linkedWork.composers}` : null,
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      if (handleConcurrencyConflict(err, "fonograma")) return;
      // other errors are already shown via toast by the hook
    } finally {
      setSubmitting(false);
    }
  };

  const renderParticipationSection = (category: PhonogramParticipationCategory) => {
    const sectionTitle = PHONOGRAM_PARTICIPATION_CATEGORY_LABELS[category];
    const percentageMax = PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE[category];
    const isOpen = categoryOpen[category];
    const setIsOpen = (value: boolean) => setCategoryOpen((prev) => ({ ...prev, [category]: value }));
    const currentPercentage = calculateCategoryPercentage(participation[category]);
    
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg border border-border">
          <span className="text-sm font-medium">
            {sectionTitle} - Percentual total: {currentPercentage.toFixed(2)}% de {percentageMax.toFixed(2)}%
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
                    value={p.percentage}
                    onChange={(e) => updateParticipant(category, p.id, 'percentage', e.target.value)}
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
                        ? await storage.findById<ArtistWireRecord>("artists", p.artist_id)
                        : p.name
                          ? (await storage.listPaged<ArtistWireRecord>("artists", { page: 1, pageSize: 5, filters: { search: p.name } }))
                              .items.find(a => (a.full_name || a.stage_name) === p.name)
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
                    {[linkedWork.musicGenre, linkedWork.composers].filter(Boolean).join(" • ")}
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
                              if (work.musicGenre) {
                                const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                                const matched = musicGenres.find(g => norm(g) === norm(work.musicGenre));
                                setMusicGenre(matched ? matched.toLowerCase() : work.musicGenre.toLowerCase());
                              }
                              // Fill the participation from the full work data
                              const fullWork = worksSearch.find((o: ObraWithRelations) => o.id === work.id);
                              if (fullWork) {
                                const composersStr =
                                  composersToString(fullWork.composer_names) ||
                                  (typeof fullWork.composer_name === "string" ? fullWork.composer_name : "");
                                // Resolve the musician/arranger from the project producers — DIRECT
                                // lookup by ID (Task J: it used to scan the `projetos` array
                                // of an unfiltered useProjetos(), truncated at 50 per tenant).
                                let sessionMusicians: PhonogramParticipant[] = [];
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
                                        sessionMusicians = trackMatch.produtores.map((name: string) => ({
                                          id: crypto.randomUUID(), name, percentage: "",
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
                                let artistName = fullWork.artistas?.stage_name as string | undefined;
                                let artistId = fullWork.artistas?.id as string | undefined;
                                if (!artistName && (fullWork.artist_id as string | null | undefined)) {
                                  const byId = await storage.findById<ArtistWireRecord>("artists", fullWork.artist_id as string);
                                  if (byId) { const a = wireToArtist(byId); artistName = a.stageName; artistId = a.id; }
                                }
                                if (!artistName && composersStr) {
                                  const firstComp = composersStr.split(",")[0]?.trim();
                                  if (firstComp) {
                                    const { items: compMatches } = await storage.listPaged<ArtistWireRecord>("artists", {
                                      page: 1, pageSize: 5, filters: { search: firstComp },
                                    });
                                    const byName = compMatches.map(wireToArtist).find((a: Artist) =>
                                      norm(a.stageName || "") === norm(firstComp) ||
                                      norm(a.fullName || "") === norm(firstComp)
                                    );
                                    if (byName) { artistName = byName.stageName; artistId = byName.id; }
                                  }
                                }
                                const performers: PhonogramParticipant[] = artistName
                                  ? [{ id: crypto.randomUUID(), name: artistName, percentage: "", ...(artistId ? { artist_id: artistId } : {}) }]
                                  : [];
                                setParticipation(prev => ({
                                  ...prev,
                                  // phonographic_producers: leave blank for manual fill
                                  performers: prev.performers.length === 0 ? performers : prev.performers,
                                  session_musicians: prev.session_musicians.length === 0 ? sessionMusicians : prev.session_musicians,
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
                                    {[work.musicGenre, work.composers]
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
                              musicGenre: rec.genero ?? "",
                              composers: Array.isArray(rec.compositores)
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
                <Input value={societyCode} onChange={(e) => setSocietyCode(e.target.value)} disabled={isViewMode} placeholder="Código de Cadastro da Sociedade" className="h-8 text-sm min-w-0" />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Código ECAD</span>
                <Input value={ecadCode} onChange={(e) => setEcadCode(e.target.value)} disabled={isViewMode} placeholder="Código ECAD" className="h-8 text-sm min-w-0" data-testid="input-cod-ecad" />
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">Agregadora</span>
                <Select value={aggregator} onValueChange={setAggregator} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_AGGREGATOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-muted-foreground mb-1 block">ISRC</span>
                <div className="flex items-center gap-1">
                  <Input value={isrcCountryCode} onChange={(e) => setIsrcCountryCode(e.target.value)} disabled={isViewMode} placeholder="BR" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcRegistrantCode} onChange={(e) => setIsrcRegistrantCode(e.target.value)} disabled={isViewMode} placeholder="XXX" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={3} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcYear} onChange={(e) => setIsrcYear(e.target.value)} disabled={isViewMode} placeholder="00" className="h-8 px-2 text-sm flex-1 min-w-0 text-center font-sans" maxLength={2} />
                  <span className="text-muted-foreground font-light shrink-0">–</span>
                  <Input value={isrcDesignationCode} onChange={(e) => setIsrcDesignationCode(e.target.value)} disabled={isViewMode} placeholder="00000" className="h-8 px-2 text-sm flex-[1.5] min-w-0 text-center font-sans" maxLength={5} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Criada por IA</span>
                <div className="flex items-center h-8">
                  <Switch checked={aiUsed} onCheckedChange={setAiUsed} disabled={isViewMode} />
                </div>
              </div>
            </div>

            {/* Row 2: Instrumental | Issue | Original recording | Release | Duration */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Instrumental</span>
                <div className="flex items-center h-8">
                  <Switch checked={isInstrumental} onCheckedChange={setIsInstrumental} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Emissão</span>
                <DatePickerField value={issueDate} onChange={setIssueDate} disabled={isViewMode} placeholder="Data" data-testid="datepicker-emissao" />
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
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationMinutesError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">min</span>
                  <Input
                    data-testid="input-duracao-segundos"
                    className={`h-8 w-12 min-w-0 text-center px-2 text-sm ${durationSecondsError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    disabled={isViewMode}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">seg</span>
                </div>
                {(durationMinutesError || durationSecondsError) && (
                  <p className="text-xs text-destructive">{durationMinutesError || durationSecondsError}</p>
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
                <Select value={mediaType} onValueChange={setMediaType} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_MEDIA_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Nacional</span>
                <div className="flex items-center h-8">
                  <Switch checked={isNational} onCheckedChange={setIsNational} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Pub. Simultânea</span>
                <div className="flex items-center h-8">
                  <Switch checked={isSimultaneousPublication} onCheckedChange={setIsSimultaneousPublication} disabled={isViewMode} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Origem</span>
                <Select value={countryOfRecording} onValueChange={setCountryOfRecording} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_COUNTRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">País Publicação</span>
                <Select value={publicationCountry} onValueChange={setPublicationCountry} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_COUNTRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Classification | Status */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Classificação</span>
                <Select value={recordingClassification} onValueChange={setRecordingClassification} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground mb-1 block">Status</span>
                <Select value={status} onValueChange={setStatus} disabled={isViewMode}>
                  <SelectTrigger className="h-8 text-sm min-w-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PHONOGRAM_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
              {PHONOGRAM_PARTICIPATION_CATEGORIES.map((category) => (
                <div key={category}>{renderParticipationSection(category)}</div>
              ))}
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
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
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
        artist={viewArtist}
      />
    </Dialog>
  );
}

