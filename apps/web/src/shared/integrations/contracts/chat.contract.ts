/**
 * shared/integrations/contracts/chat.contract.ts
 *
 * Internal communication contract — MusicChat.
 *
 * CURRENT STATE: the /chat route exists; communication is mocked (no real time).
 * FUTURE MIGRATION: IChatProvider implemented via WebSocket / SSE or a
 *   dedicated service (e.g. Stream Chat, Supabase Realtime, Pusher).
 *
 * MusicChat entities aligned with the product domains:
 *   - Channels per project, artist, department
 *   - Mentions of system entities (work, contract, release)
 *   - Internal notifications
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type ChannelType =
  | "direct"        // DM between two users
  | "group"         // ad-hoc group
  | "project"       // channel associated with a Project
  | "artist"        // channel associated with an artist
  | "department"    // department channel (Marketing, HR, etc.)
  | "general";      // canal geral do tenant

export type MessageType =
  | "text"
  | "file"
  | "image"
  | "audio"
  | "entity_ref"    // reference to a system entity
  | "notification"  // system-generated notification
  | "event";        // channel event (member added, etc.)

/**
 * Reference to a MUSIC OS 360 domain entity.
 * Lets messages link to works, contracts, releases, etc.
 */
export interface EntityReference {
  entity_type:
    | "obra"
    | "fonograma"
    | "artista"
    | "contrato"
    | "lancamento"
    | "projeto"
    | "transacao"
    | "campanha";
  entity_id: string;
  entity_label: string;
  entity_url?: string;
}

export interface ChatAttachment {
  id: string;
  filename: string;
  url: string;
  content_type: string;
  size_bytes: number;
}

export interface ChatMember {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  role: "owner" | "admin" | "member";
  joined_at: string;
  last_seen_at?: string | null;
}

export interface ChatChannel {
  id: string;
  tenant_id: string;
  type: ChannelType;
  name: string;
  description?: string | null;
  /** ID of the linked entity (project, artist, etc.) */
  entity_id?: string | null;
  members: ChatMember[];
  unread_count: number;
  last_message?: ChatMessage | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null;
  type: MessageType;
  text?: string | null;
  attachments?: ChatAttachment[];
  entity_ref?: EntityReference | null;
  /** IDs of users mentioned with @ */
  mentions?: string[];
  /** Message this one replies to (thread) */
  reply_to?: string | null;
  reactions?: Record<string, string[]>;  // emoji → user_ids
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  is_edited: boolean;
  is_deleted: boolean;
}

export interface SendMessageParams {
  channel_id: string;
  text?: string;
  type?: MessageType;
  attachments?: File[];
  entity_ref?: EntityReference;
  mentions?: string[];
  reply_to?: string;
}

export interface CreateChannelParams {
  type: ChannelType;
  name: string;
  description?: string;
  member_ids: string[];
  entity_id?: string;
}

export interface ChatNotification {
  id: string;
  type: "mention" | "reply" | "channel_invite" | "system";
  channel_id: string;
  message_id?: string;
  sender_id?: string;
  text: string;
  read: boolean;
  created_at: string;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * IChatProvider — internal communication contract.
 *
 * Planned implementations:
 *   - MockChatProvider        (standalone — localStorage + MOCK_DATA)
 *   - RealtimeChatProvider    (production — WebSocket or SSE)
 */
export interface IChatProvider {
  // ── Channels ────────────────────────────────────────────────────────────────
  listChannels(): Promise<ChatChannel[]>;
  getChannel(channelId: string): Promise<ChatChannel>;
  createChannel(params: CreateChannelParams): Promise<ChatChannel>;
  archiveChannel(channelId: string): Promise<void>;
  addMember(channelId: string, userId: string): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;

  // ── Messages ─────────────────────────────────────────────────────────────
  listMessages(channelId: string, params?: { before?: string; limit?: number }): Promise<ChatMessage[]>;
  sendMessage(params: SendMessageParams): Promise<ChatMessage>;
  editMessage(messageId: string, text: string): Promise<ChatMessage>;
  deleteMessage(messageId: string): Promise<void>;

  // ── Reactions ─────────────────────────────────────────────────────────────
  addReaction(messageId: string, emoji: string): Promise<void>;
  removeReaction(messageId: string, emoji: string): Promise<void>;

  // ── Notifications ─────────────────────────────────────────────────────────
  listNotifications(): Promise<ChatNotification[]>;
  markNotificationRead(notificationId: string): Promise<void>;
  markChannelRead(channelId: string): Promise<void>;

  // ── Tempo real ────────────────────────────────────────────────────────────
  /** Subscribes to new events on a channel. Returns an unsubscribe function. */
  subscribe(channelId: string, handler: (message: ChatMessage) => void): () => void;
}

