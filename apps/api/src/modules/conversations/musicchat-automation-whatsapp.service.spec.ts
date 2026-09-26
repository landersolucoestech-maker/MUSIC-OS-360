import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MusicChatAutomationService } from './musicchat-automation.service';
import { WhatsAppError } from '../integrations/whatsapp/whatsapp.errors';

/**
 * Decision Gate item 14 (GAP-18): real WhatsApp escalation, with production
 * controls — the channel must be enabled, the provider configured, the
 * recipient must have a phone, an anti-spam per-minute limit, an honest
 * status (sent/failed, never fabricated), and a controlled, limited retry.
 */
function makeQb(overrides: Partial<Record<string, unknown>> = {}) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
  };
  Object.assign(qb, overrides);
  return qb;
}

function makeService(opts: {
  channelEnabled?: boolean;
  configured?: boolean;
  memberPhone?: string | null;
  recentSends?: number;
} = {}) {
  const {
    channelEnabled = true, configured = true, memberPhone = '+5511999999999', recentSends = 0,
  } = opts;

  const notificationQb = makeQb({ getCount: jest.fn().mockResolvedValue(recentSends) });
  const memberQb = makeQb({ getOne: jest.fn().mockResolvedValue(memberPhone ? { phone: memberPhone } : null) });

  const notificationRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'notif-1', metadata: {}, ...(v as object) })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => notificationQb),
  };
  const orgMemberRepo = { createQueryBuilder: jest.fn(() => memberQb) };
  const settingsRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 's1', tenant_id: 't1', notification_channels: { in_app: true, whatsapp: channelEnabled, sms: false },
    }),
  };
  const eventRepo = { create: jest.fn((v: unknown) => v), save: jest.fn().mockResolvedValue({}) };

  const ds = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'MusicChatAutomationNotificationEntity') return notificationRepo;
      if (entity.name === 'OrgMemberEntity') return orgMemberRepo;
      if (entity.name === 'MusicChatAutomationSettingsEntity') return settingsRepo;
      if (entity.name === 'MusicChatAutomationEventEntity') return eventRepo;
      return { createQueryBuilder: jest.fn(() => makeQb()) };
    }),
  };

  const notifications = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = {
    isConfigured: jest.fn().mockResolvedValue(configured),
    sendTextMessage: jest.fn().mockResolvedValue({ externalMessageId: 'wamid.123' }),
  };

  const ws = { sendToTenant: jest.fn(), sendToUser: jest.fn(), notifyDataChanged: jest.fn() };

  const svc = new MusicChatAutomationService(ds as never, notifications as never, whatsapp as never, ws as never);
  return { svc, notificationRepo, orgMemberRepo, settingsRepo, whatsapp, notifications, ws };
}

const baseDto = {
  conversationId: 'conv-1', level: 'manager', recipientUserId: 'auth-user-1',
  channel: 'whatsapp' as const, title: 'Escalonamento', body: 'Conversa sem resposta',
};

describe('MusicChatAutomationService — WhatsApp escalation (Decision Gate item 14)', () => {
  it('does not send and marks CHANNEL_DISABLED when the whatsapp channel is disabled in settings', async () => {
    const { svc, notificationRepo } = makeService({ channelEnabled: false });
    await svc.sendNotification('t1', baseDto);

    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notif-1' }),
      expect.objectContaining({
        status: 'failed',
        metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ sent: false, code: 'CHANNEL_DISABLED' }) }),
      }),
    );
  });

  it('does not send and marks PROVIDER_NOT_CONFIGURED when the WhatsApp Cloud API is not configured', async () => {
    const { svc, notificationRepo, whatsapp } = makeService({ configured: false });
    await svc.sendNotification('t1', baseDto);

    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ code: 'PROVIDER_NOT_CONFIGURED' }) }) }),
    );
  });

  it('does not send and marks INVALID_RECIPIENT when the recipient has no registered phone', async () => {
    const { svc, notificationRepo, whatsapp } = makeService({ memberPhone: null });
    await svc.sendNotification('t1', baseDto);

    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ code: 'INVALID_RECIPIENT' }) }) }),
    );
  });

  it("does not send and marks RATE_LIMITED when the tenant's per-minute limit is reached", async () => {
    const { svc, notificationRepo, whatsapp } = makeService({ recentSends: 20 });
    await svc.sendNotification('t1', baseDto);

    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ code: 'RATE_LIMITED' }) }) }),
    );
  });

  it('actually sends and marks status=sent with the real message id when all controls pass', async () => {
    const { svc, notificationRepo, whatsapp } = makeService();
    await svc.sendNotification('t1', baseDto);

    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith('t1', '+5511999999999', baseDto.body);
    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'sent',
        metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ sent: true, externalMessageId: 'wamid.123' }) }),
      }),
    );
  });

  it('honestly marks status=failed (never a fake "sent") when the Meta API rejects the send', async () => {
    const { svc, notificationRepo, whatsapp } = makeService();
    whatsapp.sendTextMessage.mockRejectedValueOnce(new WhatsAppError('WHATSAPP_INVALID_RECIPIENT', 'Número inválido'));

    await svc.sendNotification('t1', baseDto);

    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'failed',
        metadata: expect.objectContaining({ externalDelivery: expect.objectContaining({ sent: false, code: 'WHATSAPP_INVALID_RECIPIENT' }) }),
      }),
    );
  });

  it('sms channel honestly remains prepared_not_sent_in_production — never calls the WhatsApp provider', async () => {
    const { svc, whatsapp } = makeService();
    await svc.sendNotification('t1', { ...baseDto, channel: 'sms' });
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
    expect(whatsapp.isConfigured).not.toHaveBeenCalled();
  });
});

describe('MusicChatAutomationService.retryNotification', () => {
  it('404 when the notification does not exist', async () => {
    const { svc, notificationRepo } = makeService();
    notificationRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.retryNotification('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a resend for a channel that is not whatsapp', async () => {
    const { svc, notificationRepo } = makeService();
    notificationRepo.findOne.mockResolvedValueOnce({ id: 'n1', channel: 'sms', status: 'failed', metadata: {} });
    await expect(svc.retryNotification('t1', 'n1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a resend of a notification that is not in failed status', async () => {
    const { svc, notificationRepo } = makeService();
    notificationRepo.findOne.mockResolvedValueOnce({ id: 'n1', channel: 'whatsapp', status: 'sent', metadata: {} });
    await expect(svc.retryNotification('t1', 'n1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a resend after reaching the retry limit', async () => {
    const { svc, notificationRepo } = makeService();
    notificationRepo.findOne.mockResolvedValueOnce({ id: 'n1', channel: 'whatsapp', status: 'failed', metadata: { retryCount: 3 } });
    await expect(svc.retryNotification('t1', 'n1')).rejects.toThrow(/Limite de 3 tentativas/);
  });

  it('resends successfully and increments retryCount', async () => {
    const { svc, notificationRepo } = makeService();
    notificationRepo.findOne
      .mockResolvedValueOnce({ id: 'n1', conversation_id: 'conv-1', channel: 'whatsapp', status: 'failed', metadata: { retryCount: 0 } })
      .mockResolvedValueOnce({ id: 'n1', conversation_id: 'conv-1', channel: 'whatsapp', status: 'prepared', metadata: { retryCount: 1 } })
      .mockResolvedValueOnce({ id: 'n1', conversation_id: 'conv-1', channel: 'whatsapp', status: 'sent', metadata: { retryCount: 1 } });

    const result = await svc.retryNotification('t1', 'n1');

    expect(notificationRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1' }),
      expect.objectContaining({ status: 'prepared', metadata: expect.objectContaining({ retryCount: 1 }) }),
    );
    expect(result.status).toBe('sent');
  });
});
