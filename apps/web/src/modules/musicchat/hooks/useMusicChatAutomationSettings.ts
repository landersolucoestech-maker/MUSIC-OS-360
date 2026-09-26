import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { musicChatAutomationService } from "../services/musicchat-automation.service";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import type { MusicChatAutomationSettings } from "../types/musicchat-automation.types";

import { toUserMessage } from "@/shared/lib/errors";
export const MUSICCHAT_AUTOMATION_SETTINGS_KEY = ["musicchat", "automation", "settings"] as const;

export function useMusicChatAutomationSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: MUSICCHAT_AUTOMATION_SETTINGS_KEY,
    queryFn: () => musicChatAutomationService.getSettings(),
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Partial<MusicChatAutomationSettings> & { expectedUpdatedAt?: string }) => musicChatAutomationService.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(MUSICCHAT_AUTOMATION_SETTINGS_KEY, data);
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
