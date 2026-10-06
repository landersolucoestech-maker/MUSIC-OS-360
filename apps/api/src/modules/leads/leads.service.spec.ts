import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { EncryptionService } from '../../core/security/encryption.service';
import { DatabaseContextService } from '../../database/database-context.service';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService } from '../../core/events/events.service';

/**
 * leads.service.spec.ts  (Part 79)
 *
 * Permanent guard for the real bug reproduced in this Part: `LeadEntity`
 * declared `score`/`pipeline_stage`, columns physically removed by the
 * RebuildLeadsInCanonicalFormOrder migration — every real POST /leads
 * failed with "column \"score\" of relation \"leads\" does not exist".
 * Never detected because the frontend used an in-memory mock. Also covers
 * the mapping of the rich music CRM fields (stageName/company/
 * servicePayload/crmInternalData/etc, added in this Part to eliminate
 * the frontend mock).
 */
function makeBilling(status: string | null = 'active') {
  return {
    getState: jest.fn(async () => (status == null ? null : ({ status } as any))),
  } as unknown as import('../billing/billing-enforcement.service').BillingEnforcementService;
}

function makeEncryption() {
  return {
    encryptNullable: jest.fn((v: string | null | undefined) => (v != null ? `enc:${v}` : null)),
    decryptNullable: jest.fn((v: string | null | undefined) => (v ? v.replace(/^enc:/, '') : null)),
  } as unknown as EncryptionService;
}

function makeRepo(rows: Record<string, unknown>[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['skip'] = jest.fn(chain);
  qb['take'] = jest.fn(chain);
  qb['limit'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getMany'] = jest.fn(async () => rows);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);

  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'lead-uuid-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    _qb: qb,
  };
}

function makeService(rows: Record<string, unknown>[] = []) {
  const encryption = makeEncryption();
  const repo = makeRepo(rows);
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const dbContext = { runInTenantContext: (_ctx: unknown, work: () => unknown) => work() } as unknown as DatabaseContextService;
  const workflowService = { getAllowedTransitions: jest.fn(() => []) } as unknown as WorkflowService;
  const events = { emitTyped: jest.fn(), emit: jest.fn() } as unknown as EventsService;
  const svc = new LeadsService(ds, null, dbContext, workflowService, events, encryption, makeBilling());
  return { svc, repo, encryption };
}

describe('LeadsService.create — real physical columns (never score/pipeline_stage)', () => {
  it('creates a lead with the rich music-CRM fields mapped to physical columns', async () => {
    const { svc, repo } = makeService();

    await svc.create('tenant-1', 'user-1', {
      name: 'Lead Teste',
      email: 'lead@example.test',
      phone: '+5511999990000',
      stageName: 'Artistico Teste',
      company: 'Empresa Teste',
      whatsapp: '+5511999990000',
      city: 'Sao Paulo',
      state: 'SP',
      clientType: 'artist',
      serviceType: 'musicMarketing',
      servicePayload: { leadType: 'artist_or_band' },
      crmInternalData: { responsiblePerson: 'QA' },
      uploads: [],
    } as any);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(saved['name']).toBe('Lead Teste');
    expect(saved['stage_name']).toBe('Artistico Teste');
    expect(saved['company']).toBe('Empresa Teste');
    expect(saved['city']).toBe('Sao Paulo');
    expect(saved['state']).toBe('SP');
    expect(saved['client_type']).toBe('artist');
    expect(saved['service_type']).toBe('musicMarketing');
    expect(saved['service_payload']).toEqual({ leadType: 'artist_or_band' });
    expect(saved['crm_internal_data']).toEqual({ responsiblePerson: 'QA' });
    // Never reintroduces the columns removed by the canonical migration.
    expect(saved['score']).toBeUndefined();
    expect(saved['pipeline_stage']).toBeUndefined();
  });

  it('DTO.stage goes into metadata (pipeline_stage does not exist physically)', async () => {
    const { svc, repo } = makeService();

    await svc.create('tenant-1', 'user-1', { name: 'Lead Teste', stage: 'qualified' } as any);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(saved['pipeline_stage']).toBeUndefined();
    expect((saved['metadata'] as Record<string, unknown>)['stage']).toBe('qualified');
  });
});

/**
 * Task K — same optimistic concurrency protection applied to
 * ContractsService.update(): when the change includes a status change,
 * the CAS runs INSIDE the same transaction as transitionInTx (via
 * em.getRepository), so a concurrent edit rolls back the whole
 * transaction instead of leaving an orphan transition history.
 */
describe('LeadsService.update — optimistic concurrency (Task K)', () => {
  const NOW = new Date('2026-08-14T12:00:00.000Z');
  const LEAD = {
    id: 'lead-1', tenant_id: 'tenant-1', nome: 'Fulano de Tal', status: 'novo',
    metadata: {}, deleted_at: null, updated_at: NOW,
  };

  function makeServiceWithTransaction() {
    const encryption = makeEncryption();
    const repo = makeRepo([LEAD]);
    const ds = {
      getRepository: jest.fn(() => repo),
      transaction: jest.fn(async (cb: (em: unknown) => unknown) => cb({ getRepository: jest.fn(() => repo) })),
    } as any;
    const dbContext = { runInTenantContext: (_ctx: unknown, work: () => unknown) => work() } as unknown as DatabaseContextService;
    const workflowService = {
      getAllowedTransitions: jest.fn(() => []),
      transitionInTx: jest.fn(async () => undefined),
    } as unknown as WorkflowService;
    const events = { emitTyped: jest.fn(), emit: jest.fn() } as unknown as EventsService;
    const svc = new LeadsService(ds, null, dbContext, workflowService, events, encryption, makeBilling());
    return { svc, repo };
  }

  it('update without a status change and without expectedUpdatedAt: applies an unconditional update', async () => {
    const { svc, repo } = makeServiceWithTransaction();

    await svc.update('tenant-1', 'user-1', 'lead-1', { nome: 'Novo Nome' } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'lead-1', tenant_id: 'tenant-1' });
  });

  it('update with a status change and stale expectedUpdatedAt (0 rows): ConflictException, the transaction does not commit', async () => {
    const { svc, repo } = makeServiceWithTransaction();
    (repo.update as jest.Mock).mockResolvedValueOnce({ affected: 0 });

    await expect(
      svc.update('tenant-1', 'user-1', 'lead-1', {
        status: 'contatado',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});

/**
 * HIGH finding (billing-enforcement rework, this session): the public
 * lead-capture flow (`LeadsController.submitPublicArtistApplication`, marked
 * `@Public()`, so `BillingEnforcementGuard` never runs for it) resolves the
 * tenant via `LeadsService.getPublicWorkspaceBySlug` — which only checks
 * `tenants.active` / `deleted_at` / `allow_public_registration`, never
 * `tenant_billing_state.status`. `LeadsService` has no dependency on
 * `BillingEnforcementService` at all, so a tenant with
 * `tenant_billing_state.status = 'suspended'` that is still `active = true`
 * can still successfully submit public artist applications and create leads.
 */
describe('LeadsService.submitPublicArtistApplication — billing-suspended tenant (HIGH finding)', () => {
  const SUSPENDED_BUT_ACTIVE_TENANT = {
    id: 'tenant-suspended-1',
    org_id: 'org-1',
    name: 'Suspended Co',
    slug: 'suspended-co',
    // `active` reflects only the tenant lifecycle, not billing —
    // tenant_billing_state.status = 'suspended' does not change this column.
    active: true,
    deleted_at: null,
    allow_public_registration: true,
    public_registration_blocked: false,
    public_registration_revoked_at: null,
    settings: {},
  };

  function makeServiceForPublicFlow(billingStatus: string | null = 'active') {
    const encryption = makeEncryption();
    const repo = makeRepo([]);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return [];
      if (sql.includes('FROM "tenants"')) return [SUSPENDED_BUT_ACTIVE_TENANT];
      if (sql.startsWith('UPDATE "tenants"')) return [];
      return [];
    });
    const ds = { getRepository: jest.fn(() => repo), query } as any;
    const dbContext = { runInTenantContext: (_ctx: unknown, work: () => unknown) => work() } as unknown as DatabaseContextService;
    const workflowService = { getAllowedTransitions: jest.fn(() => []) } as unknown as WorkflowService;
    const events = { emitTyped: jest.fn(), emit: jest.fn() } as unknown as EventsService;
    const billing = makeBilling(billingStatus);
    const svc = new LeadsService(ds, null, dbContext, workflowService, events, encryption, billing);
    return { svc, repo, query, billing };
  }

  it('rejects the public application when tenant_billing_state.status = suspended, even with tenants.active = true (find-a22e0dad fix)', async () => {
    const { svc, repo, billing } = makeServiceForPublicFlow('suspended');

    await expect(
      svc.submitPublicArtistApplication('suspended-co', {
        artisticName: 'Artista Teste',
        fullName: 'Fulano de Tal',
        email: 'artista@example.test',
        musicalGenre: 'MPB',
        acceptedTerms: true,
      } as any),
    ).rejects.toThrow();

    expect(billing.getState).toHaveBeenCalledWith('tenant-suspended-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects the public application when tenant_billing_state.status = read_only', async () => {
    const { svc, repo } = makeServiceForPublicFlow('read_only');

    await expect(
      svc.submitPublicArtistApplication('suspended-co', {
        artisticName: 'Artista Teste',
        fullName: 'Fulano de Tal',
        email: 'artista2@example.test',
        musicalGenre: 'MPB',
        acceptedTerms: true,
      } as any),
    ).rejects.toThrow();

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('accepts normally when the tenant is not suspended/read_only by billing', async () => {
    const { svc, repo } = makeServiceForPublicFlow('active');

    const result = await svc.submitPublicArtistApplication('suspended-co', {
      artisticName: 'Artista Teste',
      fullName: 'Fulano de Tal',
      email: 'artista3@example.test',
      musicalGenre: 'MPB',
      acceptedTerms: true,
    } as any);

    expect(result.accepted).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it('accepts normally when there is no billing-state row (tenant without billing configured yet)', async () => {
    const { svc, repo } = makeServiceForPublicFlow(null);

    const result = await svc.submitPublicArtistApplication('suspended-co', {
      artisticName: 'Artista Teste',
      fullName: 'Fulano de Tal',
      email: 'artista4@example.test',
      musicalGenre: 'MPB',
      acceptedTerms: true,
    } as any);

    expect(result.accepted).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });
});
