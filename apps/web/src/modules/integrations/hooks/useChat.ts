/**
 * integrations/hooks/useChat.ts
 *
 * Stub hook for the MusicChat integration (the platform's internal messages).
 *
 * CURRENT STATE: standalone — messages simulated with MOCK_DATA at /chat.
 * FUTURE MIGRATION:
 *   1. WebSocket backend (Socket.io) or SSE server
 *   2. Persistence in a multi-tenant database (isolation by tenant_id)
 *   3. Push notifications via the Web Push API
 *   4. File upload via R2 (use useR2 for attachments)
 *
 * MusicChat route: /chat
 * Contract: @/shared/integrations/contracts/chat.contract → IChatProvider
 */

import { useQuery } from "@tanstack/react-query";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";
import { disabledIntegration } from "@/shared/lib/disabled-integration";

// ─── MusicChat-specific types ─────────────────────────────────────────────────

export interface ChatStatus extends IntegrationRuntimeStatus {
  integration_id: "musicroomchat";
  websocket_url?: string | null;
  push_notifications_enabled: boolean;
  max_channels_per_tenant: number;
}

// ─── Hook de status ───────────────────────────────────────────────────────────

export function useChatStatus() {
  return useQuery<ChatStatus>({
    queryKey: ["integrations", "musicroomchat", "status"],
    queryFn: async (): Promise<ChatStatus> => ({
      integration_id: "musicroomchat",
      status: "disabled",
      connected: false,
      websocket_url: null,
      push_notifications_enabled: false,
      max_channels_per_tenant: 0,
      last_error: null,
      last_checked_at: new Date().toISOString(),
    }),
    staleTime: Infinity,
  });
}

// ─── Stubs desabilitados ──────────────────────────────────────────────────────

/**
 * FUTURE MIGRATION: connect to the MusicChat backend WebSocket/SSE.
 * In standalone mode: localStorage data replaces the real channel.
 */
export function useChatChannel() {
  return {
    messages: [],
    isLoading: false,
    sendMessage: (_text: string) => disabledIntegration("MusicChat"),
    sendAttachment: (_file: File) => disabledIntegration("MusicChat"),
  };
}

/**
 * FUTURE MIGRATION: list the channels available to the tenant.
 */
export function useChatChannels() {
  return {
    data: null,
    isLoading: false,
    createChannel: (_name: string) => disabledIntegration("MusicChat"),
  };
}

/**
 * FUTURE MIGRATION: subscribe to push notifications via the Web Push API.
 */
export function useChatNotifications() {
  return {
    unread_count: 0,
    isSubscribed: false,
    subscribe: () => disabledIntegration("MusicChat"),
    unsubscribe: () => disabledIntegration("MusicChat"),
  };
}
