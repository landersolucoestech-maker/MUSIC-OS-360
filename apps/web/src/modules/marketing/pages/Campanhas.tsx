/**
 * Marketing - Campanhas.
 *
 * Dense operational view: KPI strip, compact campaign table, dedicated
 * create/edit flow, and a focused read-only view modal.
 */

import { useMemo, useState, type ComponentType } from "react";
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  Edit,
  Eye,
  MoreHorizontal,
  MousePointer2,
  PlusCircle,
  Search,
  Share2,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { Checkbox } from "@/shared/ui/checkbox";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { SortableTableHead } from "@/shared/components/SortableTableHead";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/ui/table";
import { nextTableSortState, sortTableRows, type TableSortState } from "@/shared/lib/table-sort";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  useMarketingCampaigns,
  useCreateCampaign,
  useRemoveCampaign,
  useUpdateCampaign,
} from "../hooks/useMarketingCampaigns";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { CampaignBuilderModal } from "../components/campaign-builder/CampaignBuilderModal";
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_TYPE_OPTIONS,
  MARKETING_TARGET_LABEL,
} from "../constants/marketing.constants";
import { formatCurrency, formatDate } from "../utils/marketing-format";
import { PUBLISH_PLATFORMS } from "../config/social-formats";
import type {
  CampaignStatus,
  CampaignType,
  ContentChannel,
  MarketingCampaign,
} from "../types/marketing.types";

const PLATFORM_OPTIONS: {
  value: ContentChannel;
  label: string;
}[] = [
  { value: "facebook", label: "Meta Ads (Facebook + Instagram)" },
  { value: "material_publicitario", label: "Google Ads" },
  { value: "tiktok", label: "TikTok Ads" },
  { value: "podcast", label: "Spotify Ad Studio" },
  { value: "youtube", label: "YouTube Ads" },
];

const PLATFORM_LABEL_BY_VALUE = PLATFORM_OPTIONS.reduce(
  (acc, platform) => {
    acc[platform.value] = platform.label;
    return acc;
  },
  {} as Partial<Record<ContentChannel, string>>,
);

function platformLabel(platform?: ContentChannel): string {
  if (!platform) return "-";
  if (platform === "instagram" || platform === "reels" || platform === "stories") {
    return "Meta Ads (Facebook + Instagram)";
  }
  return PLATFORM_LABEL_BY_VALUE[platform] ?? platform;
}

/** Rotulos curtos das plataformas de publicaçãoo (sociais). */
const SOCIAL_PLATFORM_LABEL = PUBLISH_PLATFORMS.reduce(
  (acc, platform) => {
    acc[platform.value] = platform.label;
    return acc;
  },
  {} as Partial<Record<ContentChannel, string>>,
);

function socialPlatformLabel(platform: ContentChannel): string {
  return SOCIAL_PLATFORM_LABEL[platform] ?? platformLabel(platform);
}

/** Lista de todas as plataformas da campanha (multiplataforma). */
function allPlatformsLabel(platforms: ContentChannel[]): string {
  if (!platforms.length) return "-";
  return platforms.map(socialPlatformLabel).join(", ");
}

function statusLabel(status: CampaignStatus): string {
  if (status === "agendada") return "Planejado";
  return CAMPAIGN_STATUS_LABEL[status] ?? status;
}

function statusVariant(status: CampaignStatus): BadgeVariant {
  switch (status) {
    case "ativa":
    case "concluida":
      return "success";
    case "agendada":
    case "rascunho":
      return "info";
    case "cancelada":
      return "danger";
    case "pausada":
    default:
      return "neutral";
  }
}

function campaignSpend(campaign: MarketingCampaign): number {
  const calculated = campaign.metrics.costPerResult * campaign.metrics.conversions;
  return calculated > 0 ? calculated : 0;
}

function hasSpendData(campaign: MarketingCampaign): boolean {
  return campaign.metrics.costPerResult * campaign.metrics.conversions > 0;
}

function campaignCtr(campaign: MarketingCampaign): number {
  if (campaign.metrics.impressions <= 0) return 0;
  return (campaign.metrics.clicks / campaign.metrics.impressions) * 100;
}

/** CODEBASE_MAP Gotcha #16: label a metric as estimated whenever it is (i.e. always, today —
 * campaign.metrics is budget-derived, not measured; flips once a real integration is wired). */
function estimatedLabel(base: string, campaign: MarketingCampaign): string {
  return campaign.metrics.isEstimated !== false ? `${base} (estimado):` : `${base}:`;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export default function Campanhas() {
  const { data: campaigns = [], isLoading } = useMarketingCampaigns();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const removeCampaign = useRemoveCampaign();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewCampaign, setViewCampaign] = useState<MarketingCampaign | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderCampaign, setBuilderCampaign] = useState<MarketingCampaign | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const text = `${campaign.name} ${campaign.targetName ?? ""} ${campaign.objective} ${campaign.notes}`.toLowerCase();
      if (term && !text.includes(term)) return false;
      if (statusFilter !== "all" && campaign.status !== statusFilter) return false;
      if (typeFilter !== "all" && campaign.type !== typeFilter) return false;
      return true;
    });
  }, [campaigns, search, statusFilter, typeFilter]);

  const totals = useMemo(() => {
    const budget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
    const spend = campaigns.reduce((sum, campaign) => sum + campaignSpend(campaign), 0);
    const clicks = campaigns.reduce((sum, campaign) => sum + campaign.metrics.clicks, 0);
    const impressions = campaigns.reduce((sum, campaign) => sum + campaign.metrics.impressions, 0);
    // CODEBASE_MAP Gotcha #16: campaign.metrics is budget-derived (estimateCampaignResults),
    // never real measured performance -- publish() never calls a real ad-platform integration.
    // "estimado" only when every contributing campaign is itself estimated; a future real
    // integration writing isEstimated=false on at least one campaign flips this to "total" again.
    const clicksAllEstimated = campaigns.length > 0 && campaigns.every((c) => c.metrics.isEstimated !== false);
    return {
      active: campaigns.filter((campaign) => campaign.status === "ativa").length,
      budget,
      spend,
      clicks,
      clicksAllEstimated,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
    };
  }, [campaigns]);

  const openCreate = () => {
    setBuilderCampaign(null);
    setBuilderOpen(true);
  };

  const openEdit = (campaign: MarketingCampaign) => {
    // Fecha o ViewModal e abre apenas o EditModal.
    setViewCampaign(null);
    setBuilderCampaign(campaign);
    setBuilderOpen(true);
  };

  const handleRemove = (campaign: MarketingCampaign) => {
    removeCampaign.mutate(campaign.id);
    if (viewCampaign?.id === campaign.id) setViewCampaign(null);
  };

  const handleBuilderSubmit = (input: Parameters<typeof createCampaign.mutate>[0]) => {
    if (builderCampaign) {
      updateCampaign.mutate(
        { id: builderCampaign.id, patch: input, expectedUpdatedAt: getExpectedUpdatedAt(builderCampaign) },
        { onSuccess: () => setBuilderOpen(false) },
      );
      return;
    }
    createCampaign.mutate(input, { onSuccess: () => setBuilderOpen(false) });
  };

  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout
        title="Campanhas de Marketing"
        description="Planeje, execute e monitore campanhas e tráfego pago"
        actions={
          <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5" data-testid="button-nova-campanha">
            <PlusCircle className="h-3.5 w-3.5" />
            Nova Campanha
          </Button>
        }
      >
        <div className="space-y-6 bg-background text-muted-foreground">
          <div className="grid gap-3 md:grid-cols-5">
            <CampaignKpi label="Campanhas Ativas" value={totals.active} caption="em execução" icon={Target} />
            <CampaignKpi label="Budget Total" value={formatCurrency(totals.budget)} caption="investimento" icon={DollarSign} tone="success" />
            <CampaignKpi label="Gasto Total" value={formatCurrency(totals.spend)} caption="executado" icon={DollarSign} tone="danger" />
            <CampaignKpi
              label="Cliques"
              value={compactNumber(totals.clicks)}
              caption={totals.clicksAllEstimated ? "estimado" : "total"}
              icon={MousePointer2}
            />
            <CampaignKpi label="CTR Médio" value={`${totals.ctr.toFixed(0)}%`} caption="taxa de clique" icon={BarChart3} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou descrição..."
                className="h-8 border-border bg-card pl-9 text-sm text-muted-foreground placeholder:text-muted-foreground"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[{ value: "all", label: "Todos os status" }, ...CAMPAIGN_STATUS_OPTIONS.map((o) => ({ value: o.value, label: statusLabel(o.value) }))]}
            />
            <FilterSelect
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={[{ value: "all", label: "Todas" }, ...CAMPAIGN_TYPE_OPTIONS]}
            />
          </div>

          <section className="rounded-[5px] border border-border bg-card px-5 py-4">
            <CampaignTable
              campaigns={filtered}
              isLoading={isLoading}
              onView={setViewCampaign}
              onEdit={openEdit}
              onRemove={handleRemove}
            />
          </section>
        </div>

        <CampaignViewModal
          campaign={builderOpen ? null : viewCampaign}
          onClose={() => setViewCampaign(null)}
          onEdit={openEdit}
        />
        <CampaignBuilderModal
          open={builderOpen}
          campaign={builderCampaign}
          submitting={createCampaign.isPending || updateCampaign.isPending}
          onOpenChange={(open) => {
            setBuilderOpen(open);
            // Ao fechar o EditModal, zera estados para o ViewModal não reaparecer
            // caso o clique de "Editar" tenha vazado para a linha (onView).
            if (!open) {
              setViewCampaign(null);
              setBuilderCampaign(null);
            }
          }}
          onSubmit={handleBuilderSubmit}
        />
      </MainLayout>
    </FeatureGate>
  );
}

function CampaignKpi({
  label,
  value,
  caption,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "danger";
}) {
  const accent = tone === "danger" ? "destructive" : tone;
  return <MetricCard title={label} value={value} description={caption} icon={Icon} accent={accent} />;
}

function FilterSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[140px] shrink-0 border-border bg-card text-sm text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-card text-foreground">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CampaignTable({
  campaigns,
  isLoading,
  onView,
  onEdit,
  onRemove,
}: {
  campaigns: MarketingCampaign[];
  isLoading: boolean;
  onView: (campaign: MarketingCampaign) => void;
  onEdit: (campaign: MarketingCampaign) => void;
  onRemove: (campaign: MarketingCampaign) => void;
}) {
  const [sortState, setSortState] = useState<TableSortState>(null);
  const sortedCampaigns = useMemo(
    () => sortTableRows(campaigns, sortState, (campaign, key) => {
      if (key === "contexto") return campaign.targetName || campaign.owner || "Empresa";
      if (key === "plataforma") return allPlatformsLabel(campaign.platforms);
      if (key === "status") return statusLabel(campaign.status);
      if (key === "budget") return campaign.budget;
      if (key === "gasto") return campaignSpend(campaign);
      if (key === "cliques") return campaign.metrics.clicks;
      return (campaign as unknown as Record<string, unknown>)[key];
    }),
    [campaigns, sortState],
  );
  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(sortedCampaigns, 10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const allPageSelected = pageItems.length > 0 && pageItems.every((campaign) => selectedIds.includes(campaign.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageItems.some((campaign) => campaign.id === id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...pageItems.map((campaign) => campaign.id)])));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const handleBulkRemove = () => {
    const selectedCampaigns = campaigns.filter((campaign) => selectedIds.includes(campaign.id));
    selectedCampaigns.forEach(onRemove);
    setSelectedIds([]);
  };

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando campanhas...</div>;
  }

  if (campaigns.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma campanha encontrada.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <ListSectionHeader
        title="Lista de Campanhas"
        count={campaigns.length}
        description="Acompanhe campanhas, plataformas, investimento, status e performance"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Checkbox
              checked={allPageSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecionar campanhas"
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.length > 0 ? `${selectedIds.length} campanha(s) selecionada(s)` : "Selecionar todos"}
            </span>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleBulkRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover ({selectedIds.length})
              </Button>
            )}
          </div>
        }
      />
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="selecionar" sortState={sortState} onSort={() => undefined} disabled className="w-9">
              <span className="sr-only">Selecionar</span>
            </SortableTableHead>
            <SortableTableHead sortKey="name" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Nome</SortableTableHead>
            <SortableTableHead sortKey="contexto" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Contexto</SortableTableHead>
            <SortableTableHead sortKey="plataforma" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Plataforma</SortableTableHead>
            <SortableTableHead sortKey="status" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Status</SortableTableHead>
            <SortableTableHead sortKey="budget" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Budget</SortableTableHead>
            <SortableTableHead sortKey="gasto" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Gasto</SortableTableHead>
            <SortableTableHead sortKey="cliques" sortState={sortState} onSort={(key) => setSortState((current) => nextTableSortState(current, key))}>Cliques</SortableTableHead>
            <SortableTableHead sortKey="acoes" sortState={sortState} onSort={() => undefined} disabled className="text-right">Ações</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((campaign) => {
            return (
              <TableRow
                key={campaign.id}
                onClick={() => onView(campaign)}
                className="cursor-pointer border-b border-border text-muted-foreground transition-colors hover:bg-muted/40"
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(campaign.id)}
                    onCheckedChange={() => toggleSelect(campaign.id)}
                    aria-label={`Selecionar ${campaign.name}`}
                  />
                </TableCell>
                <TableCell className="font-semibold text-foreground">{campaign.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="max-w-[180px]">
                    <p className="truncate">{campaign.targetName || campaign.owner || "Empresa"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {MARKETING_TARGET_LABEL[campaign.targetType ?? "empresa"]}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="line-clamp-2 max-w-[220px]">{allPlatformsLabel(campaign.platforms)}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(campaign.status)}>
                    {statusLabel(campaign.status)}
                  </Badge>
                </TableCell>
                <TableCell className={`font-medium tabular-nums ${campaign.budget > 0 ? "text-green-600" : ""}`}>{campaign.budget > 0 ? formatCurrency(campaign.budget) : "-"}</TableCell>
                <TableCell className={`font-medium tabular-nums ${campaignSpend(campaign) > 0 ? "text-destructive" : ""}`}>{campaignSpend(campaign) > 0 ? formatCurrency(-campaignSpend(campaign)) : "-"}</TableCell>
                <TableCell className="font-medium tabular-nums">{compactNumber(campaign.metrics.clicks)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => event.stopPropagation()}
                        className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-border bg-card text-foreground">
                      <DropdownMenuItem onClick={() => onView(campaign)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(campaign)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-300 focus:text-red-300" onClick={() => onRemove(campaign)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="campanhas"
      />
    </div>
  );
}

function CampaignViewModal({
  campaign,
  onClose,
  onEdit,
}: {
  campaign: MarketingCampaign | null;
  onClose: () => void;
  onEdit: (campaign: MarketingCampaign) => void;
}) {
  if (!campaign) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/25 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-[min(590px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Target className="mt-1 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">{campaign.name}</h2>
                <Badge variant={statusVariant(campaign.status)}>
                  {statusLabel(campaign.status)}
                </Badge>
                <Badge variant="neutral">
                  {CAMPAIGN_TYPE_LABEL[campaign.type]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Campanha criada em {formatDate(campaign.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEdit(campaign)}
              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Editar campanha"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-7 space-y-6">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Métricas
            </h3>
            {campaign.metrics.isEstimated !== false && (
              <p className="mb-3 text-xs text-muted-foreground" data-testid="campaign-metrics-estimated-note">
                Cliques, Impressões, Conversões e CTR abaixo são uma estimativa calculada a partir do
                orçamento — esta campanha ainda não foi publicada em nenhuma plataforma de anúncios
                real, então não há dados medidos.
              </p>
            )}
            <div className="grid gap-x-12 gap-y-3 sm:grid-cols-2">
              <MetricLine icon={DollarSign} label="Orçamento:" value={formatCurrency(campaign.budget)} />
              <MetricLine icon={DollarSign} label="Gasto:" value={hasSpendData(campaign) ? formatCurrency(campaignSpend(campaign)) : "Indisponível"} />
              <MetricLine icon={MousePointer2} label={estimatedLabel("Cliques", campaign)} value={compactNumber(campaign.metrics.clicks)} />
              <MetricLine icon={BarChart3} label={estimatedLabel("Impressões", campaign)} value={compactNumber(campaign.metrics.impressions)} />
              <MetricLine icon={BarChart3} label={estimatedLabel("Conversões", campaign)} value={compactNumber(campaign.metrics.conversions)} />
              <MetricLine icon={BarChart3} label={estimatedLabel("CTR", campaign)} value={`${campaignCtr(campaign).toFixed(2)}%`} />
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Peri­odo
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricLine icon={CalendarDays} label="Ini­cio:" value={formatDate(campaign.startDate)} />
              <MetricLine icon={CalendarDays} label="Fim:" value={formatDate(campaign.endDate)} />
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Plataformas e contexto
            </h3>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Contexto:</span>
              <Badge variant="neutral">{MARKETING_TARGET_LABEL[campaign.targetType ?? "empresa"]}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {campaign.platforms.length ? (
                campaign.platforms.map((platform) => (
                  <Badge key={platform} variant="secondary">{socialPlatformLabel(platform)}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Nenhuma plataforma selecionada.</span>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Observações</h3>
            <p className="text-sm text-muted-foreground">{campaign.notes || campaign.objective || "Sem observações cadastradas."}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricLine({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
