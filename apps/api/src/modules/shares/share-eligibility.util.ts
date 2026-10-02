/**
 * Share eligibility for registration submission (ABRAMUS/ECAD/etc.).
 *
 * TRANSITIONAL rule (Phase 5 / C6): `share_type` is only written by the
 * financial/pending flow (ShareFormModal → shares.service.ts::toColumns()).
 * The registration flow (fields holder_name/party_role/percentage/
 * holder_document, fed via the holderName/role/holderDoc aliases)
 * never sets
 * `share_type` — today there is no dedicated creation path for registration
 * shares. That is why NULL is the only available signal for "did not come from the
 * financial form".
 *
 * DECISION REQUIRED (share_type value set + backfill) — owner: project owner / product
 * - File/context: shares.share_type (varchar(30), nullable, entities.ts ShareEntity);
 *   written only by the financial flow (shares.service.ts::toColumns()); read as
 *   "NULL = registry split" by shares.service.ts (split budget),
 *   registry/validation/entity-validators.ts, registry/payloads/society-payload-builder
 *   and core/external-data/external-data-exchange.service.ts, all via this file.
 * - Decision: which signal marks a registration share, and the closed value set of share_type.
 * - Option A: explicit 'registry' value + CHECK constraint on the value set + backfill
 *   migration (UPDATE shares SET share_type='registry' WHERE share_type IS NULL), then
 *   change only this file (predicate + SQL constant) and the registration creation path.
 * - Option B: keep NULL as the signal (current behavior); document it as permanent.
 * - Consequences: A needs a schema + data migration (L5, destructive-data rules: compat
 *   window, rollback, old/new app coexistence) and the financial value set must be
 *   enumerated; B leaves the implicit-NULL coupling and no DB-level domain constraint.
 * - Impact: L5 (schema/data). Today no code path writes any registry value, so rows
 *   cannot be classified by code.
 * - Why not derivable: the canonical sources (canonical naming map, entities, migrations,
 *   DTOs) define no share_type value set and no registration creation path; existing
 *   financial values are free text (@MaxLength(30)) and cannot be enumerated from the repo.
 * Until decided: no schema change, NULL stays the signal; do not add new raw
 * `share_type IS NULL` checks outside this file (guarded by share-eligibility.guard.spec.ts).
 *
 * This is NOT an FK/entity extraction nor a consolidation of concepts —
 * `share_type` is still written only by the financial flow. This
 * predicate only documents and centralizes the READ rule used by the
 * registration consumers (society-payload-builder, entity-validators,
 * external-data-exchange), so they never diverge from each other.
 *
 * Called on entities already read from the database — `share_type` is never
 * `undefined` in that case (a column missing from the SELECT does not occur in the current
 * queries); the predicate does not treat `undefined` as eligible.
 */
export function isRegistryEligibleShare(share: { share_type: string | null }): boolean {
  return share.share_type === null;
}

/** SQL fragment equivalent to the predicate above, for use in query builders. */
export const REGISTRY_ELIGIBLE_SHARE_SQL = 'share_type IS NULL';
