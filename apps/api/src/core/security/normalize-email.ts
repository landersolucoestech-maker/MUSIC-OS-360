/**
 * normalize-email.ts  (Part 75)
 *
 * Single, centralized e-mail normalization for any comparison,
 * lookup or account creation (institutional owner bootstrap, duplicate
 * resolution, etc.) — without it, "Nome@Dominio.com" and " nome@dominio.com "
 * could be treated as different accounts in different places in the code.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
