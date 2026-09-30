import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateMonitoringProjectInput,
  FingerprintInput,
  FingerprintResult,
  MonitoringAlert,
  MonitoringProject,
  MusicSearchResult,
  PlayReport,
  PlayReportQuery,
  PlayReportSummary,
} from "@/modules/integrations/dto";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";

import { UserFacingError, toUserMessage } from "@/shared/lib/errors";
import { resolveApiUserMessage } from "@/shared/lib/api-client";
import { DisabledIntegrationError } from "@/shared/lib/disabled-integration";

export interface ACRCloudStatus extends IntegrationRuntimeStatus {
  integration_id: "acrcloud";
  plan?: string | null;
  quota_remaining?: number | null;
}

function unwrapApiResponse<T>(payload: unknown): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function callAcrcloudApi<T>(
  endpoint: "recognize" | "copyright" | "catalog" | "monitor",
  payload: Record<string, unknown>,
): Promise<T> {
  const apiPath = endpoint === "recognize"
    ? "/api/v1/integrations/acrcloud/recognize"
    : null;

  if (!apiPath) {
    throw new UserFacingError(`ACRCloud endpoint not implemented in the backend: ${endpoint}`, "O reconhecimento de áudio (ACRCloud) ainda não está disponível.");
  }

  const res = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch((): { error?: string; message?: unknown } => ({}));
    throw new UserFacingError(
      `ACRCloud request failed (HTTP ${res.status})${err.error ? `: ${err.error}` : ""}`,
      resolveApiUserMessage(res.status, err),
    );
  }

  return unwrapApiResponse<T>(await res.json());
}

function notImplemented<T>(capability: string): Promise<T> {
  return Promise.reject(new DisabledIntegrationError("ACRCloud", `${capability} is not implemented by the API`));
}

export function useACRCloudStatus() {
  return useQuery<ACRCloudStatus>({
    queryKey: ["integrations", "acrcloud", "status"],
    queryFn: async (): Promise<ACRCloudStatus> => ({
      integration_id: "acrcloud",
      status: "disconnected",
      connected: false,
      plan: null,
      quota_remaining: null,
      last_error: "ACRCloud status is not implemented by the API",
      last_checked_at: new Date().toISOString(),
    }),
    staleTime: 60_000,
  });
}

export function useACRCloudIdentify() {
  return useMutation<FingerprintResult, Error, FingerprintInput>({
    mutationFn: (input) => callAcrcloudApi("recognize", { input }),
    onSuccess: (data) => {
      if (data.matched && data.best_match) {
        toast.success(
          `Musica identificada: "${data.best_match.title}" - ${data.best_match.artista} (${data.best_match.score}% confiança)`,
        );
      } else {
        toast.info("Nenhuma correspondência encontrada para o trecho de áudio.");
      }
    },
    onError: (err) => {
      toast.error(`Erro na identificação: ${toUserMessage(err)}`);
    },
  });
}

export function useACRCloudPlayReports(query: PlayReportQuery, enabled = true) {
  return useQuery<PlayReport[]>({
    queryKey: ["acrcloud", "play-reports", query],
    queryFn: () => notImplemented("play reports"),
    enabled,
    staleTime: 60_000,
  });
}

export function useACRCloudPlaySummary(query: PlayReportQuery, enabled = true) {
  return useQuery<PlayReportSummary>({
    queryKey: ["acrcloud", "play-summary", query],
    queryFn: () => notImplemented("play summary"),
    enabled,
    staleTime: 60_000,
  });
}

export function useACRCloudAlerts(options?: { unacknowledged_only?: boolean; limit?: number }) {
  return useQuery<MonitoringAlert[]>({
    queryKey: ["acrcloud", "alerts", options],
    queryFn: () => notImplemented("alerts"),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useACRCloudAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (_alertId) => notImplemented("alert acknowledgement"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acrcloud", "alerts"] });
      toast.success("Alerta marcado como lido.");
    },
    onError: (err) => {
      toast.error(toUserMessage(err));
    },
  });
}

export function useACRCloudSearch(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery<MusicSearchResult[]>({
    queryKey: ["acrcloud", "search", trimmed],
    queryFn: () => notImplemented("search"),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useACRCloudProjects() {
  return useQuery<MonitoringProject[]>({
    queryKey: ["acrcloud", "projects"],
    queryFn: () => notImplemented("projects"),
    staleTime: 60_000,
  });
}

export function useACRCloudCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<MonitoringProject, Error, CreateMonitoringProjectInput>({
    mutationFn: (_input) => notImplemented("project creation"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["acrcloud", "projects"] });
      toast.success(`Projeto "${data.name}" criado com sucesso.`);
    },
    onError: (err) => {
      toast.error(`Erro ao criar projeto: ${toUserMessage(err)}`);
    },
  });
}

export function useACRCloudToggleProject() {
  const queryClient = useQueryClient();
  return useMutation<MonitoringProject, Error, { projectId: string; active: boolean }>({
    mutationFn: (_input) => notImplemented("project toggle"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["acrcloud", "projects"] });
      toast.success(`Projeto "${data.name}" ${data.active ? "ativado" : "pausado"}.`);
    },
    onError: (err) => {
      toast.error(toUserMessage(err));
    },
  });
}

export function useACRCloudCheckCopyright() {
  return useMutation<{ protected: boolean; rights_holders: { name: string; share: number }[] }, Error, { isrc?: string; title?: string; artist?: string }>({
    mutationFn: (input) => callAcrcloudApi("copyright", input),
    onSuccess: (data) => {
      if (data.protected) {
        toast.info(`Obra protegida. Detentores: ${data.rights_holders.map((r) => r.name).join(", ")}.`);
      } else {
        toast.success("Obra sem restrições de copyright identificadas.");
      }
    },
    onError: (err) => {
      toast.error(`Erro na verificação: ${toUserMessage(err)}`);
    },
  });
}

export function useACRCloudMonitorTrack() {
  return useMutation<{ job_id: string; status: string }, Error, { isrc?: string; title: string; artist: string }>({
    mutationFn: (input) => callAcrcloudApi("monitor", input),
    onSuccess: (data) => {
      toast.success("Monitoramento ativo.");
    },
    onError: (err) => {
      toast.error(`Erro ao iniciar monitoramento: ${toUserMessage(err)}`);
    },
  });
}
