import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import {
  ConversationEntity,
  ConversationMessageEntity,
  MusicChatAutomationEventEntity,
  MusicChatAutomationNotificationEntity,
  MusicChatAutomationSettingsEntity,
  OrgMemberEntity,
} from '../../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { WhatsAppCloudProvider } from '../integrations/whatsapp/whatsapp-cloud.provider';
import { RECIPIENT_PHONE_MISSING, toWhatsAppDeliveryFailure } from '../integrations/whatsapp/whatsapp.errors';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type {
  MusicChatEscalationRuleDto,
  MusicChatInboundMessageDto,
  MusicChatMenuOptionDto,
  MusicChatTemplateDto,
  SendMusicChatNotificationDto,
  UpdateMusicChatAutomationSettingsDto,
} from './dto/musicchat-automation.dto';

const WELCOME =
  'Olá! Seja bem-vindo(a) à Central de Atendimento da Lander Records. Para direcionarmos seu atendimento, escolha uma das opções abaixo respondendo com o número correspondente.';

const INVALID_OPTION =
  'Não consegui identificar essa opção. Responda apenas com o número de uma das opções do menu principal.';

const DEFAULT_OPTIONS: MusicChatMenuOptionDto[] = [
  { id: 'shows', order: 1, label: 'Contratação de Shows', responseTemplateId: 'shows', queue: 'Comercial', sector: 'Shows', tags: ['Show', 'Comercial'], priority: 'alta', active: true },
  { id: 'producao', order: 2, label: 'Produção Musical', responseTemplateId: 'producao', queue: 'Produção Musical', sector: 'Produção', tags: ['Produção Musical'], priority: 'media', active: true },
  { id: 'editora', order: 3, label: 'Editora Musical e Distribuição', responseTemplateId: 'editora', queue: 'Catálogo', sector: 'Editora/Distribuição', tags: ['Editora', 'Distribuição'], priority: 'media', active: true },
  { id: 'design', order: 4, label: 'Design Gráfico e Criação', responseTemplateId: 'design', queue: 'Marketing', sector: 'Criação', tags: ['Design'], priority: 'media', active: true },
  { id: 'financeiro', order: 5, label: 'Financeiro', responseTemplateId: 'financeiro', queue: 'Financeiro', sector: 'Financeiro', tags: ['Financeiro'], priority: 'alta', active: true },
  { id: 'conteudo', order: 6, label: 'Redação & Conteúdo', responseTemplateId: 'conteudo', queue: 'Marketing', sector: 'Conteúdo', tags: ['Conteúdo'], priority: 'media', active: true },
  { id: 'outros', order: 7, label: 'Outros Assuntos', responseTemplateId: 'outros', queue: 'Atendimento', sector: 'Suporte', tags: ['Outros Assuntos'], priority: 'media', active: true },
  { id: 'engano', order: 8, label: 'Contato por Engano', responseTemplateId: 'engano', queue: 'Atendimento', sector: 'Triagem', tags: ['Contato por Engano'], priority: 'baixa', active: true },
];

const DEFAULT_TEMPLATES: MusicChatTemplateDto[] = [
  { id: 'shows', title: 'Contratação de Shows', body: 'Perfeito. Vamos direcionar seu atendimento para contratação de shows. Nossa equipe comercial irá analisar as informações e retornar com os próximos passos.' },
  { id: 'producao', title: 'Produção Musical', body: 'Recebemos sua solicitação sobre produção musical. A equipe responsável irá continuar o atendimento por aqui.' },
  { id: 'editora', title: 'Editora Musical e Distribuição', body: 'Obrigado pelo contato. Vamos encaminhar sua solicitação para a equipe de editora musical e distribuição.' },
  { id: 'design', title: 'Design Gráfico e Criação', body: 'Sua demanda de design e criação foi registrada. O setor criativo dará sequência ao atendimento.' },
  { id: 'financeiro', title: 'Financeiro', body: 'Vamos encaminhar seu atendimento para o financeiro. Para agilizar, envie o máximo de detalhes sobre sua solicitação.' },
  { id: 'conteudo', title: 'Redação & Conteúdo', body: 'Sua solicitação de redação e conteúdo foi recebida e direcionada para a equipe responsável.' },
  { id: 'outros', title: 'Outros Assuntos', body: 'Certo. Vamos analisar seu assunto e direcionar para a fila responsável.' },
  { id: 'engano', title: 'Contato por Engano', body: 'Sem problemas. Encerramos esta triagem como contato por engano. Se precisar falar conosco, envie uma nova mensagem.' },
];

const DEFAULT_REQUIRED_FIELDS = [
  'Nome do contratante ou empresa',
  'Nome do responsável',
  'Cidade e Estado',
  'Data do evento',
  'Local do evento',
  'Tipo de evento',
  'Artista desejado',
  'Público estimado',
  'Telefone para contato',
  'E-mail',
];

function buildMainMenu(options: MusicChatMenuOptionDto[]) {
  return options
    .filter((option) => option.active !== false)
    .sort((a, b) => a.order - b.order)
    .map((option) => `${option.order}. ${option.label}`)
    .join('\n');
}

function defaultSettings(): Partial<MusicChatAutomationSettingsEntity> {
  const menu = DEFAULT_OPTIONS.map((option) => (
    option.id === 'shows'
      ? { ...option, required_fields: DEFAULT_REQUIRED_FIELDS, optional_fields: [] }
      : { ...option, required_fields: [], optional_fields: [] }
  ));
  return {
    enabled: true,
    welcome_message: WELCOME,
    main_menu_message: buildMainMenu(menu),
    menu_options: menu,
    templates: DEFAULT_TEMPLATES,
    required_fields: DEFAULT_REQUIRED_FIELDS,
    optional_fields: [],
    invalid_option_message: INVALID_OPTION,
    absence_message: 'No momento não identificamos uma resposta válida. Você pode responder com o número da opção desejada para continuar.',
    out_of_hours_message: 'Recebemos sua mensagem fora do horário de atendimento. Sua solicitação foi registrada e será tratada no próximo período útil.',
    closing_message: 'Atendimento encerrado. Obrigado por falar com a Lander Records.',
    return_to_menu_rule: { enabled: true, commands: ['menu', 'voltar', 'inicio', 'início'] },
    escalation_rules: [
      { id: 'supervisor-5m', afterMinutes: 5, level: 'supervisor', recipientRole: 'supervisor', channels: ['in_app'], active: true },
      { id: 'manager-10m', afterMinutes: 10, level: 'manager', recipientRole: 'manager', channels: ['in_app'], active: true },
    ] satisfies MusicChatEscalationRuleDto[],
    notification_channels: { in_app: true, whatsapp: false, sms: false },
  };
}

@Injectable()
export class MusicChatAutomationService {
  private readonly logger = new Logger(MusicChatAutomationService.name);
  private readonly settingsRepo: Repository<MusicChatAutomationSettingsEntity> | null = null;
  private readonly convRepo: Repository<ConversationEntity> | null = null;
  private readonly msgRepo: Repository<ConversationMessageEntity> | null = null;
  private readonly eventRepo: Repository<MusicChatAutomationEventEntity> | null = null;
  private readonly notificationRepo: Repository<MusicChatAutomationNotificationEntity> | null = null;
  private readonly orgMemberRepo: Repository<OrgMemberEntity> | null = null;

  /** Simple anti-spam limit: at most N escalation WhatsApp sends per tenant/minute. */
  private static readonly WHATSAPP_RATE_LIMIT_PER_MINUTE = 20;
  private static readonly WHATSAPP_MAX_RETRIES = 3;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppCloudProvider,
    private readonly ws: RealtimeService,
  ) {
    if (ds) {
      this.settingsRepo = ds.getRepository(MusicChatAutomationSettingsEntity);
      this.convRepo = ds.getRepository(ConversationEntity);
      this.msgRepo = ds.getRepository(ConversationMessageEntity);
      this.eventRepo = ds.getRepository(MusicChatAutomationEventEntity);
      this.notificationRepo = ds.getRepository(MusicChatAutomationNotificationEntity);
      this.orgMemberRepo = ds.getRepository(OrgMemberEntity);
    }
  }

  async getSettings(tenantId: string) {
    const existing = await this.settingsRepo!.findOne({ where: { tenant_id: tenantId } as any });
    if (existing) return existing;

    const created = this.settingsRepo!.create({
      tenant_id: tenantId,
      ...defaultSettings(),
    } as Partial<MusicChatAutomationSettingsEntity>);
    return this.settingsRepo!.save(created);
  }

  async updateSettings(tenantId: string, userId: string, dto: UpdateMusicChatAutomationSettingsDto) {
    const current = await this.getSettings(tenantId);
    const menuOptions = dto.menu_options ?? (current.menu_options as MusicChatMenuOptionDto[]);
    const { expectedUpdatedAt, ...restDto } = dto;
    const updates = {
      ...restDto,
      ...(dto.menu_options ? { main_menu_message: dto.main_menu_message ?? buildMainMenu(menuOptions) } : {}),
      updated_by: userId,
    };
    await casUpdate(
      this.settingsRepo!,
      { id: current.id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt,
      'Estas configurações do MusicChat foram alteradas por outro usuário desde que você as carregou. Recarregue e tente novamente.',
    );
    await this.recordEvent(tenantId, null, 'automation.settings_updated', 'Configurações de automação do MusicChat atualizadas', { keys: Object.keys(dto) }, userId);
    return this.getSettings(tenantId);
  }

  async handleInboundMessage(tenantId: string, dto: MusicChatInboundMessageDto) {
    const settings = await this.getSettings(tenantId);
    const conv = await this.findOrCreateConversation(tenantId, dto);
    await this.addConversationMessage(tenantId, conv.id, dto.body, 'contact', dto.externalContactId, dto.metadata ?? {});

    const metadata = conv.metadata ?? {};
    const automationState = String(metadata['automation_state'] ?? 'new');
    const normalizedBody = dto.body.trim().toLowerCase();
    const returnRule = (settings.return_to_menu_rule ?? {}) as { enabled?: boolean; commands?: string[] };
    const shouldReturnMenu = returnRule.enabled !== false && (returnRule.commands ?? []).includes(normalizedBody);

    if (!settings.enabled || automationState === 'routed') {
      await this.recordEvent(tenantId, conv.id, 'automation.message_received', 'Mensagem recebida sem triagem automática', { body: dto.body });
      return { conversation: await this.findConversation(tenantId, conv.id), action: 'received' };
    }

    if (automationState === 'new' || shouldReturnMenu) {
      await this.sendSystemMessage(tenantId, conv.id, `${settings.welcome_message}\n\n${settings.main_menu_message}`);
      await this.updateConversationMetadata(tenantId, conv.id, {
        automation_state: 'waiting_menu_option',
        customer: dto.customerName,
        phone: dto.phone ?? null,
        instagram: dto.instagram ?? null,
        email: dto.email ?? null,
      });
      await this.recordEvent(tenantId, conv.id, 'automation.welcome_sent', 'Mensagem inicial enviada automaticamente', {});
      return { conversation: await this.findConversation(tenantId, conv.id), action: 'welcome_sent' };
    }

    const selected = this.resolveMenuOption(settings.menu_options as MusicChatMenuOptionDto[], dto.body);
    if (!selected) {
      await this.sendSystemMessage(tenantId, conv.id, settings.invalid_option_message);
      await this.recordEvent(tenantId, conv.id, 'automation.invalid_option', 'Opção inválida recebida na triagem', { body: dto.body });
      return { conversation: await this.findConversation(tenantId, conv.id), action: 'invalid_option' };
    }

    const template = (settings.templates as MusicChatTemplateDto[]).find((item) => item.id === selected.responseTemplateId);
    await this.routeConversation(tenantId, conv.id, selected);
    await this.sendSystemMessage(tenantId, conv.id, template?.body ?? selected.label);
    await this.recordEvent(tenantId, conv.id, 'automation.routed', `Conversa encaminhada para ${selected.queue}`, { selectedOption: selected });
    await this.createQueueNotification(tenantId, conv.id, selected);
    return { conversation: await this.findConversation(tenantId, conv.id), action: 'routed', option: selected };
  }

  async runEscalation(tenantId: string, conversationId?: string) {
    const settings = await this.getSettings(tenantId);
    const rules = (settings.escalation_rules as MusicChatEscalationRuleDto[]).filter((rule) => rule.active !== false);
    const qb = this.convRepo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId AND c.status = :status AND c.deleted_at IS NULL', { tenantId, status: 'open' })
      .andWhere("COALESCE(c.metadata->>'service_status', '') IN ('nova', 'aguardando_atendimento')");
    if (conversationId) qb.andWhere('c.id = :conversationId', { conversationId });
    const conversations = await qb.getMany();
    const created: MusicChatAutomationNotificationEntity[] = [];

    for (const conversation of conversations) {
      const minutes = (Date.now() - conversation.created_at.getTime()) / 60000;
      const hasAgentReply = await this.msgRepo!.count({
        where: { tenant_id: tenantId, conversation_id: conversation.id, sender_type: 'user' } as any,
      });
      if (hasAgentReply > 0) continue;

      for (const rule of rules) {
        if (minutes < rule.afterMinutes) continue;
        const recipient = rule.recipientUserId
          ?? (rule.recipientRole === 'manager' ? settings.manager_user_id : settings.supervisor_user_id);
        if (!recipient) continue;
        const notification = await this.sendNotification(tenantId, {
          conversationId: conversation.id,
          level: rule.level,
          recipientUserId: recipient,
          channel: ((rule.channels?.[0] ?? 'in_app') as 'in_app' | 'whatsapp' | 'sms'),
          title: `MusicChat: conversa sem resposta (${rule.level})`,
          body: `A conversa "${conversation.subject}" está sem resposta de atendente há ${Math.floor(minutes)} minuto(s).`,
          metadata: { ruleId: rule.id, afterMinutes: rule.afterMinutes },
        });
        if (notification.created) created.push(notification.data);
      }
    }

    return { processed: conversations.length, notifications: created };
  }

  async sendNotification(tenantId: string, dto: SendMusicChatNotificationDto): Promise<{ created: boolean; data: MusicChatAutomationNotificationEntity }> {
    // Real idempotency: UNIQUE (tenant_id, conversation_id, level) in the database
    // (uq_musicchat_escalation_notification) guarantees there is never more than
    // one notification per conversation+level, even under concurrency — this
    // findOne is only the optimistic check to return early in the common case.
    const existing = await this.notificationRepo!.findOne({
      where: { tenant_id: tenantId, conversation_id: dto.conversationId, level: dto.level } as any,
    });
    if (existing) return { created: false, data: existing };

    const status = dto.channel === 'in_app' ? 'queued' : 'prepared';
    const saved = await this.notificationRepo!.save(this.notificationRepo!.create({
      tenant_id: tenantId,
      conversation_id: dto.conversationId,
      level: dto.level,
      channel: dto.channel,
      recipient_user_id: dto.recipientUserId,
      title: dto.title,
      body: dto.body ?? null,
      status,
      metadata: {
        ...(dto.metadata ?? {}),
        externalDelivery: dto.channel === 'in_app' ? 'not_applicable' : 'prepared_not_sent_in_production',
      },
    }));

    if (dto.channel === 'in_app') {
      await this.notifications.enqueue(tenantId, {
        userId: dto.recipientUserId,
        title: dto.title,
        body: dto.body,
        type: 'musicchat.automation',
        entity: 'conversation',
        entityId: dto.conversationId,
        metadata: dto.metadata ?? {},
      });
    } else if (dto.channel === 'whatsapp') {
      await this.dispatchWhatsApp(tenantId, saved);
    }
    // 'sms': no real provider — honestly stays 'prepared' with
    // externalDelivery: 'prepared_not_sent_in_production' (never fabricated).

    await this.recordEvent(tenantId, dto.conversationId, 'automation.notification_created', dto.title, { channel: dto.channel, level: dto.level, status: saved.status });
    return { created: true, data: saved };
  }

  /**
   * Decision Gate item 14 (GAP-18): real escalation sending via the WhatsApp
   * Cloud API, with production controls — never sent outside production
   * (guarded by isConfigured itself: no real credentials = no sending),
   * the channel must be explicitly enabled in the tenant's
   * settings (consent/compliance on the operator's side), the recipient
   * must have a registered phone, anti-spam limit per tenant/minute,
   * honest final status (sent/failed — never a fictitious "sent"), errors never
   * expose credentials (WhatsAppError only carries Meta's response).
   */
  private async dispatchWhatsApp(tenantId: string, notification: MusicChatAutomationNotificationEntity): Promise<void> {
    const fail = async (reason: string, code: string) => {
      await this.notificationRepo!.update(
        { id: notification.id, tenant_id: tenantId } as any,
        {
          status: 'failed',
          metadata: { ...notification.metadata, externalDelivery: { sent: false, code, reason } },
        } as any,
      );
      this.logger.warn(`[musicchat/whatsapp] notification=${notification.id} tenant=${tenantId} not sent: ${code} — ${reason}`);
    };

    const settings = await this.getSettings(tenantId);
    const channels = (settings.notification_channels ?? {}) as Record<string, unknown>;
    if (channels['whatsapp'] !== true) {
      return fail('WhatsApp channel not enabled in the tenant automation settings.', 'CHANNEL_DISABLED');
    }

    if (!(await this.whatsapp.isConfigured(tenantId))) {
      return fail('WhatsApp Cloud API not configured for this tenant.', 'PROVIDER_NOT_CONFIGURED');
    }

    const member = await this.orgMemberRepo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId AND m.auth_user_id = :userId AND m.deleted_at IS NULL', {
        tenantId, userId: notification.recipient_user_id,
      })
      .getOne();
    if (!member?.phone) {
      return fail('Recipient has no registered phone.', 'INVALID_RECIPIENT');
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recentSends = await this.notificationRepo!
      .createQueryBuilder('n')
      .where("n.tenant_id = :tenantId AND n.channel = 'whatsapp' AND n.status = 'sent' AND n.created_at >= :since", {
        tenantId, since: oneMinuteAgo,
      })
      .getCount();
    if (recentSends >= MusicChatAutomationService.WHATSAPP_RATE_LIMIT_PER_MINUTE) {
      return fail('Per-minute WhatsApp send limit reached for this tenant.', 'RATE_LIMITED');
    }

    try {
      const result = await this.whatsapp.sendTextMessage(tenantId, member.phone, notification.body ?? notification.title);
      await this.notificationRepo!.update(
        { id: notification.id, tenant_id: tenantId } as any,
        {
          status: 'sent',
          metadata: {
            ...notification.metadata,
            externalDelivery: { sent: true, externalMessageId: result.externalMessageId, sentAt: new Date().toISOString() },
          },
        } as any,
      );
    } catch (err) {
      const failure = toWhatsAppDeliveryFailure(err);
      await fail(failure.technicalMessage, failure.code);
    }
  }

  /**
   * Controlled (human, not automatic) retry for WhatsApp notifications that
   * failed — limited to WHATSAPP_MAX_RETRIES attempts so it never becomes a
   * resend loop.
   */
  async retryNotification(tenantId: string, notificationId: string): Promise<MusicChatAutomationNotificationEntity> {
    const notification = await this.notificationRepo!.findOne({
      where: { id: notificationId, tenant_id: tenantId } as any,
    });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    if (notification.channel !== 'whatsapp') {
      throw new BadRequestException('Apenas notificações do canal WhatsApp podem ser reenviadas.');
    }
    if (notification.status !== 'failed') {
      throw new BadRequestException('Apenas notificações com falha podem ser reenviadas.');
    }
    const retryCount = Number((notification.metadata as Record<string, unknown>)?.['retryCount'] ?? 0);
    if (retryCount >= MusicChatAutomationService.WHATSAPP_MAX_RETRIES) {
      throw new BadRequestException(`Limite de ${MusicChatAutomationService.WHATSAPP_MAX_RETRIES} tentativas de reenvio atingido.`);
    }

    await this.notificationRepo!.update(
      { id: notificationId, tenant_id: tenantId } as any,
      { status: 'prepared', metadata: { ...notification.metadata, retryCount: retryCount + 1 } } as any,
    );
    const refreshed = await this.notificationRepo!.findOne({ where: { id: notificationId, tenant_id: tenantId } as any });
    await this.dispatchWhatsApp(tenantId, refreshed!);
    await this.recordEvent(tenantId, notification.conversation_id, 'automation.notification_retried', 'Reenvio manual de notificação WhatsApp', { notificationId, attempt: retryCount + 1 });
    return (await this.notificationRepo!.findOne({ where: { id: notificationId, tenant_id: tenantId } as any }))!;
  }

  async listEvents(tenantId: string, conversationId?: string) {
    const qb = this.eventRepo!.createQueryBuilder('e').where('e.tenant_id = :tenantId', { tenantId });
    if (conversationId) qb.andWhere('e.conversation_id = :conversationId', { conversationId });
    return qb.orderBy('e.created_at', 'DESC').take(100).getMany();
  }

  private async findConversation(tenantId: string, id: string) {
    const conversation = await this.convRepo!.findOne({ where: { tenant_id: tenantId, id } as any });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  private async findOrCreateConversation(tenantId: string, dto: MusicChatInboundMessageDto) {
    const existing = await this.convRepo!
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId AND c.deleted_at IS NULL', { tenantId })
      .andWhere("c.metadata->>'external_contact_id' = :externalContactId", { externalContactId: dto.externalContactId })
      .getOne();
    if (existing) return existing;

    const conversation = await this.convRepo!.save(this.convRepo!.create({
      tenant_id: tenantId,
      subject: dto.customerName,
      channel: dto.channel,
      status: 'open',
      assigned_to: null,
      metadata: {
        ...(dto.metadata ?? {}),
        external_contact_id: dto.externalContactId,
        automation_state: 'new',
        service_status: 'nova',
        customer: dto.customerName,
      },
      created_by: 'musicchat-automation',
    } as Partial<ConversationEntity>));
    await this.recordEvent(tenantId, conversation.id, 'automation.conversation_created', 'Conversa criada ou localizada pela automação', { channel: dto.channel });

    this.ws.sendToTenant(tenantId, 'conversation:created', {
      conversationId: conversation.id,
      subject:        conversation.subject,
      channel:        conversation.channel,
    });

    return conversation;
  }

  private resolveMenuOption(options: MusicChatMenuOptionDto[], body: string) {
    const selectedOrder = Number(body.trim().match(/^\d+/)?.[0]);
    if (!Number.isFinite(selectedOrder)) return null;
    return options.find((option) => option.active !== false && option.order === selectedOrder) ?? null;
  }

  private async addConversationMessage(tenantId: string, conversationId: string, body: string, senderType: string, senderId: string, metadata: Record<string, unknown>) {
    let saved = await this.msgRepo!.save(this.msgRepo!.create({
      tenant_id: tenantId,
      conversation_id: conversationId,
      body,
      sender_id: senderId,
      sender_type: senderType,
      attachments: [],
      metadata,
    }));

    // Triage bot messages (senderType='system') must actually
    // reach the contact on real WhatsApp, not just be stored — without this,
    // the customer never saw the welcome/menu message on the real
    // WhatsApp. 'contact' is never dispatched (it is what the customer already
    // sent — echoing it back would be a bug).
    if (senderType === 'system') {
      saved = await this.dispatchOutboundIfExternal(tenantId, conversationId, saved);
    }

    await this.convRepo!.update({ tenant_id: tenantId, id: conversationId } as any, { last_message_at: saved.created_at, updated_at: new Date() } as any);

    this.ws.sendToTenant(tenantId, 'conversation:message', {
      conversationId,
      messageId:   saved.id,
      senderId:    saved.sender_id,
      senderType:  saved.sender_type,
      bodyPreview: saved.body.slice(0, 100),
      deliveryStatus: (saved.metadata as Record<string, unknown> | null)?.['delivery_status'] ?? null,
    });

    return saved;
  }

  private async dispatchOutboundIfExternal(
    tenantId: string,
    conversationId: string,
    message: ConversationMessageEntity,
  ): Promise<ConversationMessageEntity> {
    const conv = await this.findConversation(tenantId, conversationId);
    if (conv.channel !== 'whatsapp') return message;

    const to = (conv.metadata?.['phone'] as string | undefined)
      ?? (conv.metadata?.['external_contact_id'] as string | undefined);
    const metadataPatch: Record<string, unknown> = { ...(message.metadata ?? {}) };
    if (!to) {
      metadataPatch['delivery_status'] = 'failed';
      metadataPatch['delivery_error_code'] = RECIPIENT_PHONE_MISSING.code;
      metadataPatch['delivery_error'] = RECIPIENT_PHONE_MISSING.technicalMessage;
    } else {
      try {
        const result = await this.whatsapp.sendTextMessage(tenantId, to, message.body);
        metadataPatch['delivery_status'] = 'sent';
        metadataPatch['external_message_id'] = result.externalMessageId;
      } catch (err) {
        const failure = toWhatsAppDeliveryFailure(err);
        metadataPatch['delivery_status'] = 'failed';
        metadataPatch['delivery_error_code'] = failure.code;
        metadataPatch['delivery_error'] = failure.technicalMessage;
        this.logger.warn(`dispatchOutboundIfExternal: failed to send automation via WhatsApp (conversation ${conversationId}) — ${failure.code}: ${failure.technicalMessage}`);
      }
    }
    await this.msgRepo!.update({ id: message.id } as any, { metadata: metadataPatch } as any);
    return { ...message, metadata: metadataPatch };
  }

  private sendSystemMessage(tenantId: string, conversationId: string, body: string) {
    return this.addConversationMessage(tenantId, conversationId, body, 'system', 'musicchat-automation', {});
  }

  private async updateConversationMetadata(tenantId: string, conversationId: string, patch: Record<string, unknown>) {
    const conversation = await this.findConversation(tenantId, conversationId);
    await this.convRepo!.update({ tenant_id: tenantId, id: conversationId } as any, {
      metadata: { ...(conversation.metadata ?? {}), ...patch },
      updated_at: new Date(),
    } as any);
  }

  private async routeConversation(tenantId: string, conversationId: string, option: MusicChatMenuOptionDto) {
    const conversation = await this.findConversation(tenantId, conversationId);
    const tags = Array.from(new Set([...(Array.isArray((conversation.metadata as any)?.tags) ? (conversation.metadata as any).tags : []), ...(option.tags ?? [])]));
    await this.convRepo!.update({ tenant_id: tenantId, id: conversationId } as any, {
      assigned_to: option.defaultAssignee ?? conversation.assigned_to,
      metadata: {
        ...(conversation.metadata ?? {}),
        automation_state: 'routed',
        service_status: option.id === 'engano' ? 'resolvida' : 'aguardando_atendimento',
        queue: option.queue,
        sector: option.sector,
        priority: option.priority ?? 'media',
        tags,
        selected_menu_option: option.id,
        required_fields: option.required_fields ?? [],
        optional_fields: option.optional_fields ?? [],
        routed_at: new Date().toISOString(),
      },
      updated_at: new Date(),
    } as any);
  }

  private createQueueNotification(tenantId: string, conversationId: string, option: MusicChatMenuOptionDto) {
    return this.recordEvent(tenantId, conversationId, 'automation.queue_notification', `Notificação interna gerada para fila ${option.queue}`, {
      queue: option.queue,
      sector: option.sector,
      tags: option.tags ?? [],
    });
  }

  private async recordEvent(tenantId: string, conversationId: string | null, eventType: string, summary: string, payload: Record<string, unknown>, actorId: string | null = null) {
    try {
      return await this.eventRepo!.save(this.eventRepo!.create({
        tenant_id: tenantId,
        conversation_id: conversationId,
        event_type: eventType,
        summary,
        payload,
        actor_id: actorId,
      }));
    } catch (error) {
      this.logger.warn(`Failed to record MusicChat event ${eventType}: ${String(error)}`);
      return null;
    }
  }
}
