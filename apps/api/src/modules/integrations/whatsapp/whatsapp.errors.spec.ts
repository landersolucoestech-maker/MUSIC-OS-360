import { RECIPIENT_PHONE_MISSING, WhatsAppError, toWhatsAppDeliveryFailure } from './whatsapp.errors';

describe('toWhatsAppDeliveryFailure', () => {
  it('keeps the machine code and the technical message of a WhatsAppError', () => {
    const failure = toWhatsAppDeliveryFailure(
      new WhatsAppError('WHATSAPP_INVALID_RECIPIENT', 'WhatsApp Cloud API rejected the recipient: (#131026)'),
    );
    expect(failure).toEqual({
      code: 'WHATSAPP_INVALID_RECIPIENT',
      technicalMessage: 'WhatsApp Cloud API rejected the recipient: (#131026)',
    });
  });

  it('classifies any other error as an upstream failure', () => {
    expect(toWhatsAppDeliveryFailure(new Error('socket hang up'))).toEqual({
      code: 'WHATSAPP_UPSTREAM_ERROR',
      technicalMessage: 'socket hang up',
    });
    expect(toWhatsAppDeliveryFailure('boom').code).toBe('WHATSAPP_UPSTREAM_ERROR');
  });

  it('has a dedicated code for a conversation without a recipient phone', () => {
    expect(RECIPIENT_PHONE_MISSING.code).toBe('WHATSAPP_RECIPIENT_PHONE_MISSING');
  });
});
