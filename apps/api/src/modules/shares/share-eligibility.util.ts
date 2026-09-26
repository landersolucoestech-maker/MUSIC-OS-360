/**
 * Share eligibility for registration submission (ABRAMUS/ECAD/etc.).
 *
 * TRANSITIONAL rule (Phase 5 / C6): `share_type` is only written by the
 * financial/pending flow (SharePendenteFormModal → shares.service.ts::toColumns()).
 * The registration flow (fields holder_name/party_role/percentage/
 * holder_document, fed via the holderName/role/holderDoc aliases)
 * never sets
 * `share_type` — today there is no dedicated creation path for registration
 * shares. That is why NULL is the only available signal for "did not come from the
 * financial form".
 *
 * This is NOT an FK/entity extraction nor a consolidation of concepts —
 * `share_type` is still written only by the financial flow. This
 * predicate only documents and centralizes the READ rule used by the
 * registration consumers (society-payload-builder, entity-validators,
 * external-data-exchange), so they never diverge from each other.
 *
 * TODO (future normalization, out of C6's scope): introduce an explicit
 * value (e.g. `share_type = 'registry'`) when the registration flow
 * gets its own creation path, removing the dependency on NULL.
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
