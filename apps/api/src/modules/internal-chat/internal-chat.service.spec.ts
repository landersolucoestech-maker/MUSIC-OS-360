import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InternalChatService } from './internal-chat.service';

const TENANT = 'tenant-a';
const OTHER_TENANT = 'tenant-b';
const CONV_ID = 'conv-1';
const ME = 'user-me';
const OTHER = 'user-other';
const STRANGER = 'user-stranger';

function buildService(overrides: {
  participants?: Record<string, unknown>[];
  members?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
  existingDirectConversation?: Record<string, unknown> | null;
} = {}) {
  const participants = overrides.participants ?? [{ conversation_id: CONV_ID, tenant_id: TENANT, auth_user_id: ME }];
  const members = overrides.members ?? [
    { tenant_id: TENANT, auth_user_id: ME, is_active: true, full_name: 'Me' },
    { tenant_id: TENANT, auth_user_id: OTHER, is_active: true, full_name: 'Other' },
  ];

  const participantRepo = {
    findOne: jest.fn(({ where }: any) =>
      Promise.resolve(
        participants.find(
          (p) => p.conversation_id === where.conversation_id && p.tenant_id === where.tenant_id && p.auth_user_id === where.auth_user_id,
        ) ?? null,
      ),
    ),
    find: jest.fn(({ where }: any) => {
      if (where.auth_user_id) {
        return Promise.resolve(participants.filter((p) => p.tenant_id === where.tenant_id && p.auth_user_id === where.auth_user_id));
      }
      // Deliberately enforces where.tenant_id here (unlike a naive mock) so a test can prove
      // the production query actually passes it — a real TypeORM `find` would too.
      if (!where.tenant_id) throw new Error('participantRepo.find called without tenant_id — production query regression');
      return Promise.resolve(participants.filter((p) => p.tenant_id === where.tenant_id));
    }),
    save: jest.fn((entities: unknown) => Promise.resolve(entities)),
    create: jest.fn((data: unknown) => data),
  };
  const existingDirectConversation = overrides.existingDirectConversation ?? null;
  const convRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: CONV_ID, tenant_id: TENANT, deleted_at: null }),
    save: jest.fn((entity: unknown) => Promise.resolve({ id: CONV_ID, ...(entity as object) })),
    create: jest.fn((data: unknown) => data),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const messages = overrides.messages ?? [];
  const msgRepo = {
    // Deliberately enforces the exact args listMessages must pass — a naive
    // `mockResolvedValue([])` would stay green even if tenant scoping, the pagination
    // cap, or the ordering direction regressed (see internal-chat.service.spec.ts's
    // "listMessages" describe block below).
    find: jest.fn(({ where, order, take }: any) => {
      if (!where?.tenant_id) throw new Error('msgRepo.find called without tenant_id — production query regression');
      if (take !== 200) throw new Error(`msgRepo.find called with take=${take}, expected 200 — pagination cap regression`);
      if (order?.created_at !== 'DESC') throw new Error('msgRepo.find called without order: { created_at: "DESC" } — ordering regression');
      // Simulate a real ORDER BY created_at DESC — production's listMessages then
      // .reverse()s this back to ascending, so the mock must actually honor DESC for
      // that round-trip to mean anything.
      return Promise.resolve(
        messages
          .filter((m) => m.conversation_id === where.conversation_id && m.tenant_id === where.tenant_id)
          .slice()
          .sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime()),
      );
    }),
    save: jest.fn((entity: unknown) => Promise.resolve({ id: 'msg-1', ...(entity as object) })),
    create: jest.fn((data: unknown) => data),
  };
  const memberRepo = {
    find: jest.fn(({ where }: any) =>
      Promise.resolve(members.filter((m) => m.tenant_id === where.tenant_id && where.auth_user_id.value.includes(m.auth_user_id))),
    ),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getMany: jest.fn().mockResolvedValue(members.filter((m) => m.auth_user_id !== ME)),
      };
      return qb;
    }),
  };

  // Mirrors TypeORM's EntityManager.transaction(cb) shape: create() tags the row with the
  // entity name so save() can route to the same repo mocks used outside the transaction.
  const mockManager = {
    create: jest.fn((entity: { name: string }, data: unknown) => ({ __entity: entity.name, ...(data as object) })),
    save: jest.fn((value: unknown) => {
      const rows = Array.isArray(value) ? value : [value];
      const entityName = (rows[0] as { __entity?: string } | undefined)?.__entity;
      if (entityName === 'InternalConversationEntity') return convRepo.save(rows[0]);
      if (entityName === 'InternalConversationParticipantEntity') return participantRepo.save(rows);
      return Promise.resolve(value);
    }),
    // The advisory-lock statement — mock only records/allows it; a unit test can't
    // exercise real cross-connection Postgres locking, that needs a real database.
    query: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        innerJoin: jest.fn(() => qb),
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        getOne: jest.fn().mockResolvedValue(existingDirectConversation),
      };
      return qb;
    }),
  };
  const mockDs = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'InternalConversationEntity') return convRepo;
      if (entity.name === 'InternalConversationParticipantEntity') return participantRepo;
      if (entity.name === 'InternalMessageEntity') return msgRepo;
      if (entity.name === 'OrgMemberEntity') return memberRepo;
      throw new Error(`unexpected entity ${entity.name}`);
    }),
    transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) => cb(mockManager)),
  };
  const mockWs = { sendToUser: jest.fn(), sendToUserOnly: jest.fn(), sendToTenant: jest.fn() };
  const service = new InternalChatService(mockDs as any, mockWs as any);
  return { service, participantRepo, convRepo, msgRepo, memberRepo, mockWs };
}

describe("InternalChatService — participant authorization (isolation from 'Central de Atendimento')", () => {
  it('participant can list messages in their conversation', async () => {
    const { service } = buildService();
    await expect(service.listMessages(TENANT, ME, CONV_ID)).resolves.toEqual([]);
  });

  it('non-participant is denied reading messages', async () => {
    const { service } = buildService();
    await expect(service.listMessages(TENANT, STRANGER, CONV_ID)).rejects.toThrow(ForbiddenException);
  });

  it('non-participant is denied sending a message', async () => {
    const { service } = buildService();
    await expect(service.sendMessage(TENANT, STRANGER, CONV_ID, { body: 'oi' })).rejects.toThrow(ForbiddenException);
  });

  it('participant can send a message, and sender is derived from the authenticated caller, not the payload', async () => {
    const { service, msgRepo } = buildService();
    await service.sendMessage(TENANT, ME, CONV_ID, { body: 'oi' } as any);
    expect(msgRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sender_auth_user_id: ME, conversation_id: CONV_ID, tenant_id: TENANT }),
    );
  });

  it('sendMessage notifies participants via sendToUserOnly, never the tenant-wide fan-out (regression: message ids must not reach non-participants)', async () => {
    const { service, mockWs } = buildService();
    await service.sendMessage(TENANT, ME, CONV_ID, { body: 'oi' } as any);
    expect(mockWs.sendToUserOnly).toHaveBeenCalledWith(ME, 'internalConversation:message', expect.anything());
    expect(mockWs.sendToUser).not.toHaveBeenCalled();
    expect(mockWs.sendToTenant).not.toHaveBeenCalled();
  });

  it('listMessages returns at most the 200 most recent messages, oldest first (regression: pagination cap and ordering — see msgRepo.find above)', async () => {
    const messages = [
      { id: 'm1', conversation_id: CONV_ID, tenant_id: TENANT, created_at: new Date('2026-01-01'), body: 'first' },
      { id: 'm2', conversation_id: CONV_ID, tenant_id: TENANT, created_at: new Date('2026-01-02'), body: 'second' },
    ];
    const { service } = buildService({ messages });
    await expect(service.listMessages(TENANT, ME, CONV_ID)).resolves.toEqual([
      expect.objectContaining({ id: 'm1' }),
      expect.objectContaining({ id: 'm2' }),
    ]);
  });

  it('a participant from another tenant with the same conversation id is still denied (tenant isolation)', async () => {
    const { service } = buildService({
      participants: [{ conversation_id: CONV_ID, tenant_id: OTHER_TENANT, auth_user_id: ME }],
    });
    await expect(service.listMessages(TENANT, ME, CONV_ID)).rejects.toThrow(ForbiddenException);
  });

  it('creating a direct conversation reuses an existing direct conversation between the same two people instead of duplicating it (regression: A messaging B twice used to create two conversations)', async () => {
    const existing = { id: 'existing-direct-conv', tenant_id: TENANT, type: 'direct', deleted_at: null };
    const { service, convRepo, mockWs } = buildService({ existingDirectConversation: existing });
    const result = await service.createConversation(TENANT, 'org-1', ME, {
      type: 'direct' as any,
      participantAuthUserIds: [OTHER],
    });
    expect(result).toBe(existing);
    expect(convRepo.save).not.toHaveBeenCalled();
    expect(mockWs.sendToUserOnly).not.toHaveBeenCalled();
  });

  it('creating a direct conversation with more than 2 total participants is rejected', async () => {
    const { service } = buildService();
    await expect(
      service.createConversation(TENANT, 'org-1', ME, {
        type: 'direct' as any,
        participantAuthUserIds: [OTHER, STRANGER],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creating a conversation with a participant who is not an active org member is rejected', async () => {
    const { service } = buildService({
      members: [{ tenant_id: TENANT, auth_user_id: ME, is_active: true, full_name: 'Me' }],
    });
    await expect(
      service.createConversation(TENANT, 'org-1', ME, {
        type: 'direct' as any,
        participantAuthUserIds: [STRANGER],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creating a valid direct conversation notifies both participants via sendToUserOnly, never the tenant-wide fan-out (regression: private conversation ids must not reach non-participants)', async () => {
    const { service, mockWs } = buildService();
    await service.createConversation(TENANT, 'org-1', ME, {
      type: 'direct' as any,
      participantAuthUserIds: [OTHER],
    });
    expect(mockWs.sendToUserOnly).toHaveBeenCalledWith(ME, 'internalConversation:created', expect.anything());
    expect(mockWs.sendToUserOnly).toHaveBeenCalledWith(OTHER, 'internalConversation:created', expect.anything());
    expect(mockWs.sendToUser).not.toHaveBeenCalled();
    expect(mockWs.sendToTenant).not.toHaveBeenCalled();
  });

  it('member search never returns the caller themself', async () => {
    const { service } = buildService();
    const results = await service.searchMembers(TENANT, ME, {});
    expect(results.every((m) => m.auth_user_id !== ME)).toBe(true);
  });

  it('member directory filters: tenant always; default excludes the caller and inactive members; include_self keeps the caller; ids resolves exact ids', async () => {
    const { service, memberRepo } = buildService();
    const lastQb = () => memberRepo.createQueryBuilder.mock.results.at(-1)!.value as { where: jest.Mock; andWhere: jest.Mock; take: jest.Mock };
    const andWhereSql = () => lastQb().andWhere.mock.calls.map(([sql]: [string]) => sql);

    await service.searchMembers(TENANT, ME, {});
    expect(lastQb().where).toHaveBeenCalledWith('m.tenant_id = :tenantId', { tenantId: TENANT });
    expect(andWhereSql()).toEqual(expect.arrayContaining(['m.deleted_at IS NULL', 'm.is_active = true', 'm.auth_user_id != :authUserId']));

    await service.searchMembers(TENANT, ME, { include_self: true });
    expect(andWhereSql()).toContain('m.is_active = true');
    expect(andWhereSql()).not.toContain('m.auth_user_id != :authUserId');

    await service.searchMembers(TENANT, ME, { ids: [ME, OTHER], search: 'x' });
    expect(lastQb().where).toHaveBeenCalledWith('m.tenant_id = :tenantId', { tenantId: TENANT });
    expect(lastQb().andWhere).toHaveBeenCalledWith('m.auth_user_id IN (:...ids)', { ids: [ME, OTHER] });
    expect(andWhereSql()).not.toContain('m.auth_user_id != :authUserId');
    expect(lastQb().take).toHaveBeenCalledWith(2);

    await expect(service.searchMembers(TENANT, ME, { ids: [] })).resolves.toEqual([]);
  });

  it('QueryInternalMembersDto parses include_self and a comma-separated ids list, capped at 100', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { QueryInternalMembersDto } = await import('./dto/internal-chat.dto');
    const dto = plainToInstance(QueryInternalMembersDto, { include_self: 'true', ids: 'a, b,,c' });
    expect(dto.include_self).toBe(true);
    expect(dto.ids).toEqual(['a', 'b', 'c']);
    expect(await validate(dto)).toHaveLength(0);
    const tooMany = plainToInstance(QueryInternalMembersDto, { ids: Array.from({ length: 101 }, (_, i) => `u${i}`).join(',') });
    expect((await validate(tooMany)).some((e) => e.property === 'ids')).toBe(true);
  });

  it('listMyConversations scopes the participant fan-out query by tenant_id (regression: was derivation-only)', async () => {
    const { service, convRepo } = buildService();
    convRepo.find = jest.fn().mockResolvedValue([{ id: CONV_ID, tenant_id: TENANT, updated_at: new Date(), deleted_at: null }]);
    // Would throw if the production query omitted tenant_id — see participantRepo.find above.
    await expect(service.listMyConversations(TENANT, ME)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: CONV_ID })]),
    );
  });
});

describe('CreateInternalMessageDto — attachments validation (regression: was unvalidated unknown[])', () => {
  it('rejects an attachment missing a required field', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { CreateInternalMessageDto } = await import('./dto/internal-chat.dto');
    const dto = plainToInstance(CreateInternalMessageDto, { body: 'oi', attachments: [{ name: 'x' }] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'attachments')).toBe(true);
  });

  it('rejects more than 10 attachments', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { CreateInternalMessageDto } = await import('./dto/internal-chat.dto');
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}`, url: 'https://example.com/f' }));
    const dto = plainToInstance(CreateInternalMessageDto, { body: 'oi', attachments: many });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'attachments')).toBe(true);
  });

  it('accepts a well-formed attachment', async () => {
    const { validate } = await import('class-validator');
    const { plainToInstance } = await import('class-transformer');
    const { CreateInternalMessageDto } = await import('./dto/internal-chat.dto');
    const dto = plainToInstance(CreateInternalMessageDto, {
      body: 'oi',
      attachments: [{ name: 'contrato.pdf', url: 'https://example.com/contrato.pdf', mimeType: 'application/pdf' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
