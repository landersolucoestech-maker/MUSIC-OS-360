/**
 * normalize-email.ts  (Part 75)
 *
 * Same normalization as the backend (apps/api/src/core/security/normalize-email.ts):
 * trim + lowercase before any authentication call — without it,
 * "Nome@Dominio.com" and " nome@dominio.com " could behave as
 * different inputs depending on where the comparison happened.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
