/**
 * Briefings - strategic origin for projects across the platform.
 *
 * This page remains backed by the marketing resource service for now, but the
 * product surface is intentionally transversal: collect strategy, structure
 * execution plans and hand off approved direction to operational modules.
 */

import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import {
  CalendarClock,
  ClipboardList,
  Eye,
  FileEdit,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import {
  MarketingBadge,
  MarketingDataTable,
  MarketingEmptyState,
  MarketingFilters,
  MarketingFormModal,
  BriefingStatusBadge,
  ALL_FILTER,
  type Column,
  type FormValues,
} from "../components";
import {
  useCreateBriefing,
  useMarketingBriefings,
  useRemoveBriefing,
  useUpdateBriefing,
} from "../hooks/useMarketingBriefings";
import {
  BRIEFING_STATUS_OPTIONS,
  BRIEFING_TYPE_LABEL,
} from "../constants/marketing.constants";
import {
  strategicBriefingCreateFields,
  strategicBriefingEditFields,
  strategicBriefingInitialValues,
  strategicBriefingToInput,
} from "../forms/briefing-strategy-forms";
import { formatDate } from "../utils/marketing-format";
import type { MarketingBriefing } from "../types/marketing.types";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";

type BriefingModalMode = "create" | "edit";

const MODAL_COPY: Record<BriefingModalMode, { title: string; description: string; submitLabel: string }> = {
  create: {
    title: "Novo Briefing",
    description: "Registre a origem estratégica do projeto e os primeiros direcionamentos.",
    submitLabel: "Criar Briefing",
  },
  edit: {
    title: "Editar Briefing",
    description: "Complete objetivos, requisitos, referências, recursos e plano de execução.",
    submitLabel: "Salvar alterações",
  },
};

export default function Briefing() {
  const { data: briefings = [], isLoading } = useMarketingBriefings();
  const createBriefing = useCreateBriefing();
  const updateBriefing = useUpdateBriefing();
  const removeBriefing = useRemoveBriefing();
  const { getOptionsByKind } = useOperationalSettings();
  const briefingTypeOptions = getOptionsByKind("briefing_service_type");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<BriefingModalMode>("create");
  const [selectedBriefing, setSelectedBriefing] = useState<MarketingBriefing | null>(null);
  const [viewBriefing, setViewBriefing] = useState<MarketingBriefing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingBriefing | null>(null);
  const [selectedBriefingIds, setSelectedBriefingIds] = useState<string[]>([]);

  const stats = useMemo(() => {
    const approved = briefings.filter((b) => b.status === "approved").length;
    const inReview = briefings.filter((b) => b.status === "review").length;
    const open = briefings.filter((b) => !["approved", "completed", "cancelled"].includes(b.status)).length;
    const deliverables = briefings.reduce((total, b) => total + (b.deliverables?.length ?? 0), 0);
    return { approved, inReview, open, deliverables };
  }, [briefings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return briefings.filter((b) => {
      const searchable = [
        b.title,
        b.objective,
        b.context,
        b.audience,
        b.positioning,
        ...(b.owners ?? []),
      ].join(" ").toLowerCase();
      if (term && !searchable.includes(term)) return false;
      if (typeFilter !== ALL_FILTER && b.type !== typeFilter) return false;
      if (statusFilter !== ALL_FILTER && b.status !== statusFilter) return false;
      return true;
    });
  }, [briefings, search, typeFilter, statusFilter]);

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  const openCreateModal = () => {
    setViewBriefing(null);
    setSelectedBriefing(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEditModal = (briefing: MarketingBriefing) => {
    // Ensures a single modal: closes the ViewModal before opening the EditModal.
    setViewBriefing(null);
    setSelectedBriefing(briefing);
    setModalMode("edit");
    setModalOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeBriefing.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const toggleBriefingSelection = (id: string) => {
    setSelectedBriefingIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllBriefingSelection = (ids: string[]) => {
    const allSelected = ids.length > 0 && ids.every((id) => selectedBriefingIds.includes(id));
    setSelectedBriefingIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const bulkDeleteBriefings = async (ids: string[]) => {
    setSelectedBriefingIds((current) => current.filter((id) => !ids.includes(id)));
    const result = await runBulkAction(ids, (id) => removeBriefing.mutateAsync(id));
    reportBulkResult(result, "excluído", "briefing");
  };

  const columns: Column<MarketingBriefing>[] = [
    {
      key: "title",
      header: "Briefing",
      cell: (b) => (
        <div className="space-y-1">
          <p className="font-medium">{b.title}</p>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{b.objective || b.context || "Sem objetivo definido"}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (b) => <MarketingBadge tone="neutral">{BRIEFING_TYPE_LABEL[b.type] ?? b.type}</MarketingBadge>,
    },
    { key: "status", header: "Status", cell: (b) => <BriefingStatusBadge status={b.status} /> },
    { key: "owners", header: "Responsáveis", cell: (b) => (b.owners ?? []).join(", ") || "-" },
    {
      key: "deliverables",
      header: "Plano",
      cell: (b) => (
        <span className="text-xs text-muted-foreground">{(b.deliverables ?? []).length} entregável(is)</span>
      ),
    },
    { key: "deadline", header: "Prazo", cell: (b) => <span className="text-xs text-muted-foreground">{formatDate(b.deadline)}</span> },
    {
      key: "actions",
      header: "Ações",
      headerClassName: "w-[1%] whitespace-nowrap text-right",
      className: "text-right",
      cell: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações do briefing">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewBriefing(b)}>
              <Eye className="mr-2 h-4 w-4" /> Ver estratégia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEditModal(b)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar planejamento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteTarget(b)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSubmit = (values: FormValues) => {
    if (modalMode === "create") {
      createBriefing.mutate(strategicBriefingToInput(values), { onSuccess: () => setModalOpen(false) });
      return;
    }
    if (selectedBriefing) {
      updateBriefing.mutate(
        { id: selectedBriefing.id, patch: strategicBriefingToInput(values) },
        { onSuccess: () => setModalOpen(false) },
      );
    }
  };

  const modalCopy = MODAL_COPY[modalMode];
  const modalFields = (modalMode === "create" ? strategicBriefingCreateFields : strategicBriefingEditFields).map((field) =>
    field.name === "type" ? { ...field, options: briefingTypeOptions } : field,
  );
  const modalInitialValues =
    modalMode === "create" || !selectedBriefing
      ? strategicBriefingInitialValues()
      : strategicBriefingInitialValues(selectedBriefing);

  return (
    <MainLayout
      title="Briefings"
      description="Origem estratégica dos projetos"
      actions={
        <Button size="sm" onClick={openCreateModal}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo Briefing
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-3 md:grid-cols-4">
          <BriefingMetric title="Briefings abertos" value={stats.open} icon={ClipboardList} />
          <BriefingMetric title="Em revisão" value={stats.inReview} icon={Eye} />
          <BriefingMetric title="Aprovados" value={stats.approved} icon={Target} />
          <BriefingMetric title="Entregáveis planejados" value={stats.deliverables} icon={Rocket} />
        </section>

        <MarketingFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar briefing, objetivo, público ou responsável..."
          filters={[
            { value: typeFilter, onChange: setTypeFilter, placeholder: "Tipo", allLabel: "Todos os tipos", options: briefingTypeOptions },
            { value: statusFilter, onChange: setStatusFilter, placeholder: "Status", allLabel: "Todos os status", options: BRIEFING_STATUS_OPTIONS },
          ]}
        />

        <MarketingDataTable
          title="Lista de Briefings"
          description="Acompanhe briefings, tipos, objetivos, responsáveis e status"
          columns={columns}
          rows={pageItems}
          isLoading={isLoading}
          getRowKey={(b) => b.id}
          onRowClick={setViewBriefing}
          selection={{
            selectedIds: selectedBriefingIds,
            onToggle: toggleBriefingSelection,
            onToggleAll: toggleAllBriefingSelection,
            onBulkDelete: bulkDeleteBriefings,
          }}
          empty={
            <MarketingEmptyState
              icon={FileEdit}
              title="Nenhum briefing encontrado"
              description="Crie um briefing para documentar a origem estratégica do projeto antes da execução."
              actionLabel="Novo Briefing"
              onAction={openCreateModal}
            />
          }
          footer={
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="briefings"
            />
          }
        />
      </div>

      <MarketingFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          // When the EditModal closes, resets the state so the ViewModal does not reappear
          // in case the "Editar" click leaked to the row (onRowClick).
          if (!open) {
            setSelectedBriefing(null);
            setViewBriefing(null);
          }
        }}
        title={modalCopy.title}
        description={modalCopy.description}
        fields={modalFields}
        initialValues={modalInitialValues}
        submitLabel={modalCopy.submitLabel}
        submitting={createBriefing.isPending || updateBriefing.isPending}
        onSubmit={handleSubmit}
      />

      <BriefingViewModal
        briefing={modalOpen ? null : viewBriefing}
        onOpenChange={(open) => {
          if (!open) setViewBriefing(null);
        }}
        onEdit={(briefing) => {
          openEditModal(briefing);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir briefing?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O briefing
              {deleteTarget ? ` "${deleteTarget.title}"` : ""} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBriefing.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={removeBriefing.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeBriefing.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function BriefingMetric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium  tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function BriefingViewModal({
  briefing,
  onOpenChange,
  onEdit,
}: {
  briefing: MarketingBriefing | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (briefing: MarketingBriefing) => void;
}) {
  const open = !!briefing;
  if (!briefing) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  const extra = briefing as MarketingBriefing & Record<string, unknown>;
  const deliverables = briefing.deliverables ?? [];
  const channels = briefing.channels ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl">{briefing.title}</DialogTitle>
              <DialogDescription>
                Briefing estratégico para concepção, validação e distribuição do planejamento.
              </DialogDescription>
            </div>
            <Button size="sm" onClick={() => onEdit(briefing)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <BriefingStatusBadge status={briefing.status} />
            <MarketingBadge tone="neutral">{BRIEFING_TYPE_LABEL[briefing.type]}</MarketingBadge>
            <MarketingBadge tone="pending">{formatDate(briefing.deadline)}</MarketingBadge>
          </div>
        </DialogHeader>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ReadOnlyTile icon={Users} label="Responsáveis" value={(briefing.owners ?? []).join(", ") || "-"} />
          <ReadOnlyTile icon={CalendarClock} label="Prazo" value={formatDate(briefing.deadline)} />
          <ReadOnlyTile icon={Rocket} label="Entregáveis" value={`${deliverables.length} planejado(s)`} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <ReadOnlyBlock title="Objetivo estratégico" value={briefing.objective} />
            <ReadOnlyBlock title="Contexto e necessidades" value={briefing.context} />
            <ReadOnlyBlock title="Público-alvo e personas" value={briefing.audience} />
            <ReadOnlyBlock title="Posicionamento" value={briefing.positioning} />
            <ReadOnlyBlock title="Direcionamento criativo" value={stringValue(extra.creativeDirection) || briefing.visualGuidelines} />
            <ReadOnlyBlock title="Requisitos e restrições" value={joinValues(stringValue(extra.requirements), briefing.restrictions)} />
          </div>

          <div className="space-y-4">
            <ReadOnlyBlock title="Tom de voz" value={briefing.tone} />
            <ReadOnlyBlock title="Referências" value={briefing.references} />
            <ReadOnlyBlock title="Mercado, tendências e concorrentes" value={joinValues(stringValue(extra.market), stringValue(extra.trends), stringValue(extra.competitors))} />
            <ReadOnlyBlock title="Recursos e expectativas" value={joinValues(stringValue(extra.resources), stringValue(extra.expectations))} />
            <ReadOnlyList title="Canais" items={channels} empty="Nenhum canal definido." />
            <ReadOnlyList title="Entregáveis" items={deliverables} empty="Nenhum entregável definido." />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-primary" />
                Apoio da IA Criativa
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Leve este briefing para a IA gerar ideias, campanhas, conteúdos, personas, tom de voz,
                cronograma, oportunidades e recomendações estratégicas.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/marketing/ia-criativa">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Analisar com IA
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ReadOnlyBlock title="Cronograma sugerido" value={stringValue(extra.timeline)} />
          <ReadOnlyBlock title="Plano de ação operacional" value={stringValue(extra.executionPlan)} />
          <ReadOnlyBlock title="Recomendações da IA" value={stringValue(extra.aiRecommendations)} />
          <ReadOnlyBlock title="Diretrizes textuais" value={briefing.textGuidelines} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex items-center gap-2 text-[11px] font-medium  tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function ReadOnlyBlock({ title, value }: { title: string; value?: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {value?.trim() || "Não informado."}
      </p>
    </section>
  );
}

function ReadOnlyList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <MarketingBadge key={item} tone="neutral">{item}</MarketingBadge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function joinValues(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join("\n\n");
}
