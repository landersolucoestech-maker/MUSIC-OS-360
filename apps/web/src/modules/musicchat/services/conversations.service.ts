/**
 * services/conversations.service.ts
 *
 * MusicChat Inbox (product decision 2026-08-22): real client for the
 * existing backend `/conversations` (ConversationsController/Service,
 * apps/api/src/modules/conversations). Maps the real entity
 * (tenant/status/channel/metadata) to the existing UI model in
 * shared/pages/MusicChat.tsx (SupportConversation/SupportMessage) — that
 * component was already done; only this service was missing.
 *
 * Fields with no real source on the backend (unread count, SLA/deadline, CRM
 * summary beyond contact_id, per-message protocol) get
 * a neutral, documented default — never a fabricated/variable value.
 */
import { api } from "@/shared/lib/api-client";
import type { ChatAttachmentData } from "@/shared/components/ChatAttachment";

export type BackendConversationStatus = "open" | "pending" | "closed" | "spam";
export type BackendConversationChannel =
  | "internal" | "email" | "whatsapp" | "telegram" | "instagram" | "sms" | "discord" | "facebook" | "tiktok" | "custom";
export type BackendSenderType = "user" | "contact" | "system" | "ai";

interface RawConversation {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  subject: string;
  status: BackendConversationStatus;
  channel: BackendConversationChannel;
  assigned_to: string | null;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RawMessage {
  id: string;
  conversation_id: string;
  body: string;
  sender_id: string;
  sender_type: BackendSenderType;
  attachments: unknown[];
  metadata: Record<string, unknown> & {
    delivery_status?: "sent" | "failed" | "internal_only";
    /** Machine code of the delivery failure (see whatsapp.errors.ts on the API). */
    delivery_error_code?: string;
    /** English technical detail for diagnostics — never rendered. */
    delivery_error?: string;
  };
  created_at: string;
}

// ── Types of the existing UI model (shared/pages/MusicChat.tsx) ──────────
type SupportChannel = "whatsapp" | "instagram" | "facebook" | "tiktok" | "site" | "custom";
type SupportStatus = "nova" | "aguardando_atendimento" | "em_atendimento" | "aguardando_cliente" | "resolvida" | "arquivada";
type DeadlineState = "on_track" | "at_risk" | "overdue";

export interface SupportConversation {
  id: string;
  customer: string;
  handle: string;
  phone: string;
  instagram: string;
  email: string;
  originLabel: string;
  channel: SupportChannel;
  queue: string;
  sector: string;
  status: SupportStatus;
  assignee: string;
  protocol: string;
  sla: number;
  remainingTimeLabel: string;
  deadlineState: DeadlineState;
  tags: string[];
  assunto?: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  lastReplyAt: string;
  unread: number;
  value: string;
  crmSummary: { existingCustomer: boolean; lead: string; openDeal: string; stage: string };
  auditTrail: string[];
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  sender: "customer" | "agent" | "system";
  author: string;
  body: string;
  time: string;
  attachments?: ChatAttachmentData[];
  /** Real delivery state computed by the backend (dispatchOutbound) — never fabricated on the
   *  frontend. Absent for messages that do not go through external dispatch (e.g. from the customer). */
  deliveryStatus?: "sent" | "failed" | "internal_only";
  /** PT-BR end-user copy for a failed delivery, derived from the failure code. */
  deliveryFailureCopy?: string;
}

/**
 * Delivery failure code → PT-BR end-user copy. The technical `delivery_error`
 * stays out of the UI model; unknown or missing codes (including messages
 * persisted before the code existed) get the generic copy.
 */
const DELIVERY_FAILURE_COPY: Readonly<Record<string, string>> = {
  WHATSAPP_RECIPIENT_PHONE_MISSING: "o contato não tem telefone cadastrado.",
  WHATSAPP_INVALID_RECIPIENT: "o WhatsApp recusou o número do destinatário.",
  WHATSAPP_RATE_LIMITED: "limite de envios do WhatsApp atingido. Tente novamente em instantes.",
  WHATSAPP_NOT_CONFIGURED: "o WhatsApp não está configurado neste workspace.",
  WHATSAPP_AUTH_ERROR: "a conexão com o WhatsApp expirou. Reconecte a integração.",
};
const GENERIC_DELIVERY_FAILURE_COPY = "não foi possível entregar a mensagem pelo WhatsApp.";

export function deliveryFailureCopy(code: string | undefined): string {
  return (code && DELIVERY_FAILURE_COPY[code]) || GENERIC_DELIVERY_FAILURE_COPY;
}

const CHANNEL_TO_SUPPORT: Record<BackendConversationChannel, SupportChannel> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  internal: "custom",
  email: "custom",
  telegram: "custom",
  sms: "custom",
  discord: "custom",
  custom: "custom",
};

const CHANNEL_ORIGIN_LABEL: Record<BackendConversationChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  internal: "Interno",
  email: "E-mail",
  telegram: "Telegram",
  sms: "SMS",
  discord: "Discord",
  custom: "Site",
};

const STATUS_TO_SUPPORT: Record<BackendConversationStatus, SupportStatus> = {
  open: "em_atendimento",
  pending: "aguardando_atendimento",
  closed: "resolvida",
  spam: "arquivada",
};

const SUPPORT_TO_STATUS: Record<SupportStatus, BackendConversationStatus> = {
  nova: "open",
  aguardando_atendimento: "pending",
  em_atendimento: "open",
  aguardando_cliente: "pending",
  resolvida: "closed",
  arquivada: "spam",
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function protocolFromId(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

function mapConversation(raw: RawConversation): SupportConversation {
  const meta = raw.metadata ?? {};
  const serviceStatus = str(meta["service_status"]) as SupportStatus | "";
  const tags = Array.isArray(meta["tags"]) ? (meta["tags"] as unknown[]).filter((t): t is string => typeof t === "string") : [];

  return {
    id: raw.id,
    customer: str(meta["customer"], raw.subject) || "Sem nome",
    handle: str(meta["phone"]) || str(meta["external_contact_id"]) || str(meta["instagram"]) || str(meta["email"]),
    phone: str(meta["phone"]) || (raw.channel === "whatsapp" ? str(meta["external_contact_id"]) : ""),
    instagram: str(meta["instagram"]),
    email: str(meta["email"]),
    originLabel: CHANNEL_ORIGIN_LABEL[raw.channel],
    channel: CHANNEL_TO_SUPPORT[raw.channel],
    queue: str(meta["queue_id"] ?? meta["queue"]),
    sector: str(meta["sector_id"] ?? meta["sector"]),
    status: serviceStatus || STATUS_TO_SUPPORT[raw.status],
    assignee: raw.assigned_to ?? "Sem responsável",
    protocol: protocolFromId(raw.id),
    // No real SLA configured for conversations on the backend (unlike
    // support_tickets, which has a real sla_deadline) — fixed neutral default,
    // never a fabricated count. sla_state exists only as a query
    // filter, never written by any real flow.
    sla: 100,
    remainingTimeLabel: "",
    deadlineState: "on_track",
    tags,
    assunto: raw.channel === "custom" ? str(meta["assunto"]) || undefined : undefined,
    lastMessage: "",
    lastMessageAt: formatTime(raw.last_message_at),
    createdAt: formatTime(raw.created_at),
    lastReplyAt: formatTime(raw.last_message_at ?? raw.created_at),
    // No unread column/counter on the backend — never fabricate.
    unread: 0,
    value: "",
    crmSummary: {
      existingCustomer: Boolean(raw.contact_id),
      lead: raw.contact_id ? "Vinculado" : "",
      openDeal: "",
      stage: "",
    },
    auditTrail: [],
    updated_at: raw.updated_at,
  };
}

function mapMessage(raw: RawMessage): SupportMessage {
  const sender: SupportMessage["sender"] =
    raw.sender_type === "contact" ? "customer" : raw.sender_type === "system" || raw.sender_type === "ai" ? "system" : "agent";
  const attachments = Array.isArray(raw.attachments) && raw.attachments.length > 0
    ? (raw.attachments as ChatAttachmentData[])
    : undefined;

  return {
    id: raw.id,
    sender,
    author: sender === "customer" ? "Cliente" : sender === "system" ? "Sistema" : raw.sender_id,
    body: raw.body,
    time: formatTime(raw.created_at),
    attachments,
    deliveryStatus: raw.metadata?.delivery_status,
    deliveryFailureCopy:
      raw.metadata?.delivery_status === "failed" ? deliveryFailureCopy(raw.metadata.delivery_error_code) : undefined,
  };
}

export interface ConversationUpdatePayload {
  status?: BackendConversationStatus;
  subject?: string;
  channel?: BackendConversationChannel;
  assigned_to?: string;
  metadata?: Record<string, unknown>;
  service_status?: SupportStatus;
  tags?: string[];
  expectedUpdatedAt?: string;
}

export const musicChatConversationsService = {
  /** Creates a new conversation. WhatsApp is the only channel with real external delivery (see
   *  dispatchOutbound) — metadata.phone is required for that channel to actually work.
   *  idempotencyKey: pass the SAME key on an explicit retry of the same attempt (e.g. the
   *  user clicking again after a network error) so the backend returns the result
   *  already created instead of creating a second conversation — generating a new key on every call
   *  only protects against internal automatic resends, not against a manual user retry. */
  async create(
    input: { subject: string; channel: BackendConversationChannel; phone?: string; customer?: string },
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<SupportConversation> {
    const raw = await api.post<RawConversation>(
      "/conversations",
      {
        subject: input.subject,
        channel: input.channel,
        metadata: { phone: input.phone, customer: input.customer },
      },
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );
    return mapConversation(raw);
  },

  async list(): Promise<SupportConversation[]> {
    // api.get() already unwraps the {data,timestamp} envelope of the TransformInterceptor;
    // since the controller returns {data: [...], meta} directly (no extra wrap,
    // see TransformInterceptor: an object that already has `data` is preserved), the value
    // here already IS the array — re-reading `.data` duplicated the unwrap and resulted in undefined.
    const rows = await api.get<RawConversation[]>("/conversations?limit=200");
    return rows.map(mapConversation);
  },

  async messages(conversationId: string): Promise<SupportMessage[]> {
    const rows = await api.get<RawMessage[]>(`/conversations/${conversationId}/messages?limit=200`);
    return rows.map(mapMessage);
  },

  /** Fetches a single conversation — used to update/insert locally in response to a
   *  specific realtime event, instead of re-running the whole list() on every event. */
  async get(conversationId: string): Promise<SupportConversation> {
    const raw = await api.get<RawConversation>(`/conversations/${conversationId}`);
    return mapConversation(raw);
  },

  async update(conversationId: string, patch: ConversationUpdatePayload): Promise<SupportConversation> {
    const raw = await api.patch<RawConversation>(`/conversations/${conversationId}`, patch);
    return mapConversation(raw);
  },

  async close(conversationId: string, reason = "Finalizado pelo agente via MusicChat"): Promise<SupportConversation> {
    const raw = await api.patch<RawConversation>(`/conversations/${conversationId}/close`, { reason });
    return mapConversation(raw);
  },

  /** "Arquivar" in MusicChat maps to the backend's real soft-delete. */
  async archive(conversationId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}`);
  },

  async reopen(conversationId: string, reason?: string): Promise<SupportConversation> {
    const raw = await api.patch<RawConversation>(`/conversations/${conversationId}/reopen`, { reason });
    return mapConversation(raw);
  },

  async sendMessage(
    conversationId: string,
    body: string,
    attachments: ChatAttachmentData[] = [],
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<SupportMessage> {
    // X-Idempotency-Key: protects against network-level duplicate resends (timeout + retry),
    // in addition to the UI guard (isSending) in MusicChat.tsx — same pattern already used by
    // transactions/invoices/contracts/etc. (IdempotencyInterceptor on the backend). Pass the same
    // key when resending the SAME content; edited content is another attempt and needs a
    // new key (see attemptRef in MusicChat.tsx/NewConversationDialog.tsx).
    const raw = await api.post<RawMessage>(
      `/conversations/${conversationId}/messages`,
      { body, attachments },
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );
    return mapMessage(raw);
  },

  async addNote(conversationId: string, body: string): Promise<void> {
    await api.post(`/conversations/${conversationId}/notes`, { body });
  },
};
