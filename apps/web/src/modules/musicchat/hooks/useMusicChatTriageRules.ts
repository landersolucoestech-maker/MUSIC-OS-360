import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUSICCHAT_AUTOMATION_SETTINGS_KEY } from "./useMusicChatAutomationSettings";
import { musicChatAutomationService } from "../services/musicchat-automation.service";
import type { MusicChatInboundMessagePayload } from "../types/musicchat-automation.types";

import { toUserMessage } from "@/shared/lib/errors";
export function useMusicChatTriageRules(conversationId?: string) {
  const queryClient = useQueryClient();
  const eventsQuery = useQuery({
    queryKey: ["musicchat", "automation", "events", conversationId ?? "all"],
    queryFn: () => musicChatAutomationService.listEvents(conversationId),
  });

  const processInbound = useMutation({
    mutationFn: (payload: MusicChatInboundMessagePayload) => musicChatAutomationService.processInbound(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["musicchat", "automation", "events"] });
      void queryClient.invalidateQueries({ queryKey: MUSICCHAT_AUTOMATION_SETTINGS_KEY });
    },
    onError: (error: Error) => toast.error(toUserMessage(error)),
  });

  const runEscalations = useMutation({
    mutationFn: (id?: string) => musicChatAutomationService.runEscalations(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["musicchat", "automation", "events"] });
      toast.success(`${result.notifications.length} notificação(ões) de escalonamento gerada(s)`);
    },
    onError: (error: Error) => toast.error(toUserMessage(error)),
  });

  return {
    events: eventsQuery.data ?? [],
    isLoadingEvents: eventsQuery.isLoading,
    processInbound,
    runEscalations,
  };
}
