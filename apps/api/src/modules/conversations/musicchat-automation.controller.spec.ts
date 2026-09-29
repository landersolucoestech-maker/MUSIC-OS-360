import 'reflect-metadata';
import { MusicChatAutomationController } from './musicchat-automation.controller';

/**
 * POST .../automation/notifications must go through the validated path
 * (conversation of the tenant + active-member recipient), never straight to
 * sendNotification (security re-review of 1dfd595, INFO).
 */
describe('MusicChatAutomationController.sendNotification', () => {
  it('delegates to sendManualNotification with the caller tenant', async () => {
    const service = { sendManualNotification: jest.fn().mockResolvedValue({ created: true }), sendNotification: jest.fn() };
    const controller = new MusicChatAutomationController(service as never, {} as never);
    const dto = { conversationId: '5b0f3c1e-0000-4000-8000-000000000001', level: 'supervisor', recipientUserId: 'u1', channel: 'in_app' as const, title: 'T' };
    await controller.sendNotification({ id: 't1' }, dto);
    expect(service.sendManualNotification).toHaveBeenCalledWith('t1', dto);
    expect(service.sendNotification).not.toHaveBeenCalled();
  });
});
