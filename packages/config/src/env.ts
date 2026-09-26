// ─── App-level env config ─────────────────────────────────────────────────────
// Read by the backend (process.env) and by the frontend (import.meta.env).
// Use the helper functions instead of accessing process.env directly.

export type AppEnvironment = "development" | "staging" | "production" | "test";

export function getAppEnv(): AppEnvironment {
  const env =
    (typeof process !== "undefined" && process.env["NODE_ENV"]) ||
    "development";
  if (env === "production" || env === "staging" || env === "test") return env;
  return "development";
}

export function isDev(): boolean {
  return getAppEnv() === "development";
}

export function isProd(): boolean {
  return getAppEnv() === "production";
}

export function isTest(): boolean {
  return getAppEnv() === "test";
}

// ─── API URL resolution ───────────────────────────────────────────────────────

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Browser: uses the Vite variable or falls back to a relative URL
    return (
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_API_URL ?? "/api/v1"
    );
  }
  // Server-side: uses the Node environment variable
  return process.env["API_URL"] ?? "http://localhost:3001/api/v1";
}
