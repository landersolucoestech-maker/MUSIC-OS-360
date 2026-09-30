import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { WS_ENABLED } from '@/shared/lib/env';
import { getSessionOrgId, getSessionUserId } from '@/shared/lib/get-session-org-id';
import { ALL_WS_EVENT_NAMES } from '@/shared/lib/ws-events';

/**
 * Realtime transport for domain-event delivery — replaces the previous
 * Socket.IO client (`socket.io-client` + a persistent WS connection to the
 * NestJS API). The API no longer holds a persistent WebSocket per client, so
 * broadcasts now travel through Supabase Realtime instead:
 * the backend publishes to `tenant:<org_id>` / `user:<user_id>` topics
 * (see apps/api/src/core/realtime/realtime.service.ts), and this module
 * subscribes to both as PRIVATE channels — access is enforced by the RLS
 * policies in 20260801000001_RealtimeBroadcastAuthorization, not by
 * anything in this file. The Supabase client already forwards the current
 * session's JWT to Realtime automatically (same `supabase` singleton used
 * for Auth), so no separate auth wiring is needed here.
 *
 * Two channels are kept open per session — one for tenant-wide domain
 * events, one for events addressed to this specific user — mirroring the
 * two Socket.IO rooms (`tenant:<org_id>`, `user:<user_id>`) the old
 * WsGateway joined every socket to.
 */

type Listener = (payload: unknown) => void;
type ConnectionListener = (connected: boolean) => void;

let tenantChannel: RealtimeChannel | null = null;
let userChannel:   RealtimeChannel | null = null;
let boundOrgId:    string | null = null;
let boundUserId:   string | null = null;
let tenantReady = false;
let userReady   = false;
let connected   = false;

const eventListeners      = new Map<string, Set<Listener>>();
const connectionListeners = new Set<ConnectionListener>();

function setConnected(value: boolean): void {
  if (value === connected) return;
  connected = value;
  connectionListeners.forEach((cb) => cb(value));
}

function dispatch(event: string, payload: unknown): void {
  eventListeners.get(event)?.forEach((cb) => cb(payload));
}

/** Registers a dispatcher for every known event name — Realtime has no
 * wildcard broadcast listener, so each name needs its own `.on()` call. */
function bindKnownEvents(channel: RealtimeChannel): void {
  for (const event of ALL_WS_EVENT_NAMES) {
    channel.on('broadcast', { event }, ({ payload }: { payload: unknown }) => {
      dispatch(event, payload);
    });
  }
}

/**
 * Ensures both Realtime channels are subscribed for the currently
 * authenticated session. Safe to call repeatedly — no-ops if already
 * connected for the same identity, and re-subscribes if it changed (e.g.
 * a different user logged in without a full page reload).
 */
export function ensureRealtimeChannels(): void {
  if (!WS_ENABLED) return;

  const orgId  = getSessionOrgId();
  const userId = getSessionUserId();
  if (!orgId || !userId) return;

  if (orgId === boundOrgId && userId === boundUserId && tenantChannel && userChannel) {
    return;
  }

  disconnectRealtimeChannels();
  boundOrgId  = orgId;
  boundUserId = userId;

  tenantChannel = supabase.channel(`tenant:${orgId}`, { config: { private: true } });
  bindKnownEvents(tenantChannel);
  tenantChannel.subscribe((status: string) => {
    tenantReady = status === 'SUBSCRIBED';
    setConnected(tenantReady && userReady);
  });

  userChannel = supabase.channel(`user:${userId}`, { config: { private: true } });
  bindKnownEvents(userChannel);
  userChannel.subscribe((status: string) => {
    userReady = status === 'SUBSCRIBED';
    setConnected(tenantReady && userReady);
  });
}

export function disconnectRealtimeChannels(): void {
  if (tenantChannel) {
    supabase.removeChannel(tenantChannel);
    tenantChannel = null;
  }
  if (userChannel) {
    supabase.removeChannel(userChannel);
    userChannel = null;
  }
  boundOrgId  = null;
  boundUserId = null;
  tenantReady = false;
  userReady   = false;
  setConnected(false);
}

/** Subscribes to a named broadcast event; returns an unsubscribe function. */
export function onWsEvent(event: string, handler: Listener): () => void {
  ensureRealtimeChannels();
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(handler);
  return () => {
    eventListeners.get(event)?.delete(handler);
  };
}

/** Subscribes to connection state changes; calls back immediately with the current state. */
export function onWsConnectionChange(cb: ConnectionListener): () => void {
  connectionListeners.add(cb);
  cb(connected);
  return () => connectionListeners.delete(cb);
}

export function isWsConnected(): boolean {
  return connected;
}
