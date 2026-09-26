/**
 * password-policy.ts  (Part 74)
 *
 * Strength policy for passwords CHOSEN BY THE USER (e.g. the mandatory
 * change of the temporary password). Distinct from generate-strong-password.ts,
 * which generates the temporary password itself (CSPRNG, 24+ characters) — here we only
 * validate what a human typed.
 */

export const MIN_USER_PASSWORD_LENGTH = 12;

const LOWER_RE = /[a-z]/;
const UPPER_RE = /[A-Z]/;
const DIGIT_RE = /[0-9]/;
const SYMBOL_RE = /[^A-Za-z0-9]/;

/** Returns the list of requirements NOT met (empty = strong enough password). */
export function strongPasswordViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < MIN_USER_PASSWORD_LENGTH) {
    violations.push(`mínimo de ${MIN_USER_PASSWORD_LENGTH} caracteres`);
  }
  if (!LOWER_RE.test(password)) violations.push('ao menos uma letra minúscula');
  if (!UPPER_RE.test(password)) violations.push('ao menos uma letra maiúscula');
  if (!DIGIT_RE.test(password)) violations.push('ao menos um número');
  if (!SYMBOL_RE.test(password)) violations.push('ao menos um símbolo');
  return violations;
}
