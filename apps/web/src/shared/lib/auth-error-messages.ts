/**
 * auth-error-messages.ts  (Part 75)
 *
 * Translates the raw Supabase Auth error (or a network failure) into a
 * safe message specific enough for the user to act on, without
 * revealing whether an arbitrary e-mail exists in the system (anti-enumeration —
 * "Invalid login credentials" is Supabase's deliberately generic response
 * both for a wrong password and for a nonexistent account, and that
 * is kept here too).
 */
import type { AuthError } from "@/shared/types/auth";

const INVALID_CREDENTIALS_RE = /invalid login credentials/i;

/**
 * Part 77 — only GENUINE credential errors may count against the
 * attempt limiter (see security.ts/AuthRateLimiter.recordFailure).
 * Network, 503, 500, timeout or a frontend crash may never consume an
 * attempt of the legitimate user.
 */
export function isCredentialsError(error: AuthError): boolean {
  return INVALID_CREDENTIALS_RE.test(error.message ?? "");
}

export function describeAuthError(error: AuthError): string {
  const message = error.message ?? "";

  if (INVALID_CREDENTIALS_RE.test(message)) {
    return "Credenciais inválidas.";
  }
  if (/email not confirmed/i.test(message)) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (error.status === 429 || /rate limit|too many requests/i.test(message)) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (/failed to fetch|network|fetch failed/i.test(message)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  return message || "Não foi possível entrar. Tente novamente.";
}
