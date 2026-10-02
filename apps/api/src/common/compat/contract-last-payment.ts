/**
 * contracts.metadata "last payment" keys (written when a linked transaction is paid).
 *
 * The persisted jsonb KEYS were Portuguese (ultimo_pagamento_em / _valor / _por). Canonical
 * English keys: last_payment_at, last_payment_amount, last_payment_by.
 *
 * Expand/contract (migration 20260930000023): the writer is canonical and removes the legacy
 * keys it finds; `readLastPayment` reads both spellings (canonical wins). No reader exists in
 * the repository today (the keys are write-only); the reader is the documented dual-read
 * contract for any future consumer. Removal condition: the census in
 * docs/runbooks/staging-to-production.md#residue-census-20260930000023 returns 0 for one release window.
 */
export const LEGACY_LAST_PAYMENT_KEYS = {
  ultimo_pagamento_em: 'last_payment_at',
  ultimo_pagamento_valor: 'last_payment_amount',
  ultimo_pagamento_por: 'last_payment_by',
} as const;

export interface LastPayment {
  at: unknown;
  amount: unknown;
  by: unknown;
}

/** New metadata object with the canonical last-payment keys set and the legacy ones removed; every other key is preserved. */
export function withLastPayment(metadata: Record<string, unknown> | null | undefined, payment: LastPayment): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...(metadata ?? {}) };
  for (const legacy of Object.keys(LEGACY_LAST_PAYMENT_KEYS)) delete rest[legacy];
  return { ...rest, last_payment_at: payment.at, last_payment_amount: payment.amount, last_payment_by: payment.by };
}

/** Last payment of a contract, reading the canonical keys first and the legacy ones as fallback. */
export function readLastPayment(metadata: Record<string, unknown> | null | undefined): LastPayment {
  const m = metadata ?? {};
  const pick = (canonical: string, legacy: string): unknown => (m[canonical] !== undefined ? m[canonical] : m[legacy]);
  return {
    at: pick('last_payment_at', 'ultimo_pagamento_em'),
    amount: pick('last_payment_amount', 'ultimo_pagamento_valor'),
    by: pick('last_payment_by', 'ultimo_pagamento_por'),
  };
}
