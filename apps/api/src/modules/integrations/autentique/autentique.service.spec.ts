import 'reflect-metadata';
import { AutentiqueService } from './autentique.service';
import { ContractEntity, IntegrationEntity } from '../../../database/entities';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';

/**
 * find-a22e0dad / req-90013e6a (P0-A Public Boundary Policy Matrix): this
 * @Public() webhook is Type-B (reconciliation of an external signature that
 * already happened) — it intentionally checks tenant lifecycle
 * (tenants.active/deleted_at via tenantResolver) but deliberately does NOT
 * gate on tenant_billing_state, unlike leads.service.ts's Type-A public
 * lead-capture endpoint (find-a22e0dad's sibling fix, a repeatable new-write
 * with ongoing cost). Pins the currently-decided behavior so a future change
 * can't silently drift either check without a test failing.
 */
describe('AutentiqueService — assertTenantActive (P0-A, Type-B public boundary)', () => {
  function makeService(tenantResolver: { resolveTenant: jest.Mock }) {
    return new AutentiqueService(
      null, {} as never, {} as never, undefined as never, undefined as never, undefined as never, undefined, null, tenantResolver as never,
    );
  }

  it('rejects when the tenant is inactive (lifecycle check) even without any billing-state lookup', async () => {
    const tenantResolver = { resolveTenant: jest.fn().mockResolvedValue({ id: 'tenant-1', active: false }) };
    const service = makeService(tenantResolver);

    await expect((service as unknown as { assertTenantActive: (id: string) => Promise<void> })
      .assertTenantActive('tenant-1')).rejects.toThrow('Tenant not found or inactive');
  });

  it('rejects when the tenant is not found', async () => {
    const tenantResolver = { resolveTenant: jest.fn().mockResolvedValue(null) };
    const service = makeService(tenantResolver);

    await expect((service as unknown as { assertTenantActive: (id: string) => Promise<void> })
      .assertTenantActive('tenant-1')).rejects.toThrow('Tenant not found or inactive');
  });

  it('does NOT reject a lifecycle-active tenant even when it is suspended for billing (Type-B: no billing gate here by design)', async () => {
    // No tenant_billing_state lookup exists on this path at all -- proven by
    // resolveTenant's return shape never carrying (or being asked for) a
    // billing status, and the call succeeding regardless.
    const tenantResolver = { resolveTenant: jest.fn().mockResolvedValue({ id: 'tenant-1', active: true }) };
    const service = makeService(tenantResolver);

    await expect((service as unknown as { assertTenantActive: (id: string) => Promise<void> })
      .assertTenantActive('tenant-1')).resolves.toBeUndefined();
    expect(tenantResolver.resolveTenant).toHaveBeenCalledWith('tenant-1');
  });
});

describe('AutentiqueService webhook tenant context', () => {
  it('resolve o tenant por leitura administrativa e processa o contrato no contexto correto', async () => {
    const contract = {
      id: 'contract-a',
      tenant_id: 'tenant-a',
      title: 'Contrato A',
      artist_id: 'artist-a',
      autentique_doc_id: 'doc-a',
    };
    const updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 1 })),
    };
    const contextualContractRepo = {
      findOne: jest.fn(async () => contract),
      createQueryBuilder: jest.fn(() => updateQb),
    };
    const integrationQb = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => null),
    };
    const integrationRepo = {
      createQueryBuilder: jest.fn(() => integrationQb),
    };
    const appContractRepo = {};
    const appDataSource = {
      getRepository: jest.fn((entity: unknown) =>
        entity === IntegrationEntity ? integrationRepo : appContractRepo),
    };
    const adminContractRepo = {
      find: jest.fn(async () => [contract]),
    };
    const adminDataSource = {
      getRepository: jest.fn(() => adminContractRepo),
    };
    const manager = {
      // applyProviderSignature: guarded UPDATE ... RETURNING -> [rows, count]
      query: jest.fn(async () => [[{ id: 'contract-a' }], 1]),
      getRepository: jest.fn((entity: unknown) => {
        expect(entity).toBe(ContractEntity);
        return contextualContractRepo;
      }),
    };
    const dbContext = {
      runInTenantContext: jest.fn(
        async (_ctx: unknown, work: (manager: unknown) => Promise<unknown>) => work(manager),
      ),
    };
    const events = { emitTyped: jest.fn() };
    const webhookSvc = {
      validateSharedSecret: jest.fn(() => true),
      ingest: jest.fn(async () => ({
        isDuplicate: false,
        eventId: 'webhook-a',
        status: 'pending',
      })),
      markProcessed: jest.fn(),
    };
    const tenantResolver = {
      resolveTenant: jest.fn(async () => ({ id: 'tenant-a', active: true })),
    };
    const service = new AutentiqueService(
      appDataSource as never,
      {} as never,
      { get: jest.fn(() => 'secret') } as never,
      events as never,
      null as never,
      webhookSvc as never,
      dbContext as never,
      adminDataSource as never,
      tenantResolver as never,
    );

    await service.handleWebhook({
      event: 'document.signed',
      event_id: 'event-a',
      document_id: 'doc-a',
    }, 'secret');

    // Up to two matches: a doc id owned by >1 contract must fail closed.
    expect(adminContractRepo.find).toHaveBeenCalledWith({
      where: { autentique_doc_id: 'doc-a' },
      take: 2,
    });
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', orgId: null, role: null },
      expect.any(Function),
    );
    expect(contextualContractRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'contract-a', tenant_id: 'tenant-a' },
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $2 AND status = $5'),
      ['contract-a', 'tenant-a', expect.any(String), 'signed', 'awaiting_signature'],
    );
    void updateQb;
    expect(events.emitTyped).toHaveBeenCalledWith(
      DOMAIN_EVENTS.CONTRACT_SIGNED,
      expect.objectContaining({ tenantId: 'tenant-a', aggregateId: 'contract-a' }),
    );
  });

  it('P0-3: valid signature + inactive tenant — does NOT sign the contract (the webhook is @Public, TenantGuard never runs)', async () => {
    const contract = {
      id: 'contract-a', tenant_id: 'tenant-a', title: 'Contrato A',
      artist_id: 'artist-a', autentique_doc_id: 'doc-a',
    };
    const integrationQb = { where: jest.fn().mockReturnThis(), getOne: jest.fn(async () => null) };
    const integrationRepo = { createQueryBuilder: jest.fn(() => integrationQb) };
    const appDataSource = {
      getRepository: jest.fn((entity: unknown) => (entity === IntegrationEntity ? integrationRepo : {})),
    };
    const adminContractRepo = { find: jest.fn(async () => [contract]) };
    const adminDataSource = { getRepository: jest.fn(() => adminContractRepo) };
    const dbContext = { runInTenantContext: jest.fn() };
    const events = { emitTyped: jest.fn() };
    const webhookSvc = {
      validateSharedSecret: jest.fn(() => true),
      ingest: jest.fn(async () => ({ isDuplicate: false, eventId: 'webhook-a', status: 'pending' })),
      markProcessed: jest.fn(),
    };
    const tenantResolver = { resolveTenant: jest.fn(async () => ({ id: 'tenant-a', active: false })) };

    const service = new AutentiqueService(
      appDataSource as never, {} as never, { get: jest.fn(() => 'secret') } as never,
      events as never, null as never, webhookSvc as never, dbContext as never,
      adminDataSource as never, tenantResolver as never,
    );

    await expect(service.handleWebhook({
      event: 'document.signed', event_id: 'event-b', document_id: 'doc-a',
    }, 'secret')).rejects.toThrow();

    expect(tenantResolver.resolveTenant).toHaveBeenCalledWith('tenant-a');
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
    expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'failed', expect.any(String));
  });

  it('P0-3b: falha no processamento do webhook propaga o erro (5xx) em vez de engolir para 200, permitindo retry do provedor', async () => {
    const contract = {
      id: 'contract-a', tenant_id: 'tenant-a', title: 'Contrato A',
      artist_id: 'artist-a', autentique_doc_id: 'doc-a',
    };
    const integrationQb = { where: jest.fn().mockReturnThis(), getOne: jest.fn(async () => null) };
    const integrationRepo = { createQueryBuilder: jest.fn(() => integrationQb) };
    const appDataSource = {
      getRepository: jest.fn((entity: unknown) => (entity === IntegrationEntity ? integrationRepo : {})),
    };
    const adminContractRepo = { find: jest.fn(async () => [contract]) };
    const adminDataSource = { getRepository: jest.fn(() => adminContractRepo) };
    const dbContext = { runInTenantContext: jest.fn() };
    const events = { emitTyped: jest.fn() };
    const webhookSvc = {
      validateSharedSecret: jest.fn(() => true),
      ingest: jest.fn(async () => ({ isDuplicate: false, eventId: 'webhook-b', status: 'pending' })),
      markProcessed: jest.fn(),
    };
    const tenantResolver = { resolveTenant: jest.fn(async () => ({ id: 'tenant-a', active: true })) };

    const service = new AutentiqueService(
      appDataSource as never, {} as never, { get: jest.fn(() => 'secret') } as never,
      events as never, null as never, webhookSvc as never, dbContext as never,
      adminDataSource as never, tenantResolver as never,
    );

    dbContext.runInTenantContext.mockRejectedValueOnce(new Error('processing boom'));

    await expect(service.handleWebhook({
      event: 'document.signed', event_id: 'event-c', document_id: 'doc-a',
    }, 'secret')).rejects.toThrow('processing boom');

    expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-b', 'failed', expect.any(String));
  });

  it('doc id ligado a mais de um contrato: falha fechado (nenhum assinado, evento FAILED, 200)', async () => {
    const integrationRepo = { createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), getOne: jest.fn(async () => null) })) };
    const appDataSource = { getRepository: jest.fn((entity: unknown) => (entity === IntegrationEntity ? integrationRepo : {})) };
    const adminContractRepo = { find: jest.fn(async () => [
      { id: 'contract-a', tenant_id: 'tenant-a' },
      { id: 'contract-b', tenant_id: 'tenant-b' },
    ]) };
    const dbContext = { runInTenantContext: jest.fn() };
    const events = { emitTyped: jest.fn() };
    const webhookSvc = {
      validateSharedSecret: jest.fn(() => true),
      ingest: jest.fn(async () => ({ isDuplicate: false, eventId: 'webhook-d', status: 'pending' })),
      markProcessed: jest.fn(),
    };
    const service = new AutentiqueService(
      appDataSource as never, {} as never, { get: jest.fn(() => 'secret') } as never,
      events as never, null as never, webhookSvc as never, dbContext as never,
      { getRepository: jest.fn(() => adminContractRepo) } as never,
      { resolveTenant: jest.fn(async () => ({ id: 'tenant-a', active: true })) } as never,
    );

    await expect(service.handleWebhook({
      event: 'document.signed', event_id: 'event-d', document_id: 'doc-shared',
    }, 'secret')).resolves.toEqual({ received: true });
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
    expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-d', 'failed', expect.stringContaining('ambiguous'));
  });

  it('without event_id: the dedup key is (document, event type), never the document alone', async () => {
    const webhookSvc = {
      validateSharedSecret: jest.fn(() => true),
      ingest: jest.fn(async () => ({ isDuplicate: true, eventId: 'webhook-e', status: 'processed' })),
      markProcessed: jest.fn(),
    };
    const integrationRepo = { createQueryBuilder: jest.fn() };
    const service = new AutentiqueService(
      { getRepository: jest.fn((e: unknown) => (e === IntegrationEntity ? integrationRepo : {})) } as never,
      {} as never, { get: jest.fn(() => 'secret') } as never,
      undefined as never, null as never, webhookSvc as never, undefined, null, undefined,
    );
    await service.handleWebhook({ event: 'document.signed', document_id: 'doc-z' }, 'secret');
    expect(webhookSvc.ingest).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'doc-z:document.signed' }));
  });
});
