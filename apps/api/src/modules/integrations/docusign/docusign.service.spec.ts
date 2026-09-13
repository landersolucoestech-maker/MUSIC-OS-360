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
    getOne: jest.fn(async () => contract),
  };
  const adminContractRepo = { createQueryBuilder: jest.fn(() => adminQb) };
  const adminDataSource = { getRepository: jest.fn(() => adminContractRepo) };
  const manager = {
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
  // WebhookService real — a verificação HMAC precisa ser exercitada de verdade,
  // não substituída por um mock que devolve true.
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

  return { service, adminQb, contextualContractRepo, updateQb, dbContext, events, webhookSvc, tenantResolver };
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
  it('rejeita assinatura HMAC inválida sem tocar no contrato', async () => {
    const { service, adminQb } = buildHarness();
    const { raw } = signedBody(completedPayload);

    await expect(
      service.handleWebhook(completedPayload, raw, 'not-a-valid-signature'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(adminQb.getOne).not.toHaveBeenCalled();
  });

  it('rejeita quando o header de assinatura está ausente (fail-closed)', async () => {
    const { service, adminQb } = buildHarness();
    const { raw } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, undefined))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(adminQb.getOne).not.toHaveBeenCalled();
  });

  it('aceita HMAC base64 válido, resolve o tenant e assina o contrato no contexto correto', async () => {
    const { service, adminQb, contextualContractRepo, updateQb, dbContext, events } = buildHarness();
    const { raw, signature } = signedBody(completedPayload);

    await service.handleWebhook(completedPayload, raw, signature);

    // Casamento pelo metadata genérico — sem coluna vendor-specific.
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
    expect(updateQb.where).toHaveBeenCalledWith(
      'id = :id AND tenant_id = :tenantId',
      { id: 'contract-a', tenantId: 'tenant-a' },
    );
    expect(events.emitTyped).toHaveBeenCalledWith(
      DOMAIN_EVENTS.CONTRACT_SIGNED,
      expect.objectContaining({ tenantId: 'tenant-a', aggregateId: 'contract-a' }),
    );
  });

  it('ignora eventos que não são envelope-completed sem alterar contrato', async () => {
    const { service, adminQb, events } = buildHarness();
    const payload = { ...completedPayload, event: 'envelope-sent' };
    const { raw, signature } = signedBody(payload);

    await service.handleWebhook(payload, raw, signature);

    expect(adminQb.getOne).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('não explode quando nenhum contrato casa com o envelopeId', async () => {
    const { service, events, contextualContractRepo } = buildHarness({ contract: null });
    const { raw, signature } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, signature)).resolves.toEqual({ received: true });
    expect(contextualContractRepo.findOne).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('trata evento duplicado como no-op idempotente', async () => {
    const { service, webhookSvc, adminQb } = buildHarness();
    (webhookSvc.ingest as jest.Mock).mockResolvedValueOnce({
      isDuplicate: true, eventId: 'webhook-a', status: 'processed',
    });
    const { raw, signature } = signedBody(completedPayload);

    await expect(service.handleWebhook(completedPayload, raw, signature)).resolves.toEqual({ received: true });
    expect(adminQb.getOne).not.toHaveBeenCalled();
  });

  describe('P0-3: tenant desativado', () => {
    it('assinatura válida + tenant inativo: NÃO assina o contrato (webhook é @Public, TenantGuard nunca roda)', async () => {
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

    it('tenant desconhecido (resolveTenant retorna null): mesma proteção, mesmo caminho fail-closed', async () => {
      const { service, dbContext, tenantResolver } = buildHarness();
      tenantResolver.resolveTenant.mockResolvedValueOnce(null as never);
      const { raw, signature } = signedBody(completedPayload);

      await expect(service.handleWebhook(completedPayload, raw, signature)).rejects.toThrow();
      expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    });

    it('falha no processamento do webhook propaga o erro (5xx) em vez de engolir para 200, permitindo retry do provedor', async () => {
      const { service, dbContext, webhookSvc } = buildHarness({ tenantActive: true });
      const { raw, signature } = signedBody(completedPayload);

      dbContext.runInTenantContext.mockRejectedValueOnce(new Error('processing boom'));

      await expect(service.handleWebhook(completedPayload, raw, signature))
        .rejects.toThrow('processing boom');

      expect(webhookSvc.markProcessed).toHaveBeenCalledWith('webhook-a', 'failed', expect.any(String));
    });

    it('assinatura válida + tenant ativo: assina normalmente (regressão — não quebrou o caminho feliz)', async () => {
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
