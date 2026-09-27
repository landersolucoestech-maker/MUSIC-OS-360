import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationEntity } from '../../database/entities';
import { DOMAIN_EVENTS } from '../../core/events/events.service';

/**
 * Task M — real gap closed: `transfer()` used `convRepo.update()` directly
 * (without casUpdate), unlike `updateConversation()` which was already
 * protected since Task K. This spec proves the A/B scenario for `transfer()`.
 */
const TENANT = 'tenant-test';
const CONV_ID = 'conv-test';
const NOW = new Date('2026-08-15T10:00:00.000Z');

const baseConv = {
  id: CONV_ID,
  tenant_id: TENANT,
  contact_id: null,
  subject: 'Dúvida sobre contrato',
  status: 'open',
  channel: 'whatsapp',
  assigned_to: 'user-a',
  last_message_at: null,
  metadata: {},
  created_by: 'user-a',
  deleted_at: null,
  updated_at: NOW,
} as unknown as ConversationEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const qbResult = { getOne: jest.fn().mockResolvedValue(baseConv) };
  const convRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn(() => qbResult),
    })),
    update: jest.fn().mockResolvedValue(updateResult),
    create: jest.fn((data: unknown) => ({ id: 'msg-1', created_at: NOW, metadata: {}, ...(data as object) })),
    save: jest.fn(async (entity: unknown) => entity),
  };
  return {
    getRepository: jest.fn(() => convRepo),
    _convRepo: convRepo,
  };
}

function buildService(updateResult?: { affected: number }, whatsapp?: Record<string, jest.Mock>) {
  const mockDs = buildMockDs(updateResult);
  const mockEvents = { emitTyped: jest.fn() };
  const mockWs = { sendToTenant: jest.fn() };
  const mockWhatsapp = whatsapp ?? { sendTextMessage: jest.fn() };
  const service = new ConversationsService(mockDs as any, mockEvents as any, mockWs as any, mockWhatsapp as any);
  return { service, mockDs, mockEvents, mockWs, mockWhatsapp };
}

/**
 * find-5d9b853f: createConversation() used to emit DOMAIN_EVENTS.LEAD_UPDATED
 * for a brand-new conversation -- wrong event, wrong lifecycle stage (a
 * conversation is not a lead), likely a copy-paste leftover. Fixed to emit
 * the dedicated CONVERSATION_CREATED event instead.
 */
describe('ConversationsService.createConversation() — emits the correct domain event', () => {
  it('emits CONVERSATION_CREATED, never LEAD_UPDATED', async () => {
    const { service, mockEvents } = buildService();

    await service.createConversation(TENANT, 'user-a', { subject: 'Nova conversa' } as any);

    expect(mockEvents.emitTyped).toHaveBeenCalledWith(
      DOMAIN_EVENTS.CONVERSATION_CREATED,
      expect.objectContaining({ tenantId: TENANT, aggregateType: 'conversation' }),
    );
    expect(mockEvents.emitTyped).not.toHaveBeenCalledWith(DOMAIN_EVENTS.LEAD_UPDATED, expect.anything());
  });
});

describe('ConversationsService.transfer() — Task M optimistic concurrency', () => {
  it('without expectedUpdatedAt: applies unconditionally (backward compatible)', async () => {
    const { service, mockDs } = buildService({ affected: 1 });
    await service.transfer(TENANT, 'user-b', CONV_ID, { assignee_id: 'user-b' });
    expect(mockDs._convRepo.update).toHaveBeenCalledWith(
      { id: CONV_ID, tenant_id: TENANT },
      expect.objectContaining({ assigned_to: 'user-b' }),
    );
  });

  it('A/B scenario: A opens v.X and transfers (v.Y); B tries to transfer against v.X -> 409, never silently overwrites A', async () => {
    const { service, mockDs } = buildService({ affected: 0 });
    await expect(
      service.transfer(TENANT, 'user-b', CONV_ID, {
        assignee_id: 'user-b',
        expectedUpdatedAt: NOW.toISOString(),
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockDs._convRepo.update).toHaveBeenCalledTimes(1);
  });

  it('expectedUpdatedAt never leaks into the persisted column', async () => {
    const { service, mockDs } = buildService({ affected: 1 });
    await service.transfer(TENANT, 'user-b', CONV_ID, {
      assignee_id: 'user-b',
      expectedUpdatedAt: NOW.toISOString(),
    });
    const [, payload] = mockDs._convRepo.update.mock.calls[0];
    expect(payload).not.toHaveProperty('expectedUpdatedAt');
  });
});

/**
 * Section 13 (MusicChat Inbox — product decision 2026-08-22): server-side
 * tenant isolation review. Every real query uses createQueryBuilder with
 * tenant_id in the WHERE (defense in depth — RLS in
 * 20260521000040_ConversationsAndForms is the database-level guarantee). This
 * test proves the code-level guarantee: it is never possible to build a
 * query without the tenant_id filter, even if the call passes a conversation
 * id that belongs to another tenant.
 */
describe('ConversationsService — tenant isolation (Section 13)', () => {
  it('listConversations always filters by tenant_id in the initial WHERE', async () => {
    const { service: svc, mockDs } = buildService();
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) };
    mockDs._convRepo.createQueryBuilder = jest.fn(() => qb);

    await svc.listConversations('tenant-a', {});
    expect(qb.where).toHaveBeenCalledWith('c.tenant_id = :tenantId', { tenantId: 'tenant-a' });
  });

  it("findConversationById filters by id AND tenant_id together — never returns another tenant's conversation even with the correct id", async () => {
    const { service: svc, mockDs } = buildService();
    const qb = { where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
    mockDs._convRepo.createQueryBuilder = jest.fn(() => qb);

    await expect(svc.findConversationById('tenant-b', CONV_ID)).rejects.toThrow();
    expect(qb.where).toHaveBeenCalledWith(
      'c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL',
      { id: CONV_ID, tenantId: 'tenant-b' },
    );
  });

  it('listMessages filters messages by conversation_id AND tenant_id together', async () => {
    const { service: svc, mockDs } = buildService();
    // ds.getRepository(...) from the generic mock returns the same object for
    // any entity (convRepo === msgRepo here) — a single qb needs to
    // satisfy both findConversationById() (.where().getOne()) and
    // listMessages() (.where().orderBy().skip().take().getManyAndCount()).
    const qb = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(baseConv),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    mockDs._convRepo.createQueryBuilder = jest.fn(() => qb);

    await svc.listMessages('tenant-a', CONV_ID);
    expect(qb.where).toHaveBeenCalledWith(
      'm.conversation_id = :conversationId AND m.tenant_id = :tenantId',
      { conversationId: CONV_ID, tenantId: 'tenant-a' },
    );
  });
});

/**
 * addMessage() never dispatched to any external provider — an agent's reply
 * in a WhatsApp conversation never actually reached the contact (it was only
 * written to the database). Fixed: the whatsapp channel + sender_type='user'
 * now dispatches via the real WhatsAppCloudProvider, with an honest
 * delivery_status.
 */
describe('ConversationsService.addMessage() — real delivery on the external channel', () => {
  it("whatsapp conversation: dispatches via WhatsAppCloudProvider and marks delivery_status='sent'", async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ externalMessageId: 'wamid.123' });
    const { service, mockDs, mockWhatsapp } = buildService({ affected: 1 }, { sendTextMessage });
    mockDs._convRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn(() => ({
        getOne: jest.fn().mockResolvedValue({ ...baseConv, channel: 'whatsapp', metadata: { phone: '5511999999999' } }),
      })),
    }));

    await service.addMessage(TENANT, 'user-a', CONV_ID, { body: 'Olá, tudo bem?' });

    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(TENANT, '5511999999999', 'Olá, tudo bem?');
    const updateCalls = mockDs._convRepo.update.mock.calls;
    const metadataUpdate = updateCalls.find(([, payload]) => (payload as any)?.metadata?.delivery_status);
    expect(metadataUpdate?.[1]).toMatchObject({ metadata: { delivery_status: 'sent', external_message_id: 'wamid.123' } });
  });

  it('provider failure: never throws — persists the message and marks delivery_status=failed', async () => {
    const sendTextMessage = jest.fn().mockRejectedValue(new Error('WhatsApp Cloud API responded 401'));
    const { service, mockDs } = buildService({ affected: 1 }, { sendTextMessage });
    mockDs._convRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn(() => ({
        getOne: jest.fn().mockResolvedValue({ ...baseConv, channel: 'whatsapp', metadata: { phone: '5511999999999' } }),
      })),
    }));

    await expect(service.addMessage(TENANT, 'user-a', CONV_ID, { body: 'oi' })).resolves.toBeDefined();
    const updateCalls = mockDs._convRepo.update.mock.calls;
    const metadataUpdate = updateCalls.find(([, payload]) => (payload as any)?.metadata?.delivery_status === 'failed');
    expect(metadataUpdate).toBeDefined();
    // Machine code for the web copy mapping; the provider text stays as technical detail only.
    expect(metadataUpdate?.[1]).toMatchObject({
      metadata: { delivery_error_code: 'WHATSAPP_UPSTREAM_ERROR', delivery_error: 'WhatsApp Cloud API responded 401' },
    });
  });

  it("internal channel: never dispatches externally, marks delivery_status='internal_only'", async () => {
    const sendTextMessage = jest.fn();
    const { service, mockDs, mockWhatsapp } = buildService({ affected: 1 }, { sendTextMessage });
    mockDs._convRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn(() => ({
        getOne: jest.fn().mockResolvedValue({ ...baseConv, channel: 'internal', metadata: {} }),
      })),
    }));

    await service.addMessage(TENANT, 'user-a', CONV_ID, { body: 'nota interna' });

    expect(mockWhatsapp.sendTextMessage).not.toHaveBeenCalled();
    const updateCalls = mockDs._convRepo.update.mock.calls;
    const metadataUpdate = updateCalls.find(([, payload]) => (payload as any)?.metadata?.delivery_status === 'internal_only');
    expect(metadataUpdate).toBeDefined();
  });

  it("inbound message (sender_type='contact') never triggers an outbound dispatch", async () => {
    const sendTextMessage = jest.fn();
    const { service, mockDs, mockWhatsapp } = buildService({ affected: 1 }, { sendTextMessage });
    mockDs._convRepo.createQueryBuilder = jest.fn(() => ({
      where: jest.fn(() => ({
        getOne: jest.fn().mockResolvedValue({ ...baseConv, channel: 'whatsapp', metadata: { phone: '5511999999999' } }),
      })),
    }));

    await service.addMessage(TENANT, 'wa:5511999999999', CONV_ID, { body: 'oi' }, 'contact');

    expect(mockWhatsapp.sendTextMessage).not.toHaveBeenCalled();
  });
});
