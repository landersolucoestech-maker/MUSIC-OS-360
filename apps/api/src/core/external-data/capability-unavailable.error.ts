import { ServiceUnavailableException } from '@nestjs/common';
import type { CapabilityUnavailableReason, ExternalCapability } from './external-data.types';

/** `society_submission` is a registry-level capability outside the four readiness-tracked ones. */
export type CapabilityName = ExternalCapability | 'society_submission';

/**
 * Thrown by every unconfigured adapter and by the provider registry. The body carries stable
 * codes only: no provider ids, URLs, credentials or raw upstream text.
 * The message embeds the code so classifyFailureCode() resolves CAPABILITY_UNAVAILABLE.
 */
export class CapabilityUnavailableError extends ServiceUnavailableException {
  readonly code = 'CAPABILITY_UNAVAILABLE' as const;

  constructor(
    readonly capability: CapabilityName,
    readonly reason: CapabilityUnavailableReason = 'NO_PROVIDER_CONFIGURED',
  ) {
    const message = `CAPABILITY_UNAVAILABLE: ${capability} (${reason})`;
    super({ error: 'CAPABILITY_UNAVAILABLE', capability, reason, message });
  }
}
