import { classifyFailureCode } from '@music-os-360/types';

/**
 * Public projection of an activity-log row. `metadata.error` persists the raw
 * provider/exception text (DocuSign, Autentique) for internal diagnosis; the
 * response exposes only the stable `error_code` derived from it.
 */
export function toPublicActivityLog<T extends { metadata?: Record<string, unknown> | null }>(row: T): T {
  const metadata = row.metadata;
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, 'error')) return row;
  const { error: rawError, ...rest } = metadata;
  if (rest['error_code'] == null && rawError != null) {
    rest['error_code'] = classifyFailureCode(String(rawError), 'INTEGRATION_CALL_FAILED');
  }
  return { ...row, metadata: rest };
}
