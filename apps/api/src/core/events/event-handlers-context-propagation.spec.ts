import { ArtistEventsHandler } from '../../modules/artists/handlers/artist-events.handler';
import { ArtistWorkflowHandler } from '../../modules/artists/handlers/artist-workflow.handler';
import { CampaignEventsHandler } from '../../modules/campaigns/handlers/campaign-events.handler';
import { ContractEventsHandler } from '../../modules/contracts/handlers/contract-events.handler';
import { ContractWorkflowHandler } from '../../modules/contracts/handlers/contract-workflow.handler';
import { InvoiceEventsHandler } from '../../modules/invoices/handlers/invoice-events.handler';
import { LeadEventsHandler } from '../../modules/leads/handlers/lead-events.handler';
import { MarketingProjectEventsHandler } from '../../modules/marketing/handlers/marketing-project-events.handler';
import { ReleaseEventsHandler } from '../../modules/releases/handlers/release-events.handler';
import { TicketEventsHandler } from '../../modules/support-tickets/handlers/ticket-events.handler';
import { UniversalEventLogHandler } from './universal-event-log.handler';
import { NotificationHandler } from './notification.handler';
import { WorkflowEventsHandler } from './workflow-events.handler';
import { DOMAIN_EVENTS } from './events.service';
import {
  ArtistEntity,
  ArtistGoalEntity,
  ClientEntity,
  ContractEntity,
  CrmTaskEntity,
  LeadEntity,
  NotificationEntity,
  SupportTicketEntity,
  TransactionEntity,
} from '../../database/entities';

describe('P2-9 event handlers context propagation', () => {
  const context = () => ({
    runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined)),
  });

  const managerContext = (manager: unknown) => ({
    runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(manager)),
  });

  const expectTenantContext = (dbContext: { runInTenantContext: jest.Mock }) => {
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
  };

  it('UniversalEventLogHandler persists only inside tenant context', async () => {
    const eventLog = { persist: jest.fn().mockResolvedValue(undefined) };
    const dbContext = context();
    const handler = new UniversalEventLogHandler(eventLog as any, dbContext as any);

    await handler.onAnyEvent({ type: 'x.y', tenantId: 't1', payload: {} } as any);
    expectTenantContext(dbContext);
    expect(eventLog.persist).toHaveBeenCalled();

    await handler.onAnyEvent({ type: 'x.y', payload: {} } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledTimes(1);
  });

  it('NotificationHandler persists notifications inside tenant context and aborts without tenant', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn(() => repo) };
    const dbContext = managerContext(manager);
    const ds = { getRepository: jest.fn(() => repo) };
    const handler = new NotificationHandler(undefined as any, ds as any, dbContext as any);

    await handler.onDomainNotificationEvent({
      type: DOMAIN_EVENTS.ARTIST_CREATED,
      tenantId: 't1',
      userId: 'u1',
      payload: { nomeArtistico: 'A' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(NotificationEntity);
    expect(repo.save).toHaveBeenCalled();

    await handler.onDomainNotificationEvent({
      type: DOMAIN_EVENTS.ARTIST_CREATED,
      userId: 'u1',
      payload: { nomeArtistico: 'A' },
    } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledTimes(1);
  });

  it('WorkflowEventsHandler writes audit log inside tenant context', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn(() => repo) };
    const dbContext = managerContext(manager);
    const handler = new WorkflowEventsHandler({ getRepository: jest.fn(() => repo) } as any, dbContext as any);

    await handler.onWorkflowTransitioned({
      type: DOMAIN_EVENTS.WORKFLOW_TRANSITIONED,
      tenantId: 't1',
      payload: {
        entityType: 'artist',
        entityId: 'a1',
        fromStatus: 'draft',
        toStatus: 'active',
        actorId: 'u1',
        transitionedAt: '2026-06-12T00:00:00.000Z',
      },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(expect.any(Function));
    expect(repo.save).toHaveBeenCalled();

    await handler.onWorkflowTransitioned({ type: DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, payload: {} } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledTimes(1);
  });

  it('InvoiceEventsHandler wraps activity log writes in tenant context', async () => {
    const dbContext = context();
    const activityLogs = { create: jest.fn().mockResolvedValue(undefined) };
    const handler = new InvoiceEventsHandler(null, activityLogs as any, undefined as any, dbContext as any);

    await handler.onInvoiceCreated({
      type: DOMAIN_EVENTS.INVOICE_CREATED,
      tenantId: 't1',
      payload: { invoiceId: 'i1', numero: '1', valor: 10, createdBy: 'u1' },
    } as any);
    expectTenantContext(dbContext);
    expect(activityLogs.create).toHaveBeenCalledWith('t1', 'u1', expect.objectContaining({ action: 'created' }));

    await handler.onInvoiceCreated({
      type: DOMAIN_EVENTS.INVOICE_CREATED,
      payload: { invoiceId: 'i1', createdBy: 'u1' },
    } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledTimes(1);
  });

  it('InvoiceEventsHandler.onInvoiceOverdue evaluates financial rules with the invoice.overdue trigger', async () => {
    const dbContext = context();
    const financialRules = { evaluateRules: jest.fn().mockResolvedValue(undefined) };
    const handler = new InvoiceEventsHandler(null, undefined as any, financialRules as any, dbContext as any);

    await handler.onInvoiceOverdue({
      type: DOMAIN_EVENTS.INVOICE_OVERDUE,
      tenantId: 't1',
      payload: { invoiceId: 'i1', numero: '1', valor: '250', dataVencimento: '2026-06-01' },
    } as any);

    expect(financialRules.evaluateRules).toHaveBeenCalledWith(
      't1', 'invoice.overdue',
      expect.objectContaining({ entityId: 'i1', entityType: 'invoice', valor: 250 }),
    );
  });

  it('CampaignEventsHandler persists notification inside tenant context', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn(() => repo) };
    const dbContext = managerContext(manager);
    const handler = new CampaignEventsHandler(
      { getRepository: jest.fn(() => repo) } as any,
      dbContext as any,
    );

    await handler.onCampaignStarted({
      type: DOMAIN_EVENTS.CAMPAIGN_STARTED,
      tenantId: 't1',
      userId: 'u1',
      payload: { campaignId: 'c1', tenantId: 't1', title: 'Campanha', startedBy: 'u1', startedAt: 'now' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(NotificationEntity);
  });

  it('LeadEventsHandler uses tenant context for conversion writes', async () => {
    const repos = new Map<unknown, any>([
      [ClientEntity, { create: jest.fn((v) => v), save: jest.fn(async (v) => ({ ...v, id: 'client-1' })) }],
      [LeadEntity, { update: jest.fn().mockResolvedValue(undefined), findOne: jest.fn().mockResolvedValue(null) }],
      [ArtistEntity, { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) }],
    ]);
    const getRepository = jest.fn((entity) => repos.get(entity));
    // find-aca0fb58: onLeadConverted opens base.transaction(cb) to hold an
    // advisory lock across the read-check-write sequence — the mock invokes
    // cb with a manager resolving to the SAME repo mocks.
    const manager = {
      getRepository,
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb({ getRepository, query: jest.fn().mockResolvedValue(undefined) })),
    };
    const dbContext = managerContext(manager);
    const handler = new LeadEventsHandler({ getRepository } as any, dbContext as any);

    await handler.onLeadConverted({
      type: DOMAIN_EVENTS.LEAD_CONVERTED,
      tenantId: 't1',
      userId: 'u1',
      payload: { leadId: 'l1', tenantId: 't1', nome: 'Lead', empresa: null, convertedBy: 'u1', convertedAt: 'now' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(ClientEntity);
    expect(repos.get(LeadEntity).update).toHaveBeenCalledWith(
      { id: 'l1', tenant_id: 't1' },
      expect.objectContaining({ client_id: 'client-1' }),
    );
  });

  it('ArtistWorkflowHandler creates onboarding tasks inside tenant context', async () => {
    const taskRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager = { getRepository: jest.fn((entity) => (entity === CrmTaskEntity ? taskRepo : null)) };
    const dbContext = managerContext(manager);
    const handler = new ArtistWorkflowHandler({ getRepository: jest.fn(() => taskRepo) } as any, null as any, null as any, null as any, dbContext as any);

    await handler.onArtistStatusChanged({
      type: DOMAIN_EVENTS.ARTIST_STATUS_CHANGED,
      tenantId: 't1',
      payload: { artistId: 'a1', tenantId: 't1', nomeArtistico: 'A', newStatus: 'signed', changedBy: 'u1' },
    } as any);
    expectTenantContext(dbContext);
    expect(taskRepo.save).toHaveBeenCalled();
  });

  it('ContractWorkflowHandler creates execution tasks inside tenant context', async () => {
    const taskRepo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const contractRepo = { findOne: jest.fn().mockResolvedValue({ valor: 100 }) };
    const manager = { getRepository: jest.fn((entity) => (entity === CrmTaskEntity ? taskRepo : contractRepo)) };
    const dbContext = managerContext(manager);
    const handler = new ContractWorkflowHandler({ getRepository: jest.fn((entity) => (entity === CrmTaskEntity ? taskRepo : contractRepo)) } as any, null as any, null as any, dbContext as any);

    await handler.onContractSigned({
      type: DOMAIN_EVENTS.CONTRACT_SIGNED,
      tenantId: 't1',
      payload: { contractId: 'c1', title: 'Contrato', signedBy: 'u1', signedAt: 'now' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(ContractEntity);
    expect(taskRepo.save).toHaveBeenCalled();
  });

  it('ContractEventsHandler updates signed contract side effects inside tenant context', async () => {
    const artistRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const txRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => ({ ...v, id: 'tx1' })) };
    const contractRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ valor: 100 }),
      })),
    };
    const repoFor = (entity: unknown) => {
      if (entity === ArtistEntity) return artistRepo;
      if (entity === TransactionEntity) return txRepo;
      if (entity === ContractEntity) return contractRepo;
      return null;
    };
    const manager = { getRepository: jest.fn(repoFor) };
    const dbContext = managerContext(manager);
    const handler = new ContractEventsHandler(
      { getRepository: jest.fn(repoFor) } as any,
      null as any,
      null as any,
      null as any,
      dbContext as any,
    );

    await handler.onContractSigned({
      type: DOMAIN_EVENTS.CONTRACT_SIGNED,
      tenantId: 't1',
      payload: { contractId: 'c1', title: 'Contrato', artistId: 'a1', signedBy: 'u1', signedAt: 'now' },
    } as any);
    expectTenantContext(dbContext);
    expect(artistRepo.update).toHaveBeenCalledWith(
      { id: 'a1', tenant_id: 't1' },
      expect.objectContaining({ contrato_id: 'c1' }),
    );
    expect(txRepo.save).toHaveBeenCalled();
  });

  it('ReleaseEventsHandler persists release approval notification inside tenant context', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn(() => repo) };
    const dbContext = managerContext(manager);
    const handler = new ReleaseEventsHandler({ getRepository: jest.fn(() => repo) } as any, dbContext as any);

    await handler.onReleaseApproved({
      type: DOMAIN_EVENTS.RELEASE_APPROVED,
      tenantId: 't1',
      userId: 'u1',
      payload: { releaseId: 'r1', title: 'Release', approvedBy: 'u1' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(NotificationEntity);
  });

  it('ArtistEventsHandler creates initial goals inside tenant context', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn(() => repo) };
    const dbContext = managerContext(manager);
    const handler = new ArtistEventsHandler({ getRepository: jest.fn(() => repo) } as any, null as any, null as any, dbContext as any);

    await handler.onArtistCreated({
      type: DOMAIN_EVENTS.ARTIST_CREATED,
      tenantId: 't1',
      payload: { artistId: 'a1', tenantId: 't1', nomeArtistico: 'A' },
    } as any);
    expectTenantContext(dbContext);
    expect(manager.getRepository).toHaveBeenCalledWith(ArtistGoalEntity);
    expect(repo.save).toHaveBeenCalled();
  });

  it('TicketEventsHandler updates ticket and requester notification inside tenant context', async () => {
    const ticketRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'tk1', sla_deadline: null, created_by: 'requester', metadata: {} }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const notifRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn((entity) => (entity === SupportTicketEntity ? ticketRepo : notifRepo)) };
    const dbContext = managerContext(manager);
    const handler = new TicketEventsHandler({ getRepository: jest.fn((entity) => (entity === SupportTicketEntity ? ticketRepo : notifRepo)) } as any, dbContext as any);

    await handler.onTicketResolved({
      type: DOMAIN_EVENTS.TICKET_RESOLVED,
      tenantId: 't1',
      payload: { ticketId: 'tk1', tenantId: 't1', title: 'Ticket', resolvedBy: 'u1', resolvedAt: 'now' },
    } as any);
    expectTenantContext(dbContext);
    expect(ticketRepo.update).toHaveBeenCalledWith(
      { id: 'tk1', tenant_id: 't1' },
      expect.objectContaining({ status: 'resolved' }),
    );
    expect(notifRepo.save).toHaveBeenCalled();
  });

  it('MarketingProjectEventsHandler wraps service call in tenant context', async () => {
    const marketingProjects = {
      createFromCompletedProject: jest.fn().mockResolvedValue({ id: 'mp1' }),
    };
    const dbContext = context();
    const handler = new MarketingProjectEventsHandler(marketingProjects as any, dbContext as any);

    await handler.onProjectCompleted({
      type: DOMAIN_EVENTS.PROJECT_COMPLETED,
      tenantId: 't1',
      payload: { projectId: 'p1', tenantId: 't1', title: 'Projeto' },
    } as any);
    expectTenantContext(dbContext);
    expect(marketingProjects.createFromCompletedProject).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1' }),
    );
  });
});
