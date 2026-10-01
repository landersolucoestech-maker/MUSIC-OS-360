import type { Logger } from '@nestjs/common';
import type { ApiErrorCode } from '@music-os-360/types';
import { redactDiagnosticText } from '../../core/filters/redact-diagnostic';

/**
 * Integration read endpoints answer HTTP 200 with a failure body. That body is
 * `{ error }` ONLY: the existing `error` field now carries a stable code from packages/types api-error-codes.ts.
 * Provider/HTTP detail stays in the (redacted, English) log line and never
 * reaches the response.
 */
export interface IntegrationFailureBody {
  error: ApiErrorCode;
}

/** Maps an upstream HTTP status to a stable failure code. */
export function codeForUpstreamStatus(status: number): ApiErrorCode {
  if (status === 401 || status === 403) return 'PROVIDER_UNAUTHORIZED';
  if (status === 429) return 'PROVIDER_RATE_LIMITED';
  return 'INTEGRATION_CALL_FAILED';
}

/** Builds the failure body and logs the (redacted) internal detail. */
export function integrationFailure(
  logger: Logger,
  code: ApiErrorCode,
  detail?: string | number | null,
): IntegrationFailureBody {
  const text = detail == null ? '' : redactDiagnosticText(String(detail));
  logger.warn(`Integration request failed: ${code}${text ? ` (${text})` : ''}`);
  return { error: code };
}
