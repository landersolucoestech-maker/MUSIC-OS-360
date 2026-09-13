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
import { toast } from "sonner";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { projectSchema } from "@/modules/projects/schemas/project-schema";
import { MUSICAL_GENRES } from "@/constants/musicalGenres";
import { LANGUAGES } from "@/constants/languages";
import { Plus, Upload, X, Music, FileAudio, Loader2, Link } from "lucide-react";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";

interface ProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: any;
  mode: "create" | "edit" | "view";
  onConcluido?: (projectId: string) => void;
}

interface MusicaData {
  id: string;
  nome: string;
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

const generosMusicais = MUSICAL_GENRES;

const idiomas = LANGUAGES;

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const createEmptyMusica = (): MusicaData => ({
  id: crypto.randomUUID(),
  nome: "",
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
function normTipo(v: string | null | undefined): string {
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

// ── Autocomplete: busca server-side por nome_artistico/nome_civil (Task I —
// antes filtrava só os primeiros 50 artistas do tenant carregados via
// useArtistas() sem filtro; agora cada tecla digitada (debounced) refaz a
// busca no backend). Texto livre continua permitido.
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

export function ProjectFormModal({ open, onOpenChange, projeto, mode, onConcluido }: ProjectFormModalProps) {
  const { addProject, updateProject } = useProjects();
  const { upload: uploadToR2 } = useUploadToR2();

  // Initialize state from projeto when the component mounts fresh (key-based remount ensures fresh mount per project).
  const [tipoLancamento, setTipoLancamento] = useState(() => normTipo(projeto?.type));
  const [nomeEP, setNomeEP] = useState(() => (mode !== "create" && projeto?.type !== "single") ? (projeto?.title || "") : "");
  const [musicas, setMusicas] = useState<MusicaData[]>(() => {
    if (mode === "create" || !projeto) return [createEmptyMusica()];
    // musicas[] normalizada em project_tracks (migration 20260718000013) —
    // a API já retorna o array hidratado em projeto.musicas.
    const saved = (projeto as { musicas?: MusicaData[] }).musicas;
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((m) => ({
        ...createEmptyMusica(), ...m,
        soloFeat: normEnum(m.soloFeat, "solo"),
        originalRemix: normEnum(m.originalRemix, "original"),
        instrumental: normEnum(m.instrumental, "nao"),
        genero: normEnum(m.genero, ""),
        idioma: normEnum(m.idioma, ""),
        id: m.id || crypto.randomUUID(),
      }));
    }
    const type = normTipo(projeto?.type);
    const generoHerdado = normEnum(projeto?.genero as string | undefined, "");
    return [{ ...createEmptyMusica(), nome: type === "single" ? (projeto?.title || "") : "", genero: generoHerdado }];
  });
  const [observacoes, setObservacoes] = useState(() => projeto?.notes || "");
  const [status, setStatus] = useState(() => normStatus(projeto?.status));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Projeto" : mode === "edit" ? "Editar Projeto" : "Detalhes do Projeto";
  const showAlbumEpName = tipoLancamento === "album" || tipoLancamento === "ep";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    const validation = projectSchema.safeParse({
      tipoLancamento,
      nomeEP: nomeEP || "",
      status: status || "",
      notes: observacoes || "",
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos obrigatórios");
      return;
    }

    if (!tipoLancamento) {
      toast.error("Selecione o tipo de lançamento!");
      return;
    }

    const title = showAlbumEpName
      ? nomeEP.trim()
      : (musicas[0]?.nome?.trim() || "");

    if (!title) {
      toast.error(!showAlbumEpName
        ? "Digite o nome da música!"
        : `Digite o nome do ${tipoLancamento === "ep" ? "EP" : "Álbum"}!`);
      return;
    }
    // Remove campos apenas locais (File metadata, flag de upload) antes de enviar —
    // musicas[] vai para colunas próprias (project_tracks), nunca mais serializada em descricao.
    const musicasParaSalvar = musicas.map(({ arquivoAudio: _a, _uploading: _u, ...m }) => m);

    // Persiste o gênero da primeira música como campo direto para filtros eficientes
    const genero = musicas[0]?.genero || null;

    const basePayload: ProjectUpdate = {
      title,
      type: tipoLancamento,
      status,
      notes: observacoes || null,
      genero,
      musicas: musicasParaSalvar,
    };

    try {
      setIsSubmitting(true);
      let savedId: string | undefined;
      if (mode === "create") {
        const insertPayload: ProjectInsert = {
          title,
          type: tipoLancamento,
          status,
          notes: observacoes || null,
          genero,
          musicas: musicasParaSalvar,
        };
        const created = await addProject.mutateAsync(insertPayload) as { id: string };
        savedId = created?.id;
      } else if (projeto?.id) {
        await updateProject.mutateAsync({
          id: projeto.id as string,
          ...basePayload,
          expectedUpdatedAt: getExpectedUpdatedAt(projeto),
        });
        savedId = projeto.id as string;
      }
      onOpenChange(false);
      if (status === "completed" && savedId) {
        onConcluido?.(savedId);
      }
    } catch (err) {
      if (handleConcurrencyConflict(err, "projeto")) return;
      // demais erros: toast já é exibido por useDataQuery
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMusica = () => {
    setMusicas([...musicas, createEmptyMusica()]);
  };

  const removeMusica = (id: string) => {
    if (musicas.length > 1) {
      setMusicas(musicas.filter(m => m.id !== id));
    }
  };

  const updateMusica = (id: string, field: keyof MusicaData, value: any) => {
    setMusicas(musicas.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addItemToMusica = (musicaId: string, field: 'compositores' | 'interpretes' | 'produtores') => {
    setMusicas(musicas.map(m => {
      if (m.id === musicaId) {
        return { ...m, [field]: [...m[field], ""] };
      }
      return m;
    }));
  };

  const updateItemInMusica = (musicaId: string, field: 'compositores' | 'interpretes' | 'produtores', index: number, value: string) => {
    setMusicas(musicas.map(m => {
      if (m.id === musicaId) {
        const newArray = [...m[field]];
        newArray[index] = value;
        return { ...m, [field]: newArray };
      }
      return m;
    }));
  };

  const removeItemFromMusica = (musicaId: string, field: 'compositores' | 'interpretes' | 'produtores', index: number) => {
    setMusicas(musicas.map(m => {
      if (m.id === musicaId && m[field].length > 1) {
        const newArray = m[field].filter((_, i) => i !== index);
        return { ...m, [field]: newArray };
      }
      return m;
    }));
  };

  const handleAudioUpload = async (musicaId: string, e: React.ChangeEvent<HTMLInputElement>) => {
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
    updateMusica(musicaId, 'arquivoAudio', { name: file.name, size: file.size });
    updateMusica(musicaId, '_uploading', true);

    try {
      const { publicUrl } = await uploadToR2({
        file,
        category: "audio",
        entity:   "project",
        entityId: projeto?.id as string | undefined,
      });
      updateMusica(musicaId, 'audioUrl', publicUrl);
      toast.success("Áudio enviado e link gerado com sucesso!");
    } catch (err) {
      const msg = err instanceof R2NotConfiguredError
        ? err.message
        : err instanceof Error ? err.message : "Erro no upload do áudio";
      toast.error(`Upload falhou: ${msg}`);
      // Nunca finge sucesso: sem URL real, remove o arquivo local exibido.
      updateMusica(musicaId, 'arquivoAudio', null);
    } finally {
      updateMusica(musicaId, '_uploading', false);
    }
  };

  const renderMusicaForm = (musica: MusicaData, index: number) => (
    <div key={musica.id} className="border border-border rounded-lg p-4 space-y-4 bg-muted/10">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Detalhes da Música {tipoLancamento !== "single" && `#${index + 1}`}
        </h4>
        {tipoLancamento !== "single" && musicas.length > 1 && !isViewMode && (
          <Button type="button" variant="ghost" size="sm" onClick={() => removeMusica(musica.id)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Nome da Música *</Label>
          <Input 
            value={musica.nome} 
            onChange={(e) => updateMusica(musica.id, 'nome', e.target.value)} 
            disabled={isViewMode} 
            placeholder="Digite o nome da música" 
          />
        </div>
        <div className="space-y-2">
          <Label>Solo/Feat *</Label>
          <Select value={musica.soloFeat} onValueChange={(v) => updateMusica(musica.id, 'soloFeat', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="feat">Feat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Original/Remix *</Label>
          <Select value={musica.originalRemix} onValueChange={(v) => updateMusica(musica.id, 'originalRemix', v)} disabled={isViewMode}>
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
          <Select value={musica.instrumental || "nao"} onValueChange={(v) => updateMusica(musica.id, 'instrumental', v)} disabled={isViewMode}>
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
              value={musica.duracaoMin} 
              onChange={(e) => updateMusica(musica.id, 'duracaoMin', e.target.value)} 
              disabled={isViewMode} 
              placeholder="Min" 
              className="min-w-0 flex-1 px-2"
            />
            <span className="text-muted-foreground shrink-0">:</span>
            <Input 
              value={musica.duracaoSeg} 
              onChange={(e) => updateMusica(musica.id, 'duracaoSeg', e.target.value)} 
              disabled={isViewMode} 
              placeholder="Seg" 
              className="min-w-0 flex-1 px-2"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gênero Musical *</Label>
          <Select value={musica.genero} onValueChange={(v) => updateMusica(musica.id, 'genero', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
            <SelectContent>
              {generosMusicais.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Idioma da Música *</Label>
          <Select value={musica.idioma} onValueChange={(v) => updateMusica(musica.id, 'idioma', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o idioma" /></SelectTrigger>
            <SelectContent>
              {idiomas.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Compositores */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Compositores *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToMusica(musica.id, 'compositores')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Compositor
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {musica.compositores.map((comp, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={comp}
                onChange={(v) => updateItemInMusica(musica.id, 'compositores', idx, v)}
                placeholder="Nome do compositor"
                disabled={isViewMode}
              />
              {!isViewMode && musica.compositores.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromMusica(musica.id, 'compositores', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Intérpretes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Intérpretes *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToMusica(musica.id, 'interpretes')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Intérprete
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {musica.interpretes.map((int, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={int}
                onChange={(v) => updateItemInMusica(musica.id, 'interpretes', idx, v)}
                placeholder="Nome do intérprete"
                disabled={isViewMode}
              />
              {!isViewMode && musica.interpretes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromMusica(musica.id, 'interpretes', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Produtores */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Produtores *</Label>
          {!isViewMode && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItemToMusica(musica.id, 'produtores')}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Produtor
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {musica.produtores.map((prod, idx) => (
            <div key={idx} className="flex gap-2">
              <ArtistNameInput
                value={prod}
                onChange={(v) => updateItemInMusica(musica.id, 'produtores', idx, v)}
                placeholder="Nome do produtor"
                disabled={isViewMode}
              />
              {!isViewMode && musica.produtores.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFromMusica(musica.id, 'produtores', idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Letra */}
      <div className="space-y-2">
        <Label>Letra</Label>
        <Textarea 
          value={musica.letra} 
          onChange={(e) => updateMusica(musica.id, 'letra', e.target.value)} 
          disabled={isViewMode} 
          rows={4} 
          placeholder="Digite a letra da música..." 
        />
      </div>

      {/* Upload de Áudio */}
      <div className="space-y-2">
        <Label>Arquivos de Áudio (MP3/WAV)</Label>
        <input
          ref={(el) => { audioInputRefs.current[musica.id] = el; }}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav"
          onChange={(e) => handleAudioUpload(musica.id, e)}
          className="hidden"
          disabled={isViewMode}
        />
        {musica.arquivoAudio ? (
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              {musica._uploading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : (
                <FileAudio className="w-8 h-8 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium">{musica.arquivoAudio.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(musica.arquivoAudio.size)}
                  {musica._uploading && " — enviando..."}
                  {!musica._uploading && musica.audioUrl && " — link gerado ✓"}
                </p>
                {!musica._uploading && musica.audioUrl && (
                  <a
                    href={musica.audioUrl}
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
                  onClick={() => audioInputRefs.current[musica.id]?.click()}
                  disabled={!!musica._uploading}
                >
                  Trocar
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => {
                    updateMusica(musica.id, 'arquivoAudio', null);
                    updateMusica(musica.id, 'audioUrl', undefined);
                  }}
                  disabled={!!musica._uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : musica.audioUrl ? (
          /* Remote audio from import/previous save — no local file */
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <FileAudio className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{musica.audioUrl.split("/").pop() || "Áudio remoto"}</p>
                <a
                  href={musica.audioUrl}
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
                  onClick={() => audioInputRefs.current[musica.id]?.click()}
                >
                  Trocar
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => updateMusica(musica.id, 'audioUrl', undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-warning/50 rounded-lg p-8 text-center bg-muted/20 cursor-pointer hover:border-warning hover:bg-muted/30 transition-colors"
            onClick={() => !isViewMode && audioInputRefs.current[musica.id]?.click()}
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
            {/* Tipo de Lançamento */}
            <div className={showAlbumEpName ? "space-y-2" : "space-y-2 md:col-span-2"}>
              <Label>Tipo de Lançamento *</Label>
              <Select value={tipoLancamento} onValueChange={setTipoLancamento} disabled={isViewMode}>
                <SelectTrigger className="border-primary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="ep">EP</SelectItem>
                  <SelectItem value="album">Álbum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome do EP/Álbum (condicional) */}
            {showAlbumEpName && (
              <div className="space-y-2">
                <Label>Nome do {tipoLancamento === "ep" ? "EP" : "Álbum"} *</Label>
                <Input
                  value={nomeEP}
                  onChange={(e) => setNomeEP(e.target.value)}
                  disabled={isViewMode}
                  placeholder={`Digite o nome do ${tipoLancamento === "ep" ? "EP" : "Álbum"}`}
                />
              </div>
            )}
          </div>

          {/* Seção de Músicas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{tipoLancamento === "single" ? "Música" : "Músicas"}</h3>
              {tipoLancamento !== "single" && !isViewMode && (
                <Button type="button" variant="outline" onClick={addMusica}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Música
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {musicas.map((musica, index) => renderMusicaForm(musica, index))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea 
              value={observacoes} 
              onChange={(e) => setObservacoes(e.target.value)} 
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

