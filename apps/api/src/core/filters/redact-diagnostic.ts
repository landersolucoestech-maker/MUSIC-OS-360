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
  // scheme://user:password@host — credentials embedded in a connection string / URL
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
  // JWTs (header.payload.signature)
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, REDACTED],
  // Authorization / Bearer values
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // key=value / key: value / "key":"value" for secret-looking keys
  [
    /(["']?\b[\w-]*(?:pass(?:word)?|pwd|token|api_?key|secret|private_?key|service_?role|credential|authorization)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&)}\]]+)/gi,
    `$1${REDACTED}`,
  ],
  // e-mail addresses (PII)
  // The last label must be alphabetic so `pkg@1.2.3` in pnpm stack paths is not mistaken for an address.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-])/g, REDACTED],
];

/** Returns `text` with e-mail addresses, credentials, tokens and JWTs replaced by [REDACTED]. */
export function redactDiagnosticText(text: string | null | undefined): string {
  if (!text) return '';
  return PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}
