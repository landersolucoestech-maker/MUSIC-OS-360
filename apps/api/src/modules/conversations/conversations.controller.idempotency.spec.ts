import 'reflect-metadata';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ConversationsController } from './conversations.controller';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';

/**
 * PD-1 (2026-08-23): message send + conversation create need real protection against
 * network-level duplication (timeout+retry), not only the UI guard (isSending in
 * MusicChat.tsx). Confirms that @UseInterceptors(IdempotencyInterceptor) is really
 * applied to both methods — the decorator existing in the file is not enough, the
 * NestJS metadata must really list the interceptor on the right handler.
 */
describe('ConversationsController — idempotency wiring (PD-1)', () => {
  it('addMessage (POST :id/messages) has IdempotencyInterceptor attached', () => {
    const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, ConversationsController.prototype.addMessage);
    expect(interceptors).toContain(IdempotencyInterceptor);
  });

  it('create (POST /) has IdempotencyInterceptor attached', () => {
    const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, ConversationsController.prototype.create);
    expect(interceptors).toContain(IdempotencyInterceptor);
  });

  it('listMessages (GET :id/messages) does NOT have it — reads should not be idempotency-gated', () => {
    const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, ConversationsController.prototype.listMessages);
    expect(interceptors ?? []).not.toContain(IdempotencyInterceptor);
  });
});
