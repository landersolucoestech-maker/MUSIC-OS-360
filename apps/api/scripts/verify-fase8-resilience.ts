#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import jwt from 'jsonwebtoken';
import { redactSensitiveObject } from '../src/core/security/redact';
import { Client as PgClient } from 'pg';

type HttpResult = { res: Response; json: any; text: string };

const apiUrl = process.env.API_URL || 'http://localhost:3001/api/v1';
const runId = `fase8-${Date.now()}`;
const requests: Array<Record<string, unknown>> = [];
const failures: Array<{ area: string; message: string; detail?: unknown }> = [];
const evidence: Record<string, unknown> = {};

const TENANT_A = '10000000-0000-0000-0000-000000000002';
const ORG_A = '10000000-0000-0000-0000-000000000001';
const TENANT_B = '20000000-0000-0000-0000-000000000002';
const ORG_B = '20000000-0000-0000-0000-000000000001';
const USER_B = '40000000-0000-0000-0000-000000000008';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key] || process.env[key]!.includes('*****REDACTED*****')) process.env[key] = value;
  }
}

function unwrap(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const envelope =
    Object.prototype.hasOwnProperty.call(body, 'data') &&
    !Object.prototype.hasOwnProperty.call(body, 'id') &&
    (Object.prototype.hasOwnProperty.call(body, 'timestamp') ||
      Object.prototype.hasOwnProperty.call(body, 'meta') ||
      Object.prototype.hasOwnProperty.call(body, 'success'));
  return envelope ? body.data : body;
}

function listRows(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function idOf(row: any) {
  return row?.id || row?.data?.id || row?.item?.id || row?.result?.id;
}

function fail(area: string, message: string, detail?: unknown) {
  failures.push({ area, message, detail });
}

function expect(area: string, condition: unknown, message: string, detail?: unknown) {
  if (!condition) fail(area, message, detail);
}

async function http(
  method: string,
  path: string,
  options: { token?: string; tenantId?: string; body?: unknown; expected?: number[] } = {},
): Promise<HttpResult> {
  const started = Date.now();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.tenantId) headers['X-Tenant-ID'] = options.tenantId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  let text = '';
  let json: any = null;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    requests.push({ method, path, status: 'NETWORK_ERROR', ms: Date.now() - started, message });
    throw err;
  }

  const row = {
    method,
    path,
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    expected: options.expected ?? null,
    responsePreview: JSON.stringify(json).slice(0, 500),
  };
  requests.push(row);
  if (res.status >= 500 && !(options.expected ?? []).includes(res.status)) {
    fail('network', `unexpected 500 on ${method} ${path}`, row);
  }
  return { res, json: unwrap(json), text };
}

async function putPresigned(url: string, body: Buffer, mimeType: string) {
  const signedHeaders = (new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? '')
    .split(';')
    .filter(Boolean);
  const headers: Record<string, string> = {};
  if (signedHeaders.includes('content-type')) headers['Content-Type'] = mimeType;
  const res = await fetch(url, { method: 'PUT', body, headers });
  const text = await res.text();
  return { status: res.status, ok: res.ok, signedHeaders, text: text.slice(0, 500) };
}

function signTenantB() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY missing');
  return jwt.sign(
    {
      sub: USER_B,
      session_id: `fase8-${USER_B.slice(0, 8)}`,
      app_metadata: { org_id: ORG_B, role: 'owner' },
      email: `tenant-b-${runId}@example.com`,
    },
    key,
    { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
  );
}

function signExpired(orgId: string, userId: string) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY missing');
  return jwt.sign(
    { sub: userId, session_id: `expired-${runId}`, app_metadata: { org_id: orgId, role: 'owner' } },
    key,
    { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: -1 },
  );
}

async function getAuthA() {
  const auth = await http('GET', '/dev-auth/token');
  expect('auth', auth.res.ok, 'dev-auth did not return 200', { status: auth.res.status, body: auth.json });
  return { token: auth.json?.token as string, tenantId: auth.json?.tenantId as string, userId: auth.json?.user?.id as string };
}

async function createCoreData(token: string, tenantId: string, tag: string) {
  const artist = await http('POST', '/artists', {
    token,
    tenantId,
    body: {
      nome_artistico: `F8 Artist ${tag}`,
      nome_civil: `F8 Civil ${tag}`,
      status: 'ativo',
      genero_musical: 'Pop',
      email: `f8.artist.${tag}@example.com`,
      metadata: { runId, tag },
    },
  });
  expect('setup', artist.res.ok, 'POST /artists setup failed', { status: artist.res.status, body: artist.json });
  const artistId = idOf(artist.json);

  const client = await http('POST', '/clients', {
    token,
    tenantId,
    body: { name: `F8 Client ${tag}`, type: 'company', email: `f8.client.${tag}@example.com`, metadata: { runId, tag } },
  });
  expect('setup', client.res.ok, 'POST /clients setup failed', { status: client.res.status, body: client.json });
  const clientId = idOf(client.json);

  const release = await http('POST', '/releases', {
    token,
    tenantId,
    body: { title: `F8 Release ${tag}`, type: 'single', artistId, releasedAt: '2026-05-23T12:00:00-03:00', metadata: { runId, tag } },
  });
  expect('setup', release.res.ok, 'POST /releases setup failed', { status: release.res.status, body: release.json });
  const releaseId = idOf(release.json);

  const contract = await http('POST', '/contracts', {
    token,
    tenantId,
    body: {
      titulo: `F8 Contract ${tag}`,
      tipo: 'gravacao',
      artista_id: artistId,
      cliente_id: clientId,
      valor: 1000,
      data_inicio: '2026-05-23',
      data_fim: '2027-05-23',
      metadata: { runId, tag },
    },
  });
  expect('setup', contract.res.ok, 'POST /contracts setup failed', { status: contract.res.status, body: contract.json });
  const contractId = idOf(contract.json);

  const event = await http('POST', '/events', {
    token,
    tenantId,
    body: {
      title: `F8 Event ${tag}`,
      type: 'show',
      artistId,
      startsAt: '2026-05-23T10:00:00-03:00',
      endsAt: '2026-05-23T11:00:00-03:00',
      venue: `F8 Venue ${tag}`,
      metadata: { runId, tag },
    },
  });
  expect('setup', event.res.ok, 'POST /events setup failed', { status: event.res.status, body: event.json });
  const eventId = idOf(event.json);

  const tx = await http('POST', '/transactions', {
    token,
    tenantId,
    body: {
      tipoTransacao: 'receita',
      tipoCliente: 'empresa',
      categoria: 'produtos',
      subcategoria: 'merchandising',
      descricao: `F8 Transaction ${tag}`,
      valor: '100.00',
      dataTransacao: '2026-05-23',
      formaPagamento: 'pix',
      status: 'pendente',
      artistaVinculado: artistId,
    },
  });
  expect('setup', tx.res.ok, 'POST /transactions setup failed', { status: tx.res.status, body: tx.json });
  const transactionId = idOf(tx.json);

  return { artistId, clientId, releaseId, contractId, eventId, transactionId };
}

async function uploadObject(token: string, tenantId: string, params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  entity?: string;
  entityId?: string;
  body: Buffer;
}) {
  const presign = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: {
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      category: params.category,
      entity: params.entity,
      entityId: params.entityId,
    },
  });
  expect('uploads', presign.res.ok, 'POST /uploads/presign failed', { status: presign.res.status, body: presign.json });
  const put = await putPresigned(presign.json.presignedUrl, params.body, params.mimeType);
  expect('uploads', put.ok, 'presigned PUT failed', put);
  const confirm = await http('POST', `/uploads/${presign.json.fileId}/confirm`, { token, tenantId });
  expect('uploads', confirm.res.ok, 'POST /uploads/:id/confirm failed', { status: confirm.res.status, body: confirm.json });
  const download = await http('GET', `/uploads/${presign.json.fileId}/download`, { token, tenantId });
  expect('uploads', download.res.ok && Boolean(download.json?.url), 'GET /uploads/:id/download failed', { status: download.res.status, body: download.json });
  return { fileId: presign.json.fileId as string, key: presign.json.key as string, put, confirm: confirm.json, download: download.json };
}

async function validateHealth(token: string, tenantId: string) {
  const live = await http('GET', '/health/live', { expected: [200] });
  const ready = await http('GET', '/health/ready', { token, tenantId, expected: [200, 503] });
  const artists = await http('GET', '/artists?limit=1', { token, tenantId });
  const dashboard = await http('GET', '/analytics/dashboard', { token, tenantId });
  evidence.health = {
    live: live.res.status,
    ready: ready.res.status,
    artists: artists.res.status,
    dashboard: dashboard.res.status,
  };
  expect('banco', live.res.status === 200, '/health/live did not become 200', evidence.health);
  expect('banco', ready.res.status === 200, 'current /health/ready did not become 200', evidence.health);
  expect('banco', artists.res.ok && dashboard.res.ok, 'base DB endpoints did not respond 2xx', evidence.health);
}

async function validateRedisDegraded(token: string, tenantId: string, core: Awaited<ReturnType<typeof createCoreData>>) {
  const audit = await http('GET', '/audit-logs?limit=10', { token, tenantId });
  const upload = await uploadObject(token, tenantId, {
    fileName: `redis-degraded-${runId}.png`,
    mimeType: 'image/png',
    sizeBytes: PNG_1X1.length,
    category: 'images',
    entity: 'release',
    entityId: core.releaseId,
    body: PNG_1X1,
  });
  evidence.redis = { audit: audit.res.status, uploadConfirmStatus: upload.confirm?.status, fileId: upload.fileId };
  expect('redis', audit.res.ok, 'audit logs did not respond with Redis degraded', evidence.redis);
}

async function validateR2FailurePath(pg: PgClient, token: string, tenantId: string, releaseId: string) {
  const presign = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: {
      fileName: `r2-ghost-${runId}.png`,
      mimeType: 'image/png',
      sizeBytes: PNG_1X1.length,
      category: 'images',
      entity: 'release',
      entityId: releaseId,
    },
  });
  expect('r2', presign.res.ok, 'presign for ghost failed', { status: presign.res.status, body: presign.json });
  const confirm = await http('POST', `/uploads/${presign.json.fileId}/confirm`, { token, tenantId, expected: [400] });
  const row = await pg.query('select status, confirmed_at from uploads where file_id = $1', [presign.json.fileId]);
  evidence.r2 = {
    presign: presign.res.status,
    confirmWithoutPut: confirm.res.status,
    dbStatus: row.rows[0]?.status,
    confirmedAt: row.rows[0]?.confirmed_at ?? null,
  };
  expect('r2', confirm.res.status === 400, 'confirm without an R2 object should return 400', evidence.r2);
  expect('r2', row.rows[0]?.status === 'pending' && !row.rows[0]?.confirmed_at, 'phantom upload stayed confirmed in the DB', evidence.r2);
}

async function validateRace(pg: PgClient, token: string, tenantId: string, core: Awaited<ReturnType<typeof createCoreData>>) {
  const patches = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      http('PATCH', `/artists/${core.artistId}`, {
        token,
        tenantId,
        body: { observacoes: `race artist ${runId} ${i}`, metadata: { runId, raceIndex: i } },
      }),
    ),
  );
  const badPatch = patches.filter((r) => !r.res.ok);
  const artistReload = await http('GET', `/artists/${core.artistId}`, { token, tenantId });

  const disposable = await createCoreData(token, tenantId, `race-del-${Date.now()}`);
  const [del, patchAfter] = await Promise.all([
    http('DELETE', `/artists/${disposable.artistId}`, { token, tenantId, expected: [200, 204, 404] }),
    http('PATCH', `/artists/${disposable.artistId}`, { token, tenantId, body: { nome_artistico: `race patched ${runId}` }, expected: [200, 404] }),
  ]);

  const [up1, up2] = await Promise.all([
    uploadObject(token, tenantId, { fileName: `race-a-${runId}.png`, mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images', entity: 'release', entityId: core.releaseId, body: PNG_1X1 }),
    uploadObject(token, tenantId, { fileName: `race-b-${runId}.png`, mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images', entity: 'release', entityId: core.releaseId, body: PNG_1X1 }),
  ]);

  const presign = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: { fileName: `double-confirm-${runId}.png`, mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images', entity: 'release', entityId: core.releaseId },
  });
  const put = await putPresigned(presign.json.presignedUrl, PNG_1X1, 'image/png');
  const [c1, c2] = await Promise.all([
    http('POST', `/uploads/${presign.json.fileId}/confirm`, { token, tenantId }),
    http('POST', `/uploads/${presign.json.fileId}/confirm`, { token, tenantId }),
  ]);
  const uploadRows = await pg.query('select count(*)::int as count, count(distinct r2_key)::int as unique_keys from uploads where file_id = any($1)', [[up1.fileId, up2.fileId, presign.json.fileId]]);

  evidence.race = {
    patchStatuses: patches.map((r) => r.res.status),
    deletePatchStatuses: [del.res.status, patchAfter.res.status],
    artistReload: artistReload.res.status,
    concurrentUploadKeysUnique: up1.key !== up2.key,
    doubleConfirmStatuses: [c1.res.status, c2.res.status],
    putBeforeDoubleConfirm: put.status,
    uploadRows: uploadRows.rows[0],
  };
  expect('race', badPatch.length === 0 && artistReload.res.ok, 'concurrent artist PATCH had a failure', evidence.race);
  expect('race', ![del.res.status, patchAfter.res.status].some((s) => s >= 500), 'DELETE+PATCH simultaneo gerou 5xx', evidence.race);
  expect('race', up1.key !== up2.key, 'simultaneous uploads generated a duplicate r2_key', evidence.race);
  expect('race', c1.res.ok && c2.res.ok, 'double confirm was not idempotent', evidence.race);
  expect('race', uploadRows.rows[0]?.count === 3 && uploadRows.rows[0]?.unique_keys === 3, 'concurrent uploads corrupted rows/keys', evidence.race);
}

async function validateTenantStress(pg: PgClient, authA: { token: string; tenantId: string }) {
  const tokenB = signTenantB();
  const coreA = await createCoreData(authA.token, authA.tenantId, `stress-a-${Date.now()}`);
  const coreB = await createCoreData(tokenB, TENANT_B, `stress-b-${Date.now()}`);

  const tasks: Promise<HttpResult>[] = [];
  for (let i = 0; i < 30; i += 1) {
    const isA = i % 2 === 0;
    const token = isA ? authA.token : tokenB;
    const tenantId = isA ? authA.tenantId : TENANT_B;
    tasks.push(http('GET', `/artists?search=${encodeURIComponent(isA ? 'stress-a' : 'stress-b')}`, { token, tenantId }));
    tasks.push(http('GET', '/analytics/dashboard', { token, tenantId }));
    tasks.push(http('GET', '/audit-logs?limit=20', { token, tenantId }));
  }
  const results = await Promise.all(tasks);
  const byTenant = await pg.query(
    `select tenant_id, count(*)::int as count
       from artists
      where id = any($1)
      group by tenant_id`,
    [[coreA.artistId, coreB.artistId]],
  );
  const cross = await http('GET', `/artists/${coreA.artistId}`, { token: tokenB, tenantId: TENANT_B, expected: [403, 404] });
  evidence.multiTenantStress = {
    totalRequests: results.length,
    statuses: results.reduce<Record<string, number>>((acc, r) => {
      acc[String(r.res.status)] = (acc[String(r.res.status)] ?? 0) + 1;
      return acc;
    }, {}),
    dbTenants: byTenant.rows,
    crossStatus: cross.res.status,
  };
  expect('multi-tenant', results.every((r) => r.res.ok), 'multi-tenant stress had a non-2xx request', evidence.multiTenantStress);
  expect('multi-tenant', [403, 404].includes(cross.res.status), 'cross-tenant detail vazou', evidence.multiTenantStress);
  expect('multi-tenant', byTenant.rows.length === 2, 'DB did not keep data in two separate tenants', evidence.multiTenantStress);
}

async function validateSecurity(pg: PgClient, token: string, tenantId: string, core: Awaited<ReturnType<typeof createCoreData>>) {
  const invalidJwt = await http('GET', '/artists', { token: 'invalid.jwt.token', tenantId, expected: [401] });
  const expiredJwt = await http('GET', '/artists', { token: signExpired(ORG_A, core.artistId), tenantId, expected: [401] });
  const badTenant = await http('GET', '/artists', { token, tenantId: TENANT_B, expected: [403] });
  const noAuth = await http('POST', '/uploads/presign', { tenantId, body: { fileName: 'x.png', mimeType: 'image/png', sizeBytes: 1, category: 'images' }, expected: [401] });
  const noTenant = await http('GET', '/artists', { token, expected: [403] });
  const invalidExt = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: { fileName: 'bad.exe', mimeType: 'application/x-msdownload', sizeBytes: 10, category: 'images' },
    expected: [400],
  });
  const oversize = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: { fileName: 'big.png', mimeType: 'image/png', sizeBytes: 60 * 1024 * 1024, category: 'images' },
    expected: [400],
  });
  const traversal = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: { fileName: '../../evil.png', mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images', entity: 'release', entityId: core.releaseId },
  });
  const injection = await http('GET', `/artists?search=${encodeURIComponent("'; drop table artists; --")}`, { token, tenantId });
  const xss = await http('POST', '/artists', {
    token,
    tenantId,
    body: { nome_artistico: `<script>alert('${runId}')</script>`, status: 'ativo', metadata: { runId, xss: true } },
  });

  let downloadAfterDeleteStatus: number | null = null;
  const upload = await uploadObject(token, tenantId, {
    fileName: `delete-security-${runId}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: PDF_MIN.length,
    category: 'documents',
    entity: 'contract',
    entityId: core.contractId,
    body: PDF_MIN,
  });
  await pg.query("update uploads set status = 'deleted', deleted_at = now() where file_id = $1", [upload.fileId]);
  const afterDelete = await http('GET', `/uploads/${upload.fileId}/download`, { token, tenantId, expected: [404] });
  downloadAfterDeleteStatus = afterDelete.res.status;

  evidence.security = {
    invalidJwt: invalidJwt.res.status,
    expiredJwt: expiredJwt.res.status,
    badTenant: badTenant.res.status,
    noAuth: noAuth.res.status,
    noTenant: noTenant.res.status,
    invalidExt: invalidExt.res.status,
    oversize: oversize.res.status,
    traversal: { status: traversal.res.status, key: traversal.json?.key },
    injection: injection.res.status,
    xss: xss.res.status,
    downloadAfterDelete: downloadAfterDeleteStatus,
  };
  expect('seguranca', invalidJwt.res.status === 401, 'invalid JWT did not return 401', evidence.security);
  expect('seguranca', expiredJwt.res.status === 401, 'expired JWT did not return 401', evidence.security);
  expect('seguranca', badTenant.res.status === 403, 'invalid tenant header did not return 403', evidence.security);
  expect('seguranca', noAuth.res.status === 401, 'no auth did not return 401', evidence.security);
  expect('seguranca', noTenant.res.status === 403, 'no tenant did not return 403', evidence.security);
  expect('seguranca', invalidExt.res.status === 400, 'invalid extension/MIME did not return 400', evidence.security);
  expect('seguranca', oversize.res.status === 400, 'oversize did not return 400', evidence.security);
  expect('seguranca', traversal.res.ok && !String(traversal.json?.key ?? '').includes('/../'), 'path traversal was not neutralized in the key', evidence.security);
  expect('seguranca', injection.res.ok && xss.res.ok, 'SQL/XSS payloads caused an HTTP error', evidence.security);
  expect('seguranca', downloadAfterDeleteStatus === 404, 'download after delete did not return 404', evidence.security);
}

async function validateRecovery(token: string, tenantId: string, releaseId: string) {
  const before = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: { fileName: `recovery-${runId}.png`, mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images', entity: 'release', entityId: releaseId },
  });
  const put = await putPresigned(before.json.presignedUrl, PNG_1X1, 'image/png');
  const confirm = await http('POST', `/uploads/${before.json.fileId}/confirm`, { token, tenantId });
  const dashboard = await http('GET', '/analytics/dashboard', { token, tenantId });
  evidence.recovery = { presign: before.res.status, put: put.status, confirm: confirm.res.status, dashboard: dashboard.res.status };
  expect('recovery', before.res.ok && put.ok && confirm.res.ok && dashboard.res.ok, 'recovery/logical reload cycle failed', evidence.recovery);
}

async function main() {
  loadEnvFile('apps/api/.env.development');
  loadEnvFile('.env.development');
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const authA = await getAuthA();
    await validateHealth(authA.token, authA.tenantId);
    const core = await createCoreData(authA.token, authA.tenantId, `core-${Date.now()}`);
    await validateRedisDegraded(authA.token, authA.tenantId, core);
    await validateR2FailurePath(pg, authA.token, authA.tenantId, core.releaseId);
    await validateRace(pg, authA.token, authA.tenantId, core);
    await validateTenantStress(pg, authA);
    await validateSecurity(pg, authA.token, authA.tenantId, core);
    await validateRecovery(authA.token, authA.tenantId, core.releaseId);
    await delay(500);
    const audit = await http('GET', '/audit-logs?limit=50', { token: authA.token, tenantId: authA.tenantId });
    const activity = await http('GET', '/activity-logs?limit=50', { token: authA.token, tenantId: authA.tenantId });
    evidence.audit = { audit: audit.res.status, activity: activity.res.status };
  } finally {
    await pg.end();
  }

  const summary = {
    runId,
    result: failures.length ? 'FAILED' : 'PASSED',
    failures,
    evidence,
    httpStatusCounts: requests.reduce<Record<string, number>>((acc, r) => {
      acc[String(r.status)] = (acc[String(r.status)] ?? 0) + 1;
      return acc;
    }, {}),
    requests,
  };
  console.log(JSON.stringify(redactSensitiveObject(summary), null, 2));
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify(redactSensitiveObject({
    runId,
    result: 'FAILED',
    fatal: {
      name: err instanceof Error ? err.name : 'Error',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      detail: (err as any)?.detail,
    },
    failures,
    evidence,
    requests,
  }), null, 2));
  process.exit(1);
});
