import { useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { Button } from "@/shared/ui/button";
import { Plus, Film, ClipboardList, CalendarDays, PackageCheck, DollarSign } from "lucide-react";
import { useAudiovisualProjects, useAudiovisualProjectMutations } from "../hooks/useAudiovisual";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import type { AudiovisualProject } from "../types/audiovisual.types";
import {
  AudiovisualFilterBar,
  type AudiovisualProjectFilters,
} from "../components/AudiovisualFilterBar";
import { AudiovisualProductionTable } from "../components/AudiovisualProductionTable";
import { AudiovisualNewProjectModal } from "../modals/AudiovisualNewProjectModal";
import { AudiovisualProjectDetailsModal } from "../modals/AudiovisualProjectDetailsModal";
import { AudiovisualEditProjectModal } from "../modals/AudiovisualEditProjectModal";
import { AudiovisualConfirmDeleteModal } from "../modals/AudiovisualConfirmDeleteModal";

const initialFilters: AudiovisualProjectFilters = {
  music: "",
  artist: "",
  captureStatus: "",
  editingStatus: "",
  approvalStatus: "",
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getProjectValue(project: AudiovisualProject, keys: string[]) {
  const row = project as AudiovisualProject & Record<string, any>;

  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
}

function getArtistValue(project: AudiovisualProject) {
  const row = project as AudiovisualProject & Record<string, any>;
  return row.artist_name ?? row.artist?.name ?? row.artist ?? "";
}

function matchesTextFilter(value: unknown, filter: string) {
  const query = normalize(filter);
  if (!query) return true;
  return normalize(value).includes(query);
}


function projectMatchesFilters(project: AudiovisualProject, filters: AudiovisualProjectFilters) {
  const query = filters.music;
  return (
    (matchesTextFilter(
      getProjectValue(project, ["music_title", "musicTitle", "title", "name"]),
      query,
    ) ||
      matchesTextFilter(getArtistValue(project), query)) &&
    matchesTextFilter(
      getProjectValue(project, ["capture_status", "captureStatus", "captation_status", "captationStatus"]),
      filters.captureStatus,
    ) &&
    matchesTextFilter(
      getProjectValue(project, ["editing_status", "editingStatus", "edition_status", "editionStatus"]),
      filters.editingStatus,
    ) &&
    matchesTextFilter(
      getProjectValue(project, ["approval_status", "approvalStatus"]),
      filters.approvalStatus,
    )
  );
}

function KpiCards({ rows }: { rows: AudiovisualProject[] }) {
  const row = (p: AudiovisualProject) => p as AudiovisualProject & Record<string, any>;
  const total = rows.length;
  const emProducao = rows.filter((p) =>
    ["production", "post_production", "editing", "recording"].includes(
      String(row(p).status ?? row(p).final_status ?? row(p).editing_status ?? row(p).capture_status),
    ),
  ).length;
  const aguardando = rows.filter((p) =>
    ["pending", "review"].includes(String(row(p).approval_status)),
  ).length;
  const concluidas = rows.filter((p) =>
    ["finished", "published", "delivered", "approved"].includes(
      String(row(p).final_status ?? row(p).status ?? row(p).approval_status),
    ),
  ).length;
  const budget = rows.reduce((sum, p) => sum + (Number(row(p).budget_estimated ?? row(p).budget) || 0), 0);
  const cards = [
    { label: "Total de produções", value: String(total), icon: Film },
    { label: "Em produção", value: String(emProducao), icon: ClipboardList },
    { label: "Aguardando aprovação", value: String(aguardando), icon: CalendarDays },
    { label: "Concluídas", value: String(concluidas), icon: PackageCheck },
    {
      label: "Orçamento total",
      value: budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      icon: DollarSign,
    },
  ];
  return (
    <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{c.value}</p>
          </div>
        );
      })}
    </section>
  );
}

export function AudiovisualProjectsList() {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [viewProject, setViewProject] = useState<AudiovisualProject | null>(null);
  const [editProject, setEditProject] = useState<AudiovisualProject | null>(null);
  const [deleteProject, setDeleteProject] = useState<AudiovisualProject | null>(null);
  const [filters, setFilters] = useState<AudiovisualProjectFilters>(initialFilters);

  const { data, isLoading, error } = useAudiovisualProjects();
  const mutations = useAudiovisualProjectMutations();

  const projects = useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => projectMatchesFilters(project, filters));
  }, [projects, filters]);

  const handleUpdate = (payload: Partial<AudiovisualProject>) => {
    if (!editProject) return;
    mutations.update.mutate(
      { id: editProject.id, data: { ...payload, expectedUpdatedAt: getExpectedUpdatedAt(editProject) } },
      { onSuccess: () => setEditProject(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteProject) return;
    mutations.remove.mutate(deleteProject.id);
    setDeleteProject(null);
  };

  const handleBulkDelete = async (ids: string[]) => {
    setViewProject((current) => (current && ids.includes(current.id) ? null : current));
    setEditProject((current) => (current && ids.includes(current.id) ? null : current));
    setDeleteProject((current) => (current && ids.includes(current.id) ? null : current));
    const result = await runBulkAction(ids, (id) => mutations.remove.mutateAsync(id));
    reportBulkResult(result, "excluída", "produção");
  };

  return (
    <MainLayout
      title="Produção Audiovisual"
      description="Gerencie todas as produções de vídeo da sua operação."
      actions={
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setIsNewOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Nova Produção
        </Button>
      }
    >
      <div className="text-foreground">
        {isLoading && (
          <p className="mb-4 text-sm text-muted-foreground">Carregando produções audiovisuais…</p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            Não foi possível carregar as produções audiovisuais.
          </p>
        )}
        <div className="space-y-6">
          <KpiCards rows={filteredProjects} />

          <AudiovisualFilterBar
            filters={filters}
            onFiltersChange={setFilters}
          />

          <AudiovisualProductionTable
            projects={filteredProjects}
            selectedId={viewProject?.id ?? editProject?.id ?? deleteProject?.id}
            onSelect={setViewProject}
            onView={setViewProject}
            onEdit={setEditProject}
            onDelete={setDeleteProject}
            onBulkDelete={handleBulkDelete}
          />
        </div>

        <AudiovisualNewProjectModal
          open={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          onCreate={(payload) => mutations.create.mutate(payload, { onSuccess: () => setIsNewOpen(false) })}
        />
        <AudiovisualProjectDetailsModal
          open={!!viewProject}
          project={viewProject}
          onClose={() => setViewProject(null)}
          onEdit={() => {
            setEditProject(viewProject);
            setViewProject(null);
          }}
        />
        <AudiovisualEditProjectModal
          open={!!editProject}
          project={editProject}
          onClose={() => setEditProject(null)}
          onUpdate={handleUpdate}
        />
        <AudiovisualConfirmDeleteModal
          open={!!deleteProject}
          project={deleteProject}
          onClose={() => setDeleteProject(null)}
          onConfirm={handleDelete}
        />
      </div>
    </MainLayout>
  );
}

export default AudiovisualProjectsList;


