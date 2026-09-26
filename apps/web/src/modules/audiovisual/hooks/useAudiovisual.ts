import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { audiovisualService } from "../services/audiovisual.service";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type {
  AudiovisualProject, AudiovisualProjectStatus, AudiovisualProjectType,
  DeliverableType, ApprovalStatus,
} from "../types/audiovisual.types";

import { toUserMessage } from "@/shared/lib/errors";
const K = {
  projects:    (params?: Record<string, unknown>) => ["audiovisual", "projects", params ?? {}] as const,
  project:     (id: string) => ["audiovisual", "projects", id] as const,
  dashboard:   (params?: Record<string, unknown>) => ["audiovisual", "dashboard", params ?? {}] as const,
  briefing:    (projectId: string) => ["audiovisual", "briefing", projectId] as const,
  deliverables:(projectId?: string) => ["audiovisual", "deliverables", projectId ?? "all"] as const,
  approvals:   (projectId?: string) => ["audiovisual", "approvals", projectId ?? "all"] as const,
};

export function useAudiovisualDashboard(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: K.dashboard(params),
    queryFn:  () => audiovisualService.projects.dashboard(params),
  });
}

export function useAudiovisualProjects(params: {
  search?: string; status?: AudiovisualProjectStatus; type?: AudiovisualProjectType;
  artist_id?: string; release_id?: string; campaign_id?: string; event_id?: string;
} = {}) {
  return useQuery({
    queryKey: K.projects(params),
    queryFn:  () => audiovisualService.projects.list({ ...params, limit: 200 }),
  });
}

export function useAudiovisualProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? K.project(id) : ["audiovisual", "projects", "none"],
    queryFn:  () => audiovisualService.projects.findById(id!),
    enabled:  !!id,
  });
}

export function useAudiovisualProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual"] });
  return {
    create: useMutation({
      mutationFn: audiovisualService.projects.create,
      onSuccess: () => { invalidate(); toast.success("Projeto criado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<AudiovisualProject> & { expectedUpdatedAt?: string } }) =>
        audiovisualService.projects.update(id, data),
      onSuccess: () => { invalidate(); toast.success("Projeto atualizado"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "projeto")) return;
        toast.error(toUserMessage(e));
      },
    }),
    transition: useMutation({
      mutationFn: ({ id, status, reason }: { id: string; status: AudiovisualProjectStatus; reason?: string }) =>
        audiovisualService.projects.transition(id, status, reason),
      onSuccess: () => { invalidate(); toast.success("Status atualizado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.projects.delete(id),
      onSuccess: () => { invalidate(); toast.success("Projeto removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

export function useBriefing(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? K.briefing(projectId) : ["audiovisual", "briefing", "none"],
    queryFn:  () => audiovisualService.briefings.get(projectId!),
    enabled:  !!projectId,
  });
}

export function useBriefingUpsert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Parameters<typeof audiovisualService.briefings.upsert>[1] }) =>
      audiovisualService.briefings.upsert(projectId, data),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: K.briefing(vars.projectId) }); toast.success("Briefing salvo"); },
    onError: (e: Error) => {
      if (handleConcurrencyConflict(e, "briefing")) return;
      toast.error(toUserMessage(e));
    },
  });
}

export function useDeliverables(projectId: string | undefined) {
  return useQuery({
    queryKey: K.deliverables(projectId),
    queryFn:  () => audiovisualService.deliverables.list({ audiovisual_project_id: projectId, limit: 200 }),
    enabled:  !!projectId,
  });
}

export function useDeliverableMutations(projectId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "deliverables"] });
  return {
    create: useMutation({
      mutationFn: ({ projectId: pid, data }: { projectId: string; data: { title: string; type: DeliverableType } }) =>
        audiovisualService.deliverables.create(pid, data),
      onSuccess: () => { invalidate(); toast.success("Entregável criado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.deliverables.update>[1] }) =>
        audiovisualService.deliverables.update(id, data),
      onSuccess: () => { invalidate(); toast.success("Entregável atualizado"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "entregável")) return;
        toast.error(toUserMessage(e));
      },
    }),
    seedDefaults: useMutation({
      mutationFn: ({ pid, type }: { pid: string; type: string }) =>
        audiovisualService.deliverables.seedDefaults(pid, type),
      onSuccess: () => { invalidate(); toast.success("Entregáveis padrão criados"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.deliverables.delete(id),
      onSuccess: () => { invalidate(); toast.success("Entregável removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

export function useApprovals(projectId: string | undefined) {
  return useQuery({
    queryKey: K.approvals(projectId),
    queryFn:  () => audiovisualService.approvals.list({ audiovisual_project_id: projectId, limit: 200 }),
    enabled:  !!projectId,
  });
}

// ── Shots ────────────────────────────────────────────────────────────────────
export function useShots(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ["audiovisual", "shots", projectId] : ["audiovisual", "shots", "none"],
    queryFn:  () => audiovisualService.shots.list(projectId!),
    enabled:  !!projectId,
  });
}

export function useShotMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "shots", projectId] });
  return {
    create: useMutation({
      mutationFn: (data: Parameters<typeof audiovisualService.shots.create>[1]) =>
        audiovisualService.shots.create(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Shot adicionado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.shots.update>[1] }) =>
        audiovisualService.shots.update(id, data),
      onSuccess: () => { invalidate(); toast.success("Shot atualizado"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "shot")) return;
        toast.error(toUserMessage(e));
      },
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => audiovisualService.shots.reorder(projectId, ids),
      onSuccess: () => { invalidate(); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.shots.delete(id),
      onSuccess: () => { invalidate(); toast.success("Shot removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

// ── Production Days ──────────────────────────────────────────────────────────
export function useProductionDays(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ["audiovisual", "production-days", projectId] : ["audiovisual", "production-days", "none"],
    queryFn:  () => audiovisualService.productionDays.list(projectId!),
    enabled:  !!projectId,
  });
}

export function useProductionDayMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "production-days", projectId] });
  return {
    create: useMutation({
      mutationFn: (data: Parameters<typeof audiovisualService.productionDays.create>[1]) =>
        audiovisualService.productionDays.create(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Dia de gravação agendado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.productionDays.update>[1] }) =>
        audiovisualService.productionDays.update(id, data),
      onSuccess: () => { invalidate(); toast.success("Dia atualizado"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "dia de gravação")) return;
        toast.error(toUserMessage(e));
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.productionDays.delete(id),
      onSuccess: () => { invalidate(); toast.success("Dia removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

// ── Team Members ─────────────────────────────────────────────────────────────
export function useTeamMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ["audiovisual", "team", projectId] : ["audiovisual", "team", "none"],
    queryFn:  () => audiovisualService.team.list(projectId!),
    enabled:  !!projectId,
  });
}

export function useTeamMemberMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "team", projectId] });
  return {
    create: useMutation({
      mutationFn: (data: Parameters<typeof audiovisualService.team.create>[1]) =>
        audiovisualService.team.create(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Membro adicionado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.team.update>[1] }) =>
        audiovisualService.team.update(id, data),
      onSuccess: () => { invalidate(); toast.success("Membro atualizado"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "membro da equipe")) return;
        toast.error(toUserMessage(e));
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.team.delete(id),
      onSuccess: () => { invalidate(); toast.success("Membro removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

// ── Assets / Files ───────────────────────────────────────────────────────────
export function useAssets(projectId: string | undefined, kind?: import("../types/audiovisual.types").AssetKind) {
  return useQuery({
    queryKey: projectId ? ["audiovisual", "assets", projectId, kind ?? "all"] : ["audiovisual", "assets", "none"],
    queryFn:  () => audiovisualService.assets.list(projectId!, kind),
    enabled:  !!projectId,
  });
}

export function useAssetMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "assets", projectId] });
  return {
    create: useMutation({
      mutationFn: (data: Parameters<typeof audiovisualService.assets.create>[1]) =>
        audiovisualService.assets.create(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Arquivo registrado"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.assets.update>[1] }) =>
        audiovisualService.assets.update(id, data),
      onSuccess: () => { invalidate(); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "arquivo")) return;
        toast.error(toUserMessage(e));
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.assets.delete(id),
      onSuccess: () => { invalidate(); toast.success("Arquivo removido"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ["audiovisual", "tasks", projectId] : ["audiovisual", "tasks", "none"],
    queryFn:  () => audiovisualService.tasks.list(projectId!),
    enabled:  !!projectId,
  });
}

export function useTaskMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "tasks", projectId] });
  return {
    create: useMutation({
      mutationFn: (data: Parameters<typeof audiovisualService.tasks.create>[1]) =>
        audiovisualService.tasks.create(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Tarefa criada"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof audiovisualService.tasks.update>[1] }) =>
        audiovisualService.tasks.update(id, data),
      onSuccess: () => { invalidate(); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "tarefa")) return;
        toast.error(toUserMessage(e));
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => audiovisualService.tasks.delete(id),
      onSuccess: () => { invalidate(); toast.success("Tarefa removida"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
  };
}

export function useApprovalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["audiovisual", "approvals"] });
  return {
    request: useMutation({
      mutationFn: ({ projectId, data }: { projectId: string; data: { deliverable_id?: string; comments?: string } }) =>
        audiovisualService.approvals.request(projectId, data),
      onSuccess: () => { invalidate(); toast.success("Aprovação solicitada"); },
      onError:   (e: Error) => toast.error(toUserMessage(e)),
    }),
    decide: useMutation({
      mutationFn: ({ id, status, comments, expectedUpdatedAt }: { id: string; status: ApprovalStatus; comments?: string; expectedUpdatedAt?: string }) =>
        audiovisualService.approvals.decide(id, status, comments, expectedUpdatedAt),
      onSuccess: () => { invalidate(); toast.success("Decisão registrada"); },
      onError:   (e: Error) => {
        if (handleConcurrencyConflict(e, "aprovação")) return;
        toast.error(toUserMessage(e));
      },
    }),
  };
}

