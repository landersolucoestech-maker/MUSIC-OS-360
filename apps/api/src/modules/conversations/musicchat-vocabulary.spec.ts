import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CloseConversationDto,
  ConversationServiceStatus,
  CreateConversationDto,
  QueryConversationDto,
  UpdateConversationDto,
} from './dto/conversations.dto';
import { MusicChatAutomationService } from './musicchat-automation.service';
import { canonicalMenuOption, canonicalTemplate } from './musicchat-vocabulary';

/**
 * CZ-045: MusicChat service statuses, priorities and default menu option ids
 * are English. A pre-CZ-045 web build still sends the Portuguese values during
 * the deploy window — they must be mapped, never persisted raw.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate<T>(metatype: new () => T, value: Record<string, unknown>, type: 'body' | 'query' = 'body'): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

describe('ConversationServiceStatus input (CZ-045 deploy skew)', () => {
  const legacy: Array<[string, ConversationServiceStatus]> = [
    ['nova', ConversationServiceStatus.NEW],
    ['aguardando_atendimento', ConversationServiceStatus.WAITING_AGENT],
    ['em_atendimento', ConversationServiceStatus.IN_PROGRESS],
    ['aguardando_cliente', ConversationServiceStatus.WAITING_CUSTOMER],
    ['resolvida', ConversationServiceStatus.RESOLVED],
    ['arquivada', ConversationServiceStatus.ARCHIVED],
  ];

  it.each(legacy)('maps legacy %s to %s on update, create, query and close', async (from, to) => {
    await expect(validate(UpdateConversationDto, { service_status: from })).resolves.toMatchObject({ service_status: to });
    await expect(validate(CreateConversationDto, { subject: 'x', service_status: from })).resolves.toMatchObject({ service_status: to });
    await expect(validate(QueryConversationDto, { service_status: from }, 'query')).resolves.toMatchObject({ service_status: to });
    await expect(validate(CloseConversationDto, { reason: 'ok', service_status: from })).resolves.toMatchObject({ service_status: to });
  });

  it('accepts the canonical values unchanged', async () => {
    for (const value of Object.values(ConversationServiceStatus)) {
      await expect(validate(UpdateConversationDto, { service_status: value })).resolves.toMatchObject({ service_status: value });
    }
  });

  it('still rejects unknown values (the legacy map is not a bypass)', async () => {
    await expect(validate(UpdateConversationDto, { service_status: 'fechada' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateConversationDto, { service_status: 'NOVA' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate(UpdateConversationDto, { service_status: 'constructor' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('canonicalMenuOption / canonicalTemplate', () => {
  it('maps default option ids, template ids and priorities', () => {
    expect(canonicalMenuOption({ id: 'engano', responseTemplateId: 'engano', priority: 'baixa', order: 8 }))
      .toEqual({ id: 'wrong_contact', responseTemplateId: 'wrong_contact', priority: 'low', order: 8 });
    expect(canonicalMenuOption({ id: 'producao', responseTemplateId: 'outros', priority: 'critica' }))
      .toEqual({ id: 'music_production', responseTemplateId: 'other', priority: 'critical' });
    expect(canonicalTemplate({ id: 'financeiro', title: 'Financeiro' })).toEqual({ id: 'finance', title: 'Financeiro' });
  });

  it('keeps custom ids, canonical values and a missing priority as they are', () => {
    expect(canonicalMenuOption({ id: 'opcao-1700000000000', responseTemplateId: 'shows', priority: 'high' }))
      .toEqual({ id: 'opcao-1700000000000', responseTemplateId: 'shows', priority: 'high' });
    expect(canonicalMenuOption({ id: 'toString', responseTemplateId: 'design' }))
      .toEqual({ id: 'toString', responseTemplateId: 'design' });
  });
});

function makeService(conversationMetadata: Record<string, unknown> = {}) {
  const settings = {
    id: 's1', tenant_id: 't1', enabled: true,
    welcome_message: 'Bem-vindo!', main_menu_message: '1. Shows',
    menu_options: [
      { id: 'shows', order: 1, label: 'Shows', responseTemplateId: 'shows', queue: 'Comercial', sector: 'Shows', tags: [], active: true },
      { id: 'wrong_contact', order: 8, label: 'Engano', responseTemplateId: 'wrong_contact', queue: 'Atendimento', sector: 'Triagem', tags: [], priority: 'low', active: true },
    ],
    templates: [{ id: 'shows', title: 'Shows', body: 'Ok' }, { id: 'wrong_contact', title: 'Engano', body: 'Sem problemas' }],
    return_to_menu_rule: { enabled: true, commands: [] },
    escalation_rules: [],
  };
  const conv = {
    id: 'conv-1', tenant_id: 't1', channel: 'internal', status: 'open', subject: 'Fulano', assigned_to: null,
    created_at: new Date(),
    metadata: { external_contact_id: 'ext-1', automation_state: 'waiting_menu_option', ...conversationMetadata },
  };
  const convQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(conv),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const settingsRepo = {
    findOne: jest.fn().mockResolvedValue(settings),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const convRepo = {
    createQueryBuilder: jest.fn(() => convQb),
    findOne: jest.fn().mockResolvedValue(conv),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const msgRepo = {
    create: jest.fn((v: unknown) => ({ id: 'msg-1', created_at: new Date(), metadata: {}, ...(v as object) })),
    save: jest.fn(async (v: unknown) => v),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const eventRepo = { create: jest.fn((v: unknown) => v), save: jest.fn().mockResolvedValue({}) };
  const ds = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'MusicChatAutomationSettingsEntity') return settingsRepo;
      if (entity.name === 'ConversationEntity') return convRepo;
      if (entity.name === 'ConversationMessageEntity') return msgRepo;
      if (entity.name === 'MusicChatAutomationEventEntity') return eventRepo;
      return {};
    }),
  };
  const ws = { sendToTenant: jest.fn() };
  const svc = new MusicChatAutomationService(ds as never, { enqueue: jest.fn() } as never, {} as never, ws as never);
  return { svc, settingsRepo, convRepo, convQb };
}

function routedMetadata(convRepo: { update: jest.Mock }) {
  const call = convRepo.update.mock.calls.find(([, patch]) => (patch as { metadata?: Record<string, unknown> }).metadata?.['automation_state'] === 'routed');
  return (call?.[1] as { metadata: Record<string, unknown> }).metadata;
}

describe('MusicChatAutomationService (CZ-045 values)', () => {
  it('routes the wrong-contact option as resolved and other options as waiting for an agent', async () => {
    const wrong = makeService();
    await wrong.svc.handleInboundMessage('t1', { externalContactId: 'ext-1', customerName: 'Fulano', channel: 'internal', body: '8' });
    expect(routedMetadata(wrong.convRepo)).toMatchObject({ service_status: 'resolved', priority: 'low', selected_menu_option: 'wrong_contact' });

    const shows = makeService();
    await shows.svc.handleInboundMessage('t1', { externalContactId: 'ext-1', customerName: 'Fulano', channel: 'internal', body: '1' });
    expect(routedMetadata(shows.convRepo)).toMatchObject({ service_status: 'waiting_agent', priority: 'medium', selected_menu_option: 'shows' });
  });

  it('escalation only scans conversations still waiting (canonical statuses)', async () => {
    const { svc, convQb } = makeService();
    await svc.runEscalation('t1');
    const serviceStatusFilter = convQb.andWhere.mock.calls.find(([sql]) => String(sql).includes('service_status'));
    expect(serviceStatusFilter?.[1]).toEqual({ waitingStatuses: ['new', 'waiting_agent'] });
  });

  it('a pre-CZ-045 settings save is stored with canonical ids and priorities', async () => {
    const { svc, settingsRepo } = makeService();
    await svc.updateSettings('t1', 'u1', {
      menu_options: [
        { id: 'engano', order: 1, label: 'Contato por Engano', responseTemplateId: 'engano', queue: 'A', sector: 'T', priority: 'baixa', active: true },
        { id: 'opcao-1700000000000', order: 2, label: 'Custom', responseTemplateId: 'opcao-1700000000000', queue: 'A', sector: 'T', priority: 'alta', active: true },
      ],
      templates: [{ id: 'engano', title: 'Engano', body: 'x' }, { id: 'opcao-1700000000000', title: 'Custom', body: 'y' }],
    });
    const [, updates] = settingsRepo.update.mock.calls[0] as [unknown, { menu_options: unknown[]; templates: unknown[] }];
    expect(updates.menu_options).toEqual([
      expect.objectContaining({ id: 'wrong_contact', responseTemplateId: 'wrong_contact', priority: 'low' }),
      expect.objectContaining({ id: 'opcao-1700000000000', responseTemplateId: 'opcao-1700000000000', priority: 'high' }),
    ]);
    expect(updates.templates).toEqual([
      { id: 'wrong_contact', title: 'Engano', body: 'x' },
      { id: 'opcao-1700000000000', title: 'Custom', body: 'y' },
    ]);
  });

  it('a settings save without menu options or templates does not touch them', async () => {
    const { svc, settingsRepo } = makeService();
    await svc.updateSettings('t1', 'u1', { enabled: false });
    const [, updates] = settingsRepo.update.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(updates).not.toHaveProperty('menu_options');
    expect(updates).not.toHaveProperty('templates');
  });
});
