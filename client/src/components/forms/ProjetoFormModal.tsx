import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormTextarea } from "@/components/forms/FormField";
import { toast } from "sonner";
import { Plus, Upload, X, Music, FileAudio } from "lucide-react";

interface ProjetoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: any;
  mode: "create" | "edit" | "view";
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
}

interface UploadedAudio {
  name: string;
  size: number;
}

const generosMusicais = ["Funk", "Pop", "Rock", "Sertanejo", "Trap", "Rap/Hip-Hop", "Pagode", "Forró", "MPB", "Eletrônica", "Gospel", "Reggaeton", "R&B", "Outro"];
const idiomas = ["Português", "Inglês", "Espanhol", "Francês", "Italiano", "Alemão", "Japonês", "Coreano", "Outro"];

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

export function ProjetoFormModal({ open, onOpenChange, projeto, mode }: ProjetoFormModalProps) {
  const [tipoLancamento, setTipoLancamento] = useState(projeto?.tipo || "single");
  const [nomeEP, setNomeEP] = useState("");
  const [artistaResponsavel, setArtistaResponsavel] = useState("");
  const [musicas, setMusicas] = useState<MusicaData[]>([createEmptyMusica()]);
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("rascunho");

  const audioInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Projeto" : mode === "edit" ? "Editar Projeto" : "Detalhes do Projeto";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;
    
    if (!tipoLancamento) {
      toast.error("Selecione o tipo de lançamento!");
      return;
    }
    if ((tipoLancamento === "ep" || tipoLancamento === "album") && !nomeEP) {
      toast.error(`Digite o nome do ${tipoLancamento === "ep" ? "EP" : "Álbum"}!`);
      return;
    }
    if (!artistaResponsavel) {
      toast.error("Selecione o artista responsável!");
      return;
    }
    
    toast.success(mode === "create" ? "Projeto criado com sucesso!" : "Projeto atualizado com sucesso!");
    onOpenChange(false);
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

  const handleAudioUpload = (musicaId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 50MB");
      return;
    }
    
    if (!['audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(file.type)) {
      toast.error("Formato inválido. Use MP3 ou WAV");
      return;
    }

    updateMusica(musicaId, 'arquivoAudio', { name: file.name, size: file.size });
    toast.success("Arquivo de áudio carregado!");
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
          <Select value={musica.instrumental} onValueChange={(v) => updateMusica(musica.id, 'instrumental', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Duração</Label>
          <div className="flex items-center gap-2">
            <Input 
              value={musica.duracaoMin} 
              onChange={(e) => updateMusica(musica.id, 'duracaoMin', e.target.value)} 
              disabled={isViewMode} 
              placeholder="Min" 
              className="w-16"
            />
            <span className="text-muted-foreground">:</span>
            <Input 
              value={musica.duracaoSeg} 
              onChange={(e) => updateMusica(musica.id, 'duracaoSeg', e.target.value)} 
              disabled={isViewMode} 
              placeholder="Seg" 
              className="w-16"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gênero Musical *</Label>
          <Select value={musica.genero} onValueChange={(v) => updateMusica(musica.id, 'genero', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
            <SelectContent>
              {generosMusicais.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Idioma da Música *</Label>
          <Select value={musica.idioma} onValueChange={(v) => updateMusica(musica.id, 'idioma', v)} disabled={isViewMode}>
            <SelectTrigger><SelectValue placeholder="Selecione o idioma" /></SelectTrigger>
            <SelectContent>
              {idiomas.map(i => <SelectItem key={i} value={i.toLowerCase()}>{i}</SelectItem>)}
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
              <Input 
                value={comp} 
                onChange={(e) => updateItemInMusica(musica.id, 'compositores', idx, e.target.value)} 
                disabled={isViewMode} 
                placeholder="Nome do compositor" 
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
              <Input 
                value={int} 
                onChange={(e) => updateItemInMusica(musica.id, 'interpretes', idx, e.target.value)} 
                disabled={isViewMode} 
                placeholder="Nome do intérprete" 
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
              <Input 
                value={prod} 
                onChange={(e) => updateItemInMusica(musica.id, 'produtores', idx, e.target.value)} 
                disabled={isViewMode} 
                placeholder="Nome do produtor" 
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
              <FileAudio className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{musica.arquivoAudio.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(musica.arquivoAudio.size)}</p>
              </div>
            </div>
            {!isViewMode && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => audioInputRefs.current[musica.id]?.click()}>
                  Trocar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => updateMusica(musica.id, 'arquivoAudio', null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div 
            className="border-2 border-dashed border-amber-500/50 rounded-lg p-8 text-center bg-muted/20 cursor-pointer hover:border-amber-500 hover:bg-muted/30 transition-colors"
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
          {/* Tipo de Lançamento */}
          <div className="space-y-2">
            <Label>Tipo de Lançamento *</Label>
            <Select value={tipoLancamento} onValueChange={setTipoLancamento} disabled={isViewMode}>
              <SelectTrigger className="border-red-500"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="ep">EP</SelectItem>
                <SelectItem value="album">Álbum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nome do EP/Álbum (condicional) */}
          {(tipoLancamento === "ep" || tipoLancamento === "album") && (
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

          {/* Artista Responsável */}
          <div className="space-y-2">
            <Label>Artista Responsável</Label>
            <Select value={artistaResponsavel} onValueChange={setArtistaResponsavel} disabled={isViewMode}>
              <SelectTrigger><SelectValue placeholder="Selecione o artista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="davizzin">Davizzin</SelectItem>
                <SelectItem value="mc-loolz">Mc Loolz</SelectItem>
                <SelectItem value="dj-lael">Dj Lael</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                {mode === "create" ? "Criar Projeto" : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
