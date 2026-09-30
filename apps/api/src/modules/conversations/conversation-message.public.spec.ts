import { toPublicConversationMessage } from './conversation-message.public';

describe('toPublicConversationMessage', () => {
  it('drops the raw provider diagnostic and keeps the stable code', () => {
    const out = toPublicConversationMessage({
      id: 'm1',
      metadata: { delivery_status: 'failed', delivery_error_code: 'WHATSAPP_INVALID_RECIPIENT', delivery_error: '(#131026) Message undeliverable' },
    });
    expect(out.metadata).toEqual({ delivery_status: 'failed', delivery_error_code: 'WHATSAPP_INVALID_RECIPIENT' });
  });

  it('legacy rows with raw text only get a generic code', () => {
    const out = toPublicConversationMessage({ metadata: { delivery_status: 'failed', delivery_error: 'boom' } });
    expect(out.metadata).toEqual({ delivery_status: 'failed', delivery_error_code: 'DELIVERY_FAILED' });
  });

  it('does not mutate the persisted object and passes clean messages through', () => {
    const row = { metadata: { delivery_error: 'x', delivery_error_code: 'C' } };
    toPublicConversationMessage(row);
    expect(row.metadata.delivery_error).toBe('x');
    const clean = { metadata: null };
    expect(toPublicConversationMessage(clean)).toBe(clean);
  });
});
