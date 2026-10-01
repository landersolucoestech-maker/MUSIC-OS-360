/** Machine sentinel for "value not available yet" (English canonical). */
export const PENDING_VALUE = "pending";

/** Accepts the canonical sentinel and the deprecated PT-BR spelling. */
export function isPendingValue(value: unknown): boolean {
  return value === PENDING_VALUE || value === "pendente";
}
