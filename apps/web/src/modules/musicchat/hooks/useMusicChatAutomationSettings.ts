import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { musicChatAutomationService } from "../services/musicchat-automation.service";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { MusicChatAutomationSettings } from "../types/musicchat-automation.types";
import { useTenant } from "@/app/providers/TenantContext";

import { toUserMessage } from "@/shared/lib/errors";
/** Prefix of every tenant's settings key (invalidate with this). */
export const MUSICCHAT_AUTOMATION_SETTINGS_KEY = ["musicchat", "automation", "settings"] as const;

/** Settings are per tenant: the key carries the tenant id so a tenant switch never reads another tenant's cache. */
export function musicChatAutomationSettingsKey(tenantId: string | null | undefined) {
  return [...MUSICCHAT_AUTOMATION_SETTINGS_KEY, tenantId ?? null] as const;
}

export function useMusicChatAutomationSettings() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const settingsKey = musicChatAutomationSettingsKey(tenant?.id);
  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => musicChatAutomationService.getSettings(),
    enabled: !!tenant?.id,
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Partial<MusicChatAutomationSettings> & { expectedUpdatedAt?: string }) => musicChatAutomationService.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data);
      toast.success("Configurações do MusicChat salvas");
    },
    onError: (error: Error) => {
      if (handleConcurrencyConflict(error, "configuração do MusicChat")) return;
      toast.error(toUserMessage(error));
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    isError: settingsQuery.isError,
    error: settingsQuery.error,
    refetch: settingsQuery.refetch,
    updateSettings,
  };
}
