import { useState, useRef, useEffect } from "react";
import { type Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { useEntityLookup } from "@/shared/hooks/useEntityLookup";
import { useProjects, type ProjectInsert, type ProjectUpdate } from "@/modules/projects/hooks/useProjects";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { FormTextarea } from "@/shared/components/FormField";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { toast } from "sonner";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { projectSchema } from "@/modules/projects/schemas/project-schema";
import { MUSICAL_GENRES } from "@/constants/musicalGenres";
import { LANGUAGES } from "@/constants/languages";
import { Plus, Upload, X, Music, FileAudio, Loader2, Link } from "lucide-react";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";
import { toUserMessage } from "@/shared/lib/errors";

interface ProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: any;
  mode: "create" | "edit" | "view";
  onConcluido?: (projectId: string) => void;
}

interface TrackData {
  id: string;
  name: string;
  soloFeat: string;
  originalRemix: string;
  instrumental: string;
  duracaoMin: string;
  duracaoSeg: string;
  genero: string;
  idioma: string;
  compositores: string[];
  interpretes: string[];
  produtores: string[];
  letra: string;
  arquivoAudio: { name: string; size: number } | null;
  audioUrl?: string;
  _uploading?: boolean;
}

interface UploadedAudio {
  name: string;
  size: number;
}

const musicGenres = MUSICAL_GENRES;

const idiomas = LANGUAGES;

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const createEmptyTrack = (): TrackData => ({
  id: crypto.randomUUID(),
  name: "",
  soloFeat: "solo",
  originalRemix: "original",
  instrumental: "nao",
  duracaoMin: "",
  duracaoSeg: "",
  genero: "",
  idioma: "",
  compositores: [""],
  interpretes: [""],
  produtores: [""],
  letra: "",
  arquivoAudio: null,
});

// Normalize stored enum values to match Select option values exactly.
// Handles capitalization differences, accent variants and legacy typos.
function normType(v: string | null | undefined): string {
  const s = (v || "").toLowerCase().trim();
  if (s === "álbum" || s === "album") return "album";
  if (s === "ep") return "ep";
  return "single";
}
function normStatus(v: string | null | undefined): string {
  const s = (v || "").toLowerCase().trim();
  if (s === "in_progress" || s === "em_andamento" || s === "andamento") return "in_progress";
  if (s === "completed" || s === "concluido" || s === "concluído") return "completed";
  if (s === "cancelled" || s === "cancelado") return "cancelled";
  return "planning";
}
function normEnum(v: string | undefined, fallback: string): string {
  const s = (v || fallback).toLowerCase().trim() || fallback;
  // Strip Portuguese accents from boolean-like fields ("não" → "nao")
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || fallback;
}

// ── Autocomplete: server-side search by nome_artistico/nome_civil (Task I —
// it used to filter only the tenant's first 50 artists loaded by unfiltered
// useArtistas(); now every (debounced) keystroke searches the backend again).
// Free text is still allowed.
interface ArtistNameInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ArtistNameInput({ value, onChange, placeholder, disabled }: ArtistNameInputProps) {
  const [inputText, setInputText] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when parent resets value (e.g. modal open)
  useEffect(() => { setInputText(value); }, [value]);

  // Close on outside click
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
      />
      {open && suggestions.length > 0 && !disabled && (
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

export function ProjectFormModal({ open, onOpenChange, projeto: project, mode, onConcluido: onCompleted }: ProjectFormModalProps) {
  const { addProject, updateProject } = useProjects();
  const { upload: uploadToR2 } = useUploadToR2();

  // Initialize state from projeto when the component mounts fresh (key-based remount ensures fresh mount per project).
  const [releaseType, setReleaseType] = useState(() => normType(project?.type));
  const [epName, setEpName] = useState(() => (mode !== "create" && project?.type !== "single") ? (project?.title || "") : "");
  const [tracks, setTracks] = useState<TrackData[]>(() => {
    if (mode === "create" || !project) return [createEmptyTrack()];
    // musicas[] is normalized into project_tracks (migration 20260718000013) —
    // the API already returns the hydrated array in projeto.musicas.
    const saved = (project as { musicas?: TrackData[] }).musicas;
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((m) => ({
        ...createEmptyTrack(), ...m,
        soloFeat: normEnum(m.soloFeat, "solo"),
        originalRemix: normEnum(m.originalRemix, "original"),
        instrumental: normEnum(m.instrumental, "nao"),
        genero: normEnum(m.genero, ""),
        idioma: normEnum(m.idioma, ""),
        id: m.id || crypto.randomUUID(),
      }));
    }
    const type = normType(project?.type);
    const inheritedGenre = normEnum(project?.music_genre as string | undefined, "");
    return [{ ...createEmptyTrack(), name: type === "single" ? (project?.title || "") : "", genero: inheritedGenre }];
  });
  const [notes, setNotes] = useState(() => project?.notes || "");
  // GAP-0001 / DEC-001 (MUSICAL_PROJECT_CANONICAL_HUB): the main artist and the
  // production budget are legitimate attributes of the music project —
  // columns projects.artist_id / projects.budget, accepted by the real DTO.
  const [artistId, setArtistId] = useState<string | null>(() => (project?.artist_id as string | null | undefined) ?? null);
  const [budget, setBudget] = useState<string>(() =>
    project?.budget != null && project?.budget !== "" ? String(project.budget) : "");
  const [status, setStatus] = useState(() => normStatus(project?.status));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Projeto" : mode === "edit" ? "Editar Projeto" : "Detalhes do Projeto";
  const showAlbumEpName = releaseType === "album" || releaseType === "ep";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    const validation = projectSchema.safeParse({
      tipoLancamento: releaseType,
      nomeEP: epName || "",
      status: status || "",
      notes: notes || "",
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!releaseType) {
      toast.error("Selecione o tipo de lançamento!");
      return;
    }

    const title = showAlbumEpName
      ? epName.trim()
      : (tracks[0]?.name?.trim() || "");

    if (!title) {
      toast.error(!showAlbumEpName
        ? "Digite o nome da música!"
        : `Digite o nome do ${releaseType === "ep" ? "EP" : "Álbum"}!`);
      return;
    }
    const budgetTrim = budget.trim();
    const budgetNum = budgetTrim === "" ? null : Number(budgetTrim);
    if (budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum < 0)) {
      toast.error("Orçamento deve ser um valor numérico maior ou igual a zero.");
      return;
    }

    // Removes local-only fields (File metadata, upload flag) before sending —
    // musicas[] goes to its own storage (project_tracks), never again serialized into descricao.
    const tracksToSave = tracks.map(({ arquivoAudio: _a, _uploading: _u, ...m }) => m);

    // Persists the first track's genre as a direct field for efficient filtering
    const genre = tracks[0]?.genero || null;

    const basePayload: ProjectUpdate = {
      title,
      type: releaseType,
      status,
      notes: notes || null,
      music_genre: genre,
      musicas: tracksToSave,
      artist_id: artistId,
      budget: budgetNum,
    };

    try {
      setIsSubmitting(true);
      let savedId: string | undefined;
      if (mode === "create") {
        const insertPayload: ProjectInsert = {
          title,
          type: releaseType,
          status,
          notes: notes || null,
          music_genre: genre,
          musicas: tracksToSave,
          artist_id: artistId,
          budget: budgetNum,
        };
        const created = await addProject.mutateAsync(insertPayload) as { id: string };
        savedId = created?.id;
      } else if (project?.id) {
        await updateProject.mutateAsync({
          id: project.id as string,
          ...basePayload,
          expectedUpdatedAt: getExpectedUpdatedAt(project),
        });
        savedId = project.id as string;
      }
      onOpenChange(false);
      if (status === "completed" && savedId) {
        onCompleted?.(savedId);
      }
    } catch (err) {
      if (handleConcurrencyConflict(err, "projeto")) return;
      // other errors: the toast is already shown by useDataQuery
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTrack = () => {
    setTracks([...tracks, createEmptyTrack()]);
  };

  const removeTrack = (id: string) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter(m => m.id !== id));
    }
  };

  const updateTrack = (id: string, field: keyof TrackData, value: any) => {
    setTracks(tracks.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addItemToTrack = (trackId: string, field: 'compositores' | 'interpretes' | 'produtores') => {
    setTracks(tracks.map(m => {
      if (m.id === trackId) {
        return { ...m, [field]: [...m[field], ""] };
      }
      return m;
    }));
  };

  const updateItemInTrack = (trackId: string, field: 'compositores' | 'interpretes' | 'produtores', index: number, value: string) => {
    setTracks(tracks.map(m => {
      if (m.id === trackId) {
        const newArray = [...m[field]];
        newArray[index] = value;
        return { ...m, [field]: newArray };
      }
      return m;
    }));
  };

  const removeItemFromTrack = (trackId: string, field: 'compositores' | 'interpretes' | 'produtores', index: number) => {
    setTracks(tracks.map(m => {
      if (m.id === trackId && m[field].length > 1) {
        const newArray = m[field].filter((_, i) => i !== index);
        return { ...m, [field]: newArray };
      }
      return m;
    }));
  };

  const handleAudioUpload = async (trackId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 50MB");
      return;
    }

    if (!['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'].includes(file.type)) {
      toast.error("Formato inválido. Use MP3 ou WAV");
      return;
    }

    // Show local file immediately for UX feedback
    updateTrack(trackId, 'arquivoAudio', { name: file.name, size: file.size });
    updateTrack(trackId, '_uploading', true);

    try {
      const { publicUrl } = await uploadToR2({
        file,
        category: "audio",
        entity:   "project",
        entityId: project?.id as string | undefined,
      });
      updateTrack(trackId, 'audioUrl', publicUrl);
      toast.success("Áudio enviado e link gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof R2NotConfiguredError
        ? toUserMessage(err)
        : toUserMessage(err, "Erro no upload do áudio");
      toast.error(`Upload falhou: ${msg}`);
      // Never fakes success: without a real URL, removes the displayed local file.
      updateTrack(trackId, 'arquivoAudio', null);
    } finally {
      updateTrack(trackId, '_uploading', false);
    }
  };

  const renderTrackForm = (track: TrackData, index: number) => (
    <div key={track.id} className="border border-border rounded-lg p-4 space-y-4 bg-muted/10">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Detalhes da Música {releaseType !== "single" && `#${index + 1}`}
        </h4>
        {releaseType !== "single" && tracks.length > 1 && !isViewMode && (
          <Button type="button" variant="ghost" size="sm" onClick={() => removeTrack(track.id)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Nome da Música *</Label>
          <Input
            value={track.name}
            onChange={(e) => updateTrack(track.id, 'name', e.target.value)}
            disabled={isViewMode} 
            placeholder="Digite o nome da música" 
          />
        </div>
        <div className="space-y-2">
          <Label>Solo/Feat *</Label>
          <Select value={track.soloFeat} onValueChange={(v) => updateTrack(track.id, 'soloFeat', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="feat">Feat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Original/Remix *</Label>
          <Select value={track.originalRemix} onValueChange={(v) => updateTrack(track.id, 'originalRemix', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="remix">Remix</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Instrumental *</Label>
          <Select value={track.instrumental || "nao"} onValueChange={(v) => updateTrack(track.id, 'instrumental', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label>Duração</Label>
          <div className="flex items-center gap-1 min-w-0">
            <Input 
              value={track.duracaoMin}
              onChange={(e) => updateTrack(track.id, 'duracaoMin', e.target.value)}
              disabled={isViewMode} 
              placeholder="Min" 
              className="min-w-0 flex-1 px-2"
            />
            <span className="text-muted-foreground shrink-0">:</span>
            <Input 
              value={track.duracaoSeg}
              onChange={(e) => updateTrack(track.id, 'duracaoSeg', e.target.value)}
              disabled={isViewMode} 
              placeholder="Seg" 
              className="min-w-0 flex-1 px-2"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gênero Musical *</Label>
          <Select value={track.genero} onValueChange={(v) => updateTrack(track.id, 'genero', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
            <SelectContent>
              {musicGenres.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Idioma da Música *</Label>
          <Select value={track.idioma} onValueChange={(v) => updateTrack(track.id, 'idioma', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o idioma" /></SelectTrigger>
            <SelectContent>
              {idiomas.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Composers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Compositores *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToTrack(track.id, 'compositores')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Compositor
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {track.compositores.map((comp, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={comp}
                onChange={(v) => updateItemInTrack(track.id, 'compositores', idx, v)}
                placeholder="Nome do compositor"
                disabled={isViewMode}
              />
              {!isViewMode && track.compositores.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromTrack(track.id, 'compositores', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Intérpretes *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToTrack(track.id, 'interpretes')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Intérprete
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {track.interpretes.map((int, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={int}
                onChange={(v) => updateItemInTrack(track.id, 'interpretes', idx, v)}
                placeholder="Nome do intérprete"
                disabled={isViewMode}
              />
              {!isViewMode && track.interpretes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromTrack(track.id, 'interpretes', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Producers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Produtores *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToTrack(track.id, 'produtores')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Produtor
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {track.produtores.map((prod, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={prod}
                onChange={(v) => updateItemInTrack(track.id, 'produtores', idx, v)}
                placeholder="Nome do produtor"
                disabled={isViewMode}
              />
              {!isViewMode && track.produtores.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromTrack(track.id, 'produtores', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lyrics */}
      <div className="space-y-2">
        <Label>Letra</Label>
        <Textarea 
          value={track.letra}
          onChange={(e) => updateTrack(track.id, 'letra', e.target.value)}
          disabled={isViewMode} 
          rows={4} 
          placeholder="Digite a letra da música..." 
        />
      </div>

      {/* Audio upload */}
      <div className="space-y-2">
        <Label>Arquivos de Áudio (MP3/WAV)</Label>
        <input
          ref={(el) => { audioInputRefs.current[track.id] = el; }}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav"
          onChange={(e) => handleAudioUpload(track.id, e)}
          className="hidden"
          disabled={isViewMode}
        />
        {track.arquivoAudio ? (
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              {track._uploading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : (
                <FileAudio className="w-8 h-8 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium">{track.arquivoAudio.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(track.arquivoAudio.size)}
                  {track._uploading && " — enviando..."}
                  {!track._uploading && track.audioUrl && " — link gerado ✓"}
                </p>
                {!track._uploading && track.audioUrl && (
                  <a
                    href={track.audioUrl}
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
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => audioInputRefs.current[track.id]?.click()}
                  disabled={!!track._uploading}
                >
                  Trocar
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => {
                    updateTrack(track.id, 'arquivoAudio', null);
                    updateTrack(track.id, 'audioUrl', undefined);
                  }}
                  disabled={!!track._uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : track.audioUrl ? (
          /* Remote audio from import/previous save — no local file */
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <FileAudio className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{track.audioUrl.split("/").pop() || "Áudio remoto"}</p>
                <a
                  href={track.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link className="w-3 h-3" /> Ver link de download
                </a>
              </div>
            </div>
            {!isViewMode && (
              <div className="flex gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => audioInputRefs.current[track.id]?.click()}
                >
                  Trocar
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => updateTrack(track.id, 'audioUrl', undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-warning/50 rounded-lg p-8 text-center bg-muted/20 cursor-pointer hover:border-warning hover:bg-muted/30 transition-colors"
            onClick={() => !isViewMode && audioInputRefs.current[track.id]?.click()}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Clique para selecionar arquivos ou arraste e solte aqui</p>
            <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: MP3, WAV (máx. 50MB)</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Release type */}
            <div className={showAlbumEpName ? "space-y-2" : "space-y-2 md:col-span-2"}>
              <Label>Tipo de Lançamento *</Label>
              <Select value={releaseType} onValueChange={setReleaseType} disabled={isViewMode}>
                <SelectTrigger className="border-primary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="ep">EP</SelectItem>
                  <SelectItem value="album">Álbum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* EP/album name (conditional) */}
            {showAlbumEpName && (
              <div className="space-y-2">
                <Label>Nome do {releaseType === "ep" ? "EP" : "Álbum"} *</Label>
                <Input
                  value={epName}
                  onChange={(e) => setEpName(e.target.value)}
                  disabled={isViewMode}
                  placeholder={`Digite o nome do ${releaseType === "ep" ? "EP" : "Álbum"}`}
                />
              </div>
            )}
          </div>

          {/* Main artist and budget (GAP-0001 / DEC-001) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Artista principal</Label>
              <AsyncEntityCombobox<Artist>
                table="artistas"
                getLabel={(a) => a.stageName ?? ""}
                value={artistId}
                onChange={(id) => setArtistId(id || null)}
                placeholder="Selecione o artista"
                searchPlaceholder="Buscar artista..."
                disabled={isViewMode}
                data-testid="select-projeto-artista"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-budget">Orçamento de produção (R$)</Label>
              <Input
                id="project-budget"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={isViewMode}
                placeholder="0,00"
                data-testid="input-project-budget"
              />
            </div>
          </div>

          {/* Tracks section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{releaseType === "single" ? "Música" : "Músicas"}</h3>
              {releaseType !== "single" && !isViewMode && (
                <Button type="button" variant="outline" onClick={addTrack}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Música
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {tracks.map((track, index) => renderTrackForm(track, index))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isViewMode} 
              rows={3} 
              placeholder="Observações adicionais sobre o projeto..." 
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={isViewMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planejamento</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : mode === "create" ? "Criar Projeto" : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

