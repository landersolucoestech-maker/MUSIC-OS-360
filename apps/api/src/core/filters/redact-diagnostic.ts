/**
 * Redaction of free-text diagnostics (provider / database / exception messages)
 * before they are written to a log line.
 *
 * core/security/redact.ts redacts by object KEY and by URL query key; it cannot
 * see a secret or an e-mail address embedded in a sentence such as the text of
 * a Supabase auth error ("User foo@bar.com already registered"). This module
 * covers that free-text case (CWE-532). The raw exception still goes to Sentry
 * untouched; only the log line is redacted.
 */
import { REDACTED } from '../security/redact';

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // scheme://user:password@host: credentials embedded in a connection string / URL. User and password are
  // unbounded (a bound would leave the tail of a long password in clear); the input cap below keeps the work small.
  [/([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
  // JWTs (header.payload.signature)
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, REDACTED],
  // Authorization / Bearer values
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // key=value / key: value / "key":"value" for secret-looking keys
  [
    /(["']?\b[\w-]*(?:pass(?:word)?|pwd|token|api_?key|secret|private_?key|service_?role|credential|authorization)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s,;&)}\]]+)/gi,
    `$1${REDACTED}`,
  ],
];

// E-mail addresses (PII). The domain is matched with bounded labels; the local part is then taken by
// scanning backwards from the `@`, so an address of any length is redacted whole without a quadratic regex.
// The last label must be alphabetic so `pkg@1.2.3` in pnpm stack paths is not mistaken for an address.
const EMAIL_DOMAIN = /@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){0,8}\.\p{L}{2,24}(?![\p{L}\p{N}-])/gu;
const EMAIL_LOCAL_CHAR = /[\p{L}\p{N}._%+-]/u;

function redactEmails(text: string): string {
  if (!text.includes('@')) return text;
  let out = '';
  let last = 0;
  for (const match of text.matchAll(EMAIL_DOMAIN)) {
    const at = match.index ?? 0;
    let start = at;
    while (start > last && EMAIL_LOCAL_CHAR.test(text[start - 1])) start -= 1;
    if (start === at) continue;
    out += text.slice(last, start) + REDACTED;
    last = at + match[0].length;
  }
  return out + text.slice(last);
}

/**
 * Input cap: error text can echo attacker-controlled values (a 16 KB path param, a 1 MB JSON string);
 * the regexes run over at most MAX_DIAGNOSTIC_CHARS + REDACTION_MARGIN characters (S4-1 ReDoS hardening).
 * The cap is applied AFTER redaction, so a secret that straddles it is never left half-visible.
 */
export const MAX_DIAGNOSTIC_CHARS = 4000;
const REDACTION_MARGIN = 1024;

/** Returns `text` with e-mail addresses, credentials, tokens and JWTs replaced by [REDACTED]. */
export function redactDiagnosticText(text: string | null | undefined): string {
  if (!text) return '';
  const window = text.length > MAX_DIAGNOSTIC_CHARS + REDACTION_MARGIN ? text.slice(0, MAX_DIAGNOSTIC_CHARS + REDACTION_MARGIN) : text;
  const redacted = redactEmails(PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), window));
  return redacted.length > MAX_DIAGNOSTIC_CHARS || window.length < text.length ? `${redacted.slice(0, MAX_DIAGNOSTIC_CHARS)}…[truncated]` : redacted;
}

/** Cap for diagnostics persisted in internal columns (activity_logs.metadata.error, publication_error). */
export const MAX_PERSISTED_DIAGNOSTIC_CHARS = 500;

/** Redacted AND capped text for persistence: never store raw provider/exception text. */
export function redactForStorage(text: unknown, max: number = MAX_PERSISTED_DIAGNOSTIC_CHARS): string {
  const redacted = redactDiagnosticText(typeof text === 'string' ? text : String(text ?? ''));
  return redacted.length > max ? redacted.slice(0, max) : redacted;
}
