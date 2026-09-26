/**
 * test/e2e/integrations/signature-webhooks-real-context.e2e-spec.ts
 *
 * Autentique / DocuSign signature webhooks end to end against REAL Postgres
 * with production wiring: DATA_SOURCE = app role (NOBYPASSRLS) behind
 * makeTenantAwareDataSource, DatabaseContextService with session context,
 * ADMIN_DATA_SOURCE = owner (read-only identity lookup), and the REAL
 * WebhookService (idempotency on webhook_events) and ActivityLogsService —
 * nothing on the path under review is mocked except the domain event bus.
 *
 * Invariants covered:
 *  - a signature callback applies SIGNED only from awaiting_signature; it
 *    never resurrects a cancelled contract nor regresses an in_force one;
 *  - a provider doc id matching more than one contract fails closed (no
 *    contract is signed; the event is recorded FAILED);
 *  - DocuSign: an earlier event of the same envelope (envelope-sent) does
 *    not make the later envelope-completed a "duplicate";
 *  - an exact redelivery of the same event is deduplicated (one activity
 *    log, one CONTRACT_SIGNED).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { TenantBootstrapResolver } from '../../../src/database/tenant-bootstrap.resolver';
import { WebhookService } from '../../../src/modules/integrations/webhooks/webhook.service';
import { ActivityLogsService } from '../../../src/modules/activity-logs/activity-logs.service';
import { AutentiqueService } from '../../../src/modules/integrations/autentique/autentique.service';
import { DocuSignService } from '../../../src/modules/integrations/docusign/docusign.service';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

const AUT_SECRET = 'aut-e2e-' + randomUUID();
const DS_SECRET = 'ds-e2e-' + randomUUID();

describe('Signature webhooks (Autentique/DocuSign) on real Postgres', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let autentique: AutentiqueService;
  let docusign: DocuSignService;
  const emitted: Array<{ name: string; tenantId: string; aggregateId: string }> = [];
  const orgA = randomUUID();
  const orgB = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const tag = randomUUID().slice(0, 8);

  async function contract(tenantId: string, status: string, extra: { autentique?: string; envelope?: string } = {}) {
    const meta = extra.envelope ? { provider: 'docusign', provider_doc_id: extra.envelope } : {};
    const rows = await owner.query(
      `INSERT INTO contracts (tenant_id, title, type, status, autentique_doc_id, signing_platform, metadata)
       VALUES ($1, $2, 'teste', $3, $4, $5, $6::jsonb) RETURNING id`,
      [tenantId, `sig-e2e-${tag}`, status, extra.autentique ?? null,
        extra.autentique ? 'autentique' : extra.envelope ? 'docusign' : null, JSON.stringify(meta)],
    );
    return rows[0].id as string;
  }
  const statusOf = async (id: string) => (await owner.query(`SELECT status FROM contracts WHERE id = $1`, [id]))[0].status;
  const logsFor = async (id: string) => Number((await owner.query(
    `SELECT count(*)::int AS n FROM activity_logs WHERE entity_id = $1 AND action = 'signed_via_webhook'`, [id]))[0].n);
  const webhookRow = async (externalId: string) => (await owner.query(
    `SELECT status, error FROM webhook_events WHERE external_id = $1`, [externalId]))[0];
  const signedEvents = (id: string) => emitted.filter((e) => e.aggregateId === id && e.name === 'contract.signed').length;

  function docusignSend(event: string, envelopeId: string, generatedDateTime = new Date().toISOString()) {
    const payload = { event, apiVersion: 'v2.1', generatedDateTime, data: { envelopeId, accountId: 'acc-e2e' } };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', DS_SECRET).update(raw, 'utf8').digest('base64');
    return docusign.handleWebhook(payload, raw, sig);
  }

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    appReal = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    const app = makeTenantAwareDataSource(appReal);
    const dbContext = new DatabaseContextService(app, { get: () => 'true' } as never, owner);
    const config = { get: (k: string) => ({ AUTENTIQUE_WEBHOOK_SECRET: AUT_SECRET, DOCUSIGN_WEBHOOK_SECRET: DS_SECRET } as Record<string, string>)[k] };
    const events = {
      emitTyped: (name: string, e: { tenantId: string; aggregateId: string }) => { emitted.push({ name, tenantId: e.tenantId, aggregateId: e.aggregateId }); },
      emitAsync: async () => [],
    };
    const webhooks = new WebhookService(app);
    const activity = new ActivityLogsService(app);
    const resolver = new TenantBootstrapResolver(owner);
    autentique = new AutentiqueService(app, {} as never, config as never, events as never, activity, webhooks, dbContext, owner, resolver);
    docusign = new DocuSignService(app, config as never, {} as never, events as never, activity, webhooks, dbContext, owner, resolver);

    for (const [org, tenant] of [[orgA, tenantA], [orgB, tenantB]]) {
      await owner.query(
        `INSERT INTO organizations (id, name, slug, plan, billing_status, industry, address, config, metadata)
         VALUES ($1, 'Sig E2E Org', $2, 'starter', 'active', 'gravadora', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
        [org, `sig-e2e-${org.slice(0, 8)}`],
      );
      await owner.query(
        `INSERT INTO tenants (id, org_id, name, slug, plan, features, settings, active)
         VALUES ($1, $2, 'Sig E2E Tenant', $3, 'starter', '{}'::jsonb, '{}'::jsonb, true)`,
        [tenant, org, `sig-e2e-t-${tenant.slice(0, 8)}`],
      );
    }
  }, 60000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM webhook_events WHERE external_id LIKE $1`, [`%${tag}%`]).catch(() => undefined);
      for (const t of [tenantA, tenantB]) {
        await owner.query(`DELETE FROM activity_logs WHERE tenant_id = $1`, [t]).catch(() => undefined);
        await owner.query(`DELETE FROM contracts WHERE tenant_id = $1`, [t]).catch(() => undefined);
        await owner.query(`DELETE FROM tenants WHERE id = $1`, [t]).catch(() => undefined);
      }
      for (const o of [orgA, orgB]) await owner.query(`DELETE FROM organizations WHERE id = $1`, [o]).catch(() => undefined);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  it('Autentique: awaiting_signature -> signed, activity log written in tenant context, redelivery deduplicated', async () => {
    const doc = `doc-ok-${tag}`;
    const id = await contract(tenantA, 'awaiting_signature', { autentique: doc });
    const payload = { event: 'document.signed', event_id: `evt-ok-${tag}`, document_id: doc };
    await autentique.handleWebhook(payload, AUT_SECRET);
    await autentique.handleWebhook(payload, AUT_SECRET);
    expect(await statusOf(id)).toBe('signed');
    expect(await logsFor(id)).toBe(1);
    expect(signedEvents(id)).toBe(1);
    expect((await webhookRow(`evt-ok-${tag}`)).status).toBe('processed');
  });

  it('Autentique: never resurrects a cancelled contract nor regresses an in_force one', async () => {
    const cancelled = await contract(tenantA, 'cancelled', { autentique: `doc-c-${tag}` });
    const inForce = await contract(tenantA, 'in_force', { autentique: `doc-f-${tag}` });
    await autentique.handleWebhook({ event: 'document.signed', event_id: `evt-c-${tag}`, document_id: `doc-c-${tag}` }, AUT_SECRET);
    await autentique.handleWebhook({ event: 'document.signed', event_id: `evt-f-${tag}`, document_id: `doc-f-${tag}` }, AUT_SECRET);
    expect(await statusOf(cancelled)).toBe('cancelled');
    expect(await statusOf(inForce)).toBe('in_force');
    expect(signedEvents(cancelled) + signedEvents(inForce)).toBe(0);
  });

  it('Autentique: a doc id owned by contracts in two tenants fails closed (neither signed)', async () => {
    const doc = `doc-dup-${tag}`;
    const a = await contract(tenantA, 'awaiting_signature', { autentique: doc });
    const b = await contract(tenantB, 'awaiting_signature', { autentique: doc });
    await expect(
      autentique.handleWebhook({ event: 'document.signed', event_id: `evt-dup-${tag}`, document_id: doc }, AUT_SECRET),
    ).resolves.toEqual({ received: true });
    expect(await statusOf(a)).toBe('awaiting_signature');
    expect(await statusOf(b)).toBe('awaiting_signature');
    expect((await webhookRow(`evt-dup-${tag}`)).status).toBe('failed');
  });

  it('DocuSign: envelope-sent first does not turn the later envelope-completed into a duplicate', async () => {
    const env1 = `env-seq-${tag}`;
    const id = await contract(tenantA, 'awaiting_signature', { envelope: env1 });
    await docusignSend('envelope-sent', env1);
    await docusignSend('envelope-completed', env1);
    expect(await statusOf(id)).toBe('signed');
    expect(signedEvents(id)).toBe(1);
  });

  it('DocuSign: exact redelivery of envelope-completed is deduplicated', async () => {
    const env2 = `env-redeliver-${tag}`;
    const id = await contract(tenantA, 'awaiting_signature', { envelope: env2 });
    const when = new Date().toISOString();
    await docusignSend('envelope-completed', env2, when);
    await docusignSend('envelope-completed', env2, when);
    expect(await statusOf(id)).toBe('signed');
    expect(await logsFor(id)).toBe(1);
    expect(signedEvents(id)).toBe(1);
  });

  it('DocuSign: an envelope id shared by two tenants fails closed', async () => {
    const env3 = `env-dup-${tag}`;
    const a = await contract(tenantA, 'awaiting_signature', { envelope: env3 });
    const b = await contract(tenantB, 'awaiting_signature', { envelope: env3 });
    await docusignSend('envelope-completed', env3);
    expect(await statusOf(a)).toBe('awaiting_signature');
    expect(await statusOf(b)).toBe('awaiting_signature');
  });

  it('DocuSign: invalid HMAC rejected before any write', async () => {
    const payload = { event: 'envelope-completed', data: { envelopeId: `env-bad-${tag}` } };
    await expect(docusign.handleWebhook(payload, JSON.stringify(payload), 'AAAA')).rejects.toThrow(/signature/i);
    expect(await webhookRow(`env-bad-${tag}`)).toBeUndefined();
  });
});
