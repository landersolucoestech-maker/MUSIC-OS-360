import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { API_ERROR_CODE_COPY_PT_BR } from '@music-os-360/types';
import { redactDiagnosticText } from '../../core/filters/redact-diagnostic';

/**
 * 503 for a failed external provider call. The response carries the stable
 * INTEGRATION_CALL_FAILED code and PT-BR copy only; the raw provider/network
 * text is logged (redacted) and may be persisted internally by the caller, but
 * is never part of the response.
 */
export function providerCallFailed(logger: Logger, provider: string, rawDiagnostic: string): ServiceUnavailableException {
  logger.error(`${provider} call failed: ${redactDiagnosticText(rawDiagnostic)}`);
  return new ServiceUnavailableException({
    error: 'INTEGRATION_CALL_FAILED',
    message: API_ERROR_CODE_COPY_PT_BR.INTEGRATION_CALL_FAILED,
  });
}
