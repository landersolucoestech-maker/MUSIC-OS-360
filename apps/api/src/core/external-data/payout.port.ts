/**
 * Port for payment execution (paying out royalties). Distinct from subscription billing.
 * No provider exists today: only UnconfiguredPayoutProvider.
 */
export const PAYOUT_PORT = Symbol('PAYOUT_PORT');

export interface ExecutePayoutRequest {
  tenantId: string;
  payoutId: string;
  /** Integer minor units (cents). Never a float. */
  amountMinor: number;
  /** ISO 4217 code. */
  currency: string;
  /** Same key must never move money twice. */
  idempotencyKey: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface ExecutePayoutResult {
  payoutId: string;
  providerPayoutId: string;
  status: PayoutStatus;
  amountMinor: number;
  currency: string;
  executedAt: string | null;
}

export interface PayoutPort {
  execute(request: ExecutePayoutRequest): Promise<ExecutePayoutResult>;
}
