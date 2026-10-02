import {
  DistributorSubmissionPayload,
  ExternalDataExchangeProvider,
  ExternalDataRequestContext,
  ExternalDataSubmissionResult,
  ExternalDataWebhookPayload,
} from './external-data.types';
import { CapabilityUnavailableError } from './capability-unavailable.error';

export class UnconfiguredDistributorProvider implements ExternalDataExchangeProvider<DistributorSubmissionPayload> {
  readonly metadata = {
    providerId: 'distributor-provider-not-configured',
    displayName: 'Distributor Provider Not Configured',
    kind: 'distributor' as const,
    supportsSubmit: false,
    supportsStatusCheck: false,
    mock: false,
    unconfigured: true,
  };

  async submit(
    _payload: DistributorSubmissionPayload,
    _context: ExternalDataRequestContext,
  ): Promise<ExternalDataSubmissionResult> {
    throw new CapabilityUnavailableError('distributor_submission');
  }

  async checkStatus(
    _submissionId: string,
    _context: ExternalDataRequestContext,
  ): Promise<ExternalDataSubmissionResult> {
    throw new CapabilityUnavailableError('distributor_status');
  }

  normalizeWebhook(_payload: Record<string, unknown>): ExternalDataWebhookPayload {
    throw new CapabilityUnavailableError('distributor_status');
  }
}
