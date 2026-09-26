import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';

/**
 * GAP-04 (product-completion audit): SupportTicketDetail.tsx has a full reply
 * composer wired to useTicketMessages(), but no backend messages sub-resource
 * ever existed. Covers the two new methods only — ticket CRUD/workflow paths
 * are unchanged.
 */
function makeService(ticketRow: Record<string, unknown> | null = { id: 'ticket-1', tenant_id: 'tenant-1', status: 'open' }) {
  const ticketQb = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(ticketRow),
  };
  const messagesQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([{ id: 'm-1', message: 'oi' }]),
  };
  const ticketRepo = { createQueryBuilder: jest.fn(() => ticketQb) };
  const messagesRepo = {
    createQueryBuilder: jest.fn(() => messagesQb),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'm-new', ...(v as object) })),
  };
  const ds = {
    getRepository: jest.fn((entity: { name: string }) =>
      entity?.name === 'SupportTicketMessageEntity' ? messagesRepo : ticketRepo,
    ),
    query: jest.fn().mockResolvedValue([]),
  };
  const workflowService = { getAllowedTransitions: jest.fn().mockReturnValue([]) };
  const events = { emitTyped: jest.fn() };

  const svc = new SupportTicketsService(ds as never, workflowService as never, events as never);
  return { svc, ticketRepo, messagesRepo, ticketQb, messagesQb, ds };
}

describe('SupportTicketsService — messages (GAP-04)', () => {
  describe('listMessages', () => {
    it('404s when the ticket does not exist or belongs to another tenant', async () => {
      const { svc } = makeService(null);
      await expect(svc.listMessages('tenant-1', 'ticket-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns messages ordered oldest-first, scoped to tenant + ticket', async () => {
      const { svc, messagesQb } = makeService();
      const result = await svc.listMessages('tenant-1', 'ticket-1');

      expect(messagesQb.where).toHaveBeenCalledWith(
        'm.tenant_id = :tenantId AND m.ticket_id = :ticketId',
        { tenantId: 'tenant-1', ticketId: 'ticket-1' },
      );
      expect(messagesQb.orderBy).toHaveBeenCalledWith('m.created_at', 'ASC');
      expect(result).toEqual([{ id: 'm-1', message: 'oi' }]);
    });
  });

  describe('addMessage', () => {
    it('404s when the ticket does not exist or belongs to another tenant', async () => {
      const { svc } = makeService(null);
      await expect(
        svc.addMessage('tenant-1', 'ticket-x', { id: 'u1', name: 'a@b.com', role: 'support' }, { message: 'oi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persists the message scoped to the tenant, ticket, and resolved sender', async () => {
      const { svc, messagesRepo } = makeService();

      const result = await svc.addMessage(
        'tenant-1',
        'ticket-1',
        { id: 'user-1', name: 'agent@example.com', role: 'support' },
        { message: 'Olá, já estamos verificando.' },
      );

      expect(messagesRepo.create).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        ticket_id: 'ticket-1',
        sender_id: 'user-1',
        sender_name: 'agent@example.com',
        sender_role: 'support',
        message: 'Olá, já estamos verificando.',
        internal_note: false,
      });
      expect(result.id).toBe('m-new');
    });

    it('defaults internal_note to false when omitted, honors true when set', async () => {
      const { svc, messagesRepo } = makeService();

      await svc.addMessage(
        'tenant-1', 'ticket-1',
        { id: 'user-1', name: 'a', role: 'admin' },
        { message: 'nota interna', internal_note: true },
      );

      expect(messagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ internal_note: true, sender_role: 'admin' }),
      );
    });
  });
});

describe('SupportTicketsService.listAdmin (REM-01 — cross-tenant admin view)', () => {
  it('never filters by tenant_id — only deleted_at + a real join with tenants for tenant_name', async () => {
    const { svc, ds } = makeService();
    await svc.listAdmin({});

    const [sql] = ds.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toMatch(/tenant_id\s*=\s*\$/);
    expect(sql).toMatch(/JOIN tenants tn ON tn\.id = t\.tenant_id/);
    expect(sql).toMatch(/tn\.name AS tenant_name/);
  });

  it('applies search/status/priority filters as parameters', async () => {
    const { svc, ds } = makeService();
    await svc.listAdmin({ search: 'Ana', status: 'open', priority: 'high' });

    const [sql, params] = ds.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/lower\(t\.subject\) LIKE \$1/);
    expect(sql).toMatch(/t\.status = \$2/);
    expect(sql).toMatch(/t\.priority = \$3/);
    expect(params).toEqual(['%ana%', 'open', 'high']);
  });
});
