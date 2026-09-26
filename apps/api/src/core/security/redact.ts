/**
 * core/security/redact.ts
 *
 * Prevents clear-text logging/exposure of sensitive data (CWE-312/532).
 * Deep-redacts values whose key looks like a secret (token, password, api_key,
 * secret, *_url with credentials, service_role, jwt, …) before they are logged
 * or serialized. Use `safeLog`/`redactSensitiveObject` instead of logging raw
 * objects that may carry credentials.
 */

const SENSITIVE_KEY_RE =
  /(pass(word)?|token|api_?key|secret|private_?key|service_?role|database_?url|direct_?url|jwt|bearer|credential|authorization|encryption_?key|dsn)/i;

export const REDACTED = "[REDACTED]";

/** Deep-redacts sensitive values in an object/array. Non-sensitive data kept. */
export function redactSensitiveObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitiveObject(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactSensitiveObject(v);
    }
    return out as T;
  }
  return value;
}

/** Redacts a single string if it is provided for a sensitive field. */
export function redactSensitiveValue(value: unknown): string {
  return value == null ? "" : REDACTED;
}

/** Console logger that deep-redacts its arguments first. */
export function safeLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(...args.map((a) => redactSensitiveObject(a)));
}

/**
 * Query-string parameters whose VALUES are credentials even though the key
 * does not look like one: OAuth authorization `code`/`state` (callbacks) and
 * the Meta webhook `hub.verify_token`. Any key matching SENSITIVE_KEY_RE is
 * redacted too (token, secret, api_key, ...).
 */
const SENSITIVE_QUERY_KEYS = new Set(['code', 'state', 'hub.verify_token', 'signature', 'sig']);

/**
 * Returns the URL/path with sensitive query-string values replaced by
 * [REDACTED] (find-936c6f8d). Use for anything that is logged, persisted
 * (audit httpPath) or sent to telemetry. Path and non-sensitive params are
 * kept so the line stays useful for debugging.
 */
export function redactUrl(url: string | null | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  if (q < 0) return url;
  const path = url.slice(0, q);
  const hashAt = url.indexOf('#', q);
  const query = url.slice(q + 1, hashAt < 0 ? undefined : hashAt);
  const parts = query.split('&').map((pair) => {
    if (!pair) return pair;
    const eq = pair.indexOf('=');
    const rawKey = eq < 0 ? pair : pair.slice(0, eq);
    let key = rawKey;
    try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')); } catch { /* keep raw key: undecodable input is still matched as-is */ }
    const sensitive = SENSITIVE_QUERY_KEYS.has(key.toLowerCase()) || SENSITIVE_KEY_RE.test(key);
    return sensitive && eq >= 0 ? `${rawKey}=${REDACTED}` : pair;
  });
  return `${path}?${parts.join('&')}`;
}
