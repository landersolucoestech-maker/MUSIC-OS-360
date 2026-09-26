/**
 * stripe-key-guard.ts  (Part 72)
 *
 * Safe classification of Stripe keys — never prints the key value,
 * only its state. This part of the project uses Stripe exclusively in TEST
 * MODE (see the absolute rules of Parts 69-72): an `sk_live_`/
 * `pk_live_` key is always rejected here, in any environment, not only in
 * DEV/STAGING — there is no "production with live Stripe" phase enabled yet.
 *
 * `classifyStripeSecretKeyFormat` is synchronous and makes no network
 * call — safe to run at boot/build. It CANNOT detect a
 * revoked/expired key (the format stays valid); that is only observable by
 * calling the Stripe API, which `checkStripeKeyLiveness` does on demand
 * (never automatically at boot/build).
 */

export type StripeKeyFormatState =
  | 'MISSING'
  | 'INVALID_FORMAT'
  | 'LIVE_KEY_REJECTED'
  | 'VALID_TEST_KEY';

export type StripeKeyLivenessState =
  | 'VALID_TEST_KEY'
  | 'EXPIRED_OR_REVOKED'
  | 'NETWORK_ERROR';

const TEST_KEY_PATTERN = /^[sr]k_test_/;
const LIVE_KEY_PATTERN = /^[sr]k_live_/;

export function classifyStripeSecretKeyFormat(key: string | undefined | null): StripeKeyFormatState {
  if (!key || key.trim() === '') return 'MISSING';
  if (LIVE_KEY_PATTERN.test(key)) return 'LIVE_KEY_REJECTED';
  if (TEST_KEY_PATTERN.test(key)) return 'VALID_TEST_KEY';
  return 'INVALID_FORMAT';
}

export function classifyStripePublishableKeyFormat(key: string | undefined | null): StripeKeyFormatState {
  if (!key || key.trim() === '') return 'MISSING';
  if (/^pk_live_/.test(key)) return 'LIVE_KEY_REJECTED';
  if (/^pk_test_/.test(key)) return 'VALID_TEST_KEY';
  return 'INVALID_FORMAT';
}

/**
 * Calls GET /v1/balance — an authenticated, read-only endpoint without side
 * effects — only to confirm the key is still accepted by Stripe.
 * Must never be called automatically at boot; it is for on-demand use
 * (e.g. a readiness endpoint or a manual verification script).
 */
export async function checkStripeKeyLiveness(key: string): Promise<StripeKeyLivenessState> {
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
    });
    if (res.ok) return 'VALID_TEST_KEY';
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = body?.error?.message ?? '';
    if (/expired|revoked/i.test(message)) return 'EXPIRED_OR_REVOKED';
    return 'EXPIRED_OR_REVOKED';
  } catch {
    return 'NETWORK_ERROR';
  }
}
