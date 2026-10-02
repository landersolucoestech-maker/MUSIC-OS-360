import { Injectable } from '@nestjs/common';
import {
  IntegrationTechnicalCapability,
  technicalCapabilityOf,
} from '../../modules/integrations/governance/integration-capability.registry';
import { ExternalDataProviderRegistry } from './external-data-provider-registry.service';
import type {
  CapabilityReadiness,
  CapabilityUnavailableReason,
  CapabilityUnavailableResult,
  ExternalCapability,
  ExternalDataProviderMetadata,
} from './external-data.types';

export const EXTERNAL_CAPABILITIES: readonly ExternalCapability[] = [
  'distributor_submission',
  'distributor_status',
  'audio_transcription',
  'payout',
];

const CONTRACT: Record<ExternalCapability, { expectedContract: string; fallback: string }> = {
  distributor_submission: {
    expectedContract: 'ExternalDataExchangeProvider<DistributorSubmissionPayload> with metadata.supportsSubmit=true',
    fallback: 'Submit the release manually at the distributor and record the protocol; nothing is sent from this platform.',
  },
  distributor_status: {
    expectedContract: 'ExternalDataExchangeProvider<DistributorSubmissionPayload> with metadata.supportsStatusCheck=true',
    fallback: 'Check the status manually at the distributor; no automatic synchronization is available.',
  },
  audio_transcription: {
    expectedContract: 'AudioTranscriptionPort.transcribe({ tenantId, assetId, idempotencyKey })',
    fallback: 'Provide the transcript manually; no automatic transcription is available.',
  },
  payout: {
    expectedContract: 'PayoutPort.execute({ tenantId, payoutId, amountMinor, currency, idempotencyKey })',
    fallback: 'Execute payments outside the platform and register the settlement manually; no money is moved here.',
  },
};

/** Capabilities backed by a registry provider kind, and the metadata flag that proves them. */
const REGISTRY_BACKED: Partial<Record<ExternalCapability, (m: ExternalDataProviderMetadata) => boolean>> = {
  distributor_submission: (m) => m.supportsSubmit,
  distributor_status: (m) => m.supportsStatusCheck,
};

/** Capabilities backed by a port; availability is the governance technical capability. */
const PORT_BACKED: Partial<Record<ExternalCapability, string>> = {
  audio_transcription: 'audio_transcription',
  payout: 'payout',
};

/**
 * Decides whether an external capability can run, from provider metadata only.
 * It never calls a provider and never reads configuration or the network.
 */
@Injectable()
export class ExternalCapabilityReadinessService {
  constructor(private readonly registry: ExternalDataProviderRegistry) {}

  check(capability: ExternalCapability, _tenantId?: string): CapabilityReadiness {
    const supports = REGISTRY_BACKED[capability];
    if (supports) return this.checkRegistry(capability, supports);

    const key = PORT_BACKED[capability];
    if (key && technicalCapabilityOf(key) === IntegrationTechnicalCapability.IMPLEMENTED) {
      return { available: true };
    }
    return this.unavailable(capability, 'NO_PROVIDER_CONFIGURED');
  }

  checkAll(tenantId?: string): Array<CapabilityReadiness & { capability: ExternalCapability }> {
    return EXTERNAL_CAPABILITIES.map((capability) => ({ capability, ...this.check(capability, tenantId) }));
  }

  private checkRegistry(
    capability: ExternalCapability,
    supports: (m: ExternalDataProviderMetadata) => boolean,
  ): CapabilityReadiness {
    const real = this.registry.list('distributor').filter((m) => !m.unconfigured);
    if (real.length === 0) return this.unavailable(capability, 'NO_PROVIDER_CONFIGURED');
    const nonMock = real.filter((m) => !m.mock);
    if (nonMock.length === 0) return this.unavailable(capability, 'PROVIDER_DISABLED');
    if (!nonMock.some(supports)) return this.unavailable(capability, 'PROVIDER_LACKS_CAPABILITY');
    return { available: true };
  }

  private unavailable(capability: ExternalCapability, reason: CapabilityUnavailableReason): CapabilityUnavailableResult {
    return {
      available: false,
      capability,
      code: 'CAPABILITY_UNAVAILABLE',
      reason,
      ...CONTRACT[capability],
    };
  }
}
