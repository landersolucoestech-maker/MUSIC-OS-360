/**
 * contracts/contract-provider-signature.ts
 *
 * Single authoritative implementation of how an e-signature provider
 * (Autentique, DocuSign) may change a contract, shared by both webhook
 * handlers and by ContractsService (which must not let clients forge the
 * provider linkage).
 *
 * Findings: find-dea10ba0 (status from any state), find-c610ccc0 (forgeable
 * linkage + first-match resolution), find-ea9d9d71 (linkage erased on update),
 * find-a38ac0c8 (redelivery re-applied side effects).
 *
 * Invariants:
 *  - A provider "signed/completed" callback applies SIGNED only from
 *    AWAITING_SIGNATURE — the only state the contract workflow allows into
 *    SIGNED. It never resurrects a cancelled contract nor regresses an
 *    in_force/expired/terminated one. The guard is in the UPDATE itself, so
 *    concurrent or repeated deliveries apply the transition exactly once.
 *  - The provider linkage (`autentique_doc_id`, metadata `provider*` keys)
 *    is server-owned: written only by sendForSignature, never by a client
 *    payload, and never erased by a client metadata update.
 */
import { EntityManager } from 'typeorm';
import { ContractStatus } from '@music-os-360/types';

export const PROVIDER_SIGNATURE_FROM_STATUS = ContractStatus.AWAITING_SIGNATURE;

export const SERVER_OWNED_CONTRACT_METADATA_KEYS = [
  'provider', 'provider_doc_id', 'provider_event_id', 'provider_status', 'synced_at',
] as const;

/** Removes server-owned provider keys from a client-supplied metadata object. */
export function stripServerOwnedMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out = { ...meta };
  for (const k of SERVER_OWNED_CONTRACT_METADATA_KEYS) delete out[k];
  return out;
}

/** Carries the current server-owned provider keys over a client metadata replacement. */
export function preserveServerOwnedMetadata(
  current: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out = stripServerOwnedMetadata(next);
  for (const k of SERVER_OWNED_CONTRACT_METADATA_KEYS) {
    if (current && current[k] !== undefined) out[k] = current[k];
  }
  return out;
}

export type ProviderSignatureOutcome = 'signed' | 'not_awaiting_signature';

/**
 * Applies a provider signature inside the caller's tenant transaction.
 * Returns 'signed' only when this call performed the AWAITING_SIGNATURE ->
 * SIGNED transition; otherwise records the provider status in metadata
 * (external reality stays visible) and changes nothing else.
 */
export async function applyProviderSignature(
  manager: EntityManager,
  p: { contractId: string; tenantId: string; provider: string; providerEventId: string; signedAt: string },
): Promise<ProviderSignatureOutcome> {
  const meta = JSON.stringify({
    provider: p.provider,
    provider_event_id: p.providerEventId,
    provider_status: 'signed',
    synced_at: p.signedAt,
  });
  const applied = await manager.query(
    `UPDATE contracts
        SET status = $4, updated_at = now(), metadata = metadata || $3::jsonb
      WHERE id = $1 AND tenant_id = $2 AND status = $5
      RETURNING id`,
    [p.contractId, p.tenantId, meta, ContractStatus.SIGNED, PROVIDER_SIGNATURE_FROM_STATUS],
  ) as unknown[];
  if (rowCount(applied) > 0) return 'signed';
  await manager.query(
    `UPDATE contracts SET metadata = metadata || $3::jsonb WHERE id = $1 AND tenant_id = $2`,
    [p.contractId, p.tenantId, meta],
  );
  return 'not_awaiting_signature';
}

// TypeORM's postgres driver returns [rows, count] for UPDATE ... RETURNING.
function rowCount(result: unknown): number {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[1];
  }
  return Array.isArray(result) ? result.length : 0;
}
