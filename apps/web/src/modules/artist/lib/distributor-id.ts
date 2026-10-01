/**
 * Distributor ids persisted on an artist (general_distributors[].id and the `distributors` of
 * relationships / linked_contacts / team_contacts). Canonical machine value is English: the option
 * "Outros" is `other`. Rows written before the BUG1 backfill (20260930000027) and older web builds
 * still carry `outros`: every reader maps it with canonicalDistributorId (dual-read).
 */
export const OTHER_DISTRIBUTOR_ID = "other";
const LEGACY_DISTRIBUTOR_IDS: Readonly<Record<string, string>> = { outros: OTHER_DISTRIBUTOR_ID };

export function canonicalDistributorId(id: string): string;
export function canonicalDistributorId(id: string | null | undefined): string | null | undefined;
export function canonicalDistributorId(id: string | null | undefined): string | null | undefined {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(LEGACY_DISTRIBUTOR_IDS, id)
    ? LEGACY_DISTRIBUTOR_IDS[id]
    : id;
}

export const isOtherDistributorId = (id: string | null | undefined): boolean => canonicalDistributorId(id) === OTHER_DISTRIBUTOR_ID;
