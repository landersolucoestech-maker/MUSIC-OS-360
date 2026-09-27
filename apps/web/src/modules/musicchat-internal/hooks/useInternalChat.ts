import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { internalChatService } from "../services/internal-chat.service";
import { useWsEvent } from "@/shared/hooks/useWsEvent";

import { toUserMessage } from "@/shared/lib/errors";
const CONVERSATIONS_KEY = ["internal-chat", "conversations"] as const;
const messagesKey = (conversationId: string) => ["internal-chat", "messages", conversationId] as const;

export function useInternalConversations() {
  const queryClient = useQueryClient();
  const conversationsQuery = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => internalChatService.listConversations(),
  });

  useWsEvent("internalConversation:created", () => {
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
  });
  useWsEvent("internalConversation:message", (data) => {
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: messagesKey(data.conversationId) });
  });

  const createConversation = useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: Parameters<typeof internalChatService.createConversation>[0]; idempotencyKey: string }) =>
      internalChatService.createConversation(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
    onError: (error: Error) => toast.error(toUserMessage(error, "Não foi possível criar a conversa.")),
  });

  return {
    conversations: conversationsQuery.data ?? [],
    isLoading: conversationsQuery.isLoading,
    isError: conversationsQuery.isError,
    createConversation,
  };
}

export function useInternalMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    queryKey: conversationId ? messagesKey(conversationId) : ["internal-chat", "messages", "none"],
    queryFn: () => internalChatService.listMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  const sendMessage = useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: string; idempotencyKey: string }) =>
      internalChatService.sendMessage(conversationId!, body, idempotencyKey),
    onSuccess: () => {
      if (conversationId) void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
    onError: (error: Error) => toast.error(toUserMessage(error, "Não foi possível enviar a mensagem.")),
  });

  const markRead = useMutation({
    mutationFn: () => internalChatService.markRead(conversationId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    sendMessage,
    markRead,
  };
}

export function useInternalMemberSearch(search: string) {
  return useQuery({
    queryKey: ["internal-chat", "members", search] as const,
    queryFn: () => internalChatService.searchMembers(search || undefined),
  });
}
