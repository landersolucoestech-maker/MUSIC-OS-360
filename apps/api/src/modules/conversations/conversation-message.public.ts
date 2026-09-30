/**
 * Public projection of a conversation message.
 *
 * `metadata.delivery_error` persists the raw provider diagnostic (WhatsApp Cloud
 * API text) for internal use only; responses expose the stable
 * `metadata.delivery_error_code`. Legacy rows that only carry the raw text get
 * the generic DELIVERY_FAILED code. The raw text never leaves the API.
 */
export function toPublicConversationMessage<T extends { metadata?: Record<string, unknown> | null }>(message: T): T {
  const metadata = message.metadata;
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, 'delivery_error')) return message;
  const { delivery_error: rawDiagnostic, ...rest } = metadata;
  if (rest['delivery_error_code'] == null && rawDiagnostic != null) rest['delivery_error_code'] = 'DELIVERY_FAILED';
  return { ...message, metadata: rest };
}
