/**
 * Signed-at date of a contract. `contracts` has no signed-at column; the API stores
 * it as `metadata.signed_at` (contracts.service.ts, written when `signedAt` is sent).
 */
export function contractSignedAt(contract: { metadata?: unknown } | null | undefined): string | null {
  const metadata = contract?.metadata;
  if (metadata === null || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).signed_at;
  return typeof value === "string" && value !== "" ? value : null;
}
