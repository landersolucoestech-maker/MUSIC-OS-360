import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { EncryptionService } from '../../core/security/encryption.service';
import { DatabaseContextService } from '../../database/database-context.service';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService } from '../../core/events/events.service';

/**
 * leads.service.spec.ts  (Parte 79)
 *
 * Guarda permanente do bug real reproduzido nesta Parte: `LeadEntity`
 * declarava `score`/`pipeline_stage`, colunas removidas fisicamente pela
 * migration RebuildLeadsInCanonicalFormOrder — todo POST /leads real
 * falhava com "column \"score\" of relation \"leads\" does not exist".
 * Nunca detectado porque o frontend usava um mock em memória. Cobre também
 * o mapeamento dos campos ricos do CRM musical (nomeArtistico/empresa/
 * payloadServico/dadosInternosCRM/etc, adicionados nesta Parte para eliminar
 * o mock do frontend).
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

describe('LeadsService.create — colunas físicas reais (nunca score/pipeline_stage)', () => {
  it('cria lead com os campos ricos do CRM musical mapeados para colunas físicas', async () => {
    const { svc, repo } = makeService();

    await svc.create('tenant-1', 'user-1', {
      name: 'Lead Teste',
      email: 'lead@example.test',
      phone: '+5511999990000',
      nomeArtistico: 'Artistico Teste',
      empresa: 'Empresa Teste',
      whatsapp: '+5511999990000',
      cidade: 'Sao Paulo',
      estado: 'SP',
      tipoCliente: 'artist',
      tipoServico: 'marketingMusical',
      payloadServico: { tipo_lead: 'artista_banda' },
      dadosInternosCRM: { responsavel: 'QA' },
      uploads: [],
    } as any);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(saved['nome_artistico']).toBe('Artistico Teste');
    expect(saved['empresa']).toBe('Empresa Teste');
    expect(saved['cidade']).toBe('Sao Paulo');
    expect(saved['estado']).toBe('SP');
    expect(saved['tipo_cliente']).toBe('artist');
    expect(saved['tipoServico']).toBe('marketingMusical');
    expect(saved['payload_servico']).toEqual({ tipo_lead: 'artista_banda' });
    expect(saved['dados_internos_crm']).toEqual({ responsavel: 'QA' });
    // Nunca reintroduz as colunas removidas pela migration canônica.
    expect(saved['score']).toBeUndefined();
    expect(saved['pipeline_stage']).toBeUndefined();
  });

  it('DTO.stage vai para metadata (pipeline_stage não existe fisicamente)', async () => {
    const { svc, repo } = makeService();

    await svc.create('tenant-1', 'user-1', { name: 'Lead Teste', stage: 'qualified' } as any);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(saved['pipeline_stage']).toBeUndefined();
    expect((saved['metadata'] as Record<string, unknown>)['stage']).toBe('qualified');
  });
});

/**
 * Task K — mesma proteção de concorrência otimista aplicada a
 * ContractsService.update(): quando a mudança inclui troca de status,
 * o CAS roda DENTRO da mesma transação de transitionInTx (via
 * em.getRepository), então uma edição concorrente reverte a transação
 * inteira em vez de deixar um histórico de transição órfão.
 */
describe('LeadsService.update — concorrência otimista (Task K)', () => {
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

  it('update sem troca de status, sem expectedUpdatedAt: aplica update incondicional', async () => {
    const { svc, repo } = makeServiceWithTransaction();

    await svc.update('tenant-1', 'user-1', 'lead-1', { nome: 'Novo Nome' } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'lead-1', tenant_id: 'tenant-1' });
  });

  it('update com troca de status e expectedUpdatedAt desatualizado (0 linhas): ConflictException, transação não commita', async () => {
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
describe('LeadsService.submitPublicArtistApplication — tenant suspenso por billing (HIGH finding)', () => {
  const SUSPENDED_BUT_ACTIVE_TENANT = {
    id: 'tenant-suspended-1',
    org_id: 'org-1',
    name: 'Suspended Co',
    slug: 'suspended-co',
    // `active` reflete apenas o ciclo de vida do tenant, não o billing —
    // tenant_billing_state.status = 'suspended' não altera esta coluna.
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

  it('rejeita a candidatura pública quando tenant_billing_state.status = suspended, mesmo com tenants.active = true (find-a22e0dad fix)', async () => {
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

  it('rejeita a candidatura pública quando tenant_billing_state.status = read_only', async () => {
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

  it('aceita normalmente quando o tenant não está suspenso/read_only por billing', async () => {
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

  it('aceita normalmente quando não existe linha de billing state (tenant sem billing configurado ainda)', async () => {
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
