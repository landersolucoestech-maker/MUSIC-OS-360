import { NotificationsQueueService } from './notifications-queue.service';
import { NOTIFICATION_JOB_NAMES } from '../queue.constants';
import type { NotificationPayload } from '../processors/notifications.processor';

/**
 * Regression test for a real bug found in Part 68: the producer enqueued
 * jobs under the literal name 'notification', while NotificationsProcessor's
 * switch(job.name) only handles NOTIFICATION_JOB_NAMES.SEND ('send') and
 * BROADCAST_TENANT ('broadcast-tenant') — every notification silently fell
 * into the `default:` branch and was never persisted nor broadcast. This
 * test pins the producer's job name to the processor's constants so the two
 * can never drift apart silently again.
 */
describe('NotificationsQueueService', () => {
  const payload: NotificationPayload = { tenantId: 't1', userId: 'u1', title: 'T', type: 'info' };

  function makeService(queue: { add: jest.Mock } | null) {
    return new NotificationsQueueService(queue as any);
  }

  it('enqueues under NOTIFICATION_JOB_NAMES.SEND so the processor actually handles it', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const service = makeService({ add });

    await service.enqueue(payload);

    expect(add).toHaveBeenCalledWith(NOTIFICATION_JOB_NAMES.SEND, payload, expect.any(Object));
  });

  it('enqueueUrgent also uses NOTIFICATION_JOB_NAMES.SEND', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const service = makeService({ add });

    await service.enqueueUrgent(payload);

    expect(add).toHaveBeenCalledWith(NOTIFICATION_JOB_NAMES.SEND, payload, expect.any(Object));
  });

  it('is a silent no-op when the queue is unavailable (Redis unreachable)', async () => {
    const service = makeService(null);
    await expect(service.enqueue(payload)).resolves.toBeUndefined();
  });
});
