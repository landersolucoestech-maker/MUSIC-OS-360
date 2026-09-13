import { useMemo, useState } from "react";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { SPECIALTY_LABELS } from "@/modules/artist/mappers";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { contactTypeOptions, labelFor } from "@/modules/crm-relationships/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Progress } from "@/shared/ui/progress";
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
  MapPin,
  CreditCard,
  Building,
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
  ImageIcon,
  Video,
  Link2,
} from "lucide-react";
import { ArtistEvolutionSection } from "@/modules/artist/components/ArtistEvolutionSection";
import { PositioningCard } from "@/modules/artist/components/PositioningCard";
import { ArtistPlatformMetrics } from "@/modules/artist/components/ArtistPlatformMetrics";

const formatDateDMY = (d?: string | null): string => {
  if (!d) return "Não informado";
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d.replace(/\//g, "-");
  const datePart = d.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
  }
  return d;
};

// imports movidos para cá após remoção de CircularProgress
import { formatCurrency, getCurrencyToneClass, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { useObras } from "@/modules/catalog/hooks/useObras";
import { useFonogramas } from "@/modules/catalog/hooks/useFonogramas";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useMetas } from "@/modules/marketing/hooks/useMetas";
import {
  useContracts,
  type ContractWithRelations,
} from "@/modules/contracts/hooks/useContracts";
import { useTransactions } from "@/modules/accounting/hooks/useTransactions";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { useEvents } from "@/modules/events/hooks/useEvents";
import { getBackendEventTypeLabel } from "@/modules/events/lib/event-type";
import { useMarketingContents } from "@/modules/marketing/hooks/useMarketingContents";
import { useMarketingCampaigns } from "@/modules/marketing/hooks/useMarketingCampaigns";

// ── Marketing: rótulos de campanha/canal ──────────────────────────────────
const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", agendada: "Agendada", ativa: "Ativa",
  pausada: "Pausada", concluida: "Concluída", cancelada: "Cancelada",
};
const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube",
  twitter: "Twitter", threads: "Threads", linkedin: "LinkedIn", shorts: "Shorts",
  reels: "Reels", stories: "Stories", blog: "Blog", podcast: "Podcast",
  campanha: "Campanha", portal_noticias: "Portal", material_publicitario: "Publicidade",
};
const CAMPAIGN_SECTIONS: Array<{ key: string; label: string; status: string[] }> = [
  { key: "ativas", label: "Campanhas Ativas", status: ["active", "paused"] },
  { key: "encerradas", label: "Campanhas Encerradas", status: ["completed", "cancelled"] },
  { key: "planejadas", label: "Campanhas Planejadas", status: ["draft", "agendada"] },
];

// ── Financeiro: receitas por natureza ──────────────────────────────────────
const NATURE_BUCKETS: Array<{ label: string; keywords: string[] }> = [
  { label: "Royalties", keywords: ["royalt"] },
  { label: "Shows", keywords: ["show", "cache", "cachê"] },
  { label: "Licenciamentos", keywords: ["licenc", "sync"] },
  { label: "Publicidade", keywords: ["public", "publi", "ads", "anuncio", "patroc"] },
  { label: "Distribuição", keywords: ["distrib", "streaming"] },
];

// ── Contratos: filtros por type ────────────────────────────────────────────
const CONTRACT_FILTERS: Array<{ key: string; label: string; tipos?: string[] }> = [
  { key: "todos", label: "Todos" },
  { key: "empresarial", label: "Empresarial", tipos: ["exclusivo", "nao_exclusivo", "gestao", "representacao"] },
  { key: "distribuicao", label: "Distribuição", tipos: ["distribuicao"] },
  { key: "licenciamento", label: "Licenciamento", tipos: ["licenciamento"] },
  { key: "producao", label: "Produção", tipos: ["producao"] },
  { key: "parcerias", label: "Parcerias", tipos: ["parceria"] },
  { key: "servicos", label: "Serviços", tipos: ["servicos"] },
  { key: "outros", label: "Outros", tipos: ["outro"] },
];

// ── Agenda: rótulos e filtros ──────────────────────────────────────────────
// events.type só guarda o enum coarse do backend (show/festival/recording/
// meeting/interview/tour/other) — ver modules/events/lib/event-type.ts para
// os rótulos reais. "Ensaios" e "Gravações" viram um único filtro porque a
// coluna real não distingue as duas (ambas coarseiam para "recording").
const EVENT_STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado", agendado: "Agendado", confirmado: "Confirmado",
  realizado: "Realizado", concluido: "Concluído", cancelado: "Cancelado", adiado: "Adiado",
};
const SCHEDULE_FILTERS: Array<{ key: string; label: string; tipos?: string[] }> = [
  { key: "todos", label: "Todos" },
  { key: "shows", label: "Shows", tipos: ["show", "festival"] },
  { key: "reunioes", label: "Reuniões", tipos: ["meeting"] },
  { key: "entrevistas", label: "Entrevistas", tipos: ["interview"] },
  { key: "gravacoes", label: "Gravações/Ensaios", tipos: ["recording"] },
  { key: "turnes", label: "Turnês", tipos: ["tour"] },
  { key: "outros", label: "Outros", tipos: ["other"] },
];

// ── Conteúdos: rótulos e filtros ───────────────────────────────────────────
const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post", feed: "Feed", stories: "Stories", reels: "Reels", shorts: "Shorts",
  video: "Vídeo", carrossel: "Carrossel", anuncio: "Anúncio", rede_social: "Rede Social",
  institucional: "Institucional", comercial: "Comercial", artista: "Artista",
  bastidores: "Bastidores", reuniao: "Reunião", evento: "Evento", portal: "Portal",
  blog: "Blog", publicidade: "Publicidade",
};
const CONTENT_STATUS_LABELS: Record<string, string> = {
  ideia: "Planejado", producao: "Em Produção", revisao: "Em Revisão",
  agendado: "Agendado", publicado: "Publicado", falhou: "Falhou", atrasado: "Atrasado",
};
const CONTENT_FILTERS: Array<{ key: string; label: string; status?: string[] }> = [
  { key: "todos", label: "Todos" },
  { key: "planejados", label: "Planejados", status: ["ideia", "agendado"] },
  { key: "producao", label: "Em Produção", status: ["producao", "revisao"] },
  { key: "publicado", label: "Publicado", status: ["publicado"] },
];

interface MarketingMeta {
  id: number;
  title: string;
  descricao: string;
  type: string;
  categoria: string;
  valorMeta: number;
  valorAtual: number;
  unidade: string;
  startDate: string;
  endDate: string;
  status: "em_progresso" | "concluida" | "pausada" | "cancelada";
}

interface ArtistVision360ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artista?: any;
}

const getHistoryIcon = (type: string) => {
  switch (type) {
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
    case "status":
      return <Zap className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

const getHistoryBadge = (type: string) => {
  switch (type) {
    case "criacao":
      return <Badge variant="success">Criação</Badge>;
    case "edicao":
      return <Badge variant="info">Edição</Badge>;
    case "obra":
      return <Badge variant="info">Obra</Badge>;
    case "contrato":
      return (
        <Badge variant="warning">Contrato</Badge>
      );
    case "financeiro":
      return <Badge variant="success">Financeiro</Badge>;
    case "exclusao":
      return <Badge variant="danger">Exclusão</Badge>;
    case "status":
      return <Badge variant="info">Status</Badge>;
    default:
      return <Badge variant="neutral">Outro</Badge>;
  }
};

const goalTypes = [
  { value: "streams", label: "Streams" },
  { value: "seguidores", label: "Seguidores" },
  { value: "lancamentos", label: "Lançamentos" },
  { value: "receita", label: "Receita" },
  { value: "eventos", label: "Shows/Eventos" },
  { value: "outros", label: "Outros" },
];

const goalCategories = [
  { value: "crescimento", label: "Crescimento" },
  { value: "financeiro", label: "Financeiro" },
  { value: "producao", label: "Produção" },
  { value: "marketing", label: "Marketing" },
  { value: "carreira", label: "Carreira" },
];

const primaryCompactButtonClass = "h-8 text-xs gap-1.5";
const activeBlueBadgeClass = "bg-primary text-primary-foreground border-primary";

const metaStatusOptions = [
  { value: "em_progresso", label: "Em Progresso", color: activeBlueBadgeClass },
  { value: "concluida", label: "Concluída", color: "bg-success" },
  { value: "pausada", label: "Pausada", color: "bg-gray-500" },
  { value: "cancelada", label: "Cancelada", color: "bg-destructive" },
];

const getProjectStatusBadgeClass = (status?: string | null) => {
  if (status === "in_progress") return activeBlueBadgeClass;
  if (status === "completed") return "bg-success";
  return "bg-gray-600 text-white border-gray-600";
};

const STATUS_LABELS_PT_BR: Record<string, string> = {
  analise: "Análise",
  em_analise: "Em Análise",
  em_producao: "Em Produção",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  concluida: "Concluída",
  ativo: "Ativo",
  registrado: "Registrado",
  pendente: "Pendente",
};

const formatStatusPtBr = (status?: string | null): string => {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return "Não informado";

  const key = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  return STATUS_LABELS_PT_BR[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
};

export function ArtistVision360Modal({
  open,
  onOpenChange,
  artista,
}: ArtistVision360ModalProps) {
  // Consultas pesadas do hub 360 só fazem sentido com o modal aberto — ver
  // Task F: mantê-las sempre ativas fazia Dashboard/Artistas baixarem ~11
  // tabelas inteiras a cada carregamento de página, mesmo com o modal
  // fechado. `enabled: open` preserva o comportamento de todo outro
  // consumidor desses hooks (default `true`).
  //
  // Task G: cada uma agora também é filtrada por artist_id NO SERVIDOR
  // (backend já suporta — ver QueryPhonogramDto/QueryContractDto/
  // QueryTransactionDto/QueryEventDto/projects.dto.ts/artist-goals — works
  // ganhou o filtro nesta task). Antes, o modal baixava a tabela inteira do
  // tenant e filtrava no cliente com `.filter(x => x.artist_id === id)`
  // (padrão que a Task G pede para eliminar) — trocar de artista reaproveitava
  // até o mesmo cache incorreto, já que a queryKey não distinguia o artista.
  const artistId = artista?.id;
  const { obras: actualWorks } = useObras(open, artistId);
  const { fonogramas: actualPhonograms } = useFonogramas(open, artistId);
  const { lancamentos: actualReleases } = useLancamentos(open, artistId);
  const { projects: actualProjects } = useProjects(open, artistId);
  const {
    metas: actualMetas,
    addMeta,
    updateMeta,
    deleteMeta,
    getProgressPercent: calcProgress,
  } = useMetas(open, artistId);
  const { contracts: actualContracts } = useContracts(open, artistId);
  const { transactions: artistTransactions } = useTransactions(open, artistId);
  const { contacts } = useContacts(open);
  const { events: actualEvents } = useEvents(open, artistId);
  const { data: marketingContents = [] } = useMarketingContents(open);
  const { data: marketingCampaigns = [] } = useMarketingCampaigns(open);

  // Resolve os contatos vinculados (referências) com os dados atuais do CRM.
  const linkedContactsResolved = useMemo(() => {
    const raw = (artista as Record<string, unknown> | null | undefined)?.contatos_vinculados;
    if (!Array.isArray(raw)) return [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    return (raw as Array<{ contactId?: string }>)
      .map((v) => (typeof v?.contactId === "string" ? byId.get(v.contactId) : undefined))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [artista, contacts]);

  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MarketingMeta | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState("todos");
  const [contentFilter, setContentFilter] = useState("todos");
  const [contractFilter, setContractFilter] = useState("todos");

  // ── Agenda (eventos do artista) ────────────────────────────────────────
  const filteredSchedule = (actualEvents as any[]).filter((e) => {
    const cfg = SCHEDULE_FILTERS.find((f) => f.key === scheduleFilter);
    if (!cfg || !cfg.tipos) return true;
    return cfg.tipos.includes(String(e.type ?? "").toLowerCase());
  });

  // ── Conteúdos (marketing contents do artista) ──────────────────────────
  const actualContent = marketingContents.filter(
    (c) => c.targetType === "artista" && c.targetId === artistId,
  );
  const filteredContent = actualContent.filter((c) => {
    const cfg = CONTENT_FILTERS.find((f) => f.key === contentFilter);
    if (!cfg || !cfg.status) return true;
    return cfg.status.includes(String(c.status ?? "").toLowerCase());
  });

  // ── Marketing (campanhas do artista) ───────────────────────────────────
  const actualCampaigns = marketingCampaigns.filter(
    (c) => c.targetType === "artista" && c.targetId === artistId,
  );

  // ── Movimentação (timeline operacional derivada dos dados do artista) ──
  const activityTimelineItems: {
    id: string;
    type: string;
    descricao: string;
    data: string;
    responsavel: string;
  }[] = [];
  actualContracts.forEach((c) => {
    const d = (c as { created_at?: string }).created_at;
    if (d) activityTimelineItems.push({ id: `mv-ctr-${c.id}`, type: "Jurídico", descricao: `Contrato: ${c.title}`, data: d, responsavel: "Admin" });
  });
  artistTransactions.forEach((t) => {
    const d = (t as { created_at?: string; data?: string }).created_at ?? (t as { data?: string }).data;
    if (d) activityTimelineItems.push({ id: `mv-txn-${t.id}`, type: "Financeiro", descricao: t.descricao ?? (t.type === "receita" ? "Pagamento recebido" : "Despesa registrada"), data: d, responsavel: "Financeiro" });
  });
  actualEvents.forEach((e) => {
    const ev = e as { data?: string; type?: string; created_at?: string };
    const d = ev.data ?? ev.created_at;
    if (d) activityTimelineItems.push({ id: `mv-evt-${e.id}`, type: "Agenda", descricao: `${getBackendEventTypeLabel(ev.type)}: ${e.title}`, data: d, responsavel: "—" });
  });
  actualReleases.forEach((l: any) => {
    const d = l.created_at ?? l.data_lancamento;
    if (d) activityTimelineItems.push({ id: `mv-lan-${l.id}`, type: "Produção", descricao: `Lançamento: ${l.title ?? ""}`, data: d, responsavel: "Admin" });
  });
  actualCampaigns.forEach((c) => {
    const d = c.startDate ?? c.createdAt;
    if (d) activityTimelineItems.push({ id: `mv-cmp-${c.id}`, type: "Marketing", descricao: `Campanha: ${c.name}`, data: d, responsavel: c.owner || "—" });
  });
  actualContent.forEach((c) => {
    const d = c.publishDate ?? c.createdAt;
    if (d) activityTimelineItems.push({ id: `mv-cnt-${c.id}`, type: "Marketing", descricao: `Conteúdo: ${c.title}`, data: d, responsavel: c.owner || "—" });
  });
  activityTimelineItems.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  // ── Visão Geral: KPIs executivos + widgets ─────────────────────────────
  const nowTs = Date.now();
  const confirmedShows = (actualEvents as any[]).filter(
    (e) =>
      ["show", "festival"].includes(String(e.type ?? "").toLowerCase()) &&
      ["confirmed", "held", "completed"].includes(String(e.status ?? "").toLowerCase()),
  ).length;
  const activeReleases = actualReleases.length;
  const activeCampaignsCount = actualCampaigns.filter(
    (c) => String(c.status ?? "").toLowerCase() === "active",
  ).length;
  const pendingContent = actualContent.filter((c) =>
    ["ideia", "producao", "revisao", "agendado", "atrasado"].includes(String(c.status ?? "").toLowerCase()),
  ).length;
  const nextShow = (actualEvents as any[])
    .filter(
      (e) =>
        ["show", "festival"].includes(String(e.type ?? "").toLowerCase()) &&
        e.data &&
        new Date(e.data).getTime() >= nowTs,
    )
    .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())[0];
  const nextRelease = (actualReleases as any[])
    .filter((l) => l.data_lancamento && new Date(l.data_lancamento).getTime() >= nowTs)
    .sort((a, b) => new Date(a.data_lancamento).getTime() - new Date(b.data_lancamento).getTime())[0];

  // ── Evolução: marcos (milestones) derivados ────────────────────────────
  const evolutionMilestones: { id: string; label: string; descricao: string; data: string }[] = [];
  if (artista?.created_at) evolutionMilestones.push({ id: "m-cad", label: "Cadastro", descricao: "Artista cadastrado no sistema", data: artista.created_at });
  const firstRelease = (actualReleases as any[])
    .filter((l) => l.created_at || l.data_lancamento)
    .sort((a, b) => new Date(a.created_at ?? a.data_lancamento).getTime() - new Date(b.created_at ?? b.data_lancamento).getTime())[0];
  if (firstRelease) evolutionMilestones.push({ id: "m-lan", label: "Primeiro Lançamento", descricao: firstRelease.title ?? "Lançamento", data: firstRelease.created_at ?? firstRelease.data_lancamento });
  const firstShow = (actualEvents as any[])
    .filter((e) => ["show", "festival"].includes(String(e.type ?? "").toLowerCase()) && e.data)
    .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())[0];
  if (firstShow) evolutionMilestones.push({ id: "m-show", label: "Primeira Turnê/Show", descricao: firstShow.title, data: firstShow.data! });
  const firstContract = (actualContracts as any[])
    .filter((c) => c.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  if (firstContract) evolutionMilestones.push({ id: "m-ctr", label: "Contrato Assinado", descricao: firstContract.title, data: firstContract.created_at });
  evolutionMilestones.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  // ── Financeiro real ──────────────────────────────────────────────────
  const totalRevenue = artistTransactions
    .filter((t) => t.type === "receita" && t.status === "paid")
    .reduce((sum, t) => sum + (t.valor ?? 0), 0);
  const totalExpenses = artistTransactions
    .filter((t) => t.type === "despesa" && t.status === "paid")
    .reduce((sum, t) => sum + (t.valor ?? 0), 0);
  const totalBalance = totalRevenue - totalExpenses;
  const overallRoi = totalExpenses > 0 ? totalBalance / totalExpenses : null;
  const overallMargin = totalRevenue > 0 ? totalBalance / totalRevenue : null;
  const paidRevenue = artistTransactions.filter(
    (t) => t.type === "receita" && t.status === "paid",
  );
  const revenueByNature = NATURE_BUCKETS.map((b) => ({
    label: b.label,
    total: paidRevenue
      .filter((t) => b.keywords.some((k) => String((t as { categoria?: string }).categoria ?? "").toLowerCase().includes(k)))
      .reduce((s, t) => s + (t.valor ?? 0), 0),
  }));
  const revenueByNatureOther = paidRevenue
    .filter((t) => !NATURE_BUCKETS.some((b) => b.keywords.some((k) => String((t as { categoria?: string }).categoria ?? "").toLowerCase().includes(k))))
    .reduce((s, t) => s + (t.valor ?? 0), 0);
  const totalPending = artistTransactions
    .filter((t) => t.status === "pending" || t.status === "a_receber")
    .reduce((sum, t) => sum + (t.valor ?? 0), 0);

  // ── Métricas de contratos ────────────────────────────────────────────
  const today = new Date();
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const ACTIVE_STATUSES = ["signed", "in_force"];
  const activeContracts = actualContracts.filter((c) =>
    ACTIVE_STATUSES.includes(c.status ?? ""),
  ).length;
  const expiringContracts = actualContracts.filter((c) => {
    if (!c.end_date || !ACTIVE_STATUSES.includes(c.status ?? "")) return false;
    const endDate = new Date(c.end_date);
    return endDate > today && endDate <= in60Days;
  }).length;
  const filteredContracts = actualContracts.filter((c) => {
    const cfg = CONTRACT_FILTERS.find((f) => f.key === contractFilter);
    if (!cfg || !cfg.tipos) return true;
    return cfg.tipos.includes(String(c.type ?? "").toLowerCase());
  });

  // ── Histórico derivado de dados reais ────────────────────────────────
  const actualHistory: {
    id: string;
    type: string;
    descricao: string;
    data: string;
    usuario: string;
  }[] = [];
  if (artista?.created_at) {
    actualHistory.push({
      id: "criacao",
      type: "criacao",
      descricao: "Artista cadastrado no sistema",
      data: artista.created_at,
      usuario: "Admin",
    });
  }
  actualContracts.forEach((c) => {
    if (c.created_at)
      actualHistory.push({
        id: `ctr-${c.id}`,
        type: "contrato",
        descricao: `Contrato assinado: ${c.title}`,
        data: c.created_at,
        usuario: "Admin",
      });
  });
  actualWorks.slice(0, 5).forEach((o: any) => {
    if (o.created_at)
      actualHistory.push({
        id: `obra-${o.id}`,
        type: "obra",
        descricao: `Obra registrada: ${o.title}`,
        data: o.created_at,
        usuario: "Produtor",
      });
  });
  actualReleases.slice(0, 5).forEach((l: any) => {
    if (l.created_at)
      actualHistory.push({
        id: `lanc-${l.id}`,
        type: "obra",
        descricao: `Lançamento registrado: ${l.title}`,
        data: l.created_at,
        usuario: "Admin",
      });
  });
  artistTransactions.slice(0, 3).forEach((t) => {
    if (t.created_at)
      actualHistory.push({
        id: `txn-${t.id}`,
        type: "financeiro",
        descricao: t.descricao,
        data: t.created_at,
        usuario: "Financeiro",
      });
  });
  // Status-change events derivados do status atual do artista
  const ARTIST_STATUS_HISTORY_LABELS: Record<string, string> = {
    signed: "Artista contratado",
    in_negotiation: "Negociação iniciada",
    onboarding: "Artista em processo de onboarding",
    inactive: "Artista inativado",
    suspended: "Artista suspenso",
  };
  if (
    artista?.status &&
    artista.status !== "signed" &&
    artista.updated_at
  ) {
    const label =
      ARTIST_STATUS_HISTORY_LABELS[artista.status] ??
      `Status alterado para: ${artista.status}`;
    actualHistory.push({
      id: `status-${artista.status}`,
      type: "status",
      descricao: label,
      data: artista.updated_at,
      usuario: "Admin",
    });
  }
  actualHistory.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  // Tendência da evolução (Task #361): chips de "↑/↓/—" nos cards de
  // plataforma do dashboard 360 reusam os mesmos snapshots diários
  // (`record_artista_metric_snapshot`) já consumidos pela aba "Evolução".
  // Os hooks só disparam a query quando o artista tem ID configurado para
  // a plataforma — assim evita chamadas inúteis para perfis não vinculados.

  const [metaForm, setMetaForm] = useState({
    title: "",
    descricao: "",
    type: "",
    categoria: "",
    valorMeta: "",
    valorAtual: "",
    unidade: "",
    startDate: "",
    endDate: "",
    status: "em_progresso" as MarketingMeta["status"],
  });

  if (!artista) return null;

  const resetForm = () => {
    setMetaForm({
      title: "",
      descricao: "",
      type: "",
      categoria: "",
      valorMeta: "",
      valorAtual: "",
      unidade: "",
      startDate: "",
      endDate: "",
      status: "em_progresso",
    });
    setEditingMeta(null);
    setShowMetaForm(false);
  };

  const handleSaveMeta = async () => {
    if (!metaForm.title || !metaForm.type || !metaForm.valorMeta) return;
    const payload = {
      artist_id: artistId,
      title: metaForm.title,
      descricao: metaForm.descricao,
      tipo_meta: metaForm.type,
      categoria: metaForm.categoria,
      valor_meta: Number(metaForm.valorMeta),
      valor_atual: Number(metaForm.valorAtual) || 0,
      unidade: metaForm.unidade,
      start_date: metaForm.startDate || null,
      end_date: metaForm.endDate || null,
      status: metaForm.status,
    };
    if (editingMeta) {
      await updateMeta({ id: String(editingMeta.id), ...payload });
    } else {
      await addMeta(payload);
    }
    resetForm();
  };

  const handleEditMeta = (meta: any) => {
    setMetaForm({
      title: meta.title || meta.tipo_meta || "",
      descricao: meta.descricao || "",
      type: meta.tipo_meta || meta.type || "",
      categoria: meta.categoria || "",
      valorMeta: String(meta.valor_meta ?? meta.valorMeta ?? ""),
      valorAtual: String(meta.valor_atual ?? meta.valorAtual ?? ""),
      unidade: meta.unidade || "",
      startDate: meta.start_date || meta.startDate || "",
      endDate: meta.end_date || meta.endDate || "",
      status: (meta.status as MarketingMeta["status"]) || "em_progresso",
    });
    setEditingMeta(meta);
    setShowMetaForm(true);
  };

  const handleDeleteMeta = async (id: string | number) => {
    await deleteMeta(String(id));
  };

  const metasInProgress = actualMetas.filter(
    (m) => m.status === "em_progresso",
  ).length;
  const completedMetas = actualMetas.filter(
    (m) => m.status === "concluida",
  ).length;
  const averageProgress =
    actualMetas.length > 0
      ? Math.round(
          actualMetas.reduce((acc, m) => acc + calcProgress(m), 0) /
            actualMetas.length,
        )
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-card">
        <DialogTitle className="sr-only">
          Visão 360 do artista {artista.nome_artistico}
        </DialogTitle>
        <div className="border-b border-border shrink-0 bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-foreground shrink-0"
                >
                  {artista.foto_url ? (
                    <img
                      src={artista.foto_url}
                      alt={artista.nome_artistico}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    artista.nome_artistico?.[0] || "A"
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {artista.nome_artistico}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="neutral">
                      {artista.genero_musical || "Não informado"}
                    </Badge>
                    {artista.status === "onboarding" ? (
                      <Badge variant="warning">
                        Onboarding
                      </Badge>
                    ) : (
                      (() => {
                        const ACTIVE_STATUS_VALUES = new Set([
                          "active",
                          "signed",
                          "in_force",
                          "expiring",
                        ]);
                        const isExclusive = actualContracts.some(
                          (c) =>
                            c.exclusivo === true &&
                            ACTIVE_STATUS_VALUES.has((c.status || "").toLowerCase()),
                        );
                        return isExclusive ? (
                          <Badge variant="success">Artista exclusivo</Badge>
                        ) : (
                          <Badge variant="info">Artista parceiro</Badge>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-1 flex-col min-h-0 bg-card">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 overflow-x-auto shrink-0">
            <TabsTrigger
              value="visao-geral"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="perfil"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Perfil
            </TabsTrigger>
            <TabsTrigger
              value="catalogo"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Catálogo
            </TabsTrigger>
            <TabsTrigger
              value="agenda"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Agenda
            </TabsTrigger>
            <TabsTrigger
              value="financeiro"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="contratos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Contratos
            </TabsTrigger>
            <TabsTrigger
              value="evolucao"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
              data-testid="tab-evolucao"
            >
              Evolução
            </TabsTrigger>
            <TabsTrigger
              value="marketing"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Marketing
            </TabsTrigger>
            <TabsTrigger
              value="conteudos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Conteúdos
            </TabsTrigger>
            <TabsTrigger
              value="movimentacao"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Movimentação
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
            >
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Scroll owner do modal. Usa overflow nativo em vez de ScrollArea:
              o Viewport do Radix depende de height:100%, que NÃO resolve contra um
              pai dimensionado por flex-grow — media 1467px dentro de um Root de 681px,
              logo scrollHeight === clientHeight e o scroll nunca acontecia. Um container
              de overflow nativo é dimensionado pelo próprio flex e rola de facto. */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            data-testid="vision360-scroll"
            tabIndex={0}
            role="region"
            aria-label="Conteúdo da Visão 360"
          >
            {/* Visão Geral */}
            <TabsContent value="visao-geral" className="p-6 space-y-6 mt-0">
              {/* KPIs executivos */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Resumo Executivo</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className={`text-lg font-bold ${getCurrencyToneClass(totalRevenue)}`}>{formatCurrency(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">Receita Total</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className={`text-lg font-bold ${getCurrencyToneClass(-totalExpenses)}`}>{formatCurrency(-totalExpenses)}</p>
                      <p className="text-xs text-muted-foreground">Despesas Totais</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className={`text-lg font-bold ${getCurrencyToneClass(totalBalance)}`}>{formatCurrency(totalBalance)}</p>
                      <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <BarChart3 className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-lg font-bold">{overallRoi != null ? `${Math.round(overallRoi * 100)}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground">ROI Geral</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-lg font-bold">{confirmedShows}</p>
                      <p className="text-xs text-muted-foreground">Shows Confirmados</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Rocket className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-lg font-bold">{activeReleases}</p>
                      <p className="text-xs text-muted-foreground">Lançamentos Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Widgets de acompanhamento */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" /> Próximo Show
                    </div>
                    {nextShow ? (
                      <>
                        <p className="text-sm font-semibold truncate">{nextShow.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateDMY(nextShow.data)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum agendado</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Rocket className="h-3.5 w-3.5" /> Próximo Lançamento
                    </div>
                    {nextRelease ? (
                      <>
                        <p className="text-sm font-semibold truncate">{nextRelease.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateDMY(nextRelease.data_lancamento)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum agendado</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Zap className="h-3.5 w-3.5" /> Campanhas Ativas
                    </div>
                    <p className="text-xl font-bold">{activeCampaignsCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Video className="h-3.5 w-3.5" /> Conteúdos Pendentes
                    </div>
                    <p className="text-xl font-bold">{pendingContent}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <FileText className="h-3.5 w-3.5" /> Contratos Ativos
                    </div>
                    <p className="text-xl font-bold">{activeContracts}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Posicionamento da Carreira (Fase 3.2 Parte IV — consolida
                  Career Stage + Market Benchmark em um único diagnóstico;
                  ambos calculados no backend a partir de métricas
                  Soundcharts já ingeridas) */}
              <PositioningCard artistId={artista.id} />

              {/* Métricas */}
              <div className="grid grid-cols-5 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Building className="h-4 w-4 text-primary" />
                      <span className="text-sm">Projetos</span>
                    </div>
                    <p className="text-2xl font-bold">{actualProjects.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Music className="h-4 w-4 text-primary" />
                      <span className="text-sm">Obras</span>
                    </div>
                    <p className="text-2xl font-bold">{actualWorks.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Disc className="h-4 w-4 text-success" />
                      <span className="text-sm">Fonogramas</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {actualPhonograms.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Rocket className="h-4 w-4 text-warning" />
                      <span className="text-sm">Lançamentos</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {actualReleases.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Contratos</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {actualContracts.length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Plano de Aceleração */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-warning" />
                    <h3 className="font-semibold">Plano de Aceleração</h3>
                  </div>
                  <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                    <Zap className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Plano não configurado
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      O plano de aceleração será exibido quando métricas
                      validadas forem cadastradas para este artista.
                    </p>
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
                        <h3 className="font-semibold">
                          Diagnóstico de Gargalo
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                      <Lightbulb className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Sem diagnóstico disponível
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Preencha os dados do artista para gerar análise de
                        gargalos.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h3 className="font-semibold">Principais Riscos</h3>
                    </div>
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Sem riscos identificados
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        A análise de riscos estará disponível quando houver
                        dados suficientes.
                      </p>
                    </div>
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
                      <p className={`text-xl font-bold ${getCurrencyToneClass(totalRevenue)}`}>
                        {formatCurrency(totalRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Despesas</p>
                      <p className={`text-xl font-bold ${getCurrencyToneClass(-totalExpenses)}`}>
                        {formatCurrency(-totalExpenses)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo</p>
                      <p
                        className={`text-xl font-bold ${getCurrencyToneClass(totalBalance)}`}
                      >
                        {formatCurrency(totalBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      <p className={`text-xl font-bold ${getCurrencyToneClass(totalPending)}`}>
                        {formatCurrency(totalPending)}
                      </p>
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
                    <span className="text-sm text-muted-foreground">
                      Progresso Médio
                    </span>
                    <span className="text-sm font-medium">
                      {averageProgress}%
                    </span>
                  </div>
                  <Progress value={averageProgress} className="h-2" />
                  <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-warning">
                        {metasInProgress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Em Progresso
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">
                        {completedMetas}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluídas
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{actualMetas.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Foco dos Próximos 90 Dias */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-5 w-5 text-teal-500" />
                    <h3 className="font-semibold">Foco dos Próximos 90 Dias</h3>
                  </div>
                  <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                    <Target className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Foco não definido
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Crie metas com prazo para que o foco dos próximos 90 dias
                      seja gerado automaticamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Perfil */}
            <TabsContent value="perfil" className="p-6 space-y-6 mt-0">
              {/* Informações Básicas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Mic className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Informações Básicas</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Nome Artístico
                      </p>
                      <p className="text-sm font-medium">
                        {artista.nome_artistico || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Gênero Musical
                      </p>
                      <p className="text-sm font-medium capitalize">
                        {artista.genero_musical || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Função</p>
                      <p className="text-sm font-medium">
                        {(() => {
                          const specialties = Array.isArray(artista.especialidades)
                            ? artista.especialidades
                            : [];
                          if (specialties.length === 0) return "Não informado";
                          return specialties
                            .map((e: string) => SPECIALTY_LABELS[e] ?? e)
                            .join(", ");
                        })()}
                      </p>
                    </div>
                  </div>
                  {artista.observacoes && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Biografia</p>
                      <p className="text-sm font-medium">
                        {artista.observacoes}
                      </p>
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
                      <p className="text-xs text-muted-foreground">
                        Nome Completo
                      </p>
                      <p className="text-sm font-medium">
                        {artista.nome_civil ||
                          artista.nome_artistico ||
                          "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Data de Nascimento
                      </p>
                      <p className="text-sm font-medium">
                        {formatDateDMY(artista.data_nascimento as string | null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="text-sm font-medium">
                        {artista.cpf_cnpj || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RG</p>
                      <p className="text-sm font-medium">
                        {artista.rg || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gênero</p>
                      <p className="text-sm font-medium">
                        {(artista as Record<string, unknown>).genero as string || "Não informado"}
                      </p>
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
                      <p className="text-sm font-medium">
                        {artista.email || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium">
                        {artista.telefone || "Não informado"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="text-sm font-medium">
                        {artista.endereco || "Não informado"}
                      </p>
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
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="text-sm font-medium break-words">
                        {artista.banco?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Agência</p>
                      <p className="text-sm font-medium break-words">
                        {artista.agencia || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Conta</p>
                      <p className="text-sm font-medium break-words">
                        {artista.conta || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Titular da Conta</p>
                      <p className="text-sm font-medium break-words">
                        {artista.titular_conta || artista.nome_civil || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Chave PIX</p>
                      <p className="text-sm font-medium break-words">
                        {artista.chave_pix || "Não informado"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Perfis e Redes Sociais */}
              <ArtistPlatformMetrics
                artistId={artista.id}
                spotifyUrl={artista.spotify_url ?? null}
                youtubeUrl={artista.youtube_url ?? null}
                instagramUrl={artista.instagram_url ?? null}
                tiktokUrl={artista.tiktok_url ?? null}
                deezerUrl={artista.deezer_url ?? null}
                appleMusicUrl={artista.apple_music_url ?? null}
                soundcloudUrl={artista.soundcloud_url ?? null}
              />

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
                        {artista.tipo_perfil === "independente"
                          ? "Independente"
                          : artista.tipo_perfil === "com_empresario"
                            ? "Com Empresário"
                            : artista.tipo_perfil === "gravadora"
                              ? "Gravadora"
                              : artista.tipo_perfil === "editora"
                                ? "Editora"
                                : "Não informado"}
                      </Badge>
                    </div>
                    {artista.tipo_perfil === "com_empresario" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artista.empresario_nome || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artista.empresario_telefone || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artista.empresario_email || "Não informado"}
                          </p>
                        </div>
                      </>
                    )}
                    {artista.tipo_perfil === "gravadora" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_nome || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Contato na Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_responsavel_nome ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_telefone || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_email || "Não informado"}
                          </p>
                        </div>
                      </>
                    )}
                    {artista.tipo_perfil === "editora" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_responsavel_nome ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_responsavel_telefone ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artista.gravadora_responsavel_email ||
                              "Não informado"}
                          </p>
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
                    <h3 className="font-semibold">
                      Distribuidoras / Agregadoras
                    </h3>
                  </div>
                  {(() => {
                    const distributorSelections = artista.distribuidoras_selecionadas ?? {};
                    const activeDistributorIds = Object.entries(distributorSelections)
                      .filter(([, v]) => v)
                      .map(([k]) => k);
                    const emails = artista.distribuidoras_emails ?? {};
                    return activeDistributorIds.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {activeDistributorIds.map((dist: string) => (
                            <Badge
                              key={dist}
                              variant="secondary"
                              className="capitalize"
                            >
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
                        {Object.keys(emails).length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-border">
                            {Object.entries(emails).map(([distId, email]) => {
                              const distributorName =
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
                                  <p className="text-xs text-muted-foreground">
                                    E-mail Share - {distributorName}
                                  </p>
                                  <p className="text-sm font-medium">
                                    {(email as string) || "Não informado"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma distribuidora vinculada
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Distribuidoras / Agregadoras (novo formato — secção 5 do formulário) */}
              {(() => {
                const generalDistributors: Array<{ id: string; email: string; nomeCustom?: string }> =
                  Array.isArray((artista as Record<string, unknown>).distribuidoras_gerais)
                    ? ((artista as Record<string, unknown>).distribuidoras_gerais as Array<{ id: string; email: string; nomeCustom?: string }>)
                    : [];
                if (generalDistributors.length === 0) return null;
                const DISTRIBUTOR_LABEL: Record<string, string> = {
                  onerpm: "ONErpm", distrokid: "DistroKid", "30por1": "30 Por 1",
                  symphonic: "Symphonic", musicpro: "MusicPro", somvibe: "Somvibe",
                };
                return (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Distribuidoras / Agregadoras</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {generalDistributors.map((d) => (
                          <Badge key={d.id} variant="secondary">
                            {d.id === "outros" ? (d.nomeCustom || "Outros") : (DISTRIBUTOR_LABEL[d.id] ?? d.id)}
                          </Badge>
                        ))}
                      </div>
                      {generalDistributors.some((d) => d.email) && (
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                          {generalDistributors.filter((d) => d.email).map((d) => (
                            <div key={d.id}>
                              <p className="text-xs text-muted-foreground">
                                E-mail Share — {d.id === "outros" ? (d.nomeCustom || "Outros") : (DISTRIBUTOR_LABEL[d.id] ?? d.id)}
                              </p>
                              <p className="text-sm font-medium">{d.email}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Equipe Vinculada (CRM) — dados resolvidos dinamicamente do CRM */}
              {linkedContactsResolved.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Equipe Vinculada (CRM)</h3>
                    </div>
                    <div className="space-y-4">
                      {linkedContactsResolved.map((c) => (
                        <div key={c.id} className="p-3 rounded-lg border border-border/50 bg-background/40 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{c.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {labelFor(contactTypeOptions, c.contactType)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(c.phone || c.whatsapp) && (
                              <div>
                                <p className="text-xs text-muted-foreground">Telefone</p>
                                <p className="text-sm">{c.phone || c.whatsapp}</p>
                              </div>
                            )}
                            {c.email && (
                              <div>
                                <p className="text-xs text-muted-foreground">E-mail</p>
                                <p className="text-sm">{c.email}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Equipa / Contactos (legado — dados embutidos antigos / auto-cadastro público) */}
              {(() => {
                type TeamContactItem = { nome: string; categoria: string; telefone: string; email: string; distribuidoras?: Array<{ id: string; email: string; nomeCustom?: string }> };
                const team: TeamContactItem[] = Array.isArray((artista as Record<string, unknown>).contatos_equipe)
                  ? ((artista as Record<string, unknown>).contatos_equipe as TeamContactItem[]).filter((c) => c.nome || c.email || c.telefone)
                  : [];
                if (team.length === 0) return null;
                const CATEGORY_LABEL: Record<string, string> = {
                  booker: "Booker", assessoria: "Assessoria de Imprensa", juridico: "Jurídico",
                  financeiro: "Financeiro", contador: "Contador", editora_musical: "Editora Musical",
                  roadie: "Roadie", gestor: "Gestor", empresario: "Empresário",
                };
                const DISTRIBUTOR_LABEL: Record<string, string> = {
                  onerpm: "ONErpm", distrokid: "DistroKid", "30por1": "30 Por 1",
                  symphonic: "Symphonic", musicpro: "MusicPro", somvibe: "Somvibe",
                };
                return (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Equipe / Contatos</h3>
                      </div>
                      <div className="space-y-4">
                        {team.map((c, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-border/50 bg-background/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">{c.nome || "—"}</p>
                              {c.categoria && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {CATEGORY_LABEL[c.categoria] ?? c.categoria}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {c.telefone && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Telefone</p>
                                  <p className="text-sm">{c.telefone}</p>
                                </div>
                              )}
                              {c.email && (
                                <div>
                                  <p className="text-xs text-muted-foreground">E-mail</p>
                                  <p className="text-sm">{c.email}</p>
                                </div>
                              )}
                            </div>
                            {Array.isArray(c.distribuidoras) && c.distribuidoras.length > 0 && (
                              <div className="pt-2 border-t border-border/40">
                                <p className="text-xs text-muted-foreground mb-1.5">Distribuidoras</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {c.distribuidoras.map((d) => (
                                    <Badge key={d.id} variant="secondary" className="text-xs">
                                      {d.id === "outros" ? (d.nomeCustom || "Outros") : (DISTRIBUTOR_LABEL[d.id] ?? d.id)}
                                    </Badge>
                                  ))}
                                </div>
                                {c.distribuidoras.some((d) => d.email) && (
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {c.distribuidoras.filter((d) => d.email).map((d) => (
                                      <div key={d.id}>
                                        <p className="text-xs text-muted-foreground">
                                          Share — {d.id === "outros" ? (d.nomeCustom || "Outros") : (DISTRIBUTOR_LABEL[d.id] ?? d.id)}
                                        </p>
                                        <p className="text-sm">{d.email}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

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
                <span>Data do Cadastro: </span>
                <span>
                  {artista.created_at
                    ? new Date(artista.created_at).toLocaleDateString("pt-BR")
                    : new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>
            </TabsContent>

            {/* Mídia */}
            <TabsContent value="midia" className="p-6 space-y-6 mt-0">
              {/* Galeria de Fotos */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Galeria de Fotos</h3>
                  </div>
                  {Array.isArray(artista.galeria_urls) &&
                  artista.galeria_urls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {(artista.galeria_urls as string[]).map((url, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group"
                        >
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                              (e.currentTarget
                                .nextSibling as HTMLElement)!.style.display =
                                "flex";
                            }}
                          />
                          <div className="hidden w-full h-full items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <ExternalLink className="h-5 w-5 text-foreground" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma foto na galeria
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Adicione URLs de fotos na edição do artista
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>

            {/* Documentos */}
            <TabsContent value="documents" className="p-6 space-y-6 mt-0">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Documentos Vinculados</h3>
                  </div>
                  {Array.isArray(artista.documents) &&
                  artista.documents.length > 0 ? (
                    <div className="space-y-2">
                      {(
                        artista.documents as { nome: string; url: string }[]
                      ).map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50"
                          data-testid={`row-documento-${idx}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.nome}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.url}
                              </p>
                            </div>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 ml-4"
                            data-testid={`link-documento-${idx}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum documento vinculado
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Adicione documentos (press kit, bio PDF, rider) na
                        edição do artista
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Links de documentos legados */}
              {(artista.documentos_pessoais_url || artista.presskit_url) && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Arquivos Rápidos</h3>
                    <div className="space-y-2">
                      {artista.documentos_pessoais_url && (
                        <a
                          href={artista.documentos_pessoais_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded text-sm text-primary"
                        >
                          <FileText className="h-4 w-4" />
                          Documentos Pessoais
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </a>
                      )}
                      {artista.presskit_url && (
                        <a
                          href={artista.presskit_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded text-sm text-primary"
                        >
                          <Link2 className="h-4 w-4" />
                          Press Kit
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Catálogo */}
            <TabsContent value="catalogo" className="p-6 space-y-6 mt-0">
              {/* Estatísticas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">
                    Estatísticas do Catálogo
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Building className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">
                        {actualProjects.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Projetos</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Music className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">{actualWorks.length}</p>
                      <p className="text-xs text-muted-foreground">Obras</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Disc className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">
                        {actualPhonograms.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fonogramas
                      </p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <Rocket className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">
                        {actualReleases.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lançamentos
                      </p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">
                        {artista.spotify_ouvintes != null
                          ? Number(artista.spotify_ouvintes).toLocaleString(
                              "pt-BR",
                            )
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Streams</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {actualWorks.length +
                actualPhonograms.length +
                actualReleases.length +
                actualProjects.length ===
              0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Music className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum registro de catálogo vinculado
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Cadastre projetos, obras, fonogramas ou lançamentos e
                      vincule-os a este artista para que apareçam aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {actualWorks.length > 0 && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">
                          Obras Musicais ({actualWorks.length})
                        </h3>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2">
                            {actualWorks.map((work) => (
                              <div
                                key={work.id}
                                className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                              >
                                <span className="text-sm truncate flex-1 mr-2">
                                  {work.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {formatStatusPtBr(work.status)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {actualPhonograms.length > 0 && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">
                          Fonogramas ({actualPhonograms.length})
                        </h3>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2">
                            {actualPhonograms.map((phonogram) => (
                              <div
                                key={phonogram.id}
                                className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-sm font-medium truncate">
                                    {phonogram.title}
                                  </p>
                                  {phonogram.gravadora && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {phonogram.gravadora}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {formatStatusPtBr(phonogram.status)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {actualReleases.length > 0 && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">
                          Lançamentos ({actualReleases.length})
                        </h3>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2">
                            {actualReleases.map((release) => (
                              <div
                                key={release.id}
                                className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-sm font-medium truncate">
                                    {release.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {release.data_lancamento
                                      ? new Date(
                                          release.data_lancamento,
                                        ).toLocaleDateString("pt-BR")
                                      : "Sem data"}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {formatStatusPtBr(release.status)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {actualProjects.length > 0 && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">
                          Projetos ({actualProjects.length})
                        </h3>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2">
                            {actualProjects.map((project) => (
                              <div
                                key={project.id}
                                className="flex items-center justify-between py-1 border-b border-border/40 last:border-0"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-sm font-medium truncate">
                                    {project.title}
                                  </p>
                                  {Array.isArray(project.produtores) &&
                                    (project.produtores as string[]).length >
                                      0 && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {(project.produtores as string[]).join(
                                          ", ",
                                        )}
                                      </p>
                                    )}
                                </div>
                                <Badge
                                  className={`text-xs shrink-0 ${getProjectStatusBadgeClass(project.status)}`}
                                >
                                  {formatStatusPtBr(project.status)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Financeiro */}
            <TabsContent value="financeiro" className="p-6 space-y-6 mt-0">
              {/* Cards de Valores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-success/10 border-success/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Receitas Totais
                    </p>
                    <p className={`text-2xl font-bold ${getCurrencyToneClass(totalRevenue)}`}>
                      {formatCurrency(totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-destructive/10 border-destructive/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Despesas Totais
                    </p>
                    <p className={`text-2xl font-bold ${getCurrencyToneClass(-totalExpenses)}`}>
                      {formatCurrency(-totalExpenses)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-600/10 border-blue-600/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p
                      className={`text-2xl font-bold ${getCurrencyToneClass(totalBalance)}`}
                    >
                      {formatCurrency(totalBalance)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-warning/10 border-warning/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className={`text-2xl font-bold ${getCurrencyToneClass(totalPending)}`}>
                      {formatCurrency(totalPending)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Margem</p>
                    <p className="text-2xl font-bold">
                      {overallMargin != null ? `${Math.round(overallMargin * 100)}%` : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className="text-2xl font-bold">
                      {overallRoi != null ? `${Math.round(overallRoi * 100)}%` : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Receitas por natureza */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Receitas por Natureza</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[...revenueByNature, { label: "Outros", total: revenueByNatureOther }].map((n) => (
                      <div key={n.label} className="text-center p-3 bg-primary/10 rounded-lg">
                        <p className={`text-lg font-bold ${getCurrencyToneClass(n.total)}`}>{formatCurrency(n.total)}</p>
                        <p className="text-xs text-muted-foreground">{n.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Últimas Transações */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">
                    Últimas Transações ({artistTransactions.length})
                  </h3>
                  {artistTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma transação vinculada a este artista
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {artistTransactions.slice(0, 10).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {t.descricao}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.data
                                ? new Date(t.data).toLocaleDateString("pt-BR")
                                : "—"}
                              {t.categoria &&
                                ` · ${t.categoria.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`}
                            </p>
                          </div>
                          <div className="ml-4 text-right">
                            <p
                              className={`text-sm font-bold ${t.type === "receita" ? "text-success" : "text-destructive"}`}
                            >
                              {t.type === "receita" ? "+" : ""}
                              {formatCurrency(t.type === "receita" ? t.valor : -t.valor)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {t.status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contratos */}
            <TabsContent value="contratos" className="p-6 space-y-6 mt-0">
              {/* Métricas de Contratos */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
                    <p className="text-2xl font-bold">{activeContracts}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto text-warning mb-2" />
                    <p className="text-2xl font-bold">{expiringContracts}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencendo em 60d
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">
                      {actualContracts.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filtros por type */}
              <div className="flex flex-wrap gap-2">
                {CONTRACT_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={contractFilter === f.key ? "default" : "outline"}
                    onClick={() => setContractFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              {/* Lista de Contratos */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">
                    Contratos ({filteredContracts.length})
                  </h3>
                  {filteredContracts.length > 0 ? (
                    <div className="space-y-3">
                      {filteredContracts.map((contract) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const in30Days = new Date(today);
                        in30Days.setDate(in30Days.getDate() + 30);
                        const endDate = contract.end_date
                          ? new Date(contract.end_date)
                          : null;
                        const expiring =
                          endDate && endDate >= today && endDate <= in30Days;
                        const daysRemaining = endDate
                          ? Math.ceil(
                              (endDate.getTime() - today.getTime()) /
                                (1000 * 60 * 60 * 24),
                            )
                          : null;

                        return (
                          <div
                            key={contract.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">
                                  {contract.title}
                                </p>
                                {expiring && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-warning border border-warning/20 bg-warning/10 rounded px-1 py-0.5 shrink-0">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {daysRemaining}d
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {contract.start_date
                                  ? new Date(
                                      contract.start_date,
                                    ).toLocaleDateString("pt-BR")
                                  : "—"}
                                {" → "}
                                {contract.end_date
                                  ? new Date(
                                      contract.end_date,
                                    ).toLocaleDateString("pt-BR")
                                  : "Indeterminado"}
                              </p>
                              {contract.valor != null && (
                                <p className="text-xs text-muted-foreground">
                                  Valor: <span className={getMonetarySemanticClass("neutral")}>{formatCurrency(contract.valor)}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ContractStatusBadge contratos={[contract]} />
                              {contract.arquivo_url && (
                                <a
                                  href={contract.arquivo_url as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid={`link-contrato-pdf-${contract.id}`}
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    PDF
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum contrato vinculado a este artista
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Marketing */}
            <TabsContent value="marketing" className="p-6 space-y-6 mt-0">
              {/* Campanhas */}
              {actualCampaigns.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Zap className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhuma campanha vinculada
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Campanhas de marketing vinculadas a este artista aparecerão aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                CAMPAIGN_SECTIONS.map((section) => {
                  const items = actualCampaigns.filter((c) =>
                    section.status.includes(String(c.status ?? "").toLowerCase()),
                  );
                  if (items.length === 0) return null;
                  return (
                    <Card key={section.key} className="bg-muted/30">
                      <CardContent className="p-4">
                        <h3 className="font-semibold mb-3">
                          {section.label} ({items.length})
                        </h3>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_110px_100px] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                          <span>Campanha</span>
                          <span>Canal</span>
                          <span>Investimento</span>
                          <span>Status</span>
                          <span>Resultado</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {items.map((c) => {
                            const channels = (c.platforms ?? [])
                              .map((p) => CHANNEL_LABELS[String(p).toLowerCase()] ?? p)
                              .join(", ");
                            const roi = c.metrics?.roi;
                            const result =
                              roi && roi > 0
                                ? `ROI ${Math.round(roi * 100)}%`
                                : c.metrics?.conversions
                                  ? `${c.metrics.conversions} conv.`
                                  : "—";
                            return (
                              <div
                                key={c.id}
                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_110px_100px] gap-3 px-1 py-2 items-center text-sm"
                              >
                                <span className="truncate font-medium">{c.name}</span>
                                <span className="truncate text-muted-foreground">{channels || "—"}</span>
                                <span className="text-muted-foreground">{formatCurrency(c.budget ?? 0)}</span>
                                <span>
                                  <Badge variant="outline" className="text-xs">
                                    {CAMPAIGN_STATUS_LABELS[String(c.status ?? "").toLowerCase()] ?? formatStatusPtBr(c.status)}
                                  </Badge>
                                </span>
                                <span className="text-muted-foreground">{result}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Metas */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold">Metas & OKRs</h3>
                        <p className="text-sm text-muted-foreground">
                          {artista.nome_artistico}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className={primaryCompactButtonClass}
                      onClick={() => setShowMetaForm(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova Meta
                    </Button>
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{actualMetas.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-3 bg-warning/10 rounded-lg">
                      <p className="text-2xl font-bold text-warning">
                        {metasInProgress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Em Progresso
                      </p>
                    </div>
                    <div className="text-center p-3 bg-success/10 rounded-lg">
                      <p className="text-2xl font-bold text-success">
                        {completedMetas}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluídas
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-blue-500">
                        {averageProgress}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Progresso Médio
                      </p>
                    </div>
                  </div>

                  {actualMetas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Target className="h-16 w-16 text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-1">
                        Nenhuma meta definida
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Defina metas para acompanhar o progresso do artista
                      </p>
                      <Button
                        size="sm"
                        className={primaryCompactButtonClass}
                        onClick={() => setShowMetaForm(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Criar Primeira Meta
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {actualMetas.map((meta) => {
                        const progress = calcProgress(meta);
                        const statusInfo = metaStatusOptions.find(
                          (s) => s.value === meta.status,
                        );
                        const title =
                          (meta as any).title ||
                          meta.tipo_meta ||
                          meta.descricao ||
                          "Meta";
                        const goalType =
                          (meta as any).tipo_meta || (meta as any).type;
                        const category = (meta as any).categoria;
                        const startDate =
                          meta.start_date || (meta as any).startDate;
                        const endDate = meta.end_date || (meta as any).endDate;
                        return (
                          <Card key={meta.id} className="bg-background/50">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{title}</h4>
                                    <Badge
                                      className={
                                        statusInfo?.color ?? "bg-gray-500"
                                      }
                                    >
                                      {statusInfo?.label ?? meta.status}
                                    </Badge>
                                  </div>
                                  {meta.descricao &&
                                    title !== meta.descricao && (
                                      <p className="text-sm text-muted-foreground">
                                        {meta.descricao}
                                      </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditMeta(meta)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteMeta(meta.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-muted-foreground">
                                      {(meta.valor_atual ?? 0).toLocaleString()}{" "}
                                      /{" "}
                                      {(meta.valor_meta ?? 0).toLocaleString()}{" "}
                                      {meta.unidade}
                                    </span>
                                    <span className="text-sm font-medium">
                                      {progress}%
                                    </span>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {startDate && endDate && (
                                    <span>
                                      {new Date(startDate).toLocaleDateString(
                                        "pt-BR",
                                      )}{" "}
                                      -{" "}
                                      {new Date(endDate).toLocaleDateString(
                                        "pt-BR",
                                      )}
                                    </span>
                                  )}
                                </div>
                                {category && (
                                  <Badge variant="outline" className="text-xs">
                                    {goalCategories.find(
                                      (c) => c.value === category,
                                    )?.label ?? category}
                                  </Badge>
                                )}
                                {goalType && (
                                  <Badge variant="outline" className="text-xs">
                                    {goalTypes.find((t) => t.value === goalType)
                                      ?.label ?? goalType}
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
              <ArtistEvolutionSection artist={artista} />

              {/* Marcos / Linha do tempo */}
              {evolutionMilestones.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="h-5 w-5 text-warning" />
                      <h3 className="font-semibold">Marcos</h3>
                    </div>
                    <div className="space-y-3">
                      {evolutionMilestones.map((m) => (
                        <div key={m.id} className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{m.label}</p>
                              <span className="text-xs text-muted-foreground shrink-0">{formatDateDMY(m.data)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{m.descricao}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Histórico */}
            {/* Agenda */}
            <TabsContent value="agenda" className="p-6 space-y-6 mt-0">
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={scheduleFilter === f.key ? "default" : "outline"}
                    onClick={() => setScheduleFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              {filteredSchedule.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Calendar className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum compromisso na agenda
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Shows, reuniões, ensaios e gravações vinculados a este artista aparecerão aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">
                      Compromissos ({filteredSchedule.length})
                    </h3>
                    <div className="grid grid-cols-[88px_60px_110px_minmax(0,1fr)_minmax(0,1fr)_110px] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                      <span>Data</span>
                      <span>Hora</span>
                      <span>Tipo</span>
                      <span>Título</span>
                      <span>Local</span>
                      <span>Status</span>
                    </div>
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y divide-border/40">
                        {filteredSchedule.map((e) => (
                          <div
                            key={e.id}
                            className="grid grid-cols-[88px_60px_110px_minmax(0,1fr)_minmax(0,1fr)_110px] gap-3 px-1 py-2 items-center text-sm"
                          >
                            <span className="text-muted-foreground">{formatDateDMY(e.data)}</span>
                            <span className="text-muted-foreground">
                              {e.data ? new Date(e.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </span>
                            <span className="truncate">{getBackendEventTypeLabel(e.type)}</span>
                            <span className="truncate font-medium">{e.title}</span>
                            <span className="truncate text-muted-foreground">{e.local || e.cidade || "—"}</span>
                            <span>
                              <Badge variant="outline" className="text-xs">
                                {EVENT_STATUS_LABELS[String(e.status ?? "").toLowerCase()] ?? formatStatusPtBr(e.status)}
                              </Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Conteúdos */}
            <TabsContent value="conteudos" className="p-6 space-y-6 mt-0">
              <div className="flex flex-wrap gap-2">
                {CONTENT_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={contentFilter === f.key ? "default" : "outline"}
                    onClick={() => setContentFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              {filteredContent.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Video className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum conteúdo vinculado
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Reels, vídeos, fotos, teasers e demais conteúdos vinculados a este artista aparecerão aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">
                      Conteúdos ({filteredContent.length})
                    </h3>
                    <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_100px_110px_120px] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                      <span>Título</span>
                      <span>Tipo</span>
                      <span>Formato</span>
                      <span>Data Prevista</span>
                      <span>Status</span>
                      <span>Responsável</span>
                    </div>
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y divide-border/40">
                        {filteredContent.map((c) => (
                          <div
                            key={c.id}
                            className="grid grid-cols-[minmax(0,1fr)_110px_110px_100px_110px_120px] gap-3 px-1 py-2 items-center text-sm"
                          >
                            <span className="truncate font-medium">{c.title}</span>
                            <span className="truncate text-muted-foreground">
                              {CONTENT_TYPE_LABELS[String(c.type ?? "").toLowerCase()] ?? formatStatusPtBr(c.type)}
                            </span>
                            <span className="truncate text-muted-foreground">{c.format || "—"}</span>
                            <span className="text-muted-foreground">{formatDateDMY(c.publishDate)}</span>
                            <span>
                              <Badge variant="outline" className="text-xs">
                                {CONTENT_STATUS_LABELS[String(c.status ?? "").toLowerCase()] ?? formatStatusPtBr(c.status)}
                              </Badge>
                            </span>
                            <span className="truncate text-muted-foreground">{c.owner || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Movimentação */}
            <TabsContent value="movimentacao" className="p-6 space-y-6 mt-0">
              {activityTimelineItems.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Clock className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhuma movimentação registrada
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Ações comerciais, de marketing, financeiras, de produção, jurídicas e de agenda aparecerão aqui.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">
                      Movimentação ({activityTimelineItems.length})
                    </h3>
                    <div className="grid grid-cols-[110px_110px_minmax(0,1fr)_120px] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                      <span>Data</span>
                      <span>Tipo</span>
                      <span>Descrição</span>
                      <span>Responsável</span>
                    </div>
                    <ScrollArea className="h-[360px]">
                      <div className="divide-y divide-border/40">
                        {activityTimelineItems.map((m) => (
                          <div
                            key={m.id}
                            className="grid grid-cols-[110px_110px_minmax(0,1fr)_120px] gap-3 px-1 py-2 items-center text-sm"
                          >
                            <span className="text-muted-foreground">{formatDateDMY(m.data)}</span>
                            <span>
                              <Badge variant="outline" className="text-xs">{m.type}</Badge>
                            </span>
                            <span className="truncate">{m.descricao}</span>
                            <span className="truncate text-muted-foreground">{m.responsavel}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="historico" className="p-6 space-y-6 mt-0">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Histórico de Atividades</h3>
                  </div>

                  {actualHistory.length > 0 ? (
                    <>
                      <div className="grid grid-cols-[140px_120px_130px_minmax(0,1fr)] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                        <span>Data</span>
                        <span>Usuário</span>
                        <span>Ação</span>
                        <span>Detalhes</span>
                      </div>
                      <ScrollArea className="h-[360px]">
                        <div className="divide-y divide-border/40">
                          {actualHistory.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[140px_120px_130px_minmax(0,1fr)] gap-3 px-1 py-2 items-center text-sm"
                            >
                              <span className="text-muted-foreground">
                                {new Date(item.data).toLocaleDateString("pt-BR")}{" "}
                                {new Date(item.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="flex items-center gap-1 truncate">
                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                {item.usuario}
                              </span>
                              <span>{getHistoryBadge(item.type)}</span>
                              <span className="flex items-center gap-2 truncate">
                                <span className="text-muted-foreground shrink-0">{getHistoryIcon(item.type)}</span>
                                <span className="truncate">{item.descricao}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum registro de histórico encontrado
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Modal de Nova/Editar Meta */}
        <Dialog
          open={showMetaForm}
          onOpenChange={(open) => !open && resetForm()}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingMeta ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2">
                <Label>Título da Meta *</Label>
                <Input
                  value={metaForm.title}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, title: e.target.value })
                  }
                  placeholder="Ex: Alcançar 1M de streams"
                />
              </div>

              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={metaForm.descricao}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, descricao: e.target.value })
                  }
                  placeholder="Descreva a meta em detalhes..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Tipo de Meta *</Label>
                <Select
                  value={metaForm.type}
                  onValueChange={(v) => setMetaForm({ ...metaForm, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select
                  value={metaForm.categoria}
                  onValueChange={(v) =>
                    setMetaForm({ ...metaForm, categoria: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalCategories.map((c) => (
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
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, valorMeta: e.target.value })
                  }
                  placeholder="1000000"
                />
              </div>

              <div>
                <Label>Valor Atual</Label>
                <Input
                  type="number"
                  value={metaForm.valorAtual}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, valorAtual: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Unidade de Medida</Label>
                <Input
                  value={metaForm.unidade}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, unidade: e.target.value })
                  }
                  placeholder="Ex: streams, seguidores, R$"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={metaForm.status}
                  onValueChange={(v) =>
                    setMetaForm({ ...metaForm, status: v as MarketingMeta["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {metaStatusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data de Início</Label>
                <DatePickerField
                  value={metaForm.startDate}
                  onChange={(iso) => setMetaForm({ ...metaForm, startDate: iso })}
                  placeholder="Selecione a data"
                  data-testid="datepicker-meta-data-inicio"
                />
              </div>

              <div>
                <Label>Data de Fim</Label>
                <DatePickerField
                  value={metaForm.endDate}
                  onChange={(iso) => setMetaForm({ ...metaForm, endDate: iso })}
                  placeholder="Selecione a data"
                  data-testid="datepicker-meta-data-fim"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveMeta}
                className="bg-primary hover:bg-primary/90"
              >
                {editingMeta ? "Salvar Alterações" : "Criar Meta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
