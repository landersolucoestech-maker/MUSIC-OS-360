/**
 * internal-chat/internal-chat.service.ts
 *
 * Internal Chat (team <-> team) — architecturally isolated from the Service
 * Center (modules/conversations, team <-> external public). No
 * entity, table, service or participant identity is shared between
 * the two domains.
 *
 * Authorization: every read/write requires a tenant match AND confirmed
 * participation in the conversation (checked here, in addition to the tenant-only RLS in the database —
 * see migration RlsPoliciesInternalChat). sender_auth_user_id is never
 * trusted from the client payload, always derived from CurrentUser().
 */

import { Injectable, Inject, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DataSource, Repository, In, IsNull } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import {
  InternalConversationEntity,
  InternalConversationParticipantEntity,
  InternalMessageEntity,
  OrgMemberEntity,
} from '../../database/entities';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type {
  CreateInternalConversationDto,
  CreateInternalMessageDto,
  QueryInternalMembersDto,
} from './dto/internal-chat.dto';

@Injectable()
export class InternalChatService {
  private readonly logger = new Logger(InternalChatService.name);

  private readonly convRepo: Repository<InternalConversationEntity> | null = null;
  private readonly participantRepo: Repository<InternalConversationParticipantEntity> | null = null;
  private readonly msgRepo: Repository<InternalMessageEntity> | null = null;
  private readonly memberRepo: Repository<OrgMemberEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly ws: RealtimeService,
  ) {
    if (ds) {
      this.convRepo = ds.getRepository(InternalConversationEntity);
      this.participantRepo = ds.getRepository(InternalConversationParticipantEntity);
      this.msgRepo = ds.getRepository(InternalMessageEntity);
      this.memberRepo = ds.getRepository(OrgMemberEntity);
    }
  }

  private async requireParticipant(tenantId: string, conversationId: string, authUserId: string) {
    const participant = await this.participantRepo!.findOne({
      where: { conversation_id: conversationId, tenant_id: tenantId, auth_user_id: authUserId },
    });
    if (!participant) {
      this.logger.warn(`Non-participant access denied: tenant=${tenantId} conversation=${conversationId} user=${authUserId}`);
      throw new ForbiddenException('Você não participa desta conversa.');
    }
    return participant;
  }

  async listMyConversations(tenantId: string, authUserId: string) {
    const memberships = await this.participantRepo!.find({
      where: { tenant_id: tenantId, auth_user_id: authUserId },
    });
    const ids = memberships.map((m) => m.conversation_id);
    if (ids.length === 0) return [];

    const conversations = await this.convRepo!.find({
      where: { id: In(ids), tenant_id: tenantId, deleted_at: IsNull() },
      order: { updated_at: 'DESC' },
    });

    const allParticipants = await this.participantRepo!.find({ where: { conversation_id: In(ids), tenant_id: tenantId } });
    const authUserIds = [...new Set(allParticipants.map((p) => p.auth_user_id))];
    const members = authUserIds.length
      ? await this.memberRepo!.find({ where: { tenant_id: tenantId, auth_user_id: In(authUserIds) } })
      : [];
    const memberByAuthId = new Map(members.map((m) => [m.auth_user_id, m]));

    return conversations.map((c) => ({
      ...c,
      participants: allParticipants
        .filter((p) => p.conversation_id === c.id)
        .map((p) => ({
          auth_user_id: p.auth_user_id,
          full_name: memberByAuthId.get(p.auth_user_id)?.full_name ?? null,
          email: memberByAuthId.get(p.auth_user_id)?.email ?? null,
          last_read_at: p.last_read_at,
        })),
    }));
  }

  async findConversationById(tenantId: string, authUserId: string, id: string) {
    await this.requireParticipant(tenantId, id, authUserId);
    const conversation = await this.convRepo!.findOne({ where: { id, tenant_id: tenantId } });
    if (!conversation || conversation.deleted_at) throw new NotFoundException('Conversa não encontrada.');
    return conversation;
  }

  async createConversation(tenantId: string, orgId: string, authUserId: string, dto: CreateInternalConversationDto) {
    const participantIds = [...new Set([authUserId, ...dto.participantAuthUserIds])];
    if (dto.type === 'direct' && participantIds.length !== 2) {
      throw new ForbiddenException('Conversa direta exige exatamente 2 participantes.');
    }

    const members = await this.memberRepo!.find({
      where: { tenant_id: tenantId, auth_user_id: In(participantIds), is_active: true },
    });
    if (members.length !== participantIds.length) {
      throw new NotFoundException('Um ou mais participantes não pertencem a esta organização.');
    }

    const { conversation, isNew } = await this.ds!.transaction(async (manager) => {
      if (dto.type === 'direct') {
        // A direct conversation between the same two people is unique. A plain
        // check-then-insert (SELECT existing, then INSERT if none) is a real race: two
        // concurrent requests can both see "none exists" and both insert, producing two
        // DMs. pg_advisory_xact_lock serializes concurrent attempts for the same pair —
        // the second transaction blocks here until the first commits (or rolls back),
        // then its own SELECT sees what the first one created. Lock is scoped to this
        // transaction only (released automatically on commit/rollback) and to this
        // tenant+pair specifically, so it never contends with unrelated conversations.
        const [a, b] = participantIds.slice().sort();
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`internal-chat-direct:${tenantId}:${a}:${b}`]);
        const existing = await manager
          .createQueryBuilder(InternalConversationEntity, 'c')
          .innerJoin(InternalConversationParticipantEntity, 'p1', 'p1.conversation_id = c.id AND p1.auth_user_id = :a', { a })
          .innerJoin(InternalConversationParticipantEntity, 'p2', 'p2.conversation_id = c.id AND p2.auth_user_id = :b', { b })
          .where('c.tenant_id = :tenantId', { tenantId })
          .andWhere('c.type = :type', { type: 'direct' })
          .andWhere('c.deleted_at IS NULL')
          .getOne();
        if (existing) return { conversation: existing, isNew: false };
      }

      const created = await manager.save(
        manager.create(InternalConversationEntity, { tenant_id: tenantId, org_id: orgId, type: dto.type, name: dto.name ?? null, created_by: authUserId }),
      );
      await manager.save(
        participantIds.map((id) =>
          manager.create(InternalConversationParticipantEntity, { conversation_id: created.id, tenant_id: tenantId, auth_user_id: id }),
        ),
      );
      return { conversation: created, isNew: true };
    });

    // Only notify on a genuine creation — returning a reused conversation isn't an event
    // the other participant needs to be told about again.
    if (isNew) {
      // sendToUserOnly, not sendToUser: this conversation is private to its participants —
      // sendToUser also fans out to the whole-tenant channel, which would leak the
      // conversation id (and later, message ids) to every tenant member, not just participants.
      for (const id of participantIds) this.ws.sendToUserOnly(id, 'internalConversation:created', { conversationId: conversation.id });
    }
    return conversation;
  }

  // ponytail: most-recent-200 ceiling, not keyset pagination — table is new/empty today.
  // Upgrade to cursor pagination (created_at, id) when a conversation's history makes 200
  // insufficient for the product.
  async listMessages(tenantId: string, authUserId: string, conversationId: string) {
    await this.requireParticipant(tenantId, conversationId, authUserId);
    const recent = await this.msgRepo!.find({
      where: { conversation_id: conversationId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: 200,
    });
    return recent.reverse();
  }

  async sendMessage(tenantId: string, authUserId: string, conversationId: string, dto: CreateInternalMessageDto) {
    await this.requireParticipant(tenantId, conversationId, authUserId);

    const message = await this.msgRepo!.save(
      this.msgRepo!.create({
        conversation_id: conversationId,
        tenant_id: tenantId,
        sender_auth_user_id: authUserId,
        body: dto.body,
        attachments: dto.attachments ?? [],
      }),
    );
    await this.convRepo!.update({ id: conversationId, tenant_id: tenantId }, { updated_at: new Date() });

    const participants = await this.participantRepo!.find({ where: { conversation_id: conversationId, tenant_id: tenantId } });
    // sendToUserOnly — see the comment on createConversation's notify above.
    for (const p of participants) this.ws.sendToUserOnly(p.auth_user_id, 'internalConversation:message', { conversationId, messageId: message.id });
    return message;
  }

  async markRead(tenantId: string, authUserId: string, conversationId: string) {
    const participant = await this.requireParticipant(tenantId, conversationId, authUserId);
    participant.last_read_at = new Date();
    return this.participantRepo!.save(participant);
  }

  /**
   * Organization members — never external clients/contacts. Default: active
   * colleagues other than the caller (starting an internal conversation);
   * `include_self` adds the caller (assignee pickers); `ids` resolves known
   * user ids to names (message authors, assignees), active or not — an inactive
   * member's e-mail is never returned.
   */
  async searchMembers(tenantId: string, authUserId: string, query: QueryInternalMembersDto) {
    const qb = this.memberRepo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('m.deleted_at IS NULL');

    if (query.ids) {
      if (query.ids.length === 0) return [];
      qb.andWhere('m.auth_user_id IN (:...ids)', { ids: query.ids });
    } else {
      qb.andWhere('m.is_active = true');
      if (!query.include_self) qb.andWhere('m.auth_user_id != :authUserId', { authUserId });
      if (query.search) {
        qb.andWhere('(m.full_name ILIKE :search OR m.email ILIKE :search)', { search: `%${query.search}%` });
      }
    }

    const members = await qb.orderBy('m.full_name', 'ASC').take(query.ids ? query.ids.length : 50).getMany();
    // An inactive member (reachable only through `ids`, to name a past author) is
    // shown by name only: its e-mail is not exposed to the rest of the team.
    return members.map((m) => ({ auth_user_id: m.auth_user_id, full_name: m.full_name, email: m.is_active ? m.email : null }));
  }
}
