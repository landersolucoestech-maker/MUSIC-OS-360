/**
 * lib/supabase.ts
 *
 * Supabase client singleton.
 * Persistent auth + automatic refresh + session saved in localStorage.
 *
 * The client is stored in window.__musicos360_sb to survive
 * Vite's HMR (which re-evaluates modules and would reset a local variable).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __musicos360_sb?: SupabaseClient;
  }
}

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}.supabase.co`;
}

export function getSupabaseClient(): SupabaseClient {
  if (window.__musicos360_sb) return window.__musicos360_sb;

  const rawUrl  = (import.meta.env.VITE_SUPABASE_URL      as string | undefined) ?? "";
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
  const url     = normalizeSupabaseUrl(rawUrl);

  if (!url || !anonKey) {
    throw new Error("[MUSIC OS 360] Missing Supabase configuration");
  }

  console.info("[MUSIC OS 360] Supabase initialized:", url);

  window.__musicos360_sb = createClient(url, anonKey, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storage:            window.localStorage,
      storageKey:         "musicos360_auth",
      flowType:           "implicit",
    },
  });

  return window.__musicos360_sb;
}

export const supabase = getSupabaseClient();
