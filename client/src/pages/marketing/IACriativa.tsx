import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Sparkles, Lightbulb, Split, Wand2, FileText, MessageSquare, User, 
  Presentation, TrendingUp, BarChart3, History, Copy, ThumbsUp, ThumbsDown, 
  RefreshCw, Send, Bot, Clock, Zap, Target, PenTool, Music, Instagram, 
  Youtube, Mic2, Calendar, ArrowRight, ChevronRight, Star, Loader2, Search,
  Users, Activity, Globe, Radio, Headphones, PlayCircle, Heart, AlertCircle,
  BarChart2, PieChart, MapPin, Disc, Flame, Award, Eye, TrendingDown
} from "lucide-react";
import { useArtistas } from "@/hooks/useArtistas";
import { useMarketingAI, ContentType } from "@/hooks/useMarketingAI";

// Estado inicial do chat
const chatInicial = [
  { role: "assistant", content: "Olá! Sou seu assistente de marketing musical. Como posso ajudar hoje?" },
];

type Ideia = {
  id: number;
  tipo: string;
  titulo: string;
  conteudo: string;
  canal: string;
  engajamento: string;
};

export default function MarketingIACriativa() {
  const { artistas } = useArtistas();
  const { generateContent, isGenerating } = useMarketingAI();
  
  const [activeTab, setActiveTab] = useState("gerador");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [ideiasGeradas, setIdeiasGeradas] = useState<Ideia[]>([]);
  const [chatMessages, setChatMessages] = useState(chatInicial);
  const [newMessage, setNewMessage] = useState("");
  
  // Form states
  const [selectedArtista, setSelectedArtista] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<ContentType>("post");
  const [selectedCanal, setSelectedCanal] = useState("");
  const [selectedTom, setSelectedTom] = useState("");
  const [contexto, setContexto] = useState("");

  // Estados para variações, sugestões, tendências e histórico
  const [variacoes, setVariacoes] = useState<{ id: string; titulo: string; texto: string; ctr: string }[]>([]);
  const [sugestoes, setSugestoes] = useState<{ id: number; tipo: string; descricao: string }[]>([]);
  const [tendencias, setTendencias] = useState<{ id: number; nome: string; crescimento: string; status: string }[]>([]);
  const [historico, setHistorico] = useState<{ id: number; data: string; artista: string; tipo: string; resultado: string }[]>([]);

  const artistasOptions = artistas.map(a => ({ value: a.id, label: a.nome_artistico, genero: a.genero_musical }));

  const handleGerarConteudo = async () => {
    if (!selectedArtista) {
      toast.error("Selecione um artista");
      return;
    }

    const artista = artistasOptions.find(a => a.value === selectedArtista);
    if (!artista) return;

    try {
      const result = await generateContent.mutateAsync({
        type: selectedTipo,
        artistName: artista.label,
        genre: artista.genero || undefined,
        context: contexto || undefined,
        platform: selectedCanal || undefined,
        tone: selectedTom || undefined,
        language: "pt-BR"
      });

      setGeneratedContent(result.content);
      
      // Adicionar ao histórico de ideias
      const novaIdeia: Ideia = {
        id: Date.now(),
        tipo: selectedTipo,
        titulo: `${selectedTipo.charAt(0).toUpperCase() + selectedTipo.slice(1)} para ${artista.label}`,
        conteudo: result.content,
        canal: selectedCanal || "Geral",
        engajamento: "Alto"
      };
      setIdeiasGeradas(prev => [novaIdeia, ...prev]);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCopyContent = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado para a área de transferência!");
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setChatMessages([...chatMessages, { role: "user", content: newMessage }]);
    setNewMessage("");
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Entendi! Vou analisar sua solicitação e preparar as melhores recomendações. Aguarde um momento enquanto processo as informações..." 
      }]);
    }, 1000);
  };

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Card className="bg-card px-4 py-2">
        <div className="text-center">
          <span className="text-2xl font-bold text-purple-500" data-testid="text-kpi-ideias">{ideiasGeradas.length}</span>
          <p className="text-xs text-muted-foreground">Ideias Geradas</p>
        </div>
      </Card>
      <Card className="bg-card px-4 py-2">
        <div className="text-center">
          <span className="text-2xl font-bold text-green-500" data-testid="text-kpi-utilidade">0%</span>
          <p className="text-xs text-muted-foreground">Taxa de Utilidade</p>
        </div>
      </Card>
      <Card className="bg-card px-4 py-2">
        <div className="text-center">
          <span className="text-2xl font-bold text-blue-500" data-testid="text-kpi-mes">0</span>
          <p className="text-xs text-muted-foreground">Este Mês</p>
        </div>
      </Card>
    </div>
  );

  return (
    <MainLayout
      title="IA Criativa Inteligente"
      description="Acelere a criação e otimização com IA integrada à estratégia e análise de resultados"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="gerador" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Gerador de Ideias
            </TabsTrigger>
            <TabsTrigger value="perfil-artista" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Análise de Perfil
            </TabsTrigger>
            <TabsTrigger value="pitching" className="flex items-center gap-2">
              <Presentation className="h-4 w-4" />
              Pitching
            </TabsTrigger>
            <TabsTrigger value="tendencias" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tendências
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab: Gerador de Ideias */}
          <TabsContent value="gerador" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Parâmetros
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modelo de IA</Label>
                    <Select defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            <span>Auto (Melhor para tarefa)</span>
                            <Badge variant="secondary" className="ml-2">Recomendado</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-4o">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-green-500" />
                            <span>OpenAI GPT-4o</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-4o-mini">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-green-500" />
                            <span>OpenAI GPT-4o Mini</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="claude-sonnet">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-orange-500" />
                            <span>Claude Sonnet 3.5</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="claude-haiku">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-orange-500" />
                            <span>Claude Haiku 3.5</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-pro">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-500" />
                            <span>Google Gemini Pro</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-flash">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-500" />
                            <span>Google Gemini Flash</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="perplexity">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-cyan-500" />
                            <span>Perplexity</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="llama">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-500" />
                            <span>Meta Llama 3.1</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="mistral">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-indigo-500" />
                            <span>Mistral Large</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Seleciona automaticamente a melhor IA</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Artista *</Label>
                    <Select value={selectedArtista} onValueChange={setSelectedArtista}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o artista" />
                      </SelectTrigger>
                      <SelectContent>
                        {artistasOptions.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">Nenhum artista cadastrado</div>
                        ) : artistasOptions.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Obra/Fonograma</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um artista primeiro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Objetivo *</Label>
                    <Select value={selectedTipo} onValueChange={(v) => setSelectedTipo(v as ContentType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o objetivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">Post para Redes Sociais</SelectItem>
                        <SelectItem value="caption">Legenda/Caption</SelectItem>
                        <SelectItem value="bio">Bio de Perfil</SelectItem>
                        <SelectItem value="press-release">Press Release</SelectItem>
                        <SelectItem value="email">E-mail Marketing</SelectItem>
                        <SelectItem value="ad">Anúncio/Ad</SelectItem>
                        <SelectItem value="lancamento">Divulgar Lançamento</SelectItem>
                        <SelectItem value="engajamento">Aumentar Engajamento</SelectItem>
                        <SelectItem value="branding">Fortalecer Marca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Público-Alvo</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="Faixa etária" />
                      <Input placeholder="Região" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Canal de Divulgação</Label>
                    <Select value={selectedCanal} onValueChange={setSelectedCanal}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="spotify">Spotify</SelectItem>
                        <SelectItem value="twitter">Twitter/X</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="threads">Threads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tom/Estilo</Label>
                    <Select value={selectedTom} onValueChange={setSelectedTom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tom" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inspirador">Inspirador</SelectItem>
                        <SelectItem value="divertido">Divertido</SelectItem>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="emocional">Emocional</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                        <SelectItem value="informal">Informal</SelectItem>
                        <SelectItem value="provocativo">Provocativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Palavras-chave (até 5)</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Adicionar palavra-chave" className="flex-1" />
                      <Button size="icon" variant="outline">
                        <span className="text-lg">+</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações Adicionais</Label>
                    <Textarea 
                      placeholder="Parâmetros específicos, referências, etc."
                      value={contexto}
                      onChange={(e) => setContexto(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleGerarConteudo} className="w-full gap-2" disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando com IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Gerar Ideias
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  {ideiasGeradas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhuma ideia gerada ainda</h3>
                      <p className="text-muted-foreground text-center text-sm">
                        Preencha os parâmetros e clique em "Gerar Ideias" para começar
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {ideiasGeradas.map((ideia) => (
                          <Card key={ideia.id} className="bg-muted/30">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{ideia.tipo}</Badge>
                                  <Badge className="bg-purple-500/20 text-purple-500">{ideia.canal}</Badge>
                                </div>
                                <Badge variant={ideia.engajamento === "Muito Alto" ? "default" : "secondary"}>
                                  {ideia.engajamento}
                                </Badge>
                              </div>
                              <h4 className="font-semibold mb-2">{ideia.titulo}</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{ideia.conteudo}</p>
                              <div className="flex items-center gap-2 mt-4">
                                <Button size="sm" variant="outline" onClick={() => handleCopyContent(ideia.conteudo)}>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copiar
                                </Button>
                                <Button size="sm" variant="ghost"><ThumbsUp className="h-3 w-3" /></Button>
                                <Button size="sm" variant="ghost"><ThumbsDown className="h-3 w-3" /></Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Análise de Perfil do Artista (CORE) */}
          <TabsContent value="perfil-artista" className="mt-6 space-y-6">
            {/* Header e Seletor */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Análise de Perfil do Artista
                </CardTitle>
                <CardDescription>
                  IA focada em carreira - planejamento inteligente e escalável
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2 min-w-[220px]">
                    <Label className="text-xs">Modelo IA</Label>
                    <Select defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            <span>Auto (Melhor para tarefa)</span>
                            <Badge variant="secondary" className="ml-1">Recomendado</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-4o">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-green-500" />
                            <span>OpenAI GPT-4o</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-4o-mini">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-green-500" />
                            <span>OpenAI GPT-4o Mini</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="claude-sonnet">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-orange-500" />
                            <span>Claude Sonnet 3.5</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="claude-haiku">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-orange-500" />
                            <span>Claude Haiku 3.5</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-pro">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-500" />
                            <span>Google Gemini Pro</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-flash">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-500" />
                            <span>Google Gemini Flash</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="perplexity">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-cyan-500" />
                            <span>Perplexity</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="llama">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-500" />
                            <span>Meta Llama 3.1</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="mistral">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-indigo-500" />
                            <span>Mistral Large</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 min-w-[220px]">
                    <Label className="text-xs">Artista *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o artista" />
                      </SelectTrigger>
                      <SelectContent>
                        {artistasOptions.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">Nenhum artista cadastrado</div>
                        ) : artistasOptions.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Analisar Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Grid de Análises */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Análise do Perfil */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Análise do Perfil
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Disc className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Histórico de Lançamentos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Análise de singles, EPs e álbuns lançados, frequência e padrões</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Performance em Plataformas</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Streams, listeners, saves e posicionamento em playlists</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Engajamento em Redes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Interações, crescimento de seguidores e taxa de engajamento</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Consistência Artística</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Identidade visual, sonora e narrativa do artista</p>
                  </div>
                </CardContent>
              </Card>

              {/* Identificação */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-500" />
                    Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Estágio de Carreira</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">Emergente</Badge>
                      <Badge variant="outline">Em Crescimento</Badge>
                      <Badge variant="outline">Consolidado</Badge>
                      <Badge variant="outline">Mainstream</Badge>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Posicionamento de Mercado</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Nicho, diferenciação e posição competitiva no segmento</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Público Principal</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Demografia, localização, comportamento e preferências</p>
                  </div>
                </CardContent>
              </Card>

              {/* Sugestões Estratégicas */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Sugestões Estratégicas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Disc className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Tipo de Lançamento Ideal</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Single, EP, álbum ou colaboração baseado no momento de carreira</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Frequência Recomendada</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Cadência ideal de lançamentos para manter relevância</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">Colaborações Estratégicas</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Artistas e produtores compatíveis para expansão de público</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resultado da Análise - Estado Vazio */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <User className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Selecione um artista para analisar</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    A IA irá analisar histórico de lançamentos, performance em plataformas, engajamento em redes e sugerir estratégias de carreira personalizadas
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Pitching */}
          <TabsContent value="pitching" className="mt-6 space-y-6">
            {/* Guia de Pitching Editorial Universal */}
            <Card className="border-destructive/30">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <CardTitle className="text-base">Guia de Pitching Editorial Universal</CardTitle>
                </div>
                <Button variant="outline" size="sm">Clique para ocultar</Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-green-500/10">
                        <Target className="h-4 w-4 text-green-500" />
                      </div>
                      <h4 className="font-semibold text-sm">Objetivo do Pitching</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Ajudar editores a decidir onde a música se encaixa (gênero, mood, ocasião) e se há estratégia por trás.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-blue-500/10">
                        <Music className="h-4 w-4 text-blue-500" />
                      </div>
                      <h4 className="font-semibold text-sm">Multiplataforma</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Spotify, Deezer, Apple Music, Amazon Music, YouTube Music, Tidal - cada plataforma tem foco diferente.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-purple-500/10">
                        <Zap className="h-4 w-4 text-purple-500" />
                      </div>
                      <h4 className="font-semibold text-sm">O que Funciona</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Abertura direta, gênero claro, mood definido, dados reais (se houver), diferencial único.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-destructive/10">
                        <RefreshCw className="h-4 w-4 text-destructive" />
                      </div>
                      <h4 className="font-semibold text-sm">Evitar</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Texto emocional, mentir números, histórias pessoais longas, pitches genéricos.</p>
                  </div>
                </div>

                {/* Foco por Plataforma */}
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-sm">Foco por Plataforma</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Spotify</Badge>
                    <span className="text-xs text-muted-foreground self-center">Mood, tração, playlists</span>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 ml-4">Deezer</Badge>
                    <span className="text-xs text-muted-foreground self-center">Gênero BR, Flow</span>
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 ml-4">Amazon</Badge>
                    <span className="text-xs text-muted-foreground self-center">Alexa, contexto de uso</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">YouTube</Badge>
                    <span className="text-xs text-muted-foreground self-center">Visual, Shorts, viral</span>
                    <Badge variant="outline" className="bg-pink-500/10 text-pink-600 border-pink-500/30 ml-4">Apple Music</Badge>
                    <span className="text-xs text-muted-foreground self-center">Storytelling, qualidade</span>
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30 ml-4">Tidal</Badge>
                    <span className="text-xs text-muted-foreground self-center">Hi-Fi, credenciais</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column - Dados do Lançamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Presentation className="h-5 w-5 text-primary" />
                    Dados do Lançamento
                  </CardTitle>
                  <CardDescription>Preencha as informações para gerar um pitching personalizado para distribuidoras</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Plataforma de Destino *</Label>
                    <Select defaultValue="universal">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="universal">Universal (Todas as Plataformas)</SelectItem>
                        <SelectItem value="spotify">Spotify</SelectItem>
                        <SelectItem value="deezer">Deezer</SelectItem>
                        <SelectItem value="apple">Apple Music</SelectItem>
                        <SelectItem value="amazon">Amazon Music</SelectItem>
                        <SelectItem value="youtube">YouTube Music</SelectItem>
                        <SelectItem value="tidal">Tidal</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Pitch adaptável para qualquer plataforma de streaming</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Artista *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o artista" />
                        </SelectTrigger>
                        <SelectContent>
                          {artistasOptions.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">Nenhum artista cadastrado</div>
                          ) : artistasOptions.map(a => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Lançamento (Opcional)</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o lançamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gênero Principal *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o gênero" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="funk">Funk</SelectItem>
                          <SelectItem value="sertanejo">Sertanejo</SelectItem>
                          <SelectItem value="pop">Pop</SelectItem>
                          <SelectItem value="hip-hop">Hip-Hop/Rap</SelectItem>
                          <SelectItem value="rock">Rock</SelectItem>
                          <SelectItem value="eletronica">Eletrônica</SelectItem>
                          <SelectItem value="mpb">MPB</SelectItem>
                          <SelectItem value="pagode">Pagode</SelectItem>
                          <SelectItem value="forro">Forró</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subgênero</Label>
                      <Input placeholder="Ex: MTG, Brega Funk, etc." />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mood / Energia *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o mood" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="energia-alta">Energia Alta</SelectItem>
                          <SelectItem value="animado">Animado</SelectItem>
                          <SelectItem value="romantico">Romântico</SelectItem>
                          <SelectItem value="melancolico">Melancólico</SelectItem>
                          <SelectItem value="relaxante">Relaxante</SelectItem>
                          <SelectItem value="motivacional">Motivacional</SelectItem>
                          <SelectItem value="festivo">Festivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>BPM (Opcional)</Label>
                      <Input placeholder="Ex: 130" type="number" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Referências Sonoras</Label>
                    <Input placeholder="Ex: DJ Arana, Love Funk, estilo São Paulo" />
                    <p className="text-xs text-muted-foreground">Artistas ou estilos que servem como referência sonora</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-primary" />
                      Letra da Música (IA analisa para gerar pitch)
                    </Label>
                    <Textarea 
                      placeholder="Cole a letra da música aqui. A IA vai analisar temas, tom emocional e ganchos memoráveis para criar um pitch mais preciso..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mic2 className="h-4 w-4 text-primary" />
                      Anexar Áudio (detectar vibe)
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Mic2 className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm">Clique para anexar o áudio da música</p>
                        <p className="text-xs text-muted-foreground">MP3, WAV ou WebM (máx. 25MB)</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500/20 text-blue-500 text-[10px] flex items-center justify-center">i</span>
                      A IA analisa características do áudio para sugerir mood, energia e tempo. Isso melhora a precisão do pitch gerado.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Dados de Tração (apenas se reais)
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Streams último lançamento</Label>
                        <Input placeholder="Ex: 120.000" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Crescimento mensal (%)</Label>
                        <Input placeholder="Ex: 15" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="viral" className="rounded border-input" />
                    <Label htmlFor="viral" className="text-sm font-normal">Possui conteúdo viral ou tendências ativas</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Diferencial da Música</Label>
                    <Textarea 
                      placeholder="O que torna essa música diferente das outras? Ex: produção minimalista, refrão memorável, colaboração estratégica..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contexto Adicional</Label>
                    <Textarea 
                      placeholder="Informações extras: faz parte de um EP? Continuação de hit anterior? Novo posicionamento?"
                      className="min-h-[80px]"
                    />
                  </div>

                  <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                    <Sparkles className="h-4 w-4" />
                    Gerar Pitching para Universal (Todas as Plataformas)
                  </Button>
                </CardContent>
              </Card>

              {/* Right Column - Pitching Gerado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Pitching Gerado
                  </CardTitle>
                  <CardDescription>Texto pronto para enviar via distribuidora ou plataforma</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[400px] p-4 bg-muted/30 rounded-lg flex flex-col items-center justify-center text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">Preencha os dados e clique em "Gerar Pitching"</p>
                    <p className="text-xs text-muted-foreground">O texto será exibido aqui</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Tips Section */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-green-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                    <ThumbsUp className="h-4 w-4" />
                    Boas Práticas
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  <p>- Enviar 7-21 dias antes do lançamento</p>
                  <p>- Ser específico sobre gênero e mood</p>
                  <p>- Incluir apenas dados reais</p>
                  <p>- Adaptar para cada plataforma</p>
                  <p>- Anexar letra para pitch mais preciso</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <ThumbsDown className="h-4 w-4" />
                    Evitar
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  <p>- Texto emocional demais</p>
                  <p>- Inventar números ou métricas</p>
                  <p>- Histórias pessoais longas</p>
                  <p>- Pitch genérico para todas plataformas</p>
                  <p>- Enviar depois do lançamento</p>
                </CardContent>
              </Card>
              <Card className="border-blue-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
                    <Lightbulb className="h-4 w-4" />
                    Lembre-se
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  <p>- Pitching não garante playlist</p>
                  <p>- Cada plataforma tem foco diferente</p>
                  <p>- Playlists amplificam o que já funciona</p>
                  <p>- Perfil do artista deve estar atualizado</p>
                  <p>- Use letra + áudio para melhor resultado</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Tendências */}
          <TabsContent value="tendencias" className="mt-6 space-y-6">
            {/* Search Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Tendências de Mercado
                </CardTitle>
                <CardDescription>
                  Busque tendências atuais de música, redes sociais e marketing digital
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[250px]">
                    <Input placeholder="Ex: funk, sertanejo, pop brasileiro..." />
                  </div>
                  <div className="flex-1 min-w-[250px]">
                    <Input placeholder="Busca específica (opcional)" />
                  </div>
                  <Button className="gap-2">
                    <Search className="h-4 w-4" />
                    Buscar Tendências
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Card */}
            <Card>
              <CardContent className="p-6">
                {tendencias.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Target className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Descubra o que está em alta</h3>
                    <p className="text-muted-foreground text-sm">
                      Digite um gênero musical ou termo de busca para ver tendências atuais
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tendencias.map((trend) => (
                      <div key={trend.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold">{trend.id}</span>
                          </div>
                          <span className="font-medium">{trend.nome}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-green-500 font-semibold">{trend.crescimento}</span>
                          <Badge variant={trend.status === "Em alta" ? "default" : "secondary"}>
                            {trend.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Analytics */}
          <TabsContent value="analytics" className="mt-6 space-y-6">
            {/* Filters Row */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Select defaultValue="auto">
                    <SelectTrigger className="min-w-[220px]">
                      <SelectValue placeholder="Modelo IA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span>Auto (Melhor para tarefa)</span>
                          <Badge variant="secondary" className="ml-1">Recomendado</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt-4o">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-green-500" />
                          <span>OpenAI GPT-4o</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt-4o-mini">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-green-500" />
                          <span>OpenAI GPT-4o Mini</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="claude-sonnet">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-orange-500" />
                          <span>Claude Sonnet 3.5</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="claude-haiku">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-orange-500" />
                          <span>Claude Haiku 3.5</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini-pro">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-500" />
                          <span>Google Gemini Pro</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini-flash">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-500" />
                          <span>Google Gemini Flash</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="perplexity">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-cyan-500" />
                          <span>Perplexity</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="llama">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-500" />
                          <span>Meta Llama 3.1</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="mistral">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-indigo-500" />
                          <span>Mistral Large</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="todos">
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue placeholder="Artista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os artistas</SelectItem>
                      {artistasOptions.map(a => (
                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select defaultValue="30dias">
                    <SelectTrigger className="min-w-[160px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                      <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                      <SelectItem value="90dias">Últimos 90 dias</SelectItem>
                      <SelectItem value="ano">Este ano</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="gap-2 ml-auto">
                    <Sparkles className="h-4 w-4" />
                    Analisar com IA
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ideias Geradas</p>
                      <p className="text-2xl font-bold mt-1">0</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Taxa de Utilidade</p>
                      <p className="text-2xl font-bold mt-1">0%</p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <ThumbsUp className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Este Mês</p>
                      <p className="text-2xl font-bold mt-1">0</p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                      <p className="text-2xl font-bold mt-1">0</p>
                    </div>
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <User className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ideias por Objetivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ideias por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance das Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhuma campanha encontrada
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="historico" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Gerações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {historico.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <History className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum histórico disponível</p>
                    </div>
                  ) : historico.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{item.tipo}</p>
                          <p className="text-sm text-muted-foreground">{item.artista}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{item.resultado}</Badge>
                        <span className="text-sm text-muted-foreground">{item.data}</span>
                        <Button size="sm" variant="ghost">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
