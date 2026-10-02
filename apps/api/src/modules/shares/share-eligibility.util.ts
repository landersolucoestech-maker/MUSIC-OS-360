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
 * share_type value set (FIXED, enforced at the API): the FINANCIAL shares use exactly
 * SHARE_TYPES = ['internal_release', 'external_receivable'] (share-legacy-fields.ts);
 * CreateShareDto/UpdateShareDto/QueryShareDto reject any other value. The field stays
 * optional: registry/integration writers omit it and the row keeps NULL (no DB default,
 * no CHECK constraint, no migration).
 *
 * DECISION REQUIRED (remaining) — owner: project owner / product
 * - File/context: shares.share_type (varchar(30), nullable, entities.ts ShareEntity);
 *   read as "NULL = registry split" by shares.service.ts (split budget),
 *   registry/validation/entity-validators.ts, registry/payloads/society-payload-builder
 *   and core/external-data/external-data-exchange.service.ts, all via this file.
 * - Decision (a): whether registry splits get an explicit token (e.g. 'registry') instead
 *   of NULL. That needs a CHECK constraint + schema migration (L5) and a change of only
 *   this file (predicate + SQL constant) plus the registration creation path.
 * - Decision (b): whether to execute a backfill of historical NULL rows (L5, destructive-data
 *   rules; needs a production census first). Historical financial rows written before the
 *   field existed are NULL and are indistinguishable from registry splits by this column.
 *   Deterministic inference (web resolveShareType, share-format.tsx): explicit share_type
 *   wins; else release_id set -> internal_release; else music_title/payer/external_artist_name
 *   set -> external_receivable; else internal_release (conservative default). Ambiguous case:
 *   a NULL row with none of those fields (e.g. work_id + holder only) is either a registry
 *   split or an internal financial split; the web default treats it as internal, but
 *   backfilling that would REMOVE it from the registry split budget, so it cannot be
 *   decided by code.
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
