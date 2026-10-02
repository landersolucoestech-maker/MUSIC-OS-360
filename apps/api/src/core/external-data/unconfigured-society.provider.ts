import {
  ExternalDataExchangeProvider,
  ExternalDataRequestContext,
  ExternalDataSubmissionResult,
  ExternalDataWebhookPayload,
  SocietyDataSubmissionPayload,
} from './external-data.types';
import { CapabilityUnavailableError } from './capability-unavailable.error';

export class UnconfiguredSocietyProvider implements ExternalDataExchangeProvider<SocietyDataSubmissionPayload> {
  readonly metadata = {
    providerId: 'society-provider-not-configured',
    displayName: 'Society Provider Not Configured',
    kind: 'society' as const,
    supportsSubmit: false,
    supportsStatusCheck: false,
    mock: false,
    unconfigured: true,
  };

  async submit(
    _payload: SocietyDataSubmissionPayload,
    _context: ExternalDataRequestContext,
  ): Promise<ExternalDataSubmissionResult> {
    throw new CapabilityUnavailableError('society_submission');
  }

  async checkStatus(
    _submissionId: string,
    _context: ExternalDataRequestContext,
  ): Promise<ExternalDataSubmissionResult> {
    throw new CapabilityUnavailableError('society_submission');
  }

  normalizeWebhook(_payload: Record<string, unknown>): ExternalDataWebhookPayload {
    throw new CapabilityUnavailableError('society_submission');
  }
}
