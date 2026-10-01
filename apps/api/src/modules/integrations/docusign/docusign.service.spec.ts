import 'reflect-metadata';
import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { DocuSignService } from './docusign.service';
import { ContractEntity, IntegrationEntity } from '../../../database/entities';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import { WebhookService } from '../webhooks/webhook.service';

const SECRET = 'docusign-webhook-secret-with-enough-length';

function buildHarness(overrides: {
  contract?: Record<string, unknown> | null;
  tenantActive?: boolean;
  matches?: Array<Record<string, unknown>>;
  signedRows?: number;
} = {}) {
  const contract = overrides.contract === undefined
    ? { id: 'contract-a', tenant_id: 'tenant-a', title: 'Contrato A', artist_id: 'artist-a' }
    : overrides.contract;
  const tenantResolver = {
    resolveTenant: jest.fn(async () => (
      overrides.tenantActive === false
        ? { id: 'tenant-a', active: false }
        : { id: 'tenant-a', active: true }
    )),
  };

  const updateQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => ({ affected: 1 })),
  };
  const contextualContractRepo = {
    findOne: jest.fn(async () => contract),
    createQueryBuilder: jest.fn(() => updateQb),
  };
  const integrationQb = { where: jest.fn().mockReturnThis(), getOne: jest.fn(async () => null) };
  const integrationRepo = { createQueryBuilder: jest.fn(() => integrationQb), update: jest.fn() };
  const appDataSource = {
    getRepository: jest.fn((entity: unknown) =>
      entity === IntegrationEntity ? integrationRepo : {}),
  };
  const adminQb = {
    where: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => overrides.matches ?? (contract ? [contract] : [])),
  };
  const adminContractRepo = { createQueryBuilder: jest.fn(() => adminQb) };
  const adminDataSource = { getRepository: jest.fn(() => adminContractRepo) };
  // applyProviderSignature: guarded UPDATE ... RETURNING -> [rows, count]
  const signedRows = overrides.signedRows ?? 1;
  const manager = {
    query: jest.fn(async (sql: string) => (
      sql.includes('status = $5') ? [Array.from({ length: signedRows }, () => ({ id: 'contract-a' })), signedRows] : [[], 1]
    )),
    getRepository: jest.fn((entity: unknown) => {
      expect(entity).toBe(ContractEntity);
      return contextualContractRepo;
    }),
  };
  const dbContext = {
    runInTenantContext: jest.fn(
      async (_ctx: unknown, work: (m: unknown) => Promise<unknown>) => work(manager),
    ),
  };
  const events = { emitTyped: jest.fn() };
  // Real WebhookService — HMAC verification must actually be exercised,
  // not replaced by a mock that returns true.
  const webhookSvc = new WebhookService(null as never);
  jest.spyOn(webhookSvc, 'ingest').mockResolvedValue({
    isDuplicate: false, eventId: 'webhook-a', status: 'pending',
  } as never);
  jest.spyOn(webhookSvc, 'markProcessed').mockImplementation(() => undefined as never);

  const service = new DocuSignService(
    appDataSource as never,
    { get: jest.fn(() => SECRET) } as never,
    {} as never,
    events as never,
    undefined,
    webhookSvc,
    dbContext as never,
    adminDataSource as never,
    tenantResolver as never,
  );

  return { service, adminQb, contextualContractRepo, updateQb, manager, dbContext, events, webhookSvc, tenantResolver };
}

function signedBody(payload: unknown): { raw: string; signature: string } {
  const raw = JSON.stringify(payload);
  return { raw, signature: createHmac('sha256', SECRET).update(raw, 'utf8').digest('base64') };
}

const completedPayload = {
  event: 'envelope-completed',
  generatedDateTime: '2026-08-23T10:00:00Z',
  data: { envelopeId: 'env-a', accountId: 'acct-a' },
};

describe('DocuSignService.handleWebhook', () => {
  it('rejects an invalid HMAC signature without touching the contract', async () => {
    const { service, adminQb } = buildHarness();
    const { raw } = signedBody(completedPayload);

    await expect(
      service.handleWebhook(completedPayload, raw, 'not-a-valid-signature'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(adminQb.getMany).not.toHaveBeenCalled();
  });

  it('rejects when the signature header is absent (fail-closed)', async () => {
    const { service, adminQb } = buildHarness();
    const { raw } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, undefined))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(adminQb.getMany).not.toHaveBeenCalled();
  });

  it('accepts a valid base64 HMAC, resolves the tenant and signs the contract in the right context', async () => {
    const { service, adminQb, contextualContractRepo, manager, dbContext, events, webhookSvc } = buildHarness();
    const { raw, signature } = signedBody(completedPayload);

    await service.handleWebhook(completedPayload, raw, signature);

    // Matching through the generic metadata — no vendor-specific column.
    expect(adminQb.where).toHaveBeenCalledWith(
      expect.stringContaining("metadata->>'provider_doc_id'"),
      { provider: 'docusign', envelopeId: 'env-a' },
    );
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', orgId: null, role: null },
      expect.any(Function),
    );
    expect(contextualContractRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'contract-a', tenant_id: 'tenant-a' },
    });
    // Guarded transition: SIGNED only from awaiting_signature, tenant-scoped.
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $2 AND status = $5'),
      ['contract-a', 'tenant-a', expect.any(String), 'signed', 'awaiting_signature'],
    );
    expect(events.emitTyped).toHaveBeenCalledWith(
      DOMAIN_EVENTS.CONTRACT_SIGNED,
      expect.objectContaining({ tenantId: 'tenant-a', aggregateId: 'contract-a' }),
    );
    // Dedup key is per (envelope, event), not the bare envelope id.
    expect(webhookSvc.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'env-a:envelope-completed' }),
    );
  });

  it('envelope linked to more than one contract: fails closed, no contract signed', async () => {
    const { service, dbContext, events, webhookSvc } = buildHarness({
      matches: [
        { id: 'contract-a', tenant_id: 'tenant-a' },
        { id: 'contract-b', tenant_id: 'tenant-b' },
      ],
    });
    const { raw, signature } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, signature)).resolves.toEqual({ received: true });
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
    expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'failed', expect.stringContaining('ambiguous'));
  });

  it('contract outside awaiting_signature: status unchanged, no CONTRACT_SIGNED', async () => {
    const { service, events, manager, webhookSvc } = buildHarness({ signedRows: 0 });
    const { raw, signature } = signedBody(completedPayload);

    await service.handleWebhook(completedPayload, raw, signature);
    expect(manager.query).toHaveBeenCalledTimes(2); // guarded transition (0 rows) + metadata-only record
    expect(events.emitTyped).not.toHaveBeenCalled();
    expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'processed');
  });

  it('ignores events other than envelope-completed without changing the contract', async () => {
    const { service, adminQb, events } = buildHarness();
    const payload = { ...completedPayload, event: 'envelope-sent' };
    const { raw, signature } = signedBody(payload);

    await service.handleWebhook(payload, raw, signature);

    expect(adminQb.getMany).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('does not blow up when no contract matches the envelopeId', async () => {
    const { service, events, contextualContractRepo } = buildHarness({ contract: null });
    const { raw, signature } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, signature)).resolves.toEqual({ received: true });
    expect(contextualContractRepo.findOne).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('treats a duplicate event as an idempotent no-op', async () => {
    const { service, webhookSvc, adminQb } = buildHarness();
    (webhookSvc.ingest as jest.Mock).mockResolvedValueOnce({
      isDuplicate: true, eventId: 'webhook-a', status: 'processed',
    });
    const { raw, signature } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, signature)).resolves.toEqual({ received: true });
    expect(adminQb.getMany).not.toHaveBeenCalled();
  });

  describe('P0-3: tenant desativado', () => {
    it('valid signature + inactive tenant: does NOT sign the contract (the webhook is @Public, TenantGuard never runs)', async () => {
      const { service, dbContext, events, tenantResolver, webhookSvc } =
        buildHarness({ tenantActive: false });
      const { raw, signature } = signedBody(completedPayload);

      await expect(service.handleWebhook(completedPayload, raw, signature)).rejects.toThrow();

      expect(tenantResolver.resolveTenant).toHaveBeenCalledWith('tenant-a');
      expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
      expect(events.emitTyped).not.toHaveBeenCalled();
      // Failure is recorded (not silently dropped) and rethrown so DocuSign retries the delivery
      // instead of a swallowed failure being treated as delivered (200).
      expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'failed', expect.any(String));
    });

    it('unknown tenant (resolveTenant returns null): same protection, same fail-closed path', async () => {
      const { service, dbContext, tenantResolver } = buildHarness();
      tenantResolver.resolveTenant.mockResolvedValueOnce(null as never);
      const { raw, signature } = signedBody(completedPayload);

      await expect(service.handleWebhook(completedPayload, raw, signature)).rejects.toThrow();
      expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    });

    it('a webhook processing failure propagates the error (5xx) instead of swallowing it into 200, allowing the provider to retry', async () => {
      const { service, dbContext, webhookSvc } = buildHarness({ tenantActive: true });
      const { raw, signature } = signedBody(completedPayload);

      dbContext.runInTenantContext.mockRejectedValueOnce(new Error('processing boom'));

      await expect(service.handleWebhook(completedPayload, raw, signature))
        .rejects.toThrow('processing boom');

      expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'failed', expect.any(String));
    });

    it('valid signature + active tenant: signs normally (regression — the happy path still works)', async () => {
      const { service, dbContext, events } = buildHarness({ tenantActive: true });
      const { raw, signature } = signedBody(completedPayload);

      await service.handleWebhook(completedPayload, raw, signature);

      expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
        { tenantId: 'tenant-a', orgId: null, role: null },
        expect.any(Function),
      );
      expect(events.emitTyped).toHaveBeenCalledWith(
        DOMAIN_EVENTS.CONTRACT_SIGNED,
        expect.objectContaining({ tenantId: 'tenant-a' }),
      );
    });
  });
});

describe('DocuSignService.sendForSignature: persisted failure is redacted (SEC3 F-A2-1)', () => {
  it('activity_logs metadata.error holds no e-mail/secret and at most 500 chars', async () => {
    const create = jest.fn(async () => ({}));
    const integrationBase = { getOAuthConnection: jest.fn(async () => ({ accessToken: 'tok', metadata: { docusign_account_id: 'a', docusign_base_uri: 'https://x.example' } })) };
    const ds = { getRepository: jest.fn(() => ({})) };
    const service = new DocuSignService(
      ds as never, { get: jest.fn() } as never, integrationBase as never, undefined, { create } as never,
    );
    (service as unknown as { timedFetch: jest.Mock }).timedFetch = jest.fn().mockRejectedValue(new Error(`fetch failed for owner@label.com Bearer abcdefgh12345678 ${'y'.repeat(2000)}`));
    await expect(service.sendForSignature({
      tenantId: 't1', userId: 'u1', contractId: 'c1', name: 'N', fileBase64: 'Zg==', signers: [{ name: 'A', email: 'a@b.co' }],
    })).rejects.toThrow();
    const meta = (create.mock.calls[0] as unknown as [string, string, { metadata: { error: string } }])[2].metadata;
    expect(meta.error).not.toContain('owner@label.com');
    expect(meta.error).not.toContain('abcdefgh12345678');
    expect(meta.error.length).toBeLessThanOrEqual(500);
  });
});
