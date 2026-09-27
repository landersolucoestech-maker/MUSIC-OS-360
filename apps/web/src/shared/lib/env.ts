/**
 * shared/lib/env.ts — Single source of truth for environment variables.
 *
 * RULE: no other file may read import.meta.env directly
 * for mode flags. Always import from here.
 *
 * There is no mock mode: the frontend consumes the real backend exclusively.
 * (VITE_USE_MOCK/VITE_MOCK_MODE=true are blocked at build time by the
 * assert-supabase-env guard.)
 *
 */

import { isProdLike } from "@music-os-360/config/environment";

// Auth bypass is an explicit LOCAL-DEV-ONLY convenience and must NEVER be active
// in a production build. Set VITE_AUTH_DISABLED=true in the web app and
// AUTH_DISABLED=true in the API to bypass auth temporarily during development.
// Set the flags to false or remove them to restore the original auth flow.
/**
 * Mock mode was REMOVED: literal false (type 'false') so every remaining
 * 'if (MOCK_MODE)' branch is provably dead code, eliminated from the
 * bundle by dead-code elimination. It reads no env var at all — impossible to turn on.
 * Physical removal of the remaining branches: see the no-mock report.
 */
export const AUTH_DISABLED: boolean =
  import.meta.env.DEV === true &&
  import.meta.env.VITE_AUTH_DISABLED === "true";

/**
 * DEV_AUTH_BYPASS — VITE_DISABLE_AUTH=true — DEV ONLY.
 *
 * A purely FRONTEND authentication/authorization bypass to browse the
 * interface without login during local development. Different from
 * AUTH_DISABLED: this flag does not assume the backend also has auth
 * off — API calls requiring a real token may still
 * return 401/403 normally (see api-client.ts for the only related
 * adjustment: the 401 circuit breaker is skipped under this flag so it does not
 * block the whole navigation for 30s on every authenticated call).
 *
 * `deriveDevAuthBypass` is the pure derivation (testable without mocking
 * import.meta.env). The core security guarantee: `isDev` can only be
 * `true` when Vite compiles in development mode (import.meta.env.DEV
 * is decided at build time by the build mode, it is not an env var read at
 * runtime) — so even if VITE_DISABLE_AUTH=true leaks into a
 * staging/production `.env` by mistake, a production build will never have DEV === true
 * and the bypass stays disabled.
 */
export function deriveDevAuthBypass(isDev: boolean, flagValue: string | undefined): boolean {
  return isDev === true && flagValue === "true";
}

export const DEV_AUTH_BYPASS: boolean = deriveDevAuthBypass(
  import.meta.env.DEV === true,
  import.meta.env.VITE_DISABLE_AUTH as string | undefined,
);

/**
 * Base URL of the backend API. Empty string = relative URLs (same domain, Vite proxy).
 *
 * Defensive sanitization: removes /api/v1 or /api suffixes if VITE_API_URL already
 * contains them — avoids the "http://host/api/api/v1/..." duplication that happens when
 * VITE_API_URL=http://localhost:3001/api and api-client.ts already appends /api/v1.
 *
 * Rule: VITE_API_URL must be ONLY the host/port, without a path:
 *   CORRECT: http://localhost:3001
 *   WRONG:   http://localhost:3001/api
 *   WRONG:   http://localhost:3001/api/v1
 */
function sanitizeApiBase(raw: string): string {
  return raw
    .replace(/\/api\/v1\/?$/, "")   // remove sufixo /api/v1
    .replace(/\/api\/?$/, "")        // remove sufixo /api
    .replace(/\/$/, "");             // remove trailing slash
}

export const API_BASE_URL: string = sanitizeApiBase(
  (import.meta.env.VITE_API_URL as string | undefined) ?? "",
);

/** true in the Vite development environment (npm run dev). */
export const IS_DEV: boolean = import.meta.env.DEV === true;

/** true in a production build. */
export const IS_PROD: boolean = import.meta.env.PROD === true;

/**
 * Realtime feature flag. When false, the app does NOT open the Supabase
 * Realtime channels (tenant/user broadcast topics) — components relying on
 * useWsEvent simply never fire, falling back to polling/manual refresh.
 * Defaults to true.
 */
export const WS_ENABLED: boolean =
  ((import.meta.env.VITE_WS_ENABLED as string | undefined) ?? "true") !== "false";

/**
 * Vite environment mode: "development" | "production" | "test".
 * Equivalent to import.meta.env.MODE.
 */
export const ENV_MODE: string = (import.meta.env.MODE as string) ?? "development";
export const IS_PROD_LIKE: boolean = isProdLike(ENV_MODE);

/**
 * Part 75 — safe authentication environment identifier, shown on the
 * login screen (never the full URL nor the anon key) to remove
 * ambiguity about "which Supabase this build points to" — the
 * most likely cause of a real "Invalid login" with correct credentials
 * is the user being on a surface pointing to the wrong project/environment.
 */
const SUPABASE_ENV_LABELS: Readonly<Record<string, string>> = {
  rypnevnfipygyhysqpdo: "DEV",
  jjnnjnxjkqipgqebijen: "STAGING",
  sxmfeocztlztvpdnxayk: "MAIN (proibido)",
};

/** Extracted as a pure function (receives the URL instead of reading import.meta.env) so it is testable without mocking Vite. */
export function extractSupabaseRef(url: string | undefined): string | null {
  return (url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
}

/** "DEV" | "STAGING" | "MAIN (proibido)" | "desconhecido" — never the full URL. */
export function deriveAuthEnvironmentLabel(url: string | undefined): string {
  const ref = extractSupabaseRef(url);
  if (!ref) return "desconhecido";
  return SUPABASE_ENV_LABELS[ref] ?? "desconhecido";
}

/** "rypn…qpdo" — only the first/last 4 characters of the ref, never the key. */
export function deriveMaskedSupabaseRef(url: string | undefined): string {
  const ref = extractSupabaseRef(url);
  if (!ref || ref.length < 8) return "????…????";
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

export function authEnvironmentLabel(): string {
  return deriveAuthEnvironmentLabel(import.meta.env.VITE_SUPABASE_URL as string | undefined);
}

export function maskedSupabaseRef(): string {
  return deriveMaskedSupabaseRef(import.meta.env.VITE_SUPABASE_URL as string | undefined);
}

/** First 7 characters of the commit actually packaged in this bundle (see vite.config.mjs). */
export const BUILD_COMMIT_SHA: string =
  ((import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? "unknown").slice(0, 7);

/**
 * validateFrontendEnv — called once at app startup (main.tsx).
 *
 * In production builds, halts rendering and shows an error page if any
 * required environment variable is missing. In development, logs warnings
 * so the dev can fix them without breaking the dev server entirely.
 *
 * Returns true if env is valid, false if the app should not render.
 */
/**
 * Supabase refs banned from any runtime (preview branch without public tables).
 * Mirrors apps/api/src/core/config/env.schema.ts and scripts/env-check.mjs.
 */
const SUPABASE_REF_DENYLIST: readonly string[] = ["mkyvkciwyhfawmvluugb"];

export function validateFrontendEnv(): boolean {
  const isProd = import.meta.env.PROD === true;

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  const bannedRef = SUPABASE_REF_DENYLIST.find((ref) => supabaseUrl.includes(ref));
  if (bannedRef) {
    console.error(
      `[MUSIC OS 360] ❌ VITE_SUPABASE_URL points to the banned Supabase ref "${bannedRef}" ` +
      "(preview branch without public tables). The app cannot start with this environment.",
    );
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML =
        `<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:auto">` +
        `<h2 style="color:#dc2626">Configuration Error</h2>` +
        `<p>The configured Supabase environment is not allowed. Contact your system administrator.</p>` +
        `</div>`;
    }
    return false;
  }

  const required: Array<{ key: string; value: string | undefined; label: string }> = [
    {
      key:   "VITE_SUPABASE_URL",
      value: import.meta.env.VITE_SUPABASE_URL as string | undefined,
      label: "Supabase project URL",
    },
    {
      key:   "VITE_SUPABASE_ANON_KEY",
      value: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
      label: "Supabase anon key",
    },
  ];

  // VITE_API_URL is optional in dev (Vite proxy handles it), required in prod.
  if (isProd) {
    required.push({
      key:   "VITE_API_URL",
      value: import.meta.env.VITE_API_URL as string | undefined,
      label: "Backend API URL",
    });
  }

  const missing = required.filter((r) => !r.value);

  if (missing.length === 0) return true;

  const lines = missing.map((r) => `  • ${r.key} (${r.label})`).join("\n");

  if (isProd) {
    // Halt rendering — the app cannot function without these.
    console.error(
      `[MUSIC OS 360] ❌ Missing required environment variables:\n${lines}\n` +
      "Configure these in your deployment platform before starting the app.",
    );
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML =
        `<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:auto">` +
        `<h2 style="color:#dc2626">Configuration Error</h2>` +
        `<p>Required environment variables are not set. Contact your system administrator.</p>` +
        `</div>`;
    }
    return false;
  }

  // Development: warn but allow startup so devs can still iterate.
  console.warn(
    `[MUSIC OS 360] ⚠️  Missing environment variables (app will use fallbacks):\n${lines}\n` +
    "Set these in apps/web/.env.development or adjust the local backend.",
  );
  return true;
}
