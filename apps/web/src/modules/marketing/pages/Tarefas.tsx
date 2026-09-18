/**
 * Marketing — Tarefas. Operational task list (table-only) with per-row actions.
 *
 * Creation/editing use a lean form modal. Viewing uses a dedicated read-only
 * detail modal so it does not look like a disabled edit form.
 */

import { useMemo, useState, type ComponentType } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { useSkillRun } from "@/shared/hooks/useSkillRun";
import { SkillRunPanel } from "@/shared/components/SkillRunPanel";
import { AlertTriangle, CalendarClock, CheckCircle, Download, Eye, ListChecks, MoreHorizontal, Music, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
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
  MarketingDataTable,
  MarketingDeliverableSection,
  MarketingEmptyState,
  MarketingFilters,
  MarketingFormModal,
  MarketingBadge,
  MarketingPriorityBadge,
  TaskStatusBadge,
  ALL_FILTER,
  type Column,
  type FormValues,
} from "../components";
import {
  useCreateTask,
  useMarketingTasks,
  useRemoveTask,
  useUpdateTask,
} from "../hooks/useMarketingTasks";
import {
  MARKETING_TARGET_LABEL,
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  TASK_TYPE_OPTIONS,
} from "../constants/marketing.constants";
import {
  taskCreateFields,
  taskEditFields,
  taskInitialValues,
  taskToFormValues,
  toTaskInput,
  findProjectReferenceAudio,
  type TaskTargetOptions,
} from "../forms/marketing-forms";
import { formatDate } from "../utils/marketing-format";
import type { MarketingTask } from "../types/marketing.types";
import { useQuery } from "@tanstack/react-query";
import { fetchAllLabels } from "@/shared/lib/fetch-all-labels";
import { useMarketingProjects } from "../hooks/useMarketingProjects";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";

type TaskModalMode = "create" | "edit";

const MODAL_COPY: Record<TaskModalMode, { title: string; description: string; submitLabel: string }> = {
  create: {
    title: "Nova Tarefa",
    description: "Crie uma nova tarefa operacional.",
    submitLabel: "Criar Tarefa",
  },
  edit: {
    title: "Editar Tarefa",
    description: "Atualize os dados da tarefa selecionada.",
    submitLabel: "Salvar alterações",
  },
};

export default function Tarefas() {
  const { data: tasks = [], isLoading } = useMarketingTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const removeTask = useRemoveTask();

  // Real registries powering the "Projeto musical, artista ou empresa" picker.
  // Campo `targetName` guarda o NOME (não o id) e é filtrado client-side
  // (searchable: true no FieldDef) — por isso usa fetchAllLabels (paginação
  // real, sem cap) em vez de useArtistas()/useClientes() (capadas a 50/tenant).
  const { data: artistaNameOptions = [] } = useQuery({
    queryKey: ["marketing-task-target-names", "artistas"],
    queryFn: () => fetchAllLabels("artistas", (a) => a.nome_artistico as string | undefined),
  });
  const { data: empresaNameOptions = [] } = useQuery({
    queryKey: ["marketing-task-target-names", "clientes"],
    queryFn: () => fetchAllLabels("clientes", (c) => c.nome as string | undefined),
  });
  const { data: projects = [] } = useMarketingProjects();
  const { getOptionsByKind } = useOperationalSettings();
  const marketingContextOptions = getOptionsByKind("marketing_context");
  const marketingSectorOptions = getOptionsByKind("marketing_sector");
  const marketingTaskTypeOptions = getOptionsByKind("marketing_task_type");

  const targetOptions = useMemo<TaskTargetOptions>(
    () => ({
      artista: artistaNameOptions,
      projeto_musical: projects
        .map((p) => ({ value: p.name, label: p.name }))
        .filter((o) => o.value),
      empresa: empresaNameOptions,
    }),
    [artistaNameOptions, projects, empresaNameOptions],
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TaskModalMode>("create");
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [viewTask, setViewTask] = useState<MarketingTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingTask | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const text = `${t.title} ${t.targetName ?? ""} ${t.description ?? ""}`.toLowerCase();
      if (term && !text.includes(term)) return false;
      if (typeFilter !== ALL_FILTER && t.type !== typeFilter) return false;
      return true;
    });
  }, [tasks, search, typeFilter]);

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  const taskKpis = useMemo(() => {
    const aFazerStatuses = new Set(["backlog", "a_fazer"]);
    return {
      total: tasks.length,
      concluidas: tasks.filter((task) => task.status === "concluida").length,
      aFazer: tasks.filter((task) => aFazerStatuses.has(task.status)).length,
      emAndamento: tasks.filter((task) => task.status === "em_andamento").length,
      revisao: tasks.filter((task) => task.status === "revisao").length,
    };
  }, [tasks]);

  const openCreateModal = () => {
    setSelectedTask(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openViewModal = (task: MarketingTask) => {
    setViewTask(task);
  };

  const openEditModal = (task: MarketingTask) => {
    setSelectedTask(task);
    setModalMode("edit");
    setModalOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeTask.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllTaskSelection = (ids: string[]) => {
    const allSelected = ids.length > 0 && ids.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const bulkDeleteTasks = async (ids: string[]) => {
    setSelectedTaskIds((current) => current.filter((id) => !ids.includes(id)));
    const result = await runBulkAction(ids, (id) => removeTask.mutateAsync(id));
    reportBulkResult(result, "excluída", "tarefa");
  };

  const columns: Column<MarketingTask>[] = [
    {
      key: "title",
      header: "Tarefa",
      cell: (t) => (
        <div>
          <p className="font-medium">{t.title}</p>
          <p className="text-[11px] text-muted-foreground">{TASK_TYPE_LABEL[t.type] ?? t.type}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (t) => <TaskStatusBadge status={t.status} /> },
    {
      key: "target",
      header: "Contexto",
      cell: (t) => (
        <div>
          <p className="text-sm">{t.targetName || "Empresa"}</p>
          <p className="text-[11px] text-muted-foreground">
            {MARKETING_TARGET_LABEL[t.targetType ?? "empresa"]}
          </p>
        </div>
      ),
    },
    { key: "priority", header: "Prioridade", cell: (t) => <MarketingPriorityBadge priority={t.priority} /> },
    { key: "sector", header: "Setor", cell: (t) => t.sector },
    { key: "owner", header: "Responsável", cell: (t) => t.owner || "—" },
    { key: "deadline", header: "Prazo", cell: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.deadline)}</span> },
    {
      key: "actions",
      header: "Ações",
      headerClassName: "w-[1%] whitespace-nowrap text-right",
      className: "text-right",
      cell: (task) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da tarefa">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openViewModal(task)}>
              <Eye className="mr-2 h-4 w-4" /> Ver
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEditModal(task)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteTarget(task)}
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
    const input = toTaskInput(values);
    // Vínculo automático do WAV — exclusivo do contexto Projeto Musical: herda a
    // música de referência do projeto selecionado, sem upload manual.
    if (values.targetType === "projeto_musical") {
      const project = projects.find((p) => p.name === values.targetName);
      const referenceAudio = findProjectReferenceAudio(project);
      if (referenceAudio) input.referenceAudio = referenceAudio;
    }
    if (modalMode === "create") {
      createTask.mutate(input, { onSuccess: () => setModalOpen(false) });
      return;
    }
    if (modalMode === "edit" && selectedTask) {
      updateTask.mutate(
        { id: selectedTask.id, patch: input, expectedUpdatedAt: getExpectedUpdatedAt(selectedTask) },
        { onSuccess: () => setModalOpen(false) },
      );
    }
  };

  const modalCopy = MODAL_COPY[modalMode];
  const modalFields = useMemo(
    () => (modalMode === "create" ? taskCreateFields(targetOptions) : taskEditFields(targetOptions)).map((field) => {
      if (field.name === "targetType") return { ...field, options: marketingContextOptions };
      if (field.name === "sector") return { ...field, computeOptions: () => marketingSectorOptions };
      if (field.name === "type") return { ...field, computeOptions: () => marketingTaskTypeOptions };
      return field;
    }),
    [modalMode, targetOptions, marketingContextOptions, marketingSectorOptions, marketingTaskTypeOptions],
  );
  const modalInitialValues =
    modalMode === "create" || !selectedTask ? taskInitialValues() : taskToFormValues(selectedTask);

  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout
        title="Marketing · Tarefas"
        description="Núcleo operacional de tarefas"
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Tarefa
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TaskKpi label="Total de Tarefas" value={taskKpis.total} caption="demandas cadastradas" icon={ListChecks} />
            <TaskKpi label="Concluídas" value={taskKpis.concluidas} caption="finalizadas" icon={CheckCircle} tone="success" />
            <TaskKpi label="A Fazer" value={taskKpis.aFazer} caption="backlog e a fazer" icon={CalendarClock} tone="info" />
            <TaskKpi label="Em Andamento" value={taskKpis.emAndamento} caption="em execução" icon={MoreHorizontal} tone="warning" />
            <TaskKpi label="Revisão" value={taskKpis.revisao} caption="em revisão" icon={AlertTriangle} tone="danger" />
          </div>

          <MarketingFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar tarefa..."
            filters={[
              { value: typeFilter, onChange: setTypeFilter, placeholder: "Tipo", allLabel: "Todos os tipos", options: TASK_TYPE_OPTIONS },
            ]}
          />

          <MarketingDataTable
            title="Lista de Tarefas"
            description="Acompanhe tarefas, tipos, responsáveis, prazos e status"
            columns={columns}
            rows={pageItems}
            isLoading={isLoading}
            getRowKey={(t) => t.id}
            selection={{
              selectedIds: selectedTaskIds,
              onToggle: toggleTaskSelection,
              onToggleAll: toggleAllTaskSelection,
              onBulkDelete: bulkDeleteTasks,
            }}
            empty={
              <MarketingEmptyState
                icon={ListChecks}
                title="Nenhuma tarefa encontrada"
                description="Crie tarefas operacionais para organizar as demandas do marketing."
                actionLabel="Nova Tarefa"
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
                itemLabel="tarefas"
              />
            }
          />
        </div>

        <MarketingFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={modalCopy.title}
          description={modalCopy.description}
          fields={modalFields}
          initialValues={modalInitialValues}
          submitLabel={modalCopy.submitLabel}
          submitting={createTask.isPending || updateTask.isPending}
          extraContent={
            modalMode === "edit" && selectedTask ? (
              <MarketingDeliverableSection taskId={selectedTask.id} />
            ) : undefined
          }
          onSubmit={handleSubmit}
        />

        <TaskViewModal
          task={viewTask}
          onOpenChange={(open) => {
            if (!open) setViewTask(null);
          }}
          onEdit={(task) => {
            setViewTask(null);
            openEditModal(task);
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
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A tarefa
                {deleteTarget ? ` "${deleteTarget.title}"` : ""} será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removeTask.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  confirmDelete();
                }}
                disabled={removeTask.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeTask.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </FeatureGate>
  );
}

function TaskKpi({
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
  tone?: "primary" | "info" | "warning" | "success" | "danger";
}) {
  const accent = tone === "danger" ? "destructive" : tone === "info" ? "primary" : tone;
  return <MetricCard title={label} value={value} description={caption} icon={Icon} accent={accent} />;
}

function TaskViewModal({
  task,
  onOpenChange,
  onEdit,
}: {
  task: MarketingTask | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: MarketingTask) => void;
}) {
  const copywriting = useSkillRun<Record<string, unknown>>(`/marketing/tasks/${task?.id}/ai/copywriting`);

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl">{task.title}</DialogTitle>
              <DialogDescription>
                Detalhes operacionais da tarefa de marketing.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <MarketingPriorityBadge priority={task.priority} />
            <MarketingBadge tone="info">{TASK_TYPE_LABEL[task.type]}</MarketingBadge>
            <MarketingBadge tone="neutral">
              {MARKETING_TARGET_LABEL[task.targetType ?? "empresa"]}
            </MarketingBadge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnlyTile
              icon={UserRound}
              label="Responsável"
              value={task.owner || "Não informado"}
            />
            <ReadOnlyTile
              icon={ListChecks}
              label="Setor"
              value={task.sector || "Não informado"}
            />
            <ReadOnlyTile
              icon={CalendarClock}
              label="Prazo"
              value={formatDate(task.deadline)}
            />
            <ReadOnlyTile
              icon={Eye}
              label="Status"
              value={TASK_STATUS_LABEL[task.status]}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyBlock
              label="Contexto"
              value={task.targetName || "Empresa"}
              helper={MARKETING_TARGET_LABEL[task.targetType ?? "empresa"]}
            />
            <ReadOnlyBlock
              label="Classificação"
              value={TASK_TYPE_LABEL[task.type]}
              helper={`Prioridade: ${PRIORITY_LABEL[task.priority]}`}
            />
          </div>

          <ReadOnlyBlock
            label="Observações"
            value={task.description || "Nenhuma observação registrada."}
            multiline
          />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Música de Referência</h3>
            {task.referenceAudio ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Music className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.referenceAudio.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.referenceAudio.uploadedAt
                        ? `Enviado em ${formatDate(task.referenceAudio.uploadedAt)}`
                        : "Data de upload indisponível"}
                      {task.referenceAudio.uploadedBy ? ` · por ${task.referenceAudio.uploadedBy}` : ""}
                    </p>
                  </div>
                </div>
                <a
                  href={task.referenceAudio.url}
                  download={task.referenceAudio.fileName}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar Música de Referência
                </a>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm italic text-muted-foreground">
                Nenhuma música de referência disponível para esta tarefa.
              </p>
            )}
          </section>

          {task.checklist.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Checklist</h3>
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                {task.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className={item.done ? "text-emerald-600" : "text-muted-foreground"}>
                      {item.done ? "✓" : "○"}
                    </span>
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="border-t border-border pt-4">
            <MarketingDeliverableSection taskId={task.id} readOnly />
          </div>

          {/* ══ RASCUNHO DE COPY (AI Skill copywriting sobre o contexto real da tarefa) ══ */}
          <section className="space-y-2 border-t border-border pt-4" data-testid="task-view-copywriting">
            <h3 className="text-sm font-semibold">Rascunho de Copy (IA)</h3>
            <SkillRunPanel
              label="Gerar rascunho de copy"
              result={copywriting.result}
              isRunning={copywriting.isRunning}
              error={copywriting.error}
              onRun={() => copywriting.run(undefined)}
            />
          </section>
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
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium  tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function ReadOnlyBlock({
  label,
  value,
  helper,
  multiline = false,
}: {
  label: string;
  value: string;
  helper?: string;
  multiline?: boolean;
}) {
  return (
    <section className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <p className={multiline ? "whitespace-pre-wrap text-sm leading-relaxed" : "text-sm font-medium"}>
          {value}
        </p>
        {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
      </div>
    </section>
  );
}
