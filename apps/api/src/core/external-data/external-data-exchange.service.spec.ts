/**
 * external-data-exchange.service.spec.ts
 *
 * Fase 5 / C6: buildSocietyPayload() (privado) monta metadata.contributors/
 * rightHolders a partir de shares — só shares elegíveis para registro
 * (share_type IS NULL, não soft-deleted) podem entrar; shares financeiras/
 * pendentes nunca são tratadas como titular/autor numa submissão externa.
 *
 * O método é privado e chamado por submitSociety(), que também orquestra
 * provider/eventos/persistResult — irrelevante para o que o C6 mudou aqui.
 * Testamos buildSocietyPayload() isoladamente via cast, para não precisar
 * mockar toda a orquestração só para provar o filtro de elegibilidade.
 *
 * find-bc7c20a6 (CRITICAL): ingestWebhook used to resolve the target tenant
 * from a caller-supplied `tenantId` param (itself sourced from the
 * `X-Tenant-ID` header at the controller). The HMAC signature only proves
 * the payload was signed with the shared per-provider secret — it proves
 * nothing about which tenant it belongs to. The fix resolves tenant
 * server-side from an `external_data_submissions` row recorded at submit
 * time, keyed on (provider, submission_id) — never from caller input.
 */
import 'reflect-metadata';
import { createHmac } from 'crypto';
import { ExternalDataExchangeService } from './external-data-exchange.service';
import { WorkEntity, PhonogramEntity, ShareEntity, ExternalDataSubmissionEntity, ActivityLogEntity, WebhookEventEntity } from '../../database/entities';
import { WebhookEventStatus } from '@music-os-360/types';

function sign(payload: Record<string, unknown>, secret: string): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload), 'utf8').digest('hex');
}

function makeQb(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn(chain);
  qb['getMany'] = jest.fn(async () => rows);
  return qb;
}

function makeSubmissionsRepo(rows: Array<{ provider: string; submission_id: string; tenant_id: string }> = []) {
  return {
    findOne: jest.fn(async ({ where }: { where: { provider: string; submission_id: string } }) =>
      rows.find((r) => r.provider === where.provider && r.submission_id === where.submission_id) ?? null),
    upsert: jest.fn(async () => undefined),
  };
}

function makeWebhookEventsRepo(existing: Record<string, unknown> | null = null) {
  const rows = new Map<string, Record<string, unknown>>();
  if (existing) rows.set(existing.id as string, existing);
  return {
    findOne: jest.fn(async ({ where }: { where: { external_id: string } }) =>
      [...rows.values()].find((r) => r['external_id'] === where.external_id) ?? null),
    update: jest.fn(async (criteria: { id: string }, patch: Record<string, unknown>) => {
      const row = rows.get(criteria.id);
      if (row) Object.assign(row, patch);
    }),
    create: jest.fn((data: Record<string, unknown>) => ({ id: 'new-event-1', ...data })),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      rows.set(entity.id as string, entity);
      return entity;
    }),
    _rows: rows,
  };
}

function makeDs(opts: {
  works?: Record<string, unknown>[];
  shares?: Record<string, unknown>[];
  submissions?: Array<{ provider: string; submission_id: string; tenant_id: string }>;
  webhookEvent?: Record<string, unknown> | null;
}) {
  const worksRepo = { createQueryBuilder: jest.fn(() => makeQb(opts.works ?? [])) };
  const phonogramsRepo = { createQueryBuilder: jest.fn(() => makeQb([])) };
  const sharesRepo = { createQueryBuilder: jest.fn(() => makeQb(opts.shares ?? [])) };
  const submissionsRepo = makeSubmissionsRepo(opts.submissions ?? []);
  const activityLogsRepo = { create: jest.fn((d: unknown) => d), save: jest.fn(async () => undefined) };
  const webhookEventsRepo = makeWebhookEventsRepo(opts.webhookEvent ?? null);
  const map = new Map<unknown, unknown>([
    [WorkEntity, worksRepo],
    [PhonogramEntity, phonogramsRepo],
    [ShareEntity, sharesRepo],
    [ExternalDataSubmissionEntity, submissionsRepo],
    [ActivityLogEntity, activityLogsRepo],
    [WebhookEventEntity, webhookEventsRepo],
  ]);
  return { getRepository: jest.fn((e: unknown) => map.get(e) ?? {}), webhookEventsRepo } as never;
}

function makeTenantResolver(active = true) {
  return { resolveTenant: jest.fn(async () => (active ? { id: 'tenant-1', active: true } : null)) };
}

function makeRegistry(normalized: Record<string, unknown> = {}) {
  return {
    get: jest.fn(() => ({
      normalizeWebhook: jest.fn(() => normalized),
    })),
  };
}

function makeService(
  opts: { works?: Record<string, unknown>[]; shares?: Record<string, unknown>[]; submissions?: Array<{ provider: string; submission_id: string; tenant_id: string }>; webhookEvent?: Record<string, unknown> | null },
  tenantResolver: unknown = makeTenantResolver(),
  registry: unknown = {},
) {
  const events = { emitTyped: jest.fn() } as never;
  return new ExternalDataExchangeService(makeDs(opts), registry as never, events, tenantResolver as never);
}

/** Same as makeService, but also returns the mocked webhookEvents repo for direct row inspection. */
function makeServiceWithWebhookRepo(
  opts: { submissions?: Array<{ provider: string; submission_id: string; tenant_id: string }>; webhookEvent?: Record<string, unknown> | null },
  tenantResolver: unknown = makeTenantResolver(),
  registry: unknown = {},
) {
  const events = { emitTyped: jest.fn() } as never;
  const ds = makeDs(opts) as unknown as { webhookEventsRepo: ReturnType<typeof makeWebhookEventsRepo> };
  const svc = new ExternalDataExchangeService(ds as never, registry as never, events, tenantResolver as never);
  return { svc, webhookEventsRepo: ds.webhookEventsRepo };
}

describe('ExternalDataExchangeService.buildSocietyPayload — elegibilidade de shares (Fase 5 / C6)', () => {
  const work = { id: 'w1', title: 'Obra', compositores: null, compositor: null, co_compositores: null, editora: null, detentores: null, genero: null, isrc: null, iswc: null };

  it('contributors/rightHolders só incluem shares elegíveis (share_type null)', async () => {
    const svc = makeService({
      works: [work],
      shares: [
        { holder_name: 'Autor Elegível', party_role: 'autor', percentage: '100', holder_document: null, status: 'ativo', share_type: null },
        { holder_name: 'Financeiro', party_role: 'autor', percentage: '999', holder_document: null, status: 'ativo', share_type: 'pendente' },
      ],
    });

    const payload = await (svc as unknown as {
      buildSocietyPayload: (input: unknown, providerId: string) => Promise<{ metadata: Record<string, unknown> }>;
    }).buildSocietyPayload({ tenantId: 't1', userId: 'u1', workIds: ['w1'] }, 'abramus');

    const metadata = payload.metadata as { contributors: { name: string }[]; rightHolders: { name: string }[] };
    expect(metadata.contributors).toHaveLength(1);
    expect(metadata.contributors[0].name).toBe('Autor Elegível');
    expect(metadata.rightHolders).toHaveLength(1);
    expect(metadata.rightHolders[0].name).toBe('Autor Elegível');
  });

  it('nenhuma share elegível quando todas são financeiras/pendentes', async () => {
    const svc = makeService({
      works: [work],
      shares: [{ holder_name: 'Financeiro', party_role: 'autor', percentage: '100', holder_document: null, status: 'ativo', share_type: 'pendente' }],
    });

    const payload = await (svc as unknown as {
      buildSocietyPayload: (input: unknown, providerId: string) => Promise<{ metadata: Record<string, unknown> }>;
    }).buildSocietyPayload({ tenantId: 't1', userId: 'u1', workIds: ['w1'] }, 'abramus');

    const metadata = payload.metadata as { contributors: unknown[] };
    expect(metadata.contributors).toHaveLength(0);
  });
});

describe('ExternalDataExchangeService.ingestWebhook — find-bc7c20a6: tenant resolved server-side, never from caller input', () => {
  it('rejeita um webhook cujo submission_id não corresponde a nenhuma submissão registrada (não existe header para "atacar" mais — mesmo assim, sem submission conhecida, nada é aceito)', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-unknown' });
    const svc = makeService({ submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }] }, makeTenantResolver(), registry);

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow('Webhook does not reference a known submission');
  });

  it('rejeita um webhook sem submission_id algum no payload normalizado (não pode ser atribuído a nenhum tenant)', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1' }); // no submissionId
    const svc = makeService({}, makeTenantResolver(), registry);

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow('Webhook does not reference a known submission');
  });

  it('resolve o tenant correto a partir da submissão registrada — nunca de um valor fornecido pelo chamador', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real', entityType: 'artist', entityId: 'artist-1' });
    const resolver = makeTenantResolver(true);
    const svc = makeService(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }] },
      resolver,
      registry,
    );

    // applyWebhook will try to persist onto the artist repo, which makeDs
    // doesn't stub with a real findOne — irrelevant to this test, which only
    // proves *which tenant* got resolved before that point. We only assert
    // resolveTenant was called with the tenant recorded for the submission,
    // never anything the caller could have supplied (there is no tenantId
    // parameter on ingestWebhook anymore at all).
    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow(); // fails later inside applyWebhook/persistResult (unstubbed repo) — fine, that's past the point under test
    expect(resolver.resolveTenant).toHaveBeenCalledWith('tenant-real');
  });

  it('tenant inativo: rejeita ANTES de qualquer escrita em webhookEvents', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real' });
    const resolver = makeTenantResolver(false); // resolveTenant → null
    const svc = makeService(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-1' }] },
      resolver,
      registry,
    );

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow('Tenant not found or inactive');

    expect(resolver.resolveTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('find-e5ca49de: sem secret configurado, rejeita fail-closed antes de qualquer resolução de tenant', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real' });
    const resolver = makeTenantResolver();
    const svc = makeService(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-1' }] },
      resolver,
      registry,
    );

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: {}, signature: null, secret: null }),
    ).rejects.toThrow('External data webhook secret unavailable');

    expect(resolver.resolveTenant).not.toHaveBeenCalled();
  });

  it('find-ee81e34d: um external_id já visto mas ainda não PROCESSED é reprocessado, não tratado como duplicata permanente', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real', raw: {} });
    const existingRow = {
      id: 'event-1', external_id: 'abramus:evt-1', status: WebhookEventStatus.FAILED, retry_count: 1,
    };
    const { svc, webhookEventsRepo } = makeServiceWithWebhookRepo(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }], webhookEvent: existingRow },
      makeTenantResolver(),
      registry,
    );

    const result = await svc.ingestWebhook({
      providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' },
      signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh',
    });

    expect(result).toMatchObject({ duplicate: false, eventId: 'event-1' });
    expect(webhookEventsRepo.update).toHaveBeenCalledWith(
      { id: 'event-1' },
      expect.objectContaining({ status: WebhookEventStatus.PENDING, retry_count: 2 }),
    );
    // reprocessed successfully -> row transitions to PROCESSED
    expect(webhookEventsRepo._rows.get('event-1')).toMatchObject({ status: WebhookEventStatus.PROCESSED });
  });

  it('find-ee81e34d: um external_id já PROCESSED continua sendo tratado como duplicata verdadeira', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real' });
    const existingRow = {
      id: 'event-1', external_id: 'abramus:evt-1', status: WebhookEventStatus.PROCESSED, retry_count: 0,
    };
    const { svc, webhookEventsRepo } = makeServiceWithWebhookRepo(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }], webhookEvent: existingRow },
      makeTenantResolver(),
      registry,
    );

    const result = await svc.ingestWebhook({
      providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' },
      signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh',
    });

    expect(result).toEqual({ duplicate: true, eventId: 'event-1' });
    expect(webhookEventsRepo.update).not.toHaveBeenCalled();
  });
});
