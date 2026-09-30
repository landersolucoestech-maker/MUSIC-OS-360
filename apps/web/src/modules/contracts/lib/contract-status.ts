/**
 * Contract status vocabulary for the web module.
 *
 * Single source of truth = `ContractStatus` (@music-os-360/types), which mirrors the
 * DB CHECK `chk_contract_status` (migration 20260910000010). Values are English
 * technical ids; labels are PT-BR user copy from `CONTRACT_STATUS_LABELS_PT_BR`.
 * Nothing outside `ContractStatus` may be offered, accepted or bucketed here.
 */
import { ContractStatus, CONTRACT_STATUS_LABELS_PT_BR } from "@music-os-360/types";

export { ContractStatus };

export const CONTRACT_STATUS_VALUES = Object.values(ContractStatus) as ContractStatus[];

/** `[value, PT-BR label]` pairs in lifecycle order, for status selects. */
export const CONTRACT_STATUS_OPTIONS: ReadonlyArray<readonly [ContractStatus, string]> =
  CONTRACT_STATUS_VALUES.map((value) => [value, CONTRACT_STATUS_LABELS_PT_BR[value]] as const);

export type ContractStatusBucket = "in_force" | "signed" | "awaiting_signature" | "closed" | "under_review";

/**
 * KPI partition: every ContractStatus belongs to EXACTLY one bucket.
 * `expiring` is still running (it only signals an approaching end date), so it
 * counts as "in_force"; `expired`, `terminated` and `cancelled` are "closed".
 */
export const CONTRACT_STATUS_BUCKETS: Readonly<Record<ContractStatusBucket, readonly ContractStatus[]>> = {
  in_force: [ContractStatus.IN_FORCE, ContractStatus.ACTIVE, ContractStatus.EXPIRING],
  signed: [ContractStatus.SIGNED],
  awaiting_signature: [ContractStatus.AWAITING_SIGNATURE],
  closed: [ContractStatus.EXPIRED, ContractStatus.TERMINATED, ContractStatus.CANCELLED],
  under_review: [ContractStatus.DRAFT, ContractStatus.UNDER_REVIEW],
};

/**
 * Bucket of a raw status string coming from the API. A value outside the
 * canonical enum cannot exist (DB CHECK); it is counted under "under_review" only so
 * the KPI total stays equal to the list total if such a row ever appears.
 */
export function contractStatusBucket(status?: string | null): ContractStatusBucket {
  const s = (status ?? "").toLowerCase();
  for (const bucket of Object.keys(CONTRACT_STATUS_BUCKETS) as ContractStatusBucket[]) {
    if ((CONTRACT_STATUS_BUCKETS[bucket] as readonly string[]).includes(s)) return bucket;
  }
  return "under_review";
}
