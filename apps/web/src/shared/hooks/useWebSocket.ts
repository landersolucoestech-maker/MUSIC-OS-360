import { useState, useEffect } from 'react';
import {
  ensureRealtimeChannels,
  onWsConnectionChange,
  isWsConnected,
  disconnectRealtimeChannels,
} from '@/shared/lib/ws-client';

/**
 * Establishes and maintains the Supabase Realtime channels for the current
 * session (tenant + user broadcast topics — see ws-client.ts).
 *
 * - Skipped entirely when VITE_WS_ENABLED=false.
 * - Returns only `connected`; no raw channel/socket handle is exposed here
 *   because no consumer in this codebase needs one — everything subscribes
 *   to named events via `useWsEvent`.
 */
export function useWebSocket(): { connected: boolean } {
  const [connected, setConnected] = useState(isWsConnected());

  useEffect(() => {
    ensureRealtimeChannels();
    return onWsConnectionChange(setConnected);
  }, []);

  return { connected };
}

export { disconnectRealtimeChannels };
