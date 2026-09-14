import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationEntity } from '../../database/entities';
import { DOMAIN_EVENTS } from '../../core/events/events.service';

/**
 * Task M — gap real fechado: `transfer()` usava `convRepo.update()` direto
 * (sem casUpdate), diferente de `updateConversation()` que já estava
 * protegido desde a Task K. Este spec prova o cenário A/B para `transfer()`.
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

describe('ConversationsService.transfer() — Task M concorrência otimista', () => {
  it('sem expectedUpdatedAt: aplica incondicionalmente (retrocompatível)', async () => {
    const { service, mockDs } = buildService({ affected: 1 });
    await service.transfer(TENANT, 'user-b', CONV_ID, { assignee_id: 'user-b' });
    expect(mockDs._convRepo.update).toHaveBeenCalledWith(
      { id: CONV_ID, tenant_id: TENANT },
      expect.objectContaining({ assigned_to: 'user-b' }),
    );
  });

  it('cenário A/B: A abre v.X e transfere (v.Y); B tenta transferir contra v.X -> 409, nunca sobrescreve A em silêncio', async () => {
    const { service, mockDs } = buildService({ affected: 0 });
    await expect(
      service.transfer(TENANT, 'user-b', CONV_ID, {
        assignee_id: 'user-b',
        expectedUpdatedAt: NOW.toISOString(),
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockDs._convRepo.update).toHaveBeenCalledTimes(1);
  });

  it('expectedUpdatedAt nunca vaza para a coluna persistida', async () => {
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
 * Section 13 (MusicChat Inbox — decisão de produto 2026-08-22): revisão de
 * tenant isolation server-side. Toda query real usa createQueryBuilder com
 * tenant_id no WHERE (defesa em profundidade — RLS em
 * 20260521000040_ConversationsAndForms é a garantia de banco). Este teste
 * prova a garantia de código: nunca é possível montar uma query sem o
 * filtro de tenant_id, mesmo que a chamada passe um id de conversa que
 * pertence a outro tenant.
 */
describe('ConversationsService — tenant isolation (Section 13)', () => {
  it('listConversations sempre filtra por tenant_id no WHERE inicial', async () => {
    const { service: svc, mockDs } = buildService();
    const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) };
    mockDs._convRepo.createQueryBuilder = jest.fn(() => qb);

    await svc.listConversations('tenant-a', {});
    expect(qb.where).toHaveBeenCalledWith('c.tenant_id = :tenantId', { tenantId: 'tenant-a' });
  });

  it('findConversationById filtra por id E tenant_id juntos — não retorna conversa de outro tenant mesmo com id correto', async () => {
    const { service: svc, mockDs } = buildService();
    const qb = { where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
    mockDs._convRepo.createQueryBuilder = jest.fn(() => qb);

    await expect(svc.findConversationById('tenant-b', CONV_ID)).rejects.toThrow();
    expect(qb.where).toHaveBeenCalledWith(
      'c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL',
      { id: CONV_ID, tenantId: 'tenant-b' },
    );
  });

  it('listMessages filtra mensagens por conversation_id E tenant_id juntos', async () => {
    const { service: svc, mockDs } = buildService();
    // ds.getRepository(...) do mock genérico devolve o mesmo objeto para
    // qualquer entidade (convRepo === msgRepo aqui) — um único qb precisa
    // satisfazer tanto findConversationById() (.where().getOne()) quanto
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
 * addMessage() nunca despachava a nenhum provider externo — uma resposta do
 * agente numa conversa WhatsApp nunca chegava de fato ao contact (só ficava
 * gravada no banco). Corrigido: canal whatsapp + sender_type='user' agora
 * despacha via WhatsAppCloudProvider real, com delivery_status honesto.
 */
describe('ConversationsService.addMessage() — entrega real no canal externo', () => {
  it("conversa whatsapp: despacha via WhatsAppCloudProvider e marca delivery_status='sent'", async () => {
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

  it('falha no provider: nunca lança — persiste a mensagem e marca delivery_status=failed', async () => {
    const sendTextMessage = jest.fn().mockRejectedValue(new Error('WhatsApp Cloud API respondeu 401'));
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
  });

  it("canal internal: nunca despacha externamente, marca delivery_status='internal_only'", async () => {
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

  it("mensagem inbound (sender_type='contact') nunca dispara despacho outbound", async () => {
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
