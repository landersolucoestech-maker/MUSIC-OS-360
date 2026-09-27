/**
 * Normative LARGEST REMAINDER algorithm for financial allocations
 * (Phases 11 §13 / 12 §10 / 13A Step 12) — exact equivalent of the SQL function
 * fn_largest_remainder (migration 20260718000005_TransactionAllocations).
 *
 * 100% integer arithmetic (BigInt) — NEVER float (precision invariant):
 * - monetary values in cents (amount with up to 2 decimal places);
 * - percentages in ten-thousandths (numeric(7,4) → integer ×10,000).
 *
 * Rules:
 * 1. target_total = round(amount × Σpct / 100, 2)  [half-up]
 * 2. raw_i = amount × pct_i / 100 (exact); floor_i = trunc(raw_i, 2)
 * 3. the residue (cents) is distributed in steps of 0.01 by LARGEST fraction;
 *    tie → LOWEST input index (deterministic and stable)
 * 4. Σ result = target_total (exact reconciliation — I7)
 * 5. Σpct > 100, pct ≤ 0, pct > 100, amount ≤ 0 → error (I5/validations)
 * 6. a resulting share of R$ 0.00 → error (CHECK allocated_amount > 0)
 */

const PCT_SCALE = 10_000n; // numeric(7,4)
const HUNDRED = 100n * PCT_SCALE; // 100% in ten-thousandths

export class LargestRemainderError extends Error {
  constructor(
    readonly code:
      | 'INVALID_AMOUNT'
      | 'EMPTY_PERCENTAGES'
      | 'INVALID_PERCENTAGE'
      | 'SUM_EXCEEDS_100'
      | 'SHARE_ROUNDS_TO_ZERO',
    message: string,
  ) {
    super(message);
    this.name = 'LargestRemainderError';
  }
}

/** "1234.56" | 1234.56 → 123456n (cents). Rejects >2 decimal places and non-numeric input. */
function toCents(value: string | number): bigint {
  const s = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new LargestRemainderError('INVALID_AMOUNT', `invalid monetary amount: "${s}"`);
  const frac = (m[2] ?? '').padEnd(2, '0');
  return BigInt(m[1]) * 100n + BigInt(frac);
}

/** "33.3333" | 60 → 333333n | 600000n (ten-thousandths). At most 4 decimal places. */
function toPctScaled(value: string | number, index: number): bigint {
  const s = typeof value === 'number' ? value.toFixed(4) : String(value).trim();
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(s);
  if (!m) {
    throw new LargestRemainderError('INVALID_PERCENTAGE', `invalid percentage at position ${index}: "${s}"`);
  }
  const frac = (m[2] ?? '').padEnd(4, '0');
  return BigInt(m[1]) * PCT_SCALE + BigInt(frac);
}

function centsToString(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  return `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

/**
 * Distributes `amount` over the `percentages` of ONE dimension.
 * Returns the allocated values as 2-decimal strings ("600.00").
 */
export function largestRemainder(
  amount: string | number,
  percentages: Array<string | number>,
): string[] {
  const amountCents = toCents(amount);
  if (amountCents <= 0n) {
    throw new LargestRemainderError('INVALID_AMOUNT', 'amount must be > 0');
  }
  if (percentages.length === 0) {
    throw new LargestRemainderError('EMPTY_PERCENTAGES', 'empty percentage list');
  }

  const pcts = percentages.map((p, i) => {
    const scaled = toPctScaled(p, i);
    if (scaled <= 0n || scaled > HUNDRED) {
      throw new LargestRemainderError(
        'INVALID_PERCENTAGE',
        `percentage out of range (0,100] at position ${i}`,
      );
    }
    return scaled;
  });

  const sumPct = pcts.reduce((a, b) => a + b, 0n);
  if (sumPct > HUNDRED) {
    throw new LargestRemainderError('SUM_EXCEEDS_100', 'sum of percentages exceeds 100 (I5)');
  }

  // Unit of work: amountCents × pctScaled  (cents × 10^6).
  // target total in cents = round(amountCents × sumPct / 10^6) [half-up].
  const UNIT = 100n * PCT_SCALE; // 10^6
  const targetRaw = amountCents * sumPct;
  const targetCents = targetRaw / UNIT + (targetRaw % UNIT >= UNIT / 2n ? 1n : 0n);

  const floors: bigint[] = [];
  const fracs: bigint[] = [];
  for (const pct of pcts) {
    const raw = amountCents * pct; // cents × 10^6, exact
    floors.push(raw / UNIT);
    fracs.push(raw % UNIT);
  }

  let residue = targetCents - floors.reduce((a, b) => a + b, 0n);
  // residue < n cents by construction; distributed by largest fraction,
  // tie → lowest index (ascending scan with strict comparison).
  while (residue > 0n) {
    let pick = -1;
    let best = -1n;
    for (let i = 0; i < fracs.length; i++) {
      if (fracs[i] > best) {
        best = fracs[i];
        pick = i;
      }
    }
    floors[pick] += 1n;
    fracs[pick] = -2n; // consumed
    residue -= 1n;
  }

  return floors.map((cents, i) => {
    if (cents === 0n) {
      throw new LargestRemainderError(
        'SHARE_ROUNDS_TO_ZERO',
        `infeasible split: share at position ${i} results in R$ 0,00 (allocated_amount > 0)`,
      );
    }
    return centsToString(cents);
  });
}
