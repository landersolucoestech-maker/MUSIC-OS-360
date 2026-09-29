import { useMemo, useState } from "react";
import { useSkillRun } from "@/shared/hooks/useSkillRun";
import { SkillRunPanel } from "@/shared/components/SkillRunPanel";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { genderLabel, profileTypeLabel, specialtyLabel } from "@/modules/artist/mappers";
import type { Artist, DistributorEntry } from "@/modules/artist/types/artist.types";
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

// imports moved here after CircularProgress was removed
import { formatCalendarDateLabel, formatCurrency, getCurrencyToneClass, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { useWorks } from "@/modules/catalog/hooks/useWorks";
import { usePhonograms } from "@/modules/catalog/hooks/usePhonograms";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useGoals } from "@/modules/marketing/hooks/useGoals";
import type { Goal, GoalType } from "@/modules/marketing/types/marketing.types";
import { ArtistGoalStatus, ARTIST_GOAL_STATUS_LABELS_PT_BR, statusLabelPtBr, type StatusDomain } from "@music-os-360/types";
import { transactionCategoryLabel } from "@/modules/accounting/constants/transaction-constants";
import {
  useContracts,
  type ContractWithRelations,
} from "@/modules/contracts/hooks/useContracts";
import { truncatedTransactionsNotice, useAllTransactions } from "@/modules/accounting/hooks/useAllTransactions";
import { toNumber } from "@/modules/accounting/pages/profit-and-loss-calc";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { useEvents } from "@/modules/events/hooks/useEvents";
import { getBackendEventTypeLabel } from "@/modules/events/lib/event-type";
import { useMarketingContents } from "@/modules/marketing/hooks/useMarketingContents";
import { useMarketingCampaigns } from "@/modules/marketing/hooks/useMarketingCampaigns";
import { StoredFileLink } from "@/shared/components/StoredFileLink";
import { releaseStatusLabel, resolveReleaseStatus } from "@/modules/releases/lib/release-status";
import { storedFileDisplayName } from "@/shared/lib/stored-file";
import { distributorLabel } from "@/modules/artist/lib/distributor-label";
import { safeExternalUrl, safeImageSrc } from "@/shared/lib/safe-url";

// ── Marketing: campaign/channel labels ────────────────────────────────────
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

// ── Finance: revenue by nature ──────────────────────────────────────
const NATURE_BUCKETS: Array<{ label: string; keywords: string[] }> = [
  { label: "Royalties", keywords: ["royalt"] },
  { label: "Shows", keywords: ["show", "cache", "cachê"] },
  { label: "Licenciamentos", keywords: ["licenc", "sync"] },
  { label: "Publicidade", keywords: ["public", "publi", "ads", "anuncio", "patroc"] },
  { label: "Distribuição", keywords: ["distrib", "streaming"] },
];

// ── Contracts: filters by type ────────────────────────────────────────────
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

// ── Agenda: labels and filters ─────────────────────────────────────────────
// events.type only stores the backend's coarse enum (show/festival/recording/
// meeting/interview/tour/other) — see modules/events/lib/event-type.ts for the
// real labels. "Ensaios" and "Gravações" become a single filter because the
// real column does not distinguish them (both coarsen to "recording").
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

// ── Contents: labels and filters ───────────────────────────────────────────
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

interface GoalFormState {
  title: string;
  description: string;
  type: GoalType | "";
  category: string;
  targetValue: string;
  currentValue: string;
  unit: string;
  startDate: string;
  endDate: string;
  status: ArtistGoalStatus;
}

const EMPTY_GOAL_FORM: GoalFormState = {
  title: "",
  description: "",
  type: "",
  category: "",
  targetValue: "",
  currentValue: "",
  unit: "",
  startDate: "",
  endDate: "",
  status: ArtistGoalStatus.IN_PROGRESS,
};

interface ArtistVision360ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist?: Artist | null;
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

const goalTypes: Array<{ value: GoalType; label: string }> = [
  { value: "streams", label: "Streams" },
  { value: "followers", label: "Seguidores" },
  { value: "releases", label: "Lançamentos" },
  { value: "revenue", label: "Receita" },
  { value: "shows", label: "Shows/Eventos" },
  { value: "engagement", label: "Engajamento" },
  { value: "other", label: "Outros" },
];

const goalCategories = [
  { value: "growth", label: "Crescimento" },
  { value: "financial", label: "Financeiro" },
  { value: "production", label: "Produção" },
  { value: "marketing", label: "Marketing" },
  { value: "career", label: "Carreira" },
];

const primaryCompactButtonClass = "h-8 text-xs gap-1.5";
const activeBlueBadgeClass = "bg-primary text-primary-foreground border-primary";

const goalStatusOptions: Array<{ value: ArtistGoalStatus; label: string; color: string }> = [
  { value: ArtistGoalStatus.IN_PROGRESS, label: ARTIST_GOAL_STATUS_LABELS_PT_BR[ArtistGoalStatus.IN_PROGRESS], color: activeBlueBadgeClass },
  { value: ArtistGoalStatus.COMPLETED, label: ARTIST_GOAL_STATUS_LABELS_PT_BR[ArtistGoalStatus.COMPLETED], color: "bg-success" },
  { value: ArtistGoalStatus.CANCELLED, label: ARTIST_GOAL_STATUS_LABELS_PT_BR[ArtistGoalStatus.CANCELLED], color: "bg-destructive" },
  { value: ArtistGoalStatus.EXPIRED, label: ARTIST_GOAL_STATUS_LABELS_PT_BR[ArtistGoalStatus.EXPIRED], color: "bg-gray-500" },
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

/** PT-BR status label: the domain's canonical labels first; never the raw value. */
const formatStatusPtBr = (status?: string | null, domain?: StatusDomain): string => {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return "Não informado";
  const canonical = domain ? statusLabelPtBr(domain, normalized) : null;
  if (canonical) return canonical;

  const key = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  return STATUS_LABELS_PT_BR[key] ?? "Status não reconhecido";
};

export function ArtistVision360Modal({
  open,
  onOpenChange,
  artist,
}: ArtistVision360ModalProps) {
  // The 360 hub's heavy queries only make sense while the modal is open — see
  // Task F: keeping them always active made Dashboard/Artists download ~11 whole
  // tables on every page load, even with the modal closed. `enabled: open` keeps
  // the behavior of every other consumer of these hooks (default `true`).
  //
  // Task G: each one is now also filtered by artist_id ON THE SERVER (the
  // backend already supports it — see QueryPhonogramDto/QueryContractDto/
  // QueryTransactionDto/QueryEventDto/projects.dto.ts/artist-goals — works got
  // the filter in this task). Before, the modal downloaded the tenant's whole
  // table and filtered on the client with `.filter(x => x.artist_id === id)`
  // (the pattern Task G removes) — switching artists even reused the same wrong
  // cache, since the queryKey did not distinguish the artist.
  const artistId = artist?.id;
  const audienceHealth = useSkillRun<Record<string, unknown>>(`/artists/${artistId}/audience-health`);
  const { works: actualWorks } = useWorks(open, artistId);
  const { phonograms: actualPhonograms } = usePhonograms(open, artistId);
  const { releases: actualReleases } = useReleases(open, artistId);
  const { projects: actualProjects } = useProjects(open, artistId);
  const {
    goals: actualGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    getProgressPercent: calcProgress,
  } = useGoals(open, artistId);
  const { contracts: actualContracts } = useContracts(open, artistId);
  // Full paged sweep (server-side artist_id filter): finance totals over the
  // API's default first page (50 rows) were partial for active artists.
  const {
    transactions: artistTransactions,
    truncated: artistTransactionsTruncated,
    total: artistTransactionsTotal,
    isLoading: artistTransactionsLoading,
    error: artistTransactionsError,
  } = useAllTransactions({ enabled: open && Boolean(artistId), artistId });
  const { contacts } = useContacts(open);
  const { events: actualEvents } = useEvents(open, artistId);
  const { data: marketingContents = [] } = useMarketingContents(open);
  const { data: marketingCampaigns = [] } = useMarketingCampaigns(open);

  // Resolves the linked contacts (references) with the CRM's current data.
  const linkedContactsResolved = useMemo(() => {
    const raw = artist?.linkedContacts;
    if (!Array.isArray(raw)) return [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    return raw
      .map((v) => (typeof v?.contactId === "string" ? byId.get(v.contactId) : undefined))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [artist, contacts]);

  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState("todos");
  const [contentFilter, setContentFilter] = useState("todos");
  const [contractFilter, setContractFilter] = useState("todos");

  // ── Schedule (artist events) ────────────────────────────────────────
  const filteredSchedule = (actualEvents as any[]).filter((e) => {
    const cfg = SCHEDULE_FILTERS.find((f) => f.key === scheduleFilter);
    if (!cfg || !cfg.tipos) return true;
    return cfg.tipos.includes(String(e.type ?? "").toLowerCase());
  });

  // ── Contents (the artist's marketing contents) ─────────────────────────
  const actualContent = marketingContents.filter(
    (c) => c.targetType === "artista" && c.targetId === artistId,
  );
  const filteredContent = actualContent.filter((c) => {
    const cfg = CONTENT_FILTERS.find((f) => f.key === contentFilter);
    if (!cfg || !cfg.status) return true;
    return cfg.status.includes(String(c.status ?? "").toLowerCase());
  });

  // ── Marketing (artist campaigns) ───────────────────────────────────
  const actualCampaigns = marketingCampaigns.filter(
    (c) => c.targetType === "artista" && c.targetId === artistId,
  );

  // ── Activity (operational timeline derived from the artist's data) ─────
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
    const d = t.created_at ?? t.transaction_date;
    if (d) activityTimelineItems.push({ id: `mv-txn-${t.id}`, type: "Financeiro", descricao: t.description ?? (t.type === "revenue" ? "Pagamento recebido" : "Despesa registrada"), data: d, responsavel: "Financeiro" });
  });
  actualEvents.forEach((e) => {
    const ev = e as { starts_at?: string; type?: string; created_at?: string };
    const d = ev.starts_at ?? ev.created_at;
    if (d) activityTimelineItems.push({ id: `mv-evt-${e.id}`, type: "Agenda", descricao: `${getBackendEventTypeLabel(ev.type)}: ${e.title}`, data: d, responsavel: "—" });
  });
  actualReleases.forEach((l: any) => {
    const d = l.created_at ?? l.release_date;
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

  // ── Overview: executive KPIs + widgets ─────────────────────────────────
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
        e.starts_at &&
        new Date(e.starts_at).getTime() >= nowTs,
    )
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];
  const nextRelease = (actualReleases as any[])
    .filter((l) => l.release_date && new Date(l.release_date).getTime() >= nowTs)
    .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())[0];

  // ── Evolution: derived milestones ──────────────────────────────────────
  const evolutionMilestones: { id: string; label: string; descricao: string; data: string }[] = [];
  if (artist?.created_at) evolutionMilestones.push({ id: "m-cad", label: "Cadastro", descricao: "Artista cadastrado no sistema", data: artist.created_at });
  const firstRelease = (actualReleases as any[])
    .filter((l) => l.created_at || l.release_date)
    .sort((a, b) => new Date(a.created_at ?? a.release_date).getTime() - new Date(b.created_at ?? b.release_date).getTime())[0];
  if (firstRelease) evolutionMilestones.push({ id: "m-lan", label: "Primeiro Lançamento", descricao: firstRelease.title ?? "Lançamento", data: firstRelease.created_at ?? firstRelease.release_date });
  const firstShow = (actualEvents as any[])
    .filter((e) => ["show", "festival"].includes(String(e.type ?? "").toLowerCase()) && e.starts_at)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];
  if (firstShow) evolutionMilestones.push({ id: "m-show", label: "Primeira Turnê/Show", descricao: firstShow.title, data: firstShow.starts_at! });
  const firstContract = (actualContracts as any[])
    .filter((c) => c.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  if (firstContract) evolutionMilestones.push({ id: "m-ctr", label: "Contrato Assinado", descricao: firstContract.title, data: firstContract.created_at });
  evolutionMilestones.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  // ── Real finance ──────────────────────────────────────────────────
  const totalRevenue = artistTransactions
    .filter((t) => t.type === "revenue" && t.status === "paid")
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
  const totalExpenses = artistTransactions
    .filter((t) => t.type === "expense" && t.status === "paid")
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
  const totalBalance = totalRevenue - totalExpenses;
  const overallRoi = totalExpenses > 0 ? totalBalance / totalExpenses : null;
  const overallMargin = totalRevenue > 0 ? totalBalance / totalRevenue : null;
  const paidRevenue = artistTransactions.filter(
    (t) => t.type === "revenue" && t.status === "paid",
  );
  const revenueByNature = NATURE_BUCKETS.map((b) => ({
    label: b.label,
    total: paidRevenue
      .filter((t) => b.keywords.some((k) => String(t.category ?? "").toLowerCase().includes(k)))
      .reduce((s, t) => s + toNumber(t.amount), 0),
  }));
  const revenueByNatureOther = paidRevenue
    .filter((t) => !NATURE_BUCKETS.some((b) => b.keywords.some((k) => String(t.category ?? "").toLowerCase().includes(k))))
    .reduce((s, t) => s + toNumber(t.amount), 0);
  const totalPending = artistTransactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + toNumber(t.amount), 0);

  // ── Contract metrics ───────────────────────────────────────────────────
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

  // ── History derived from real data ───────────────────────────────────
  const actualHistory: {
    id: string;
    type: string;
    descricao: string;
    data: string;
    usuario: string;
  }[] = [];
  if (artist?.created_at) {
    actualHistory.push({
      id: "criacao",
      type: "criacao",
      descricao: "Artista cadastrado no sistema",
      data: artist.created_at,
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
        descricao: t.description ?? "",
        data: t.created_at,
        usuario: "Financeiro",
      });
  });
  // Status-change events derived from the artist's current status
  const ARTIST_STATUS_HISTORY_LABELS: Record<string, string> = {
    signed: "Artista contratado",
    in_negotiation: "Negociação iniciada",
    onboarding: "Artista em processo de onboarding",
    inactive: "Artista inativado",
    suspended: "Artista suspenso",
  };
  if (
    artist?.status &&
    artist.status !== "signed" &&
    artist.updated_at
  ) {
    const label =
      ARTIST_STATUS_HISTORY_LABELS[artist.status] ??
      `Status alterado para: ${artist.status}`;
    actualHistory.push({
      id: `status-${artist.status}`,
      type: "status",
      descricao: label,
      data: artist.updated_at,
      usuario: "Admin",
    });
  }
  actualHistory.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  // Evolution trend (Task #361): the "↑/↓/—" chips on the 360 dashboard platform
  // cards reuse the same daily snapshots (`record_artista_metric_snapshot`)
  // already consumed by the "Evolução" tab. The hooks only fire the query when
  // the artist has an ID configured for the platform — avoiding useless calls
  // for unlinked profiles.

  const [goalForm, setGoalForm] = useState<GoalFormState>(EMPTY_GOAL_FORM);

  if (!artist) return null;

  const resetForm = () => {
    setGoalForm(EMPTY_GOAL_FORM);
    setEditingGoal(null);
    setShowGoalForm(false);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title || !goalForm.type || !goalForm.targetValue) return;
    const payload = {
      artistId: String(artistId),
      title: goalForm.title,
      description: goalForm.description,
      type: goalForm.type,
      category: goalForm.category,
      targetValue: Number(goalForm.targetValue),
      currentValue: Number(goalForm.currentValue) || 0,
      unit: goalForm.unit,
      startDate: goalForm.startDate || null,
      endDate: goalForm.endDate || null,
      status: goalForm.status,
    };
    if (editingGoal) {
      await updateGoal({ id: editingGoal.id, ...payload });
    } else {
      await addGoal(payload);
    }
    resetForm();
  };

  const handleEditGoal = (goal: Goal) => {
    setGoalForm({
      title: goal.title,
      description: goal.description,
      type: goal.type,
      category: goal.category,
      targetValue: String(goal.targetValue),
      currentValue: String(goal.currentValue),
      unit: goal.unit,
      startDate: goal.startDate ?? "",
      endDate: goal.endDate ?? "",
      status: goal.status,
    });
    setEditingGoal(goal);
    setShowGoalForm(true);
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteGoal(id);
  };

  const goalsInProgress = actualGoals.filter(
    (goal) => goal.status === ArtistGoalStatus.IN_PROGRESS,
  ).length;
  const completedGoals = actualGoals.filter(
    (goal) => goal.status === ArtistGoalStatus.COMPLETED,
  ).length;
  const averageProgress =
    actualGoals.length > 0
      ? Math.round(
          actualGoals.reduce((acc, m) => acc + calcProgress(m), 0) /
            actualGoals.length,
        )
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden bg-card">
        <DialogTitle className="sr-only">
          Visão 360 do artista {artist.stageName}
        </DialogTitle>
        <div className="border-b border-border shrink-0 bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-foreground shrink-0"
                >
                  {safeImageSrc(artist.photoUrl) ? (
                    <img
                      src={safeImageSrc(artist.photoUrl)}
                      alt={artist.stageName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    artist.stageName?.[0] || "A"
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {artist.stageName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="neutral">
                      {artist.musicGenre || "Não informado"}
                    </Badge>
                    {artist.status === "onboarding" ? (
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
                            c.exclusive === true &&
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

          {/* Modal scroll owner. Uses native overflow instead of ScrollArea: the Radix
              Viewport depends on height:100%, which does NOT resolve against a
              flex-grow-sized parent — it measured 1467px inside a 681px Root, so
              scrollHeight === clientHeight and scrolling never happened. A native
              overflow container is sized by the flex itself and really scrolls. */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            data-testid="vision360-scroll"
            tabIndex={0}
            role="region"
            aria-label="Conteúdo da Visão 360"
          >
            {/* Overview */}
            <TabsContent value="visao-geral" className="p-6 space-y-6 mt-0">
              {/* Executive KPIs */}
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

              {/* Tracking widgets */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" /> Próximo Show
                    </div>
                    {nextShow ? (
                      <>
                        <p className="text-sm font-semibold truncate">{nextShow.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateDMY(nextShow.starts_at)}</p>
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
                        <p className="text-xs text-muted-foreground">{formatDateDMY(nextRelease.release_date)}</p>
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

              {/* Career positioning (Phase 3.2 Part IV — consolidates Career Stage +
                  Market Benchmark into a single diagnosis; both computed in the
                  backend from already-ingested Soundcharts metrics) */}
              <PositioningCard artistId={artist.id} />

              {/* Metrics */}
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
                      <FileText className="h-4 w-4 text-info" />
                      <span className="text-sm">Contratos</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {actualContracts.length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Acceleration plan */}
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

              {/* Diagnosis + risks */}
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

              {/* Financial summary */}
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

              {/* Goal progress */}
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
                        {goalsInProgress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Em Progresso
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">
                        {completedGoals}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluídas
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{actualGoals.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Focus for the next 90 days */}
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

            {/* Profile */}
            <TabsContent value="perfil" className="p-6 space-y-6 mt-0">
              {/* Basic information */}
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
                        {artist.stageName || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Gênero Musical
                      </p>
                      <p className="text-sm font-medium capitalize">
                        {artist.musicGenre || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Função</p>
                      <p className="text-sm font-medium">
                        {(() => {
                          const specialties = Array.isArray(artist.specialties)
                            ? artist.specialties
                            : [];
                          if (specialties.length === 0) return "Não informado";
                          return specialties
                            .map((e: string) => specialtyLabel(e))
                            .join(", ");
                        })()}
                      </p>
                    </div>
                  </div>
                  {artist.notes && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Biografia</p>
                      <p className="text-sm font-medium">
                        {artist.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Personal data */}
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
                        {artist.fullName ||
                          artist.stageName ||
                          "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Data de Nascimento
                      </p>
                      <p className="text-sm font-medium">
                        {formatDateDMY(artist.birthDate ?? null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="text-sm font-medium">
                        {artist.taxId || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RG</p>
                      <p className="text-sm font-medium">
                        {artist.idDocument || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gênero</p>
                      <p className="text-sm font-medium">
                        {genderLabel(artist.gender)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact and address */}
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
                        {artist.email || "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium">
                        {artist.phone || "Não informado"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="text-sm font-medium">
                        {artist.address || "Não informado"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank details */}
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
                        {artist.bankName?.trim() || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Agência</p>
                      <p className="text-sm font-medium break-words">
                        {artist.bankBranch || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Conta</p>
                      <p className="text-sm font-medium break-words">
                        {artist.bankAccount || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Titular da Conta</p>
                      <p className="text-sm font-medium break-words">
                        {artist.accountHolder || artist.fullName || "Não informado"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Chave PIX</p>
                      <p className="text-sm font-medium break-words">
                        {artist.pixKey || "Não informado"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profiles and social networks */}
              <ArtistPlatformMetrics
                artistId={artist.id}
                spotifyUrl={artist.spotifyUrl ?? null}
                youtubeUrl={artist.youtubeUrl ?? null}
                instagramUrl={artist.instagramUrl ?? null}
                tiktokUrl={artist.tiktokUrl ?? null}
                deezerUrl={artist.deezerUrl ?? null}
                appleMusicUrl={artist.appleMusicUrl ?? null}
                soundcloudUrl={artist.soundcloudUrl ?? null}
              />

              {/* Profile type */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Tipo de Perfil</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <Badge variant="outline">
                        {artist.profileType ? profileTypeLabel(artist.profileType) : "Não informado"}
                      </Badge>
                    </div>
                    {artist.profileType === "managed" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artist.agentName || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artist.agentPhone || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail do Empresário
                          </p>
                          <p className="text-sm font-medium">
                            {artist.agentEmail || "Não informado"}
                          </p>
                        </div>
                      </>
                    )}
                    {artist.profileType === "record_label" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelName || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Contato na Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelContactName ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelPhone || "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail da Gravadora
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelEmail || "Não informado"}
                          </p>
                        </div>
                      </>
                    )}
                    {artist.profileType === "publisher" && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Nome do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelContactName ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Telefone do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelContactPhone ||
                              "Não informado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            E-mail do Responsável
                          </p>
                          <p className="text-sm font-medium">
                            {artist.recordLabelContactEmail ||
                              "Não informado"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Distributors */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">
                      Distribuidoras / Agregadoras
                    </h3>
                  </div>
                  {(() => {
                    const distributorSelections = artist.selectedDistributors ?? {};
                    const activeDistributorIds = Object.entries(distributorSelections)
                      .filter(([, v]) => v)
                      .map(([k]) => k);
                    const emails = artist.distributorEmails ?? {};
                    return activeDistributorIds.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {activeDistributorIds.map((dist: string) => (
                            <Badge key={dist} variant="secondary">
                              {distributorLabel(dist)}
                            </Badge>
                          ))}
                        </div>
                        {Object.keys(emails).length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-border">
                            {Object.entries(emails).map(([distId, email]) => {
                              const distributorName = distributorLabel(distId);
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

              {/* Distributors / aggregators (new format — form section 5) */}
              {(() => {
                const generalDistributors: DistributorEntry[] =
                  Array.isArray(artist.generalDistributors) ? artist.generalDistributors : [];
                if (generalDistributors.length === 0) return null;
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
                            {distributorLabel(d.id, d.customName)}
                          </Badge>
                        ))}
                      </div>
                      {generalDistributors.some((d) => d.email) && (
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                          {generalDistributors.filter((d) => d.email).map((d) => (
                            <div key={d.id}>
                              <p className="text-xs text-muted-foreground">
                                E-mail Share — {distributorLabel(d.id, d.customName)}
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

              {/* Linked team (CRM) — data resolved dynamically from the CRM */}
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
                              {labelFor(contactTypeOptions, c.category)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {c.phone && (
                              <div>
                                <p className="text-xs text-muted-foreground">Telefone</p>
                                <p className="text-sm">{c.phone}</p>
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

              {/* Team / contacts (legacy — old embedded data / public self-signup) */}
              {(() => {
                const team = Array.isArray(artist.teamContacts)
                  ? artist.teamContacts.filter((c) => c.name || c.email || c.phone)
                  : [];
                if (team.length === 0) return null;
                const CATEGORY_LABEL: Record<string, string> = {
                  booker: "Booker", assessoria: "Assessoria de Imprensa", juridico: "Jurídico",
                  financeiro: "Financeiro", contador: "Contador", editora_musical: "Editora Musical",
                  roadie: "Roadie", gestor: "Gestor", empresario: "Empresário",
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
                              <p className="text-sm font-semibold">{c.name || "—"}</p>
                              {c.category && (
                                <Badge variant="outline" className="text-xs">
                                  {CATEGORY_LABEL[c.category] ?? "Outro"}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {c.phone && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Telefone</p>
                                  <p className="text-sm">{c.phone}</p>
                                </div>
                              )}
                              {c.email && (
                                <div>
                                  <p className="text-xs text-muted-foreground">E-mail</p>
                                  <p className="text-sm">{c.email}</p>
                                </div>
                              )}
                            </div>
                            {Array.isArray(c.distributors) && c.distributors.length > 0 && (
                              <div className="pt-2 border-t border-border/40">
                                <p className="text-xs text-muted-foreground mb-1.5">Distribuidoras</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {c.distributors.map((d) => (
                                    <Badge key={d.id} variant="secondary" className="text-xs">
                                      {distributorLabel(d.id, d.customName)}
                                    </Badge>
                                  ))}
                                </div>
                                {c.distributors.some((d) => d.email) && (
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {c.distributors.filter((d) => d.email).map((d) => (
                                      <div key={d.id}>
                                        <p className="text-xs text-muted-foreground">
                                          Share — {distributorLabel(d.id, d.customName)}
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

              {/* Notes */}
              {artist.notes && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Observações</h3>
                    </div>
                    <p className="text-sm">{artist.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Registration date */}
              <div className="text-sm text-muted-foreground">
                <span>Data do Cadastro: </span>
                <span>
                  {artist.created_at
                    ? new Date(artist.created_at).toLocaleDateString("pt-BR")
                    : new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>
            </TabsContent>

            {/* Media */}
            <TabsContent value="midia" className="p-6 space-y-6 mt-0">
              {/* Photo gallery */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Galeria de Fotos</h3>
                  </div>
                  {Array.isArray(artist.galleryUrls) &&
                  artist.galleryUrls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {artist.galleryUrls.map((url, idx) => {
                        // Stored URLs are untrusted (gallery_urls has no URL validation on the API):
                        // only absolute http(s) becomes a link / image source.
                        const galleryHref = safeExternalUrl(url);
                        const gallerySrc = galleryHref ? safeImageSrc(galleryHref) : "";
                        return (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group"
                        >
                          {gallerySrc ? (
                          <img
                            src={gallerySrc}
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
                          ) : null}
                          <div className={`${gallerySrc ? "hidden" : "flex"} w-full h-full flex-col items-center justify-center gap-1 p-2 text-center`}>
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                            {!galleryHref && (
                              <span className="text-[10px] text-muted-foreground" data-testid="gallery-unsafe-url">Link inválido</span>
                            )}
                          </div>
                          {galleryHref && (
                            <a
                              href={galleryHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <ExternalLink className="h-5 w-5 text-foreground" />
                            </a>
                          )}
                        </div>
                        );
                      })}
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

            {/* Documents */}
            <TabsContent value="documents" className="p-6 space-y-6 mt-0">
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Documentos Vinculados</h3>
                  </div>
                  {Array.isArray(artist.documents) &&
                  artist.documents.length > 0 ? (
                    <div className="space-y-2">
                      {(
                        artist.documents
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
                                {doc.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {storedFileDisplayName(doc.url)}
                              </p>
                            </div>
                          </div>
                          <StoredFileLink url={doc.url}
                            className="shrink-0 ml-4"
                            data-testid={`link-documento-${idx}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </Button>
                          </StoredFileLink>
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

              {/* Legacy document links */}
              {(artist.personalDocumentsUrl || artist.pressKitUrl) && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Arquivos Rápidos</h3>
                    <div className="space-y-2">
                      {artist.personalDocumentsUrl && (
                        <StoredFileLink url={artist.personalDocumentsUrl}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded text-sm text-primary">
                          <FileText className="h-4 w-4" />
                          Documentos Pessoais
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </StoredFileLink>
                      )}
                      {artist.pressKitUrl && (
                        <StoredFileLink url={artist.pressKitUrl}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded text-sm text-primary">
                          <Link2 className="h-4 w-4" />
                          Press Kit
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </StoredFileLink>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Catalog */}
            <TabsContent value="catalogo" className="p-6 space-y-6 mt-0">
              {/* Statistics */}
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
                        {artist.spotifyListeners != null
                          ? Number(artist.spotifyListeners).toLocaleString(
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
                                  {formatStatusPtBr(work.status, "work")}
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
                                  {phonogram.record_label_name && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {phonogram.record_label_name}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {formatStatusPtBr(phonogram.status, "phonogram")}
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
                                    {formatCalendarDateLabel(release.release_date, "Sem data")}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {releaseStatusLabel(resolveReleaseStatus(release))}
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
                                  {formatStatusPtBr(project.status, "project")}
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

            {/* Finance */}
            <TabsContent value="financeiro" className="p-6 space-y-6 mt-0">
              {artistTransactionsLoading ? (
                <p className="text-sm text-muted-foreground" role="status" data-testid="vision360-finance-loading">
                  Carregando transações…
                </p>
              ) : artistTransactionsError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="vision360-finance-error">
                  Não foi possível carregar as transações deste artista. Tente novamente.
                </p>
              ) : (
              <>
              {artistTransactionsTruncated && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="vision360-finance-truncated">
                  {truncatedTransactionsNotice(artistTransactions.length, artistTransactionsTotal)}
                </p>
              )}
              {/* Value cards */}
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
                <Card className="bg-info/10 border-info/20">
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

              {/* Revenue by nature */}
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

              {/* Latest transactions */}
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
                              {t.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCalendarDateLabel(t.transaction_date, "—")}
                              {t.category && ` · ${transactionCategoryLabel(t.category)}`}
                            </p>
                          </div>
                          <div className="ml-4 text-right">
                            <p
                              className={`text-sm font-bold ${t.type === "revenue" ? "text-success" : "text-destructive"}`}
                            >
                              {t.type === "revenue" ? "+" : ""}
                              {formatCurrency(t.type === "revenue" ? toNumber(t.amount) : -toNumber(t.amount))}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatStatusPtBr(t.status, "transaction")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </TabsContent>

            {/* Contracts */}
            <TabsContent value="contratos" className="p-6 space-y-6 mt-0">
              {/* Contract metrics */}
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

              {/* Filters by type */}
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

              {/* Contract list */}
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
                                {formatCalendarDateLabel(contract.start_date, "—")}
                                {" → "}
                                {formatCalendarDateLabel(contract.end_date, "Indeterminado")}
                              </p>
                              {contract.fixed_value != null && (
                                <p className="text-xs text-muted-foreground">
                                  Valor: <span className={getMonetarySemanticClass("neutral")}>{formatCurrency(contract.fixed_value)}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ContractStatusBadge contratos={[contract]} />
                              {contract.file_url && (
                                <StoredFileLink url={contract.file_url as string}
                                  data-testid={`link-contrato-pdf-${contract.id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    PDF
                                  </Button>
                                </StoredFileLink>
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
              {/* Campaigns */}
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

              {/* Goals */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold">Metas & OKRs</h3>
                        <p className="text-sm text-muted-foreground">
                          {artist.stageName}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className={primaryCompactButtonClass}
                      onClick={() => setShowGoalForm(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova Meta
                    </Button>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{actualGoals.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-3 bg-warning/10 rounded-lg">
                      <p className="text-2xl font-bold text-warning">
                        {goalsInProgress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Em Progresso
                      </p>
                    </div>
                    <div className="text-center p-3 bg-success/10 rounded-lg">
                      <p className="text-2xl font-bold text-success">
                        {completedGoals}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluídas
                      </p>
                    </div>
                    <div className="text-center p-3 bg-info/10 rounded-lg">
                      <p className="text-2xl font-bold text-info">
                        {averageProgress}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Progresso Médio
                      </p>
                    </div>
                  </div>

                  {actualGoals.length === 0 ? (
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
                        onClick={() => setShowGoalForm(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Criar Primeira Meta
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {actualGoals.map((goal) => {
                        const progress = calcProgress(goal);
                        const statusInfo = goalStatusOptions.find(
                          (s) => s.value === goal.status,
                        );
                        const title = goal.title || goal.description || "Meta";
                        const { type: goalType, category, startDate, endDate } = goal;
                        return (
                          <Card key={goal.id} className="bg-background/50">
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
                                      {statusInfo?.label ?? "Status desconhecido"}
                                    </Badge>
                                  </div>
                                  {goal.description &&
                                    title !== goal.description && (
                                      <p className="text-sm text-muted-foreground">
                                        {goal.description}
                                      </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditGoal(goal)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteGoal(goal.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-muted-foreground">
                                      {goal.currentValue.toLocaleString()}{" "}
                                      /{" "}
                                      {goal.targetValue.toLocaleString()}{" "}
                                      {goal.unit}
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
                                      {formatCalendarDateLabel(startDate)}{" "}
                                      -{" "}
                                      {formatCalendarDateLabel(endDate)}
                                    </span>
                                  )}
                                </div>
                                {category && (
                                  <Badge variant="outline" className="text-xs">
                                    {goalCategories.find(
                                      (c) => c.value === category,
                                    )?.label ?? "Outra categoria"}
                                  </Badge>
                                )}
                                {goalType && (
                                  <Badge variant="outline" className="text-xs">
                                    {goalTypes.find((t) => t.value === goalType)
                                      ?.label ?? "Outros"}
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

            {/* Evolution */}
            <TabsContent value="evolucao" className="p-6 space-y-6 mt-0">
              <ArtistEvolutionSection artist={artist} />

              {/* ══ AUDIENCE HEALTH (audience-health AI Skill over the already-computed Career Stage + Market Benchmark) ══ */}
              <section className="space-y-3" data-testid="artist-vision-audience-health">
                <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">
                  Saúde de Audiência (IA)
                </h3>
                <SkillRunPanel
                  label="Analisar saúde de audiência"
                  result={audienceHealth.result}
                  isRunning={audienceHealth.isRunning}
                  error={audienceHealth.error}
                  onRun={() => audienceHealth.run(undefined)}
                />
              </section>

              {/* Milestones / timeline */}
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

            {/* History */}
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
                            <span className="text-muted-foreground">{formatDateDMY(e.starts_at)}</span>
                            <span className="text-muted-foreground">
                              {e.starts_at ? new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </span>
                            <span className="truncate">{getBackendEventTypeLabel(e.type)}</span>
                            <span className="truncate font-medium">{e.title}</span>
                            <span className="truncate text-muted-foreground">{e.venue || "—"}</span>
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

            {/* Contents */}
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

            {/* Activity */}
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

        {/* New/Edit goal modal */}
        <Dialog
          open={showGoalForm}
          onOpenChange={(open) => !open && resetForm()}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2">
                <Label>Título da Meta *</Label>
                <Input
                  value={goalForm.title}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, title: e.target.value })
                  }
                  placeholder="Ex: Alcançar 1M de streams"
                />
              </div>

              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={goalForm.description}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, description: e.target.value })
                  }
                  placeholder="Descreva a meta em detalhes..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Tipo de Meta *</Label>
                <Select
                  value={goalForm.type}
                  onValueChange={(v) => setGoalForm({ ...goalForm, type: v as GoalType })}
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
                  value={goalForm.category}
                  onValueChange={(v) =>
                    setGoalForm({ ...goalForm, category: v })
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
                  value={goalForm.targetValue}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, targetValue: e.target.value })
                  }
                  placeholder="1000000"
                />
              </div>

              <div>
                <Label>Valor Atual</Label>
                <Input
                  type="number"
                  value={goalForm.currentValue}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, currentValue: e.target.value })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Unidade de Medida</Label>
                <Input
                  value={goalForm.unit}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, unit: e.target.value })
                  }
                  placeholder="Ex: streams, seguidores, R$"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={goalForm.status}
                  onValueChange={(v) =>
                    setGoalForm({ ...goalForm, status: v as ArtistGoalStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalStatusOptions.map((s) => (
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
                  value={goalForm.startDate}
                  onChange={(iso) => setGoalForm({ ...goalForm, startDate: iso })}
                  placeholder="Selecione a data"
                  data-testid="datepicker-goal-start-date"
                />
              </div>

              <div>
                <Label>Data de Fim</Label>
                <DatePickerField
                  value={goalForm.endDate}
                  onChange={(iso) => setGoalForm({ ...goalForm, endDate: iso })}
                  placeholder="Selecione a data"
                  data-testid="datepicker-goal-end-date"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveGoal}
                className="bg-primary hover:bg-primary/90"
              >
                {editingGoal ? "Salvar Alterações" : "Criar Meta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
