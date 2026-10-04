import 'reflect-metadata';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { IsNull } from 'typeorm';
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

  it.each([
    ['producao', 'music_production'],
    ['editora', 'publishing_distribution'],
    ['financeiro', 'finance'],
    ['conteudo', 'content'],
    ['outros', 'other'],
    ['engano', 'wrong_contact'],
  ])('maps the deprecated default menu option id %j to %j (option id, response template id and template id)', (legacy, canonical) => {
    expect(canonicalMenuOption({ id: legacy, responseTemplateId: legacy })).toEqual({ id: canonical, responseTemplateId: canonical });
    expect(canonicalTemplate({ id: legacy })).toEqual({ id: canonical });
  });

  it.each([
    ['baixa', 'low'], ['media', 'medium'], ['alta', 'high'], ['critica', 'critical'],
  ])('maps the deprecated priority %j to %j', (legacy, canonical) => {
    expect(canonicalMenuOption({ id: 'x', responseTemplateId: 'x', priority: legacy }).priority).toBe(canonical);
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
    count: jest.fn().mockResolvedValue(0),
  };
  const eventRepo = { create: jest.fn((v: unknown) => v), save: jest.fn().mockResolvedValue({}) };
  // Active org members of t1 (see tenant-members.ts).
  const members = ['agent-1', 'supervisor-1'];
  let wanted: string[] = [];
  let memberTenant: string | undefined;
  const memberQb: Record<string, jest.Mock> = {};
  memberQb.select = jest.fn(() => memberQb);
  memberQb.where = jest.fn((_sql: string, p: { tenantId: string }) => { memberTenant = p.tenantId; return memberQb; });
  memberQb.andWhere = jest.fn((_sql: string, p?: { wanted?: string[] }) => { if (p?.wanted) wanted = p.wanted; return memberQb; });
  memberQb.getRawMany = jest.fn(async () => (memberTenant === 't1' ? wanted.filter((id) => members.includes(id)) : []).map((id) => ({ auth_user_id: id })));
  const memberRepo = { createQueryBuilder: jest.fn(() => memberQb) };
  const ds = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'MusicChatAutomationSettingsEntity') return settingsRepo;
      if (entity.name === 'ConversationEntity') return convRepo;
      if (entity.name === 'ConversationMessageEntity') return msgRepo;
      if (entity.name === 'MusicChatAutomationEventEntity') return eventRepo;
      if (entity.name === 'OrgMemberEntity') return memberRepo;
      return {};
    }),
  };
  const ws = { sendToTenant: jest.fn() };
  const svc = new MusicChatAutomationService(ds as never, { enqueue: jest.fn() } as never, {} as never, ws as never);
  return { svc, settings, settingsRepo, convRepo, convQb, memberQb, conv, eventRepo };
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

  it('creates the default settings with the pinned capitalized queue/sector values (R3-03 pending canonical slugs)', async () => {
    const { svc, settingsRepo } = makeService();
    Object.assign(settingsRepo, {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => v),
    });
    settingsRepo.findOne.mockResolvedValueOnce(null);
    const created = (await svc.getSettings('t-new')) as unknown as { menu_options: Array<{ id: string; queue: string; sector: string }> };
    const routing = Object.fromEntries(created.menu_options.map((o) => [o.id, [o.queue, o.sector]]));
    expect(routing['other']).toEqual(['Atendimento', 'Suporte']);
    expect(routing['wrong_contact']).toEqual(['Atendimento', 'Triagem']);
  });

  it('the default menu pins the full queue/sector/tags/label/priority routing of every option (Comercial and Financeiro included)', async () => {
    const { svc, settingsRepo } = makeService();
    Object.assign(settingsRepo, {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => v),
    });
    settingsRepo.findOne.mockResolvedValueOnce(null);
    const created = (await svc.getSettings('t-new')) as unknown as {
      menu_options: Array<{ id: string; label: string; queue: string; sector: string; tags: string[]; priority: string }>;
      templates: Array<{ id: string; title: string }>;
    };
    const byId = Object.fromEntries(created.menu_options.map((o) => [o.id, o]));
    expect(byId['shows']).toMatchObject({ label: 'Contratação de Shows', queue: 'Comercial', sector: 'Shows', tags: ['Show', 'Comercial'], priority: 'high' });
    expect(byId['finance']).toMatchObject({ label: 'Financeiro', queue: 'Financeiro', sector: 'Financeiro', tags: ['Financeiro'], priority: 'high' });
    expect(byId['content']).toMatchObject({ queue: 'Marketing', sector: 'Conteúdo', tags: ['Conteúdo'] });
    expect(created.menu_options.map((o) => o.id)).toEqual([
      'shows', 'music_production', 'publishing_distribution', 'design', 'finance', 'content', 'other', 'wrong_contact',
    ]);
    expect(created.templates.find((t) => t.id === 'finance')).toMatchObject({ title: 'Financeiro' });
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

/**
 * LOW-1 (b875241 DB re-review): a legacy id is renamed only when its English
 * target is not already used by the saved document — the same rule as
 * migration 20260928000026 — and a payload that would still hold two entries
 * with one id is rejected instead of stored.
 */
describe('updateSettings: legacy ids never collide with ids already in use', () => {
  const option = (id: string, order: number) => ({ id, order, label: id, responseTemplateId: id, queue: 'A', sector: 'T', active: true });

  it('keeps a legacy id whose English target is already used by the payload', async () => {
    const { svc, settingsRepo } = makeService();
    await svc.updateSettings('t1', 'u1', {
      menu_options: [option('outros', 1), option('other', 2)],
      templates: [{ id: 'outros', title: 'Outros', body: 'x' }, { id: 'other', title: 'Other', body: 'y' }],
    });
    const [, updates] = settingsRepo.update.mock.calls[0] as [unknown, { menu_options: Array<{ id: string }>; templates: Array<{ id: string }> }];
    expect(updates.menu_options.map((o) => o.id)).toEqual(['outros', 'other']);
    expect(updates.templates.map((t) => t.id)).toEqual(['outros', 'other']);
  });

  it('an options-only save maps a legacy option onto the stored (already English) template', async () => {
    // Stored templates were renamed by migration 26; a pre-CZ-045 build sends only `producao`.
    const { svc, settings, settingsRepo } = makeService();
    settings.templates = [{ id: 'music_production', title: 'Produção', body: 'y' }, { id: 'shows', title: 'Shows', body: 'Ok' }];
    await svc.updateSettings('t1', 'u1', { menu_options: [option('producao', 1)] });
    const [, updates] = settingsRepo.update.mock.calls[0] as [unknown, { menu_options: Array<{ id: string; responseTemplateId: string }>; templates?: unknown }];
    expect(updates.menu_options.map((o) => [o.id, o.responseTemplateId])).toEqual([['music_production', 'music_production']]);
    expect(updates).not.toHaveProperty('templates');
  });

  it('rejects a payload with two entries sharing one id (400) and writes nothing', async () => {
    const { svc, settingsRepo } = makeService();
    await expect(svc.updateSettings('t1', 'u1', { menu_options: [option('shows', 1), option('shows', 2)] }))
      .rejects.toThrow(BadRequestException);
    await expect(svc.updateSettings('t1', 'u1', { templates: [{ id: 'x', title: 'a', body: 'a' }, { id: 'x', title: 'b', body: 'b' }] }))
      .rejects.toThrow(BadRequestException);
    expect(settingsRepo.update).not.toHaveBeenCalled();
  });
});

/**
 * N8: users the settings route conversations or notifications to must be
 * active members of the tenant; values already stored are not re-validated.
 */
describe('updateSettings: assignees and recipients are tenant members', () => {
  it('rejects a free-text or foreign assignee, recipient, supervisor or manager (400) and writes nothing', async () => {
    const payloads = [
      { menu_options: [{ id: 'shows', order: 1, label: 'Shows', responseTemplateId: 'shows', queue: 'A', sector: 'T', defaultAssignee: 'Maria' }] },
      { escalation_rules: [{ id: 'r1', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: 'user-of-other-tenant' }] },
      { supervisor_user_id: 'ghost' },
      { manager_user_id: 'ghost' },
    ];
    for (const payload of payloads) {
      const { svc, settingsRepo } = makeService();
      await expect(svc.updateSettings('t1', 'u1', payload)).rejects.toThrow(BadRequestException);
      expect(settingsRepo.update).not.toHaveBeenCalled();
    }
  });

  it('accepts active members of the tenant', async () => {
    const { svc, settingsRepo, memberQb } = makeService();
    await svc.updateSettings('t1', 'u1', { supervisor_user_id: 'supervisor-1', manager_user_id: 'agent-1' });
    expect(settingsRepo.update).toHaveBeenCalledTimes(1);
    expect(memberQb.where).toHaveBeenCalledWith('m.tenant_id = :tenantId', { tenantId: 't1' });
  });

  it('does not fail a save on an id left unchanged in the same field', async () => {
    const { svc, settings, settingsRepo } = makeService();
    Object.assign(settings, {
      supervisor_user_id: 'legacy-free-text',
      escalation_rules: [{ id: 'r1', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: 'gone-member' }],
    });
    Object.assign(settings.menu_options[0], { defaultAssignee: 'old-assignee' });
    await svc.updateSettings('t1', 'u1', {
      supervisor_user_id: 'legacy-free-text',
      escalation_rules: [{ id: 'r1', afterMinutes: 10, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: 'gone-member' }],
      menu_options: [{ ...settings.menu_options[0], label: 'Shows (novo)' } as never],
      enabled: true,
    });
    expect(settingsRepo.update).toHaveBeenCalledTimes(1);
  });

  it('a stored value copied into another field (or another option) is validated like a new one', async () => {
    const copies = [
      { manager_user_id: 'legacy-free-text' },
      { escalation_rules: [{ id: 'r2', afterMinutes: 5, level: 'manager', recipientRole: 'manager', recipientUserId: 'legacy-free-text' }] },
      { menu_options: [{ id: 'other-option', order: 3, label: 'X', responseTemplateId: 'shows', queue: 'A', sector: 'T', defaultAssignee: 'legacy-free-text' }] },
    ];
    for (const payload of copies) {
      const { svc, settings, settingsRepo } = makeService();
      Object.assign(settings, { supervisor_user_id: 'legacy-free-text' });
      await expect(svc.updateSettings('t1', 'u1', payload)).rejects.toThrow(BadRequestException);
      expect(settingsRepo.update).not.toHaveBeenCalled();
    }
  });
});

describe('MusicChat manual notifications and escalation recipients', () => {
  const notification = { conversationId: 'conv-1', level: 'supervisor', recipientUserId: 'supervisor-1', channel: 'in_app' as const, title: 'T' };

  it('rejects a recipient that is not an active member of the tenant (400) and a conversation of another tenant (404)', async () => {
    const { svc, convRepo } = makeService();
    const send = jest.spyOn(svc, 'sendNotification').mockResolvedValue({ created: true, data: {} as never });
    await expect(svc.sendManualNotification('t1', { ...notification, recipientUserId: 'user-of-other-tenant' })).rejects.toThrow(BadRequestException);
    convRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.sendManualNotification('t1', notification)).rejects.toThrow(NotFoundException);
    expect(convRepo.findOne).toHaveBeenLastCalledWith({ where: expect.objectContaining({ id: 'conv-1', tenant_id: 't1', deleted_at: IsNull() }) });
    expect(send).not.toHaveBeenCalled();
    await svc.sendManualNotification('t1', notification);
    expect(send).toHaveBeenCalledWith('t1', notification);
  });

  it('a blank stored escalation recipient falls back to the supervisor instead of skipping the escalation', async () => {
    const { svc, settings, convQb, conv } = makeService({ service_status: 'waiting_agent' });
    Object.assign(settings, {
      supervisor_user_id: 'supervisor-1',
      escalation_rules: [{ id: 'r1', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: '', channels: ['in_app'], active: true }],
    });
    Object.assign(conv, { created_at: new Date(Date.now() - 60 * 60_000), status: 'open' });
    convQb.getMany.mockResolvedValue([conv]);
    const send = jest.spyOn(svc, 'sendNotification').mockResolvedValue({ created: true, data: {} as never });
    await svc.runEscalation('t1');
    expect(send).toHaveBeenCalledWith('t1', expect.objectContaining({ recipientUserId: 'supervisor-1' }));
  });

  it('an escalation recipient who is no longer an active member gets nothing; the skip is recorded', async () => {
    const { svc, settings, convQb, conv, eventRepo } = makeService({ service_status: 'waiting_agent' });
    Object.assign(settings, {
      escalation_rules: [{ id: 'r1', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: 'offboarded-member', channels: ['whatsapp'], active: true }],
    });
    Object.assign(conv, { created_at: new Date(Date.now() - 60 * 60_000), status: 'open' });
    convQb.getMany.mockResolvedValue([conv]);
    const send = jest.spyOn(svc, 'sendNotification').mockResolvedValue({ created: true, data: {} as never });
    await svc.runEscalation('t1');
    expect(send).not.toHaveBeenCalled();
    expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'automation.escalation_recipient_inactive',
      payload: { ruleIds: ['r1'] },
    }));
  });

  it('rejects escalation rules sharing one id (400) — a stale exempt recipient cannot be multiplied', async () => {
    const { svc, settings, settingsRepo } = makeService();
    Object.assign(settings, { escalation_rules: [{ id: 'r1', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', recipientUserId: 'ex-member' }] });
    const rule = (level: string) => ({ id: 'r1', afterMinutes: 5, level, recipientRole: 'supervisor', recipientUserId: 'ex-member', channels: ['whatsapp'] });
    await expect(svc.updateSettings('t1', 'u1', { escalation_rules: [rule('supervisor'), rule('manager'), rule('lvl3')] }))
      .rejects.toThrow(BadRequestException);
    expect(settingsRepo.update).not.toHaveBeenCalled();
  });

  it('a blank stored default assignee never becomes an empty assigned_to when a conversation is routed', async () => {
    const { svc, settings, convRepo } = makeService();
    Object.assign(settings.menu_options[0], { defaultAssignee: '' });
    await svc.handleInboundMessage('t1', { externalContactId: 'ext-1', customerName: 'Fulano', channel: 'internal', body: '1' });
    const routed = convRepo.update.mock.calls.find(([, patch]) => (patch as { metadata?: Record<string, unknown> }).metadata?.['automation_state'] === 'routed');
    expect((routed?.[1] as { assigned_to: unknown }).assigned_to).toBeNull();
  });

  it('an options-only save from a tenant that kept both outros and other templates keeps pointing outros at outros', async () => {
    const { svc, settings, settingsRepo } = makeService();
    settings.templates = [{ id: 'outros', title: 'Outros', body: 'a' }, { id: 'other', title: 'Outro (próprio)', body: 'b' }];
    const legacyOption = { id: 'outros', order: 1, label: 'Outros', responseTemplateId: 'outros', queue: 'A', sector: 'T', active: true };
    await svc.updateSettings('t1', 'u1', { menu_options: [legacyOption] });
    const [, updates] = settingsRepo.update.mock.calls[0] as [unknown, { menu_options: Array<{ id: string; responseTemplateId: string }> }];
    expect(updates.menu_options.map((o) => [o.id, o.responseTemplateId])).toEqual([['outros', 'outros']]);
  });
});
