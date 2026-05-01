import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Music,
  Disc,
  Rocket,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  Target,
  Plus,
  Edit,
  Trash2,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building,
  Share2,
  TrendingUp,
  History,
  Globe,
  Mic,
  BookOpen,
  ExternalLink,
  AlertTriangle,
  Zap,
  Users,
  Award,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import { ArtistaEvolucaoSection } from "./ArtistaEvolucaoSection";
import { PlatformMiniTrend } from "./PlatformMiniTrend";
import { useSpotifyEvolution } from "@/hooks/useSpotify";
import { useYouTubeEvolution } from "@/hooks/useYouTube";
import {
  extractDeezerArtistIdFromUrl,
  useDeezerEvolution,
} from "@/hooks/useDeezer";

const estagiosCarreira = [
  { nivel: 1, nome: "Iniciante", descricao: "Começando a carreira musical" },
  { nivel: 2, nome: "Emergente", descricao: "Construindo uma base de fãs" },
  { nivel: 3, nome: "Em Desenvolvimento", descricao: "Ganhando tração no mercado" },
  { nivel: 4, nome: "Promissor", descricao: "Potencial reconhecido pela indústria" },
  { nivel: 5, nome: "Estabelecido", descricao: "Presença consolidada no mercado" },
  { nivel: 6, nome: "Sustentável", descricao: "Receita recorrente e base de fãs leal" },
  { nivel: 7, nome: "Influente", descricao: "Referência no gênero musical" },
  { nivel: 8, nome: "Dominante", descricao: "Liderança no mercado nacional" },
  { nivel: 9, nome: "Elite", descricao: "Top do mercado brasileiro" },
  { nivel: 10, nome: "Lendário", descricao: "Ícone da música brasileira" },
];

function CircularProgress({ value, label, sublabel, color = "teal", badge }: {
  value: number;
  label: string;
  sublabel?: string;
  color?: "teal" | "green" | "amber" | "red";
  badge?: { text: string; variant: "high" | "medium" | "low" };
}) {
  const colors = {
    teal: { stroke: "stroke-teal-500", text: "text-teal-500" },
    green: { stroke: "stroke-green-500", text: "text-green-500" },
    amber: { stroke: "stroke-amber-500", text: "text-amber-500" },
    red: { stroke: "stroke-red-500", text: "text-red-500" },
  };
  
  const badgeColors = {
    high: "bg-green-600 text-white",
    medium: "bg-amber-500 text-black",
    low: "bg-red-600 text-white",
  };

  const c = colors[color];
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColors[badge.variant]}`}>
          {badge.text}
        </span>
      )}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/20" />
          <circle cx="40" cy="40" r={radius} fill="none" strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={c.stroke} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-lg ${c.text}`}>{value}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-center">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground text-center max-w-[70px] truncate">{sublabel}</span>}
    </div>
  );
}
import { formatCurrency } from "@/lib/format-utils";
import { useObras } from "@/hooks/useObras";
import { useFonogramas } from "@/hooks/useFonogramas";
import { useLancamentos } from "@/hooks/useLancamentos";
import { useProjetos } from "@/hooks/useProjetos";
import { useMetas } from "@/hooks/useMetas";
import { useContratos, type ContratoWithRelations } from "@/hooks/useContratos";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";

interface Meta {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  categoria: string;
  valorMeta: number;
  valorAtual: number;
  unidade: string;
  dataInicio: string;
  dataFim: string;
  status: "em_progresso" | "concluida" | "pausada" | "cancelada";
}

interface ArtistaVisao360ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artista?: any;
}

// Contratos do artista - mock data para demonstração
const contratosArtistaMock = [
  { id: 1, title: "Contrato de Gravação", inicio: "2023-01-01", fim: "2025-12-31", status: "ativo" },
  { id: 2, title: "Contrato de Shows", inicio: "2023-06-01", fim: "2024-12-31", status: "ativo" },
  { id: 3, title: "Contrato Editorial", inicio: "2022-01-01", fim: "2027-01-01", status: "ativo" },
];

// Histórico do artista - mock data para demonstração
const historicoArtistaMock = [
  { id: 1, tipo: "criacao", descricao: "Artista cadastrado no sistema", data: "2023-01-15", usuario: "Admin" },
  { id: 2, tipo: "contrato", descricao: "Contrato de gravação assinado", data: "2023-01-20", usuario: "Admin" },
  { id: 3, tipo: "obra", descricao: "Obra 'Novo Hit' registrada", data: "2023-03-10", usuario: "Produtor" },
  { id: 4, tipo: "financeiro", descricao: "Royalties Q1 2023 processados", data: "2023-04-15", usuario: "Financeiro" },
  { id: 5, tipo: "edicao", descricao: "Dados de contato atualizados", data: "2023-06-01", usuario: "Admin" },
];

const getHistoricoIcon = (tipo: string) => {
  switch (tipo) {
    case "criacao":
      return <Plus className="h-4 w-4" />;
    case "edicao":
      return <Edit className="h-4 w-4" />;
    case "obra":
      return <Music className="h-4 w-4" />;
    case "contrato":
      return <FileText className="h-4 w-4" />;
    case "financeiro":
      return <DollarSign className="h-4 w-4" />;
    case "exclusao":
      return <Trash2 className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

const getHistoricoBadge = (tipo: string) => {
  switch (tipo) {
    case "criacao":
      return <Badge className="bg-green-600">Criação</Badge>;
    case "edicao":
      return <Badge className="bg-blue-600">Edição</Badge>;
    case "obra":
      return <Badge className="bg-purple-600">Obra</Badge>;
    case "contrato":
      return <Badge className="bg-amber-600">Contrato</Badge>;
    case "financeiro":
      return <Badge className="bg-emerald-600">Financeiro</Badge>;
    case "exclusao":
      return <Badge variant="destructive">Exclusão</Badge>;
    default:
      return <Badge variant="secondary">Outro</Badge>;
  }
};

const tiposMeta = [
  { value: "streams", label: "Streams" },
  { value: "seguidores", label: "Seguidores" },
  { value: "lancamentos", label: "Lançamentos" },
  { value: "receita", label: "Receita" },
  { value: "eventos", label: "Shows/Eventos" },
  { value: "outros", label: "Outros" },
];

const categoriasMeta = [
  { value: "crescimento", label: "Crescimento" },
  { value: "financeiro", label: "Financeiro" },
  { value: "producao", label: "Produção" },
  { value: "marketing", label: "Marketing" },
  { value: "carreira", label: "Carreira" },
];

const statusMeta = [
  { value: "em_progresso", label: "Em Progresso", color: "bg-amber-500" },
  { value: "concluida", label: "Concluída", color: "bg-green-500" },
  { value: "pausada", label: "Pausada", color: "bg-gray-500" },
  { value: "cancelada", label: "Cancelada", color: "bg-red-500" },
];

export function ArtistaVisao360Modal({ open, onOpenChange, artista }: ArtistaVisao360ModalProps) {
  const { obras } = useObras();
  const { fonogramas } = useFonogramas();
  const { lancamentos } = useLancamentos();
  const { projetos } = useProjetos();
  const { metas: metasSupabase } = useMetas();
  const { contratos } = useContratos();

  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  
  // Filter data by artista_id
  const artistaId = artista?.id;
  const obrasReais = obras.filter((o: any) => o.artista_id === artistaId);
  const fonogramasReais = fonogramas.filter((f: any) => f.artista_id === artistaId);
  const lancamentosReais = lancamentos.filter((l: any) => l.artista_id === artistaId);
  const projetosReais = projetos.filter((p: any) => p.artista_id === artistaId);
  const metasReais = metasSupabase.filter((m: any) => m.artista_id === artistaId);
  const contratosReais: ContratoWithRelations[] = contratos.filter((c) => c.artista_id === artistaId);

  // Tendência da evolução (Task #361): chips de "↑/↓/—" nos cards de
  // plataforma do dashboard 360 reusam os mesmos snapshots diários
  // (`record_artista_metric_snapshot`) já consumidos pela aba "Evolução".
  // Os hooks só disparam a query quando o artista tem ID configurado para
  // a plataforma — assim evita chamadas inúteis para perfis não vinculados.
  const spotifyArtistId: string | null = artista?.spotify_artist_id ?? null;
  const youtubeChannelId: string | null = artista?.youtube_channel_id ?? null;
  const deezerUrl: string | null = artista?.deezer_url ?? null;
  const deezerArtistId = extractDeezerArtistIdFromUrl(deezerUrl);
  const spotifyEvolution = useSpotifyEvolution(
    spotifyArtistId ? artistaId : null,
    30,
  );
  const youtubeEvolution = useYouTubeEvolution(
    youtubeChannelId ? artistaId : null,
    30,
  );
  const deezerEvolution = useDeezerEvolution(
    deezerArtistId ? artistaId : null,
    30,
  );

  const [metas, setMetas] = useState<Meta[]>([]);

  const [metaForm, setMetaForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "",
    categoria: "",
    valorMeta: "",
    valorAtual: "",
    unidade: "",
    dataInicio: "",
    dataFim: "",
    status: "em_progresso" as Meta["status"],
  });

  if (!artista) return null;

  const saudeCarreira = 55;

  const resetForm = () => {
    setMetaForm({
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      valorMeta: "",
      valorAtual: "",
      unidade: "",
      dataInicio: "",
      dataFim: "",
      status: "em_progresso",
    });
    setEditingMeta(null);
    setShowMetaForm(false);
  };

  const handleSaveMeta = () => {
    if (!metaForm.titulo || !metaForm.tipo || !metaForm.valorMeta) return;

    if (editingMeta) {
      setMetas(
        metas.map((m) =>
          m.id === editingMeta.id
            ? { ...m, ...metaForm, valorMeta: Number(metaForm.valorMeta), valorAtual: Number(metaForm.valorAtual) }
            : m,
        ),
      );
    } else {
      const newMeta: Meta = {
        id: Date.now(),
        titulo: metaForm.titulo,
        descricao: metaForm.descricao,
        tipo: metaForm.tipo,
        categoria: metaForm.categoria,
        valorMeta: Number(metaForm.valorMeta),
        valorAtual: Number(metaForm.valorAtual) || 0,
        unidade: metaForm.unidade,
        dataInicio: metaForm.dataInicio,
        dataFim: metaForm.dataFim,
        status: metaForm.status,
      };
      setMetas([...metas, newMeta]);
    }
    resetForm();
  };

  const handleEditMeta = (meta: Meta) => {
    setMetaForm({
      titulo: meta.titulo,
      descricao: meta.descricao,
      tipo: meta.tipo,
      categoria: meta.categoria,
      valorMeta: String(meta.valorMeta),
      valorAtual: String(meta.valorAtual),
      unidade: meta.unidade,
      dataInicio: meta.dataInicio,
      dataFim: meta.dataFim,
      status: meta.status,
    });
    setEditingMeta(meta);
    setShowMetaForm(true);
  };

  const handleDeleteMeta = (id: number) => {
    setMetas(metas.filter((m) => m.id !== id));
  };

  const getProgressPercent = (meta: Meta) => {
    return Math.min(Math.round((meta.valorAtual / meta.valorMeta) * 100), 100);
  };

  const metasEmProgresso = metas.filter((m) => m.status === "em_progresso").length;
  const metasConcluidas = metas.filter((m) => m.status === "concluida").length;
  const progressoMedio =
    metas.length > 0 ? Math.round(metas.reduce((acc, m) => acc + getProgressPercent(m), 0) / metas.length) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center text-xl font-bold text-white shrink-0">
                {artista.initial || artista.name?.[0] || "A"}
              </div>
              <div>
                <h2 className="text-xl font-bold">{artista.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-muted">
                    {artista.genre || "funk"}
                  </Badge>
                  <Badge className="bg-green-600">Ativo</Badge>
                  <ContratoStatusBadge
                    situacao={getContratoSituacao(contratosReais)}
                    data-testid={`badge-contrato-visao360-${artistaId}`}
                  />
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-500">{saudeCarreira}%</p>
              <p className="text-xs text-muted-foreground">Saúde da Carreira</p>
              <Badge variant="outline" className="mt-1 border-amber-500 text-amber-500">
                Atenção
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0">
            <TabsTrigger
              value="visao-geral"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="perfil"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Perfil
            </TabsTrigger>
            <TabsTrigger
              value="catalogo"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Catálogo
            </TabsTrigger>
            <TabsTrigger
              value="financeiro"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="contratos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Contratos
            </TabsTrigger>
            <TabsTrigger
              value="metas"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Metas
            </TabsTrigger>
            <TabsTrigger
              value="evolucao"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              data-testid="tab-evolucao"
            >
              Evolução
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Histórico
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(90vh-200px)]">
            {/* Visão Geral */}
            <TabsContent value="visao-geral" className="p-6 space-y-6 mt-0">
              {/* Estágio da Carreira + Benchmark */}
              <div className="grid grid-cols-2 gap-4">
                {/* Estágio da Carreira */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-teal-500" />
                      <h3 className="font-semibold">Estágio da Carreira</h3>
                    </div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full bg-teal-500/20 border-4 border-teal-500 flex items-center justify-center">
                          <span className="text-xl font-bold text-teal-400">{artista.estagio_carreira || 6}</span>
                        </div>
                        <span className="absolute -top-1 -right-1 text-[9px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full">de 10</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-teal-400">{estagiosCarreira[(artista.estagio_carreira || 6) - 1]?.nome || "Sustentável"}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{estagiosCarreira[(artista.estagio_carreira || 6) - 1]?.descricao}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Progresso para próximo estágio</span>
                        <span className="text-xs font-medium text-teal-400">68%</span>
                      </div>
                      <Progress value={68} className="h-2" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <div key={n} className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                          n < (artista.estagio_carreira || 6) ? "bg-teal-500 text-white" 
                            : n === (artista.estagio_carreira || 6) ? "bg-teal-500 text-white ring-2 ring-teal-400 ring-offset-1 ring-offset-background" 
                            : "bg-muted text-muted-foreground"
                        }`}>{n}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Benchmark de Mercado */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold">Benchmark de Mercado</h3>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-2 mb-3">
                      <p className="text-xs text-teal-300">
                        Apenas <strong>5.2%</strong> dos artistas de <strong>{artista.genre || "Funk Brasileiro"}</strong> chegam ao estágio <strong>Sustentável</strong>
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold">45.892</p>
                        <p className="text-[10px] text-muted-foreground">TOTAL ARTISTAS</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-500">Top 5.2%</p>
                        <p className="text-[10px] text-muted-foreground">SEU RANKING</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">+5</p>
                        <p className="text-[10px] text-muted-foreground">ESTÁGIOS</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-5 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Building className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Projetos</span>
                    </div>
                    <p className="text-2xl font-bold">{projetosReais.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Music className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Obras</span>
                    </div>
                    <p className="text-2xl font-bold">{obrasReais.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Disc className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Fonogramas</span>
                    </div>
                    <p className="text-2xl font-bold">{fonogramasReais.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Rocket className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Lançamentos</span>
                    </div>
                    <p className="text-2xl font-bold">{lancamentosReais.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Contratos</span>
                    </div>
                    <p className="text-2xl font-bold">1</p>
                  </CardContent>
                </Card>
              </div>

              {/* Plano de Aceleração */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">Plano de Aceleração</h3>
                  </div>
                  <div className="flex justify-around">
                    <CircularProgress value={78} label="Velocidade" sublabel="Lançamentos" color="teal" badge={{ text: "Alto", variant: "high" }} />
                    <CircularProgress value={65} label="Consistência" sublabel="Qualidade" color="teal" badge={{ text: "Médio", variant: "medium" }} />
                    <CircularProgress value={45} label="Ambiente" sublabel="Presença digital" color="red" badge={{ text: "Baixo", variant: "low" }} />
                    <CircularProgress value={52} label="Investimento" sublabel="ROI" color="amber" badge={{ text: "Médio", variant: "medium" }} />
                  </div>
                </CardContent>
              </Card>

              {/* Diagnóstico + Riscos */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-teal-500" />
                      <div>
                        <h3 className="font-semibold">Diagnóstico de Gargalo</h3>
                        <p className="text-[10px] text-muted-foreground">Identificado por IA</p>
                      </div>
                    </div>
                    <Badge className="bg-teal-500 text-white mb-2">Gargalo Principal</Badge>
                    <h4 className="text-lg font-bold mb-1">Escala</h4>
                    <p className="text-xs text-muted-foreground">Seu conteúdo tem qualidade, mas você ainda não encontrou o canal ideal para amplificar seu alcance.</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <h3 className="font-semibold">Principais Riscos</h3>
                    </div>
                    <ul className="space-y-1.5">
                      <li className="flex items-center gap-2 text-xs text-muted-foreground"><span className="text-red-500">•</span>Zona de conforto</li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground"><span className="text-red-500">•</span>Estagnação de crescimento</li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground"><span className="text-red-500">•</span>Dependência de uma plataforma</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Resumo Financeiro */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Resumo Financeiro</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Receitas</p>
                      <p className="text-xl font-bold text-green-500">R$ 0,00</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Despesas</p>
                      <p className="text-xl font-bold text-red-500">R$ 0,00</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo</p>
                      <p className="text-xl font-bold text-blue-500">R$ 0,00</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      <p className="text-xl font-bold text-amber-500">R$ 0,00</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progresso das Metas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Progresso das Metas</h3>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Progresso Médio</span>
                    <span className="text-sm font-medium">{progressoMedio}%</span>
                  </div>
                  <Progress value={progressoMedio} className="h-2" />
                  <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-amber-500">{metasEmProgresso}</p>
                      <p className="text-xs text-muted-foreground">Em Progresso</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{metasConcluidas}</p>
                      <p className="text-xs text-muted-foreground">Concluídas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{metas.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Foco dos Próximos 90 Dias */}
              <Card className="bg-teal-500/10 border-teal-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-teal-500" />
                    <h3 className="font-semibold text-teal-400">Foco dos Próximos 90 Dias</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estabelecer presença consistente em 3 plataformas de vídeo curto com conteúdo diário, mantendo ritmo de 2 lançamentos por mês.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Perfil */}
            <TabsContent value="perfil" className="p-6 space-y-6 mt-0">
              {/* Informações Básicas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Mic className="h-5 w-5 text-red-500" />
                    <h3 className="font-semibold">Informações Básicas</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome Artístico</p>
                      <p className="text-sm font-medium">{artista.name || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gênero Musical</p>
                      <p className="text-sm font-medium capitalize">{artista.genre || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo de Artista</p>
                      <p className="text-sm font-medium">{artista.tiposArtista?.join(", ") || "Não informado"}</p>
                    </div>
                  </div>
                  {artista.biografia && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Biografia</p>
                      <p className="text-sm font-medium">{artista.biografia}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dados Pessoais */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Dados Pessoais</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome Completo</p>
                      <p className="text-sm font-medium">{artista.realName || artista.name || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                      <p className="text-sm font-medium">{artista.dataNascimento || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="text-sm font-medium">{artista.cpfCnpj || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RG</p>
                      <p className="text-sm font-medium">{artista.rg || "Não informado"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contato e Endereço */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Contato e Endereço</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="text-sm font-medium">{artista.email || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium">{artista.phone || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">CEP</p>
                      <p className="text-sm font-medium">{artista.cep || "Não informado"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="text-sm font-medium">
                        {artista.endereco || "Não informado"}
                        {artista.numero ? `, ${artista.numero}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Complemento</p>
                      <p className="text-sm font-medium">{artista.complemento || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Bairro</p>
                      <p className="text-sm font-medium">{artista.bairro || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cidade</p>
                      <p className="text-sm font-medium">{artista.cidade || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <p className="text-sm font-medium">{artista.estado || "Não informado"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados Bancários */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Dados Bancários</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="text-sm font-medium capitalize">
                        {artista.banco?.replace(/_/g, " ") || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Agência</p>
                      <p className="text-sm font-medium">{artista.agencia || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conta</p>
                      <p className="text-sm font-medium">{artista.conta || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Titular da Conta</p>
                      <p className="text-sm font-medium">
                        {artista.titularConta || artista.realName || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Chave PIX</p>
                      <p className="text-sm font-medium">{artista.chavePix || "Não informado"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Perfis e Redes Sociais */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Perfis e Redes Sociais</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div
                      className="text-center p-3 bg-green-600 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      data-testid="card-visao360-spotify"
                    >
                      <p className="text-white text-xs mb-1">Spotify</p>
                      <p className="text-white font-bold text-sm truncate">{artista.spotify || artista.spotify_url || "N/D"}</p>
                      {spotifyArtistId ? (
                        <div className="flex justify-center">
                          <PlatformMiniTrend
                            points={spotifyEvolution.data}
                            metric="followers"
                            variant="white"
                            showSparkline={false}
                            showEmptyState
                            testIdPrefix="visao360-spotify"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                      <p className="text-white text-xs mb-1">Instagram</p>
                      <p className="text-white font-bold text-sm truncate">{artista.instagram || "N/D"}</p>
                    </div>
                    <div
                      className="text-center p-3 bg-red-600 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      data-testid="card-visao360-youtube"
                    >
                      <p className="text-white text-xs mb-1">YouTube</p>
                      <p className="text-white font-bold text-sm truncate">{artista.youtube || artista.youtube_url || "N/D"}</p>
                      {youtubeChannelId ? (
                        <div className="flex justify-center">
                          <PlatformMiniTrend
                            points={youtubeEvolution.data}
                            metric="followers"
                            variant="white"
                            showSparkline={false}
                            showEmptyState
                            testIdPrefix="visao360-youtube"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-center p-3 bg-black rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                      <p className="text-white text-xs mb-1">TikTok</p>
                      <p className="text-white font-bold text-sm truncate">{artista.tiktok || "N/D"}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-500 rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                      <p className="text-white text-xs mb-1">SoundCloud</p>
                      <p className="text-white font-bold text-sm truncate">{artista.soundcloud || "N/D"}</p>
                    </div>
                    <div
                      className="text-center p-3 bg-purple-600 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      data-testid="card-visao360-deezer"
                    >
                      <p className="text-white text-xs mb-1">Deezer</p>
                      <p className="text-white font-bold text-sm truncate">{artista.deezer || artista.deezer_url || "N/D"}</p>
                      {deezerArtistId ? (
                        <div className="flex justify-center">
                          <PlatformMiniTrend
                            points={deezerEvolution.data}
                            metric="followers"
                            variant="white"
                            showSparkline={false}
                            showEmptyState
                            testIdPrefix="visao360-deezer"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-center p-3 bg-zinc-800 rounded-lg cursor-pointer hover:opacity-80 transition-opacity">
                      <p className="text-white text-xs mb-1">Apple Music</p>
                      <p className="text-white font-bold text-sm truncate">{artista.appleMusic || "N/D"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tipo de Perfil */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Tipo de Perfil</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <Badge variant="outline" className="capitalize">
                        {artista.tipoPerfil === "independente"
                          ? "Independente"
                          : artista.tipoPerfil === "empresario"
                            ? "Com Empresário"
                            : artista.tipoPerfil === "gravadora"
                              ? "Gravadora"
                              : artista.tipoPerfil === "editora"
                                ? "Editora"
                                : "Não informado"}
                      </Badge>
                    </div>
                    {artista.tipoPerfil === "empresario" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Nome do Empresário</p>
                          <p className="text-sm font-medium">{artista.nomeEmpresario || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Telefone do Empresário</p>
                          <p className="text-sm font-medium">{artista.telefoneEmpresario || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail do Empresário</p>
                          <p className="text-sm font-medium">{artista.emailEmpresario || "Não informado"}</p>
                        </div>
                      </>
                    )}
                    {artista.tipoPerfil === "gravadora" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Nome da Gravadora</p>
                          <p className="text-sm font-medium">{artista.nomeGravadora || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contato na Gravadora</p>
                          <p className="text-sm font-medium">{artista.nomeContatoGravadora || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Telefone da Gravadora</p>
                          <p className="text-sm font-medium">{artista.telefoneGravadora || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail da Gravadora</p>
                          <p className="text-sm font-medium">{artista.emailGravadora || "Não informado"}</p>
                        </div>
                      </>
                    )}
                    {artista.tipoPerfil === "editora" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Nome do Responsável</p>
                          <p className="text-sm font-medium">{artista.nomeResponsavel || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Telefone do Responsável</p>
                          <p className="text-sm font-medium">{artista.telefoneResponsavel || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail do Responsável</p>
                          <p className="text-sm font-medium">{artista.emailResponsavel || "Não informado"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Distribuidoras */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Distribuidoras / Agregadoras</h3>
                  </div>
                  {artista.distribuidorasSelecionadas && artista.distribuidorasSelecionadas.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {artista.distribuidorasSelecionadas.map((dist: string) => (
                          <Badge key={dist} variant="secondary" className="capitalize">
                            {dist === "cdbaby"
                              ? "CD Baby"
                              : dist === "distrokid"
                                ? "DistroKid"
                                : dist === "tunecore"
                                  ? "TuneCore"
                                  : dist === "ditto"
                                    ? "Ditto Music"
                                    : dist === "onerpm"
                                      ? "ONErpm"
                                      : dist === "imusics"
                                        ? "iMusics"
                                        : dist === "symphonic"
                                          ? "Symphonic Distribution"
                                          : dist}
                          </Badge>
                        ))}
                      </div>
                      {artista.emailsShare && Object.keys(artista.emailsShare).length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-border">
                          {Object.entries(artista.emailsShare).map(([distId, email]) => {
                            const distName =
                              distId === "cdbaby"
                                ? "CD Baby"
                                : distId === "distrokid"
                                  ? "DistroKid"
                                  : distId === "tunecore"
                                    ? "TuneCore"
                                    : distId === "ditto"
                                      ? "Ditto Music"
                                      : distId === "onerpm"
                                        ? "ONErpm"
                                        : distId === "imusics"
                                          ? "iMusics"
                                          : distId === "symphonic"
                                            ? "Symphonic Distribution"
                                            : distId;
                            return (
                              <div key={distId}>
                                <p className="text-xs text-muted-foreground">E-mail Share - {distName}</p>
                                <p className="text-sm font-medium">{(email as string) || "Não informado"}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma distribuidora vinculada</p>
                  )}
                </CardContent>
              </Card>

              {/* Observações */}
              {artista.observacoes && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Observações</h3>
                    </div>
                    <p className="text-sm">{artista.observacoes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Data de Cadastro */}
              <div className="text-sm text-muted-foreground">
                <span>Data de Cadastro: </span>
                <span>{artista.dataCadastro || new Date().toLocaleDateString("pt-BR")}</span>
              </div>
            </TabsContent>

            {/* Catálogo */}
            <TabsContent value="catalogo" className="p-6 space-y-6 mt-0">
              {/* Estatísticas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Estatísticas do Catálogo</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center p-3 bg-red-600/10 rounded-lg">
                      <Building className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{projetosReais.length}</p>
                      <p className="text-xs text-muted-foreground">Projetos</p>
                    </div>
                    <div className="text-center p-3 bg-red-600/10 rounded-lg">
                      <Music className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{obrasReais.length}</p>
                      <p className="text-xs text-muted-foreground">Obras</p>
                    </div>
                    <div className="text-center p-3 bg-red-600/10 rounded-lg">
                      <Disc className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{fonogramasReais.length}</p>
                      <p className="text-xs text-muted-foreground">Fonogramas</p>
                    </div>
                    <div className="text-center p-3 bg-red-600/10 rounded-lg">
                      <Rocket className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{lancamentosReais.length}</p>
                      <p className="text-xs text-muted-foreground">Lançamentos</p>
                    </div>
                    <div className="text-center p-3 bg-red-600/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-xs text-muted-foreground">Streams</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-6">
                {/* Obras Musicais */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Obras Musicais ({obrasReais.length})</h3>
                    {obrasReais.length > 0 ? (
                      <div className="space-y-3">
                        {obrasReais.map((obra) => (
                          <div key={obra.id} className="flex items-center justify-between">
                            <span className="text-sm">{obra.titulo}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {obra.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma obra registrada</p>
                    )}
                  </CardContent>
                </Card>

                {/* Fonogramas */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Fonogramas ({fonogramasReais.length})</h3>
                    {fonogramasReais.length > 0 ? (
                      <div className="space-y-3">
                        {fonogramasReais.map((fono) => (
                          <div key={fono.id} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{fono.titulo}</p>
                              <p className="text-xs text-muted-foreground">{fono.gravadora || "Sem gravadora"}</p>
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {fono.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum fonograma registrado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Lançamentos */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Lançamentos ({lancamentosReais.length})</h3>
                    {lancamentosReais.length > 0 ? (
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-3">
                          {lancamentosReais.map((lanc) => (
                            <div key={lanc.id} className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{lanc.titulo}</p>
                                <p className="text-xs text-muted-foreground">
                                  {lanc.data_lancamento 
                                    ? new Date(lanc.data_lancamento).toLocaleDateString("pt-BR")
                                    : "Sem data"}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs capitalize">
                                {lanc.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum lançamento registrado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Projetos */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Projetos ({projetosReais.length})</h3>
                    {projetosReais.length > 0 ? (
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-3">
                          {projetosReais.map((proj) => (
                            <div key={proj.id} className="flex items-center justify-between">
                              <div>
                                <span className="text-sm">{proj.titulo}</span>
                                {proj.produtores && proj.produtores.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Produtores: {proj.produtores.join(", ")}
                                  </p>
                                )}
                              </div>
                              <Badge className={`text-xs ${proj.status === 'concluido' ? 'bg-green-600' : proj.status === 'em_andamento' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                                {proj.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum projeto registrado</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Financeiro */}
            <TabsContent value="financeiro" className="p-6 space-y-6 mt-0">
              {/* Cards de Valores */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-green-600/10 border-green-600/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Receitas Total</p>
                    <p className="text-2xl font-bold text-green-500">R$ 0,00</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-600/10 border-red-600/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Despesas Total</p>
                    <p className="text-2xl font-bold text-red-500">R$ 0,00</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-600/10 border-blue-600/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className="text-2xl font-bold text-blue-500">R$ 0,00</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-600/10 border-amber-600/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-amber-500">R$ 0,00</p>
                  </CardContent>
                </Card>
              </div>

              {/* Últimas Transações */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Últimas Transações</h3>
                  <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contratos */}
            <TabsContent value="contratos" className="p-6 space-y-6 mt-0">
              {/* Métricas de Contratos */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <p className="text-2xl font-bold">1</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Vencendo</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">1</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Contratos */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Contratos</h3>
                  {contratosArtistaMock.length > 0 ? (
                    <div className="space-y-3">
                      {contratosArtistaMock.map((contrato) => (
                        <div key={contrato.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium">{contrato.title}</p>
                            <p className="text-xs text-muted-foreground">
                              De {contrato.inicio} até {contrato.fim}
                            </p>
                          </div>
                          <Badge className="bg-green-600">{contrato.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum contrato vinculado
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Metas */}
            <TabsContent value="metas" className="p-6 space-y-6 mt-0">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold">Metas & OKRs</h3>
                        <p className="text-sm text-muted-foreground">{artista.name}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowMetaForm(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Meta
                    </Button>
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{metas.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-amber-500">{metasEmProgresso}</p>
                      <p className="text-xs text-muted-foreground">Em Progresso</p>
                    </div>
                    <div className="text-center p-3 bg-green-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">{metasConcluidas}</p>
                      <p className="text-xs text-muted-foreground">Concluídas</p>
                    </div>
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-blue-500">{progressoMedio}%</p>
                      <p className="text-xs text-muted-foreground">Progresso Médio</p>
                    </div>
                  </div>

                  {metas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Target className="h-16 w-16 text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-1">Nenhuma meta definida</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Defina metas para acompanhar o progresso do artista
                      </p>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowMetaForm(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Criar Primeira Meta
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {metas.map((meta) => {
                        const progress = getProgressPercent(meta);
                        const statusInfo = statusMeta.find((s) => s.value === meta.status);
                        return (
                          <Card key={meta.id} className="bg-background/50">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{meta.titulo}</h4>
                                    <Badge className={statusInfo?.color}>{statusInfo?.label}</Badge>
                                  </div>
                                  {meta.descricao && <p className="text-sm text-muted-foreground">{meta.descricao}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditMeta(meta)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteMeta(meta.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-muted-foreground">
                                      {meta.valorAtual.toLocaleString()} / {meta.valorMeta.toLocaleString()}{" "}
                                      {meta.unidade}
                                    </span>
                                    <span className="text-sm font-medium">{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {meta.dataInicio && meta.dataFim && (
                                    <span>
                                      {new Date(meta.dataInicio).toLocaleDateString("pt-BR")} -{" "}
                                      {new Date(meta.dataFim).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                                {meta.categoria && (
                                  <Badge variant="outline" className="text-xs">
                                    {categoriasMeta.find((c) => c.value === meta.categoria)?.label}
                                  </Badge>
                                )}
                                {meta.tipo && (
                                  <Badge variant="outline" className="text-xs">
                                    {tiposMeta.find((t) => t.value === meta.tipo)?.label}
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Evolução */}
            <TabsContent value="evolucao" className="p-6 space-y-6 mt-0">
              <ArtistaEvolucaoSection artista={artista} />
            </TabsContent>

            {/* Histórico */}
            <TabsContent value="historico" className="p-6 space-y-6 mt-0">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Histórico de Atividades</h3>
                  </div>

                  <div className="space-y-4">
                    {historicoArtistaMock.length > 0 ? (
                      historicoArtistaMock.map((item, index) => (
                        <div key={item.id} className="relative">
                          {index < historicoArtistaMock.length - 1 && (
                            <div className="absolute left-5 top-10 w-0.5 h-full bg-border" />
                          )}

                          <div className="flex items-start gap-4 p-3 bg-background/50 rounded-lg">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                              {getHistoricoIcon(item.tipo)}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{item.descricao}</p>
                                {getHistoricoBadge(item.tipo)}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(item.data).toLocaleDateString("pt-BR")} às{" "}
                                  {new Date(item.data).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {item.usuario}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        Nenhum registro de histórico encontrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Modal de Nova/Editar Meta */}
        <Dialog open={showMetaForm} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2">
                <Label>Título da Meta *</Label>
                <Input
                  value={metaForm.titulo}
                  onChange={(e) => setMetaForm({ ...metaForm, titulo: e.target.value })}
                  placeholder="Ex: Alcançar 1M de streams"
                />
              </div>

              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={metaForm.descricao}
                  onChange={(e) => setMetaForm({ ...metaForm, descricao: e.target.value })}
                  placeholder="Descreva a meta em detalhes..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Tipo de Meta *</Label>
                <Select value={metaForm.tipo} onValueChange={(v) => setMetaForm({ ...metaForm, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposMeta.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={metaForm.categoria} onValueChange={(v) => setMetaForm({ ...metaForm, categoria: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasMeta.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Valor da Meta *</Label>
                <Input
                  type="number"
                  value={metaForm.valorMeta}
                  onChange={(e) => setMetaForm({ ...metaForm, valorMeta: e.target.value })}
                  placeholder="1000000"
                />
              </div>

              <div>
                <Label>Valor Atual</Label>
                <Input
                  type="number"
                  value={metaForm.valorAtual}
                  onChange={(e) => setMetaForm({ ...metaForm, valorAtual: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Unidade de Medida</Label>
                <Input
                  value={metaForm.unidade}
                  onChange={(e) => setMetaForm({ ...metaForm, unidade: e.target.value })}
                  placeholder="Ex: streams, seguidores, R$"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={metaForm.status}
                  onValueChange={(v) => setMetaForm({ ...metaForm, status: v as Meta["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusMeta.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={metaForm.dataInicio}
                  onChange={(e) => setMetaForm({ ...metaForm, dataInicio: e.target.value })}
                />
              </div>

              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={metaForm.dataFim}
                  onChange={(e) => setMetaForm({ ...metaForm, dataFim: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSaveMeta} className="bg-red-600 hover:bg-red-700">
                {editingMeta ? "Salvar Alterações" : "Criar Meta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
