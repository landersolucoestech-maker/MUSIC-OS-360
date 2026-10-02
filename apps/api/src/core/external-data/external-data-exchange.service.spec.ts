/**
 * external-data-exchange.service.spec.ts
 *
 * Phase 5 / C6: buildSocietyPayload() (private) builds metadata.contributors/
 * rightHolders from shares — only shares eligible for registration
 * (share_type IS NULL, not soft-deleted) may be included; financial/pending
 * shares are never treated as a rights holder/author in an external submission.
 *
 * The method is private and called by submitSociety(), which also orchestrates
 * provider/events/persistResult — irrelevant to what C6 changed here.
 * We test buildSocietyPayload() in isolation via a cast, to avoid having to
 * mock the entire orchestration just to prove the eligibility filter.
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
import { NotFoundException } from '@nestjs/common';
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
    findOne: jest.fn(async ({ where }: { where: { provider: string; submission_id: string; tenant_id?: string } }) =>
      rows.find((r) => r.provider === where.provider && r.submission_id === where.submission_id
        && (where.tenant_id === undefined || r.tenant_id === where.tenant_id)) ?? null),
    upsert: jest.fn(async () => undefined),
  };
}

function makeWebhookEventsRepo(existing: Record<string, unknown> | null = null) {
  const rows = new Map<string, Record<string, unknown>>();
  if (existing) rows.set(existing.id as string, existing);
  return {
    findOne: jest.fn(async ({ where }: { where: { external_id: string; tenant_id?: string } }) =>
      [...rows.values()].find((r) => r['external_id'] === where.external_id
        && (where.tenant_id === undefined || r['tenant_id'] === where.tenant_id)) ?? null),
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

describe('ExternalDataExchangeService.buildSocietyPayload — share eligibility (Fase 5 / C6)', () => {
  const work = { id: 'w1', title: 'Obra', composer_names: null, composer_name: null, publisher_name: null, music_genre: null, isrc: null, iswc: null };

  it('contributors/rightHolders only include eligible shares (share_type null)', async () => {
    const svc = makeService({
      works: [work],
      shares: [
        { holder_name: 'Autor Elegível', party_role: 'author', percentage: '100', holder_document: null, status: 'active', share_type: null },
        { holder_name: 'Financeiro', party_role: 'author', percentage: '999', holder_document: null, status: 'active', share_type: 'external_receivable' },
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

  it('no share is eligible when all are financial/pending', async () => {
    const svc = makeService({
      works: [work],
      shares: [{ holder_name: 'Financeiro', party_role: 'author', percentage: '100', holder_document: null, status: 'active', share_type: 'external_receivable' }],
    });

    const payload = await (svc as unknown as {
      buildSocietyPayload: (input: unknown, providerId: string) => Promise<{ metadata: Record<string, unknown> }>;
    }).buildSocietyPayload({ tenantId: 't1', userId: 'u1', workIds: ['w1'] }, 'abramus');

    const metadata = payload.metadata as { contributors: unknown[] };
    expect(metadata.contributors).toHaveLength(0);
  });
});

describe('ExternalDataExchangeService.ingestWebhook — find-bc7c20a6: tenant resolved server-side, never from caller input', () => {
  it('rejects a webhook whose submission_id does not match any registered submission (there is no header left to "attack" — either way, with no known submission, nothing is accepted)', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-unknown' });
    const svc = makeService({ submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }] }, makeTenantResolver(), registry);

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow('Webhook does not reference a known submission');
  });

  it('rejects a webhook with no submission_id at all in the normalized payload (cannot be attributed to any tenant)', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1' }); // no submissionId
    const svc = makeService({}, makeTenantResolver(), registry);

    await expect(
      svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh' }),
    ).rejects.toThrow('Webhook does not reference a known submission');
  });

  it('resolves the correct tenant from the registered submission — never from a caller-supplied value', async () => {
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

  it('inactive tenant: rejects BEFORE any write to webhookEvents', async () => {
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

  it('find-e5ca49de: with no secret configured, fails closed before any tenant resolution', async () => {
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

  it('find-ee81e34d: an already-seen external_id that is not yet PROCESSED is reprocessed, not treated as a permanent duplicate', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real', raw: {} });
    const existingRow = {
      id: 'event-1', tenant_id: 'tenant-real', external_id: 'abramus:evt-1', status: WebhookEventStatus.FAILED, retry_count: 1,
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

  it('find-ee81e34d: an already-PROCESSED external_id continues to be treated as a true duplicate', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real' });
    const existingRow = {
      id: 'event-1', tenant_id: 'tenant-real', external_id: 'abramus:evt-1', status: WebhookEventStatus.PROCESSED, retry_count: 0,
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

describe('ExternalDataExchangeService.ingestWebhook — cross-tenant external_id collision', () => {
  it('a provider event id already stored for ANOTHER tenant is not treated as a duplicate and is not touched', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-1', submissionId: 'sub-real', raw: {} });
    const foreignRow = { id: 'event-foreign', tenant_id: 'tenant-OTHER', external_id: 'abramus:evt-1', status: WebhookEventStatus.PROCESSED, retry_count: 0 };
    const { svc, webhookEventsRepo } = makeServiceWithWebhookRepo(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }], webhookEvent: foreignRow },
      makeTenantResolver(),
      registry,
    );
    const result = await svc.ingestWebhook({
      providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh',
    });
    expect(result).toMatchObject({ duplicate: false });
    expect((result as { eventId: string }).eventId).not.toBe('event-foreign');
    expect(webhookEventsRepo.update).not.toHaveBeenCalledWith({ id: 'event-foreign' }, expect.anything());
    expect(webhookEventsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-real' }));
    const created = webhookEventsRepo.create.mock.calls[0][0] as { external_id: string };
    expect(created.external_id).not.toBe('abramus:evt-1');
    expect(foreignRow.status).toBe(WebhookEventStatus.PROCESSED);
  });

  it('every event lookup is scoped by the resolved tenant', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-2', submissionId: 'sub-real', raw: {} });
    const { svc, webhookEventsRepo } = makeServiceWithWebhookRepo(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }] }, makeTenantResolver(), registry,
    );
    await svc.ingestWebhook({ providerId: 'abramus', kind: 'society', payload: { id: 'evt-2' }, signature: sign({ id: 'evt-2' }, 'shh'), secret: 'shh' });
    for (const call of webhookEventsRepo.findOne.mock.calls) {
      expect((call[0] as { where: { tenant_id: string } }).where.tenant_id).toBe('tenant-real');
    }
  });
});

describe('ExternalDataExchangeService — failure surfaces carry codes, never raw text', () => {
  it('sync_failed event payload has errorCode and no raw error text', () => {
    const emitTyped = jest.fn();
    const svc = new ExternalDataExchangeService(makeDs({}), {} as never, { emitTyped } as never, makeTenantResolver() as never);
    (svc as unknown as { emitFailed: (...a: unknown[]) => void }).emitFailed(
      'tenant-1', 'user-1', 'artist-1', 'job-1', 'abramus',
      new Error('connect ECONNREFUSED 10.0.0.5 token=abc123 foo@bar.com'),
    );
    const payload = emitTyped.mock.calls[0][1].payload;
    expect(payload.errorCode).toBe('SYNC_FAILED');
    expect(payload).not.toHaveProperty('error');
    expect(JSON.stringify(payload)).not.toMatch(/ECONNREFUSED|abc123|foo@bar/);
  });

  it('persists a redacted internal error on the webhook row when processing fails', async () => {
    const registry = makeRegistry({ providerEventId: 'evt-9', submissionId: 'sub-real', raw: {} });
    const { svc, webhookEventsRepo } = makeServiceWithWebhookRepo(
      { submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }], webhookEvent: null },
      makeTenantResolver(),
      registry,
    );
    jest.spyOn(svc as unknown as { applyWebhook: () => Promise<void> }, 'applyWebhook').mockRejectedValue(new Error('boom token=abc123 foo@bar.com'));
    await expect(svc.ingestWebhook({
      providerId: 'abramus', kind: 'society', payload: { id: 'evt-9' },
      signature: sign({ id: 'evt-9' }, 'shh'), secret: 'shh',
    })).rejects.toThrow();
    const failed = webhookEventsRepo.update.mock.calls.find((c: unknown[]) => (c[1] as { status?: string }).status === WebhookEventStatus.FAILED);
    expect(failed).toBeDefined();
    const err = (failed![1] as { error: string }).error;
    expect(err).not.toMatch(/abc123|foo@bar/);
  });
});

// ─── External capability blocking, status machine, tenant isolation ──────────
import { ExternalDataProviderRegistry } from './external-data-provider-registry.service';
import { CapabilityUnavailableError } from './capability-unavailable.error';
import { InvalidSubmissionTransitionError } from './external-data-exchange.service';
import { ALLOWED_SUBMISSION_TRANSITIONS, isAllowedSubmissionTransition } from './external-data.types';

function makeCapDs(opts: { artist?: Record<string, unknown> | null; artistFindOne?: jest.Mock; ownedSubmission?: { tenant_id: string; provider: string; submission_id: string } } = {}) {
  const activity = { create: jest.fn((d: unknown) => d), save: jest.fn(async () => undefined) };
  const artists = {
    findOne: opts.artistFindOne ?? jest.fn(async ({ where }: { where: { id: string; tenant_id: string } }) =>
      opts.artist && opts.artist['id'] === where.id && opts.artist['tenant_id'] === where.tenant_id ? opts.artist : null),
    update: jest.fn(async () => undefined),
  };
  const submissions = {
    upsert: jest.fn(async () => undefined),
    findOne: jest.fn(async ({ where }: { where: { tenant_id: string; provider: string; submission_id: string } }) =>
      opts.ownedSubmission && opts.ownedSubmission.tenant_id === where.tenant_id && opts.ownedSubmission.provider === where.provider
        && opts.ownedSubmission.submission_id === where.submission_id ? opts.ownedSubmission : null),
  };
  const map = new Map<unknown, unknown>([
    [ActivityLogEntity, activity], [ExternalDataSubmissionEntity, submissions],
  ]);
  const { ArtistEntity, PhonogramEntity: P } = jest.requireActual('../../database/entities');
  map.set(ArtistEntity, artists); map.set(P, { createQueryBuilder: jest.fn() });
  return { ds: { getRepository: jest.fn((e: unknown) => map.get(e) ?? {}) } as never, activity, artists, submissions };
}

describe('ExternalDataExchangeService — blocked capabilities', () => {
  const artist = { id: 'a1', tenant_id: 't1', stage_name: 'X' };

  it('submitDistributor via unconfigured provider: SYNC_FAILED CAPABILITY_UNAVAILABLE, nothing persisted, blocked audit without payload', async () => {
    const { ds, activity, artists, submissions } = makeCapDs({ artist });
    const emitTyped = jest.fn();
    const svc = new ExternalDataExchangeService(ds, new ExternalDataProviderRegistry(), { emitTyped } as never, makeTenantResolver() as never);

    await expect(svc.submitDistributor({
      tenantId: 't1', userId: 'u1', providerId: 'distributor-provider-not-configured', artistId: 'a1', idempotencyKey: 'key-1',
      metadata: { secretNote: 'PAYLOAD-MARKER' },
    })).rejects.toBeInstanceOf(CapabilityUnavailableError);

    expect(emitTyped).toHaveBeenCalledTimes(1);
    expect(emitTyped.mock.calls[0][0]).toBe('external-data.sync_failed');
    expect(emitTyped.mock.calls[0][1].payload).toMatchObject({ errorCode: 'CAPABILITY_UNAVAILABLE', jobId: 'key-1' });
    expect(artists.update).not.toHaveBeenCalled();
    expect(submissions.upsert).not.toHaveBeenCalled();
    const logged = activity.create.mock.calls.map((c) => c[0] as { action: string; metadata: unknown });
    expect(logged).toHaveLength(1);
    expect(logged[0].action).toBe('external_data.blocked');
    expect(logged[0].metadata).toEqual({ capability: 'distributor_submission', provider: 'distributor-provider-not-configured', code: 'CAPABILITY_UNAVAILABLE' });
    expect(JSON.stringify(logged)).not.toContain('PAYLOAD-MARKER');
  });

  it('checkDistributorStatus failure emits an event and the blocked audit', async () => {
    const { ds, activity } = makeCapDs({ artist });
    const emitTyped = jest.fn();
    const svc = new ExternalDataExchangeService(ds, new ExternalDataProviderRegistry(), { emitTyped } as never, makeTenantResolver() as never);

    await expect(svc.checkDistributorStatus({
      tenantId: 't1', userId: 'u1', providerId: 'distributor-provider-not-configured', submissionId: 's1',
    })).rejects.toBeInstanceOf(CapabilityUnavailableError);

    expect(emitTyped.mock.calls[0][1].payload.errorCode).toBe('CAPABILITY_UNAVAILABLE');
    expect((activity.create.mock.calls[0][0] as { action: string }).action).toBe('external_data.blocked');
  });

  it('checkDistributorStatus asserts persistence availability', async () => {
    const svc = new ExternalDataExchangeService(null, new ExternalDataProviderRegistry(), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(svc.checkDistributorStatus({ tenantId: 't1', userId: 'u1', providerId: 'p', submissionId: 's' }))
      .rejects.toThrow('persistence unavailable');
  });

  it('propagates the idempotency key to a registered capable provider and persists', async () => {
    const { ds, artists } = makeCapDs({ artist });
    const registry = new ExternalDataProviderRegistry();
    const submit = jest.fn(async () => ({
      providerId: 'fake-dist', kind: 'distributor', submissionId: 'sub-1', status: 'processing', validationErrors: [],
      pendingRequirements: [], providerNotes: [], lastSyncedAt: new Date().toISOString(), raw: {},
    }));
    registry.register({
      metadata: { providerId: 'fake-dist', displayName: 'F', kind: 'distributor', supportsSubmit: true, supportsStatusCheck: true, mock: false },
      submit, checkStatus: jest.fn(), normalizeWebhook: jest.fn(),
    } as never);
    const svc = new ExternalDataExchangeService(ds, registry, { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    (artists.findOne as jest.Mock).mockResolvedValue({ ...artist, metadata: {} });

    await svc.submitDistributor({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', artistId: 'a1', idempotencyKey: 'key-42' });
    expect((submit.mock.calls[0] as unknown[])[1]).toMatchObject({ idempotencyKey: 'key-42', tenantId: 't1' });
    expect(artists.update).toHaveBeenCalled();
  });

  it('tenant isolation: another tenant\'s artist/submission entity id is rejected and nothing is written', async () => {
    const { ds, artists } = makeCapDs({
      artist: { id: 'a1', tenant_id: 'tenant-OTHER', stage_name: 'X' },
      ownedSubmission: { tenant_id: 't1', provider: 'fake-dist', submission_id: 's1' },
    });
    const registry = new ExternalDataProviderRegistry();
    registry.register({
      metadata: { providerId: 'fake-dist', displayName: 'F', kind: 'distributor', supportsSubmit: true, supportsStatusCheck: true, mock: false },
      submit: jest.fn(), checkStatus: jest.fn(async () => ({
        providerId: 'fake-dist', kind: 'distributor', submissionId: 's1', status: 'approved', validationErrors: [],
        pendingRequirements: [], providerNotes: [], lastSyncedAt: new Date().toISOString(), raw: {},
      })), normalizeWebhook: jest.fn(),
    } as never);
    const svc = new ExternalDataExchangeService(ds, registry, { emitTyped: jest.fn() } as never, makeTenantResolver() as never);

    await expect(svc.submitDistributor({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', artistId: 'a1' }))
      .rejects.toThrow('Artista não encontrado.');
    await expect(svc.checkDistributorStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', submissionId: 's1', entityType: 'artist', entityId: 'a1' }))
      .rejects.toThrow('Registro não encontrado.');
    expect(artists.update).not.toHaveBeenCalled();
  });
});

function capableRegistry(kind: 'distributor' | 'society', providerId: string, checkStatus: jest.Mock) {
  const registry = new ExternalDataProviderRegistry();
  registry.register({
    metadata: { providerId, displayName: 'F', kind, supportsSubmit: true, supportsStatusCheck: true, mock: false },
    submit: jest.fn(), checkStatus, normalizeWebhook: jest.fn(),
  } as never);
  return registry;
}

describe('ExternalDataExchangeService — status checks require an owned submission (abuse: foreign submissionId)', () => {
  const okResult = (providerId: string, kind: string) => ({
    providerId, kind, submissionId: 'sub-own', status: 'processing', validationErrors: [],
    pendingRequirements: [], providerNotes: [], lastSyncedAt: new Date().toISOString(), raw: {},
  });

  it('distributor: foreign/unknown submissionId is a 404 and the provider is never called', async () => {
    const { ds } = makeCapDs({ ownedSubmission: { tenant_id: 'tenant-OTHER', provider: 'fake-dist', submission_id: 'sub-foreign' } });
    const checkStatus = jest.fn();
    const svc = new ExternalDataExchangeService(ds, capableRegistry('distributor', 'fake-dist', checkStatus), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(svc.checkDistributorStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', submissionId: 'sub-foreign' }))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.checkDistributorStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', submissionId: 'sub-unknown' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(checkStatus).not.toHaveBeenCalled();
  });

  it('distributor: an owned submission reaches the provider', async () => {
    const { ds } = makeCapDs({ ownedSubmission: { tenant_id: 't1', provider: 'fake-dist', submission_id: 'sub-own' } });
    const checkStatus = jest.fn(async () => okResult('fake-dist', 'distributor'));
    const svc = new ExternalDataExchangeService(ds, capableRegistry('distributor', 'fake-dist', checkStatus), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(svc.checkDistributorStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-dist', submissionId: 'sub-own' }))
      .resolves.toMatchObject({ status: 'processing' });
    expect(checkStatus).toHaveBeenCalledTimes(1);
  });

  it('society: foreign submissionId is a 404 and the provider is never called', async () => {
    const { ds } = makeCapDs({ ownedSubmission: { tenant_id: 'tenant-OTHER', provider: 'fake-soc', submission_id: 'sub-foreign' } });
    const checkStatus = jest.fn();
    const svc = new ExternalDataExchangeService(ds, capableRegistry('society', 'fake-soc', checkStatus), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(svc.checkSocietyStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-soc', submissionId: 'sub-foreign' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(checkStatus).not.toHaveBeenCalled();
  });

  it('society: owned submission reaches the provider', async () => {
    const { ds } = makeCapDs({ ownedSubmission: { tenant_id: 't1', provider: 'fake-soc', submission_id: 'sub-own' } });
    const checkStatus = jest.fn(async () => okResult('fake-soc', 'society'));
    const svc = new ExternalDataExchangeService(ds, capableRegistry('society', 'fake-soc', checkStatus), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(svc.checkSocietyStatus({ tenantId: 't1', userId: 'u1', providerId: 'fake-soc', submissionId: 'sub-own' }))
      .resolves.toMatchObject({ status: 'processing' });
  });

  it('society: asserts persistence, and an unconfigured provider is blocked with event + blocked audit, no provider call', async () => {
    const nodb = new ExternalDataExchangeService(null, new ExternalDataProviderRegistry(), { emitTyped: jest.fn() } as never, makeTenantResolver() as never);
    await expect(nodb.checkSocietyStatus({ tenantId: 't1', userId: 'u1', providerId: 'p', submissionId: 's' }))
      .rejects.toThrow('persistence unavailable');

    const { ds, activity } = makeCapDs({});
    const emitTyped = jest.fn();
    const svc = new ExternalDataExchangeService(ds, new ExternalDataProviderRegistry(), { emitTyped } as never, makeTenantResolver() as never);
    await expect(svc.checkSocietyStatus({ tenantId: 't1', userId: 'u1', providerId: 'society-provider-not-configured', submissionId: 's1' }))
      .rejects.toBeInstanceOf(CapabilityUnavailableError);
    expect(emitTyped.mock.calls[0][1].payload.errorCode).toBe('CAPABILITY_UNAVAILABLE');
    expect((activity.create.mock.calls[0][0] as { action: string }).action).toBe('external_data.blocked');
  });
});

describe('Submission status machine', () => {
  it('table: completed terminal, same-status idempotent, unknown edges rejected', () => {
    expect(ALLOWED_SUBMISSION_TRANSITIONS.completed).toEqual([]);
    expect(isAllowedSubmissionTransition('completed', 'completed')).toBe(true);
    expect(isAllowedSubmissionTransition('pending', 'processing')).toBe(true);
    expect(isAllowedSubmissionTransition('completed', 'processing')).toBe(false);
    expect(isAllowedSubmissionTransition('approved', 'pending')).toBe(false);
  });

  function webhookSvc(previousStatus: string | null, nextStatus: string) {
    const registry = makeRegistry({
      providerEventId: 'evt-1', submissionId: 'sub-real', entityType: 'artist', entityId: 'a1', providerId: 'abramus', kind: 'society',
      status: nextStatus, raw: {},
    });
    const events = { emitTyped: jest.fn() } as never;
    const ds = makeDs({ submissions: [{ provider: 'abramus', submission_id: 'sub-real', tenant_id: 'tenant-real' }] }) as unknown as { getRepository: jest.Mock };
    const artistRow = { id: 'a1', tenant_id: 'tenant-real', metadata: previousStatus ? { external_data_exchange: { abramus: { status: previousStatus } } } : {} };
    const artistRepo = { findOne: jest.fn(async () => artistRow), update: jest.fn(async () => undefined) };
    const orig = ds.getRepository.getMockImplementation()!;
    const { ArtistEntity } = jest.requireActual('../../database/entities');
    ds.getRepository.mockImplementation((e: unknown) => (e === ArtistEntity ? artistRepo : orig(e)));
    const svc = new ExternalDataExchangeService(ds as never, registry as never, events, makeTenantResolver() as never);
    return { svc, artistRepo };
  }
  const run = (svc: ExternalDataExchangeService) => svc.ingestWebhook({
    providerId: 'abramus', kind: 'society', payload: { id: 'evt-1' }, signature: sign({ id: 'evt-1' }, 'shh'), secret: 'shh',
  });

  it('rejects an invalid transition with a typed error and does not persist', async () => {
    const { svc, artistRepo } = webhookSvc('completed', 'processing');
    await expect(run(svc)).rejects.toBeInstanceOf(InvalidSubmissionTransitionError);
    expect(artistRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown status value', async () => {
    const { svc, artistRepo } = webhookSvc('pending', 'bogus');
    await expect(run(svc)).rejects.toBeInstanceOf(InvalidSubmissionTransitionError);
    expect(artistRepo.update).not.toHaveBeenCalled();
  });

  it('keeps existing behavior for a valid transition and for a first-ever status', async () => {
    const a = webhookSvc('pending', 'approved');
    await expect(run(a.svc)).resolves.toMatchObject({ duplicate: false });
    expect(a.artistRepo.update).toHaveBeenCalled();
    const b = webhookSvc(null, 'completed');
    await expect(run(b.svc)).resolves.toMatchObject({ duplicate: false });
  });
});
