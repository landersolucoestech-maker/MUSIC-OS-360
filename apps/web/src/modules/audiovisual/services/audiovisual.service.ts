import { api } from "@/lib/api";
import type {
  AudiovisualProject, AudiovisualBriefing, AudiovisualDeliverable,
  AudiovisualApproval, AudiovisualDashboard,
  AudiovisualProjectType, AudiovisualProjectStatus, DeliverableType, ApprovalDecisionStatus,
  AudiovisualShot, AudiovisualProductionDay, AudiovisualTeamMember, TeamRole,
  AudiovisualTask, TaskStatus, TaskPriority,
  AudiovisualAsset, AssetKind,
} from "../types/audiovisual.types";

function q(params: Record<string, unknown> = {}): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const audiovisualService = {
  projects: {
    list: (p: { search?: string; status?: AudiovisualProjectStatus; type?: AudiovisualProjectType; artist_id?: string; release_id?: string; campaign_id?: string; event_id?: string; limit?: number; offset?: number } = {}) =>
      api.get<AudiovisualProject[]>(`/audiovisual/projects${q(p)}`),
    dashboard: (p: { from?: string; to?: string } = {}) =>
      api.get<AudiovisualDashboard>(`/audiovisual/projects/dashboard${q(p)}`),
    findById: (id: string) => api.get<AudiovisualProject>(`/audiovisual/projects/${id}`),
    create:   (data: Partial<AudiovisualProject>) => api.post<AudiovisualProject>("/audiovisual/projects", data),
    update:   (id: string, data: Partial<AudiovisualProject> & { expectedUpdatedAt?: string }) => api.patch<AudiovisualProject>(`/audiovisual/projects/${id}`, data),
    transition: (id: string, status: AudiovisualProjectStatus, reason?: string) =>
      api.post<AudiovisualProject>(`/audiovisual/projects/${id}/transition`, { status, reason }),
    delete:   (id: string) => api.delete(`/audiovisual/projects/${id}`),
  },

  briefings: {
    get:    (projectId: string) => api.get<AudiovisualBriefing | null>(`/audiovisual/projects/${projectId}/briefing`),
    upsert: (projectId: string, data: Partial<AudiovisualBriefing> & { expectedUpdatedAt?: string }) =>
      api.put<AudiovisualBriefing>(`/audiovisual/projects/${projectId}/briefing`, data),
  },

  deliverables: {
    list:     (p: { audiovisual_project_id?: string; status?: string; limit?: number; offset?: number } = {}) =>
      api.get<AudiovisualDeliverable[]>(`/audiovisual/deliverables${q(p)}`),
    findById: (id: string) => api.get<AudiovisualDeliverable>(`/audiovisual/deliverables/${id}`),
    create:   (projectId: string, data: { title: string; type: DeliverableType } & Partial<AudiovisualDeliverable>) =>
      api.post<AudiovisualDeliverable>(`/audiovisual/projects/${projectId}/deliverables`, data),
    seedDefaults: (projectId: string, project_type: string) =>
      api.post<AudiovisualDeliverable[]>(`/audiovisual/projects/${projectId}/deliverables/seed-defaults`, { project_type }),
    update:   (id: string, data: Partial<AudiovisualDeliverable> & { expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualDeliverable>(`/audiovisual/deliverables/${id}`, data),
    delete:   (id: string) => api.delete(`/audiovisual/deliverables/${id}`),
  },

  shots: {
    list:    (projectId: string) => api.get<AudiovisualShot[]>(`/audiovisual/projects/${projectId}/shots`),
    create:  (projectId: string, data: Partial<AudiovisualShot>) =>
      api.post<AudiovisualShot>(`/audiovisual/projects/${projectId}/shots`, data),
    update:  (id: string, data: Partial<AudiovisualShot> & { expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualShot>(`/audiovisual/shots/${id}`, data),
    reorder: (projectId: string, ids: string[]) =>
      api.post<{ reordered: number }>(`/audiovisual/projects/${projectId}/shots/reorder`, { ids }),
    delete:  (id: string) => api.delete(`/audiovisual/shots/${id}`),
  },

  productionDays: {
    list:   (projectId: string) => api.get<AudiovisualProductionDay[]>(`/audiovisual/projects/${projectId}/production-days`),
    create: (projectId: string, data: Partial<AudiovisualProductionDay> & { shooting_date: string }) =>
      api.post<AudiovisualProductionDay>(`/audiovisual/projects/${projectId}/production-days`, data),
    update: (id: string, data: Partial<AudiovisualProductionDay> & { expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualProductionDay>(`/audiovisual/production-days/${id}`, data),
    delete: (id: string) => api.delete(`/audiovisual/production-days/${id}`),
  },

  team: {
    list:   (projectId: string) => api.get<AudiovisualTeamMember[]>(`/audiovisual/projects/${projectId}/team`),
    create: (projectId: string, data: { role: TeamRole } & Partial<AudiovisualTeamMember>) =>
      api.post<AudiovisualTeamMember>(`/audiovisual/projects/${projectId}/team`, data),
    update: (id: string, data: Partial<AudiovisualTeamMember> & { expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualTeamMember>(`/audiovisual/team/${id}`, data),
    delete: (id: string) => api.delete(`/audiovisual/team/${id}`),
  },

  assets: {
    list:   (projectId: string, kind?: AssetKind) =>
      api.get<AudiovisualAsset[]>(`/audiovisual/projects/${projectId}/assets${kind ? `?kind=${kind}` : ""}`),
    create: (projectId: string, data: { name: string; file_url: string; kind?: AssetKind; thumbnail_url?: string; mime_type?: string; size_bytes?: number; description?: string; tags?: string[] }) =>
      api.post<AudiovisualAsset>(`/audiovisual/projects/${projectId}/assets`, data),
    update: (id: string, data: Partial<AudiovisualAsset> & { expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualAsset>(`/audiovisual/assets/${id}`, data),
    delete: (id: string) => api.delete(`/audiovisual/assets/${id}`),
  },

  tasks: {
    list:   (projectId: string) => api.get<AudiovisualTask[]>(`/audiovisual/projects/${projectId}/tasks`),
    create: (projectId: string, data: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigned_to?: string; due_date?: string }) =>
      api.post<AudiovisualTask>(`/audiovisual/projects/${projectId}/tasks`, data),
    update: (id: string, data: Partial<AudiovisualTask> & { status?: TaskStatus; priority?: TaskPriority; expectedUpdatedAt?: string }) =>
      api.patch<AudiovisualTask>(`/audiovisual/tasks/${id}`, data),
    delete: (id: string) => api.delete(`/audiovisual/tasks/${id}`),
  },

  approvals: {
    list:     (p: { audiovisual_project_id?: string; deliverable_id?: string; status?: ApprovalDecisionStatus; limit?: number; offset?: number } = {}) =>
      api.get<AudiovisualApproval[]>(`/audiovisual/approvals${q(p)}`),
    findById: (id: string) => api.get<AudiovisualApproval>(`/audiovisual/approvals/${id}`),
    request:  (projectId: string, data: { deliverable_id?: string; comments?: string }) =>
      api.post<AudiovisualApproval>(`/audiovisual/projects/${projectId}/approvals`, data),
    decide:   (id: string, status: ApprovalDecisionStatus, comments?: string, expectedUpdatedAt?: string) =>
      api.post<AudiovisualApproval>(`/audiovisual/approvals/${id}/decision`, { status, comments, expectedUpdatedAt }),
  },
};

