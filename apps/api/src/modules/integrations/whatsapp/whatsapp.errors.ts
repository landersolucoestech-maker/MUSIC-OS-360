export type WhatsAppErrorCode =
  | 'WHATSAPP_NOT_CONFIGURED'
  | 'WHATSAPP_AUTH_ERROR'
  | 'WHATSAPP_INVALID_RECIPIENT'
  | 'WHATSAPP_RATE_LIMITED'
  | 'WHATSAPP_UPSTREAM_ERROR'
  | 'WHATSAPP_WEBHOOK_INVALID';

export class WhatsAppError extends Error {
  readonly code: WhatsAppErrorCode;

  constructor(code: WhatsAppErrorCode, message: string) {
    super(message);
    this.name = 'WhatsAppError';
    this.code = code;
  }
}

/**
 * Machine code of an outbound WhatsApp delivery failure, persisted on the
 * conversation message as `metadata.delivery_error_code`. The web maps it to
 * PT-BR end-user copy; `metadata.delivery_error` keeps the English technical
 * detail for diagnostics and is never rendered.
 */
export type WhatsAppDeliveryErrorCode = WhatsAppErrorCode | 'WHATSAPP_RECIPIENT_PHONE_MISSING';

export interface WhatsAppDeliveryFailure {
  readonly code: WhatsAppDeliveryErrorCode;
  readonly technicalMessage: string;
}

export const RECIPIENT_PHONE_MISSING: WhatsAppDeliveryFailure = {
  code: 'WHATSAPP_RECIPIENT_PHONE_MISSING',
  technicalMessage: 'Conversation metadata has no recipient phone (phone/external_contact_id)',
};

/** Classifies a send failure; unknown errors are upstream failures. */
export function toWhatsAppDeliveryFailure(err: unknown): WhatsAppDeliveryFailure {
  if (err instanceof WhatsAppError) return { code: err.code, technicalMessage: err.message };
  return { code: 'WHATSAPP_UPSTREAM_ERROR', technicalMessage: err instanceof Error ? err.message : String(err) };
}
