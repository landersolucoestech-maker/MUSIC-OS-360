/**
 * services/internal-chat.service.ts
 *
 * Internal Chat (team <-> team) — real client for the backend
 * `/internal-chat` (apps/api/src/modules/internal-chat). Isolated from the Support
 * Center: its own entity, endpoint and participant identity
 * (auth_user_id, no phone/external channel).
 */
import { api } from "@/shared/lib/api-client";

export type InternalConversationType = "direct" | "group";

export interface InternalParticipant {
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  last_read_at: string | null;
}

export interface InternalConversation {
  id: string;
  tenant_id: string;
  org_id: string;
  type: InternalConversationType;
  name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: InternalParticipant[];
}

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_auth_user_id: string;
  body: string;
  attachments: unknown[];
  created_at: string;
  edited_at: string | null;
}

export interface InternalMember {
  auth_user_id: string;
  full_name: string | null;
  email: string;
}

export const internalChatService = {
  async listConversations(): Promise<InternalConversation[]> {
    return api.get<InternalConversation[]>("/internal-chat/conversations");
  },

  async getConversation(id: string): Promise<InternalConversation> {
    return api.get<InternalConversation>(`/internal-chat/conversations/${id}`);
  },

  async createConversation(input: {
    type: InternalConversationType;
    name?: string;
    participantAuthUserIds: string[];
  }, idempotencyKey: string = crypto.randomUUID()): Promise<InternalConversation> {
    return api.post<InternalConversation>("/internal-chat/conversations", input, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
  },

  async listMessages(conversationId: string): Promise<InternalMessage[]> {
    return api.get<InternalMessage[]>(`/internal-chat/conversations/${conversationId}/messages`);
  },

  async sendMessage(
    conversationId: string,
    body: string,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<InternalMessage> {
    return api.post<InternalMessage>(
      `/internal-chat/conversations/${conversationId}/messages`,
      { body },
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );
  },

  async markRead(conversationId: string): Promise<void> {
    await api.post(`/internal-chat/conversations/${conversationId}/read`, {});
  },

  async searchMembers(search?: string): Promise<InternalMember[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return api.get<InternalMember[]>(`/internal-chat/members${query}`);
  },
};
