import { hasOwnKey } from "@/shared/lib/own-property";
/**
 * Canonical user (org member) status. Machine values are English and match the
 * API vocabulary (`active | inactive | suspended | invited`, users.dto.ts STATUSES).
 * Visible labels are PT-BR and live only in USER_STATUS_LABELS.
 */
export type UserStatus = "active" | "inactive" | "suspended" | "invited";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
  invited: "Pendente",
};

/** Dual-read: values stored by older sessions/forms (ativo | inativo | suspenso | pendente) map to the canonical value. */
const LEGACY_USER_STATUS: Record<string, UserStatus> = {
  ativo: "active",
  inativo: "inactive",
  suspenso: "suspended",
  pendente: "invited",
};

export function normalizeUserStatus(value: unknown, fallback: UserStatus = "active"): UserStatus {
  if (typeof value !== "string") return fallback;
  const key = value.trim().toLowerCase();
  if (hasOwnKey(USER_STATUS_LABELS, key)) return key as UserStatus;
  return hasOwnKey(LEGACY_USER_STATUS, key) ? LEGACY_USER_STATUS[key] : fallback;
}

export function userStatusLabel(value: unknown): string {
  return USER_STATUS_LABELS[normalizeUserStatus(value)];
}
