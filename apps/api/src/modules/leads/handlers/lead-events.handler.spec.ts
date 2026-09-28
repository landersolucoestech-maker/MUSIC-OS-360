import 'reflect-metadata';
import { LeadEventsHandler } from './lead-events.handler';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { LeadConvertedPayload } from '../../../core/events/domain-events.types';

/**
 * lead-events.handler.spec.ts  (Part 78)
 *
 * Permanent guard: onLeadConverted() created a ClientEntity with
 * segmento/responsavel — columns physically removed from `clients` by
 * migration 20260719000010 (same root cause as the client export
 * bug). Since the silent catch only logs the error, every lead-to-client
 * conversion failed without any visible signal: no client was created,
 * `lead.client_id` was never linked. There was no spec at all for this
 * handler before this Part.
 */
function makeRepo() {
  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    // find-22ec2dfa: idempotency guard reads the lead's CURRENT client_id
    // before creating anything — null means "not yet converted".
    findOne: jest.fn(async (): Promise<Record<string, unknown> | null> => null),
  };
}

function makeDs(clientRepo: ReturnType<typeof makeRepo>, leadRepo: ReturnType<typeof makeRepo>, artistRepo: ReturnType<typeof makeRepo>) {
  const getRepository = jest.fn((entity: { name: string }) => {
    if (entity.name === 'ClientEntity') return clientRepo;
    if (entity.name === 'LeadEntity') return leadRepo;
    return artistRepo;
  });
  // find-aca0fb58: onLeadConverted opens a real transaction (via
  // leadRepo.manager.transaction) to hold the advisory lock across the
  // whole read-check-write sequence. The mock's transaction() just invokes
  // the callback with a manager resolving to the SAME repo mocks, and a
  // no-op query() for the advisory-lock statement.
  const txManager = { getRepository, query: jest.fn().mockResolvedValue(undefined) };
  (leadRepo as unknown as { manager: unknown }).manager = {
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(txManager)),
  };
  return { getRepository } as any;
}

function makeEvent(): DomainEvent<LeadConvertedPayload> {
  return {
    type: DOMAIN_EVENTS.LEAD_CONVERTED,
    tenantId: 'tenant-1',
    userId: 'user-1',
    correlationId: 'corr-1',
    payload: {
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      name: 'Fulano de Tal',
      company: null,
      convertedBy: 'user-1',
      convertedAt: new Date().toISOString(),
    },
  } as unknown as DomainEvent<LeadConvertedPayload>;
}

describe('LeadEventsHandler.onLeadConverted', () => {
  it('creates the client with the canonical category/profile/responsible_name columns (CZ-043), never segmento/responsavel (removed)', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);

    const handler = new LeadEventsHandler(ds, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(clientRepo.create).toHaveBeenCalledTimes(1);
    const created = clientRepo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created['segmento']).toBeUndefined();
    expect(created['responsavel']).toBeUndefined();
    expect(created['category']).toBe('CORPORATE_CLIENT');
    expect(created['profile']).toBe('outros');
    expect(created['responsible_name']).toBe('user-1');
    expect(clientRepo.save).toHaveBeenCalledTimes(1);
  });

  it('emits client.created (client_created) ONLY AFTER commit, never inside the transaction, with the real clientId/category/personType', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);
    const events = { emitTyped: jest.fn() };

    const handler = new LeadEventsHandler(ds, events as never, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(events.emitTyped).toHaveBeenCalledTimes(1);
    const [eventName, envelope] = events.emitTyped.mock.calls[0];
    expect(eventName).toBe('client.created');
    expect(envelope).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        aggregateType: 'client',
        aggregateId: expect.any(String),
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Fulano de Tal',
          category: 'CORPORATE_CLIENT',
          personType: 'individual',
          sourceLeadId: 'lead-1',
        }),
      }),
    );
  });

  it('idempotency: does not emit client.created when the lead was already converted', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    leadRepo.findOne = jest.fn(async () => ({ client_id: 'client-already-there' }));
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);
    const events = { emitTyped: jest.fn() };

    const handler = new LeadEventsHandler(ds, events as never, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('links lead.client_id after successfully creating the client', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);

    const handler = new LeadEventsHandler(ds, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(leadRepo.update).toHaveBeenCalledWith(
      { id: 'lead-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ client_id: expect.any(String), status: 'closed' }),
    );
  });

  it('find-22ec2dfa: does not create a SECOND client/artist when the lead was already converted (re-progression CLOSED->INACTIVE->NEW->CLOSED)', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    leadRepo.findOne = jest.fn(async () => ({ id: 'lead-1', tenant_id: 'tenant-1', client_id: 'client-already-there' }));
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);

    const handler = new LeadEventsHandler(ds, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(clientRepo.create).not.toHaveBeenCalled();
    expect(clientRepo.save).not.toHaveBeenCalled();
    expect(artistRepo.create).not.toHaveBeenCalled();
    expect(leadRepo.update).not.toHaveBeenCalled();
  });

  it('find-aca0fb58: opens a transaction with an advisory lock per leadId before checking/writing', async () => {
    const clientRepo = makeRepo();
    const leadRepo = makeRepo();
    const artistRepo = makeRepo();
    const ds = makeDs(clientRepo, leadRepo, artistRepo);
    const manager = (leadRepo as unknown as { manager: { transaction: jest.Mock } }).manager;

    const handler = new LeadEventsHandler(ds, undefined);
    await handler.onLeadConverted(makeEvent());

    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });
});
