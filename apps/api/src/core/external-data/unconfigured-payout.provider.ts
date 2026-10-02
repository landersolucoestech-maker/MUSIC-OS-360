import { CapabilityUnavailableError } from './capability-unavailable.error';
import { ExecutePayoutRequest, ExecutePayoutResult, PayoutPort } from './payout.port';

export class UnconfiguredPayoutProvider implements PayoutPort {
  async execute(_request: ExecutePayoutRequest): Promise<ExecutePayoutResult> {
    throw new CapabilityUnavailableError('payout');
  }
}
