import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, Folder, Music, Plus, Upload, Image as ImageIcon, X, ExternalLink, LogIn, AlertCircle } from "lucide-react";

// FieldError component padronizado
const FieldError = ({ error }: { error?: string }) => {
  if (!error) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3" />
      {error}
    </p>
  );
};

interface Faixa {
  id: number;
  titulo: string;
  artista: string;
  isrc: string;
  compositores: string[];
  interpretes: string[];
  produtores: string[];
  arquivoAudio: File | null;
  letra: string;
}

interface LancamentoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento?: any;
  mode: "create" | "edit" | "view";
}

export function LancamentoFormModal({ open, onOpenChange, lancamento, mode }: LancamentoFormModalProps) {
  const [formData, setFormData] = useState({
    projeto: "",
    titulo: lancamento?.title || "",
    artista: lancamento?.artist || "",
    tipo: "",
    codigoUPC: "",
    genero: "",
    idioma: "",
    dataLancamento: "",
    status: "analise",
    gravadora: "",
    copyright: "",
    distribuidora: "onerpm",
    notasDistribuicao: "",
  });

  const [faixas, setFaixas] = useState<Faixa[]>([
    {
      id: 1,
      titulo: "",
      artista: "",
      isrc: "",
      compositores: [""],
      interpretes: [""],
      produtores: [""],
      arquivoAudio: null,
      letra: "",
    },
  ]);

  const [capaPrincipal, setCapaPrincipal] = useState<File | null>(null);
  const [faixasOpen, setFaixasOpen] = useState(true);
  const [metadadosOpen, setMetadadosOpen] = useState(true);
  const [artesOpen, setArtesOpen] = useState(true);
  const [distribuicaoOpen, setDistribuicaoOpen] = useState(true);
  const [distribuidoraConectada, setDistribuidoraConectada] = useState(false);

  const isViewMode = mode === "view";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;
    toast.success(mode === "create" ? "Lançamento criado!" : "Lançamento atualizado!");
    onOpenChange(false);
  };

  const addFaixa = () => {
    setFaixas([
      ...faixas,
      {
        id: faixas.length + 1,
        titulo: "",
        artista: "",
        isrc: "",
        compositores: [""],
        interpretes: [""],
        produtores: [""],
        arquivoAudio: null,
        letra: "",
      },
    ]);
  };

  const removeFaixa = (id: number) => {
    if (faixas.length > 1) {
      setFaixas(faixas.filter((f) => f.id !== id));
    }
  };

  const updateFaixa = (id: number, field: keyof Faixa, value: any) => {
    setFaixas(faixas.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const addItemToFaixaArray = (faixaId: number, field: "compositores" | "interpretes" | "produtores") => {
    setFaixas(
      faixas.map((f) => {
        if (f.id === faixaId) {
          return { ...f, [field]: [...f[field], ""] };
        }
        return f;
      })
    );
  };

  const updateFaixaArrayItem = (
    faixaId: number,
    field: "compositores" | "interpretes" | "produtores",
    index: number,
    value: string
  ) => {
    setFaixas(
      faixas.map((f) => {
        if (f.id === faixaId) {
          const newArray = [...f[field]];
          newArray[index] = value;
          return { ...f, [field]: newArray };
        }
        return f;
      })
    );
  };

  // Projetos serão carregados do banco de dados
  const projetos: { id: string; nome: string }[] = [];

  const handleConectarDistribuidora = () => {
    toast.success("Conectando com ONErpm...");
    setDistribuidoraConectada(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Lançamento" : mode === "edit" ? "Editar Lançamento" : "Detalhes do Lançamento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Projeto Base */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Projeto Base</CardTitle>
              </div>
              <CardDescription>Selecione um projeto para pré-carregar informações</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Projeto (Opcional)</Label>
                <Select value={formData.projeto} onValueChange={(v) => setFormData({ ...formData, projeto: v })} disabled={isViewMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">Nenhum projeto cadastrado</div>
                    ) : projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Informações Básicas */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Básicas</CardTitle>
              <CardDescription>Complete as informações do lançamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título do Lançamento *</Label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Nome do single/álbum"
                    disabled={isViewMode}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Artista *</Label>
                  <Input
                    value={formData.artista}
                    onChange={(e) => setFormData({ ...formData, artista: e.target.value })}
                    placeholder="Nome do artista principal"
                    disabled={isViewMode}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Lançamento</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })} disabled={isViewMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="ep">EP</SelectItem>
                      <SelectItem value="album">Álbum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Código UPC</Label>
                  <Input
                    value={formData.codigoUPC}
                    onChange={(e) => setFormData({ ...formData, codigoUPC: e.target.value })}
                    placeholder="Digite o código UPC"
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gênero *</Label>
                  <Select value={formData.genero} onValueChange={(v) => setFormData({ ...formData, genero: v })} disabled={isViewMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funk">Funk</SelectItem>
                      <SelectItem value="trap">Trap</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="sertanejo">Sertanejo</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Idioma da Música *</Label>
                  <Select value={formData.idioma} onValueChange={(v) => setFormData({ ...formData, idioma: v })} disabled={isViewMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                      <SelectItem value="en">Inglês</SelectItem>
                      <SelectItem value="es">Espanhol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de Lançamento</Label>
                  <Input
                    type="date"
                    value={formData.dataLancamento}
                    onChange={(e) => setFormData({ ...formData, dataLancamento: e.target.value })}
                    placeholder="DD/MM/AAAA"
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={isViewMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analise">Em Análise</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="programado">Programado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faixas */}
          <Collapsible open={faixasOpen} onOpenChange={setFaixasOpen}>
            <Card className="bg-muted/30 border-border">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">Faixas</CardTitle>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${faixasOpen ? "rotate-180" : ""}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {faixas.map((faixa, index) => (
                    <div key={faixa.id} className="space-y-4 p-4 border border-border rounded-lg relative">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Faixa {index + 1}</span>
                        {faixas.length > 1 && !isViewMode && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFaixa(faixa.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Título da Faixa *</Label>
                          <Input
                            value={faixa.titulo}
                            onChange={(e) => updateFaixa(faixa.id, "titulo", e.target.value)}
                            placeholder="Nome da música"
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Artista *</Label>
                          <Input
                            value={faixa.artista}
                            onChange={(e) => updateFaixa(faixa.id, "artista", e.target.value)}
                            placeholder="Nome do artista"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Código ISRC</Label>
                        <Input
                          value={faixa.isrc}
                          onChange={(e) => updateFaixa(faixa.id, "isrc", e.target.value)}
                          placeholder="BR-UBC-12-34567"
                          disabled={isViewMode}
                        />
                      </div>

                      {/* Compositores */}
                      <div className="space-y-2">
                        <Label>Compositores</Label>
                        {faixa.compositores.map((compositor, i) => (
                          <Input
                            key={i}
                            value={compositor}
                            onChange={(e) => updateFaixaArrayItem(faixa.id, "compositores", i, e.target.value)}
                            placeholder="Nome do compositor"
                            disabled={isViewMode}
                            className="mb-2"
                          />
                        ))}
                        {!isViewMode && (
                          <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => addItemToFaixaArray(faixa.id, "compositores")}>
                            <Plus className="h-4 w-4" />
                            Adicionar Compositor
                          </Button>
                        )}
                      </div>

                      {/* Intérpretes */}
                      <div className="space-y-2">
                        <Label>Intérpretes</Label>
                        {faixa.interpretes.map((interprete, i) => (
                          <Input
                            key={i}
                            value={interprete}
                            onChange={(e) => updateFaixaArrayItem(faixa.id, "interpretes", i, e.target.value)}
                            placeholder="Nome do intérprete"
                            disabled={isViewMode}
                            className="mb-2"
                          />
                        ))}
                        {!isViewMode && (
                          <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => addItemToFaixaArray(faixa.id, "interpretes")}>
                            <Plus className="h-4 w-4" />
                            Adicionar Intérprete
                          </Button>
                        )}
                      </div>

                      {/* Produtores */}
                      <div className="space-y-2">
                        <Label>Produtores</Label>
                        {faixa.produtores.map((produtor, i) => (
                          <Input
                            key={i}
                            value={produtor}
                            onChange={(e) => updateFaixaArrayItem(faixa.id, "produtores", i, e.target.value)}
                            placeholder="Nome do produtor"
                            disabled={isViewMode}
                            className="mb-2"
                          />
                        ))}
                        {!isViewMode && (
                          <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => addItemToFaixaArray(faixa.id, "produtores")}>
                            <Plus className="h-4 w-4" />
                            Adicionar Produtor
                          </Button>
                        )}
                      </div>

                      {/* Arquivo de Áudio */}
                      <div className="space-y-2">
                        <Label>Arquivo de Áudio</Label>
                        <div
                          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                          onClick={() => !isViewMode && document.getElementById(`audio-${faixa.id}`)?.click()}
                        >
                          <p className="text-sm text-muted-foreground">MP3 ou WAV (máx. 25MB)</p>
                          {faixa.arquivoAudio ? (
                            <p className="text-sm text-foreground mt-2">{faixa.arquivoAudio.name}</p>
                          ) : (
                            !isViewMode && (
                              <Button type="button" variant="outline" size="sm" className="mt-2 gap-2">
                                <Upload className="h-4 w-4" />
                                Selecionar Áudio
                              </Button>
                            )
                          )}
                          <input
                            id={`audio-${faixa.id}`}
                            type="file"
                            accept=".mp3,.wav"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) updateFaixa(faixa.id, "arquivoAudio", file);
                            }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      {/* Letra */}
                      <div className="space-y-2">
                        <Label>Letra (Opcional)</Label>
                        <Textarea
                          value={faixa.letra}
                          onChange={(e) => updateFaixa(faixa.id, "letra", e.target.value)}
                          placeholder="Letra da música..."
                          rows={4}
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                  ))}

                  {!isViewMode && (
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={addFaixa}>
                      <Plus className="h-4 w-4" />
                      Adicionar Faixa
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Metadados */}
          <Collapsible open={metadadosOpen} onOpenChange={setMetadadosOpen}>
            <Card className="bg-muted/30 border-border">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Metadados</CardTitle>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${metadadosOpen ? "rotate-180" : ""}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gravadora/Selo</Label>
                      <Input
                        value={formData.gravadora}
                        onChange={(e) => setFormData({ ...formData, gravadora: e.target.value })}
                        placeholder="Nome da gravadora ou selo"
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Copyright</Label>
                      <Input
                        value={formData.copyright}
                        onChange={(e) => setFormData({ ...formData, copyright: e.target.value })}
                        placeholder="© 2024 Nome do detentor"
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Artes do Lançamento */}
          <Collapsible open={artesOpen} onOpenChange={setArtesOpen}>
            <Card className="bg-muted/30 border-border">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">Artes do Lançamento</CardTitle>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${artesOpen ? "rotate-180" : ""}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Capa Principal *</Label>
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                      onClick={() => !isViewMode && document.getElementById("capa-principal")?.click()}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        {capaPrincipal ? (
                          <p className="text-sm text-foreground">{capaPrincipal.name}</p>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">Clique para selecionar a capa ou arraste e solte aqui</p>
                            <p className="text-xs text-muted-foreground">Formatos aceitos: JPEG, PNG, WebP (máx. 10MB) - Recomendado: 3000x3000px</p>
                            {!isViewMode && (
                              <Button type="button" variant="outline" size="sm" className="mt-2 gap-2">
                                <Upload className="h-4 w-4" />
                                Selecionar Capa
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      <input
                        id="capa-principal"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setCapaPrincipal(file);
                        }}
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Distribuição */}
          <Card className="bg-muted/30 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Distribuição</CardTitle>
              <CardDescription>Selecione a distribuidora para envio às plataformas digitais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Distribuidora *</Label>
                <Select value={formData.distribuidora} onValueChange={(v) => setFormData({ ...formData, distribuidora: v })} disabled={isViewMode}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-red-500" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onerpm">ONErpm</SelectItem>
                    <SelectItem value="distrokid">DistroKid</SelectItem>
                    <SelectItem value="tunecore">TuneCore</SelectItem>
                    <SelectItem value="cdbaby">CD Baby</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status da distribuidora */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-600/20 rounded-lg">
                      <Music className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">ONErpm</p>
                      <p className="text-sm text-muted-foreground">Distribuidora global com presença na América Latina</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {distribuidoraConectada ? "Conectado" : "Não conectado"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                    onClick={handleConectarDistribuidora}
                    disabled={isViewMode}
                  >
                    <LogIn className="h-4 w-4" />
                    Conectar com ONErpm
                  </Button>
                  <Button type="button" variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Abrir site
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas de Distribuição</Label>
                <Textarea
                  value={formData.notasDistribuicao}
                  onChange={(e) => setFormData({ ...formData, notasDistribuicao: e.target.value })}
                  placeholder="Notas especiais sobre a distribuição (ex: data preferencial, territórios, exclusividades...)"
                  rows={3}
                  disabled={isViewMode}
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                {mode === "create" ? "Criar Lançamento" : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
