import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";
import { DisabledIntegrationError } from "@/shared/lib/disabled-integration";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * Decision Gate item 9 (GAP-15): Autentique has a real backend
 * (`GET /integrations/status`, `POST /integrations/autentique/configure`,
 * `POST /integrations/autentique/documents` — apps/api/.../autentique/*).
 * There is no real "disconnect" endpoint nor rich status fields
 * (has_token/has_global_fallback/last_sync_at/last_error) — the mapping
 * below only fills what is real; the rest stays undefined on purpose
 * (AutentiqueConfigDialog already treats those fields as optional).
 */
export interface AutentiqueStatus {
  connected: boolean;
  status?: string;
  has_token?: boolean;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
}

interface IntegrationsStatusResponse {
  autentique?: { configured: boolean };
}

export function useAutentiqueStatus() {
  return useQuery<AutentiqueStatus>({
    queryKey: ["autentique", "status"] as const,
    queryFn: async () => {
      const res = await api.get<IntegrationsStatusResponse>("/integrations/status");
      return { connected: res.autentique?.configured ?? false };
    },
    staleTime: 30_000,
  });
}

export function useAutentiqueSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string }) =>
      api.post("/integrations/autentique/configure", { apiToken: input.token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autentique", "status"] });
      toast.success("Autentique conectado com sucesso!");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

/** No real disconnect endpoint — never fabricate success. */
export function useAutentiqueDeleteCredentials() {
  return useMutation({
    mutationFn: async () => Promise.reject(new DisabledIntegrationError("Autentique", "disconnect is not implemented by the API")),
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}
