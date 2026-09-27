/**
 * Shared contract between the backend RealtimeService and frontend
 * useWsEvent. Each key is a Supabase Realtime broadcast event name; the
 * value is the expected payload shape. Use `WsEventMap[E]` in generic
 * constraints so TypeScript catches wrong payload types at compile time.
 *
 * Keep in sync with apps/api/src/core/realtime/realtime.service.ts.
 */

export interface WsBasePayload {
  org_id: string;
  [key: string]: unknown;
}

export interface WsNotificationPayload {
  id:        string | null;
  title:     string;
  body?:     string | null;
  type:      string;
  entity?:   string | null;
  entityId?: string | null;
  createdAt: string | Date;
}

export interface WsEventMap {
  // ── Artists ────────────────────────────────────────────────────────────────────
  'artist.created':               WsBasePayload & { id: string };
  'artist.updated':               WsBasePayload & { id: string };
  'artist.deleted':               WsBasePayload & { id: string };

  // ── Catalog ──────────────────────────────────────────────────────────────────
  'catalog.music.registered':     WsBasePayload & { id: string };
  'catalog.phonogram.registered': WsBasePayload & { id: string };

  // ── Contracts ──────────────────────────────────────────────────────────────────
  'contract.created':             WsBasePayload & { id: string };
  'contract.updated':             WsBasePayload & { id: string };
  'contract.signed':              WsBasePayload & { id: string };

  // ── CRM ────────────────────────────────────────────────────────────────────────
  'crm.lead.captured':            WsBasePayload & { id: string };
  'crm.lead.converted':           WsBasePayload & { id: string };

  // ── Finance ────────────────────────────────────────────────────────────────────
  'finance.transaction.created':  WsBasePayload & { id: string };
  'finance.transaction.updated':  WsBasePayload & { id: string };
  'finance.calculated':           WsBasePayload & { period?: string };

  // ── Audit ────────────────────────────────────────────────────────────────────
  'audit.entry.created':          WsBasePayload & { action: string };

  // ── Individual notifications (PHASE 4) ─────────────────────────────────────
  'notification:new':             WsNotificationPayload;

  // ── Billing (FASE 6 — Stripe) ────────────────────────────────────────────────
  'billing:plan_upgraded':        { org_id: string; plan: string };
  'billing:trial_ending':         { org_id: string; days_left: number };
  'billing:payment_failed':       { org_id: string; invoice_id: string };
  'billing:cancelled':            { org_id: string };

  // ── Changed data (cache invalidation) ────────────────────────────────────────
  'data:changed':                 { entity: string; id: string };

  // ── MusicChat / Conversations (Inbox operacional) ────────────────────────────
  'conversation:created':     { conversationId: string; subject: string; channel: string };
  'conversation:updated':     { conversationId: string; status: string; assigned_to: string | null };
  'conversation:message':     { conversationId: string; messageId: string; senderId: string; senderType: string; bodyPreview: string; deliveryStatus?: string | null };
  'conversation:assigned':    { conversationId: string; assigneeId: string | null };
  'conversation:transferred': { conversationId: string; assigneeId: string | null; queueId: string | null; sectorId: string | null };
  'conversation:closed':      { conversationId: string; closedBy: string };
  'conversation:reopened':    { conversationId: string; reopenedBy: string };

  // ── Internal Chat (team <-> team — isolated from the Service Center above) ──
  'internalConversation:created': { conversationId: string };
  'internalConversation:message': { conversationId: string; messageId: string };
}

/** Union of all known WS event names (useful for exhaustive switches). */
export type WsEventName = keyof WsEventMap;

/**
 * Runtime list of every event name in WsEventMap. Supabase Realtime requires
 * each broadcast event to have a listener registered (`channel.on('broadcast',
 * { event }, cb)`) before `subscribe()` — there is no wildcard/catch-all
 * broadcast listener in the client SDK — so ws-client.ts binds one generic
 * dispatcher per name in this list to every channel it opens. The `satisfies`
 * clause makes TypeScript fail the build if an entry here isn't a real
 * WsEventMap key; keeping the reverse in sync (every WsEventMap key present
 * here) is manual — update this list whenever ws-events.ts gains a new key.
 */
export const ALL_WS_EVENT_NAMES = [
  'artist.created',
  'artist.updated',
  'artist.deleted',
  'catalog.music.registered',
  'catalog.phonogram.registered',
  'contract.created',
  'contract.updated',
  'contract.signed',
  'crm.lead.captured',
  'crm.lead.converted',
  'finance.transaction.created',
  'finance.transaction.updated',
  'finance.calculated',
  'audit.entry.created',
  'notification:new',
  'billing:plan_upgraded',
  'billing:trial_ending',
  'billing:payment_failed',
  'billing:cancelled',
  'data:changed',
  'conversation:created',
  'conversation:updated',
  'conversation:message',
  'conversation:assigned',
  'conversation:transferred',
  'conversation:closed',
  'conversation:reopened',
  'internalConversation:created',
  'internalConversation:message',
] as const satisfies readonly WsEventName[];

