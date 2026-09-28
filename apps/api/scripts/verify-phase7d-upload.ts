#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import jwt from 'jsonwebtoken';
import { redactSensitiveObject } from '../src/core/security/redact';
import { Client as PgClient } from 'pg';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type HttpResult = { res: Response; json: any; text: string };

const runId = `phase7d-${Date.now()}`;
const apiUrl = process.env.API_URL || 'http://localhost:3001/api/v1';
const requests: Array<Record<string, unknown>> = [];
const checks: Record<string, unknown> = {};

const TENANT_A = '10000000-0000-0000-0000-000000000002';
const ORG_A = '10000000-0000-0000-0000-000000000001';
const TENANT_B = '20000000-0000-0000-0000-000000000002';
const ORG_B = '20000000-0000-0000-0000-000000000001';
const USER_A = '40000000-0000-0000-0000-000000000001';
const USER_B = '40000000-0000-0000-0000-000000000008';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'utf8');

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
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

function errInfo(err: unknown) {
  const e = err as { name?: string; message?: string; Code?: string; $metadata?: Record<string, unknown> };
  return {
    name: e.name ?? 'Error',
    code: e.Code ?? null,
    message: e.message ?? String(err),
    metadata: e.$metadata ?? null,
  };
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

function getId(row: any) {
  return row?.id || row?.data?.id || row?.item?.id || row?.result?.id;
}

function assert(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) {
    const error = new Error(message) as Error & { detail?: unknown };
    error.detail = detail;
    throw error;
  }
}

function createS3Client() {
  assert(process.env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID missing');
  assert(process.env.R2_BUCKET_NAME, 'R2_BUCKET_NAME missing');
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_KEY;
  assert(accessKeyId, 'R2_ACCESS_KEY_ID/R2_ACCESS_KEY missing');
  assert(secretAccessKey, 'R2_SECRET_ACCESS_KEY/R2_SECRET_KEY missing');
  return new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function bodyToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  if (typeof body.transformToString === 'function') {
    return Buffer.from(await body.transformToString());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function http(method: string, path: string, options: { token?: string; tenantId?: string; body?: unknown } = {}): Promise<HttpResult> {
  const started = Date.now();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.tenantId) headers['X-Tenant-ID'] = options.tenantId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  requests.push({
    method,
    path,
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    responsePreview: JSON.stringify(json).slice(0, 500),
  });
  return { res, json: unwrap(json), text };
}

async function downloadBytes(url: string) {
  const res = await fetch(url);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, ok: res.ok, contentType: res.headers.get('content-type'), bytes };
}

async function putPresigned(url: string, body: Buffer, mimeType: string) {
  const signedHeaders = (new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? '')
    .split(';')
    .filter(Boolean);
  const headers: Record<string, string> = {};
  if (signedHeaders.includes('content-type')) headers['Content-Type'] = mimeType;
  const res = await fetch(url, { method: 'PUT', body, headers });
  const text = await res.text();
  return {
    status: res.status,
    ok: res.ok,
    signedHeaders,
    body: text.slice(0, 700),
    cfRay: res.headers.get('cf-ray'),
  };
}

async function authA() {
  const auth = await http('GET', '/dev-auth/token');
  assert(auth.res.ok, 'dev-auth failed', { status: auth.res.status, body: auth.json });
  assert(auth.json?.token && auth.json?.tenantId, 'dev-auth did not return token/tenantId', auth.json);
  const decoded = jwt.decode(auth.json.token) as { app_metadata?: { org_id?: string }; org_id?: string } | null;
  const tokenOrgId = decoded?.app_metadata?.org_id ?? decoded?.org_id ?? auth.json.orgId;
  return {
    token: auth.json.token as string,
    tenantId: tokenOrgId as string,
    orgId: auth.json.orgId as string,
  };
}

function tenantToken(params: { userId: string; orgId: string; tenantId: string }) {
  assert(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY missing for token B');
  return jwt.sign(
    {
      sub: params.userId,
      session_id: `f7d-${params.userId.slice(0, 8)}`,
      app_metadata: { org_id: params.orgId, role: 'owner' },
      email: `tenant-b-${runId}@example.com`,
    },
    process.env.ENCRYPTION_KEY,
    { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
  );
}

function oppositeTenantAuth(currentTenantHeader: string) {
  if (currentTenantHeader === ORG_B || currentTenantHeader === TENANT_B) {
    return { token: tenantToken({ userId: USER_A, orgId: ORG_A, tenantId: TENANT_A }), tenantId: TENANT_A };
  }
  return { token: tenantToken({ userId: USER_B, orgId: ORG_B, tenantId: TENANT_B }), tenantId: TENANT_B };
}

async function sdkCycle(s3: S3Client, bucket: string) {
  const key = `diag/7d/sdk-${runId}.txt`;
  const body = Buffer.from(`hello-${runId}`);
  const put = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const gotBytes = await bodyToBuffer(got.Body);
  assert(gotBytes.equals(body), 'SDK GET returned different bytes', { expected: body.toString(), actual: gotBytes.toString() });
  const del = await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    throw new Error('SDK HEAD after delete still found the object');
  } catch (err) {
    const info = errInfo(err);
    if (!['NotFound', 'NoSuchKey', 'Forbidden', 'UnknownError'].includes(info.name) && (info.metadata as any)?.httpStatusCode !== 404) {
      throw err;
    }
  }
  checks.sdk = {
    key,
    put: put.$metadata.httpStatusCode,
    head: head.$metadata.httpStatusCode,
    get: got.$metadata.httpStatusCode,
    delete: del.$metadata.httpStatusCode,
  };
}

async function presignUpload(token: string, tenantId: string, params: {
  fileName: string;
  mimeType: string;
  category: 'images' | 'documents';
  body: Buffer;
  entity: string;
  entityId: string;
}) {
  const presign = await http('POST', '/uploads/presign', {
    token,
    tenantId,
    body: {
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.body.length,
      category: params.category,
      entity: params.entity,
      entityId: params.entityId,
    },
  });
  assert(presign.res.ok, 'POST /uploads/presign failed', { status: presign.res.status, body: presign.json });
  const put = await putPresigned(presign.json.presignedUrl, params.body, params.mimeType);
  assert(put.ok, 'presigned PUT failed', put);
  const confirm = await http('POST', `/uploads/${presign.json.fileId}/confirm`, { token, tenantId });
  assert(confirm.res.ok, 'POST /uploads/:id/confirm failed', { status: confirm.res.status, body: confirm.json });
  const download = await http('GET', `/uploads/${presign.json.fileId}/download`, { token, tenantId });
  assert(download.res.ok && download.json?.url, 'GET /uploads/:id/download failed', { status: download.res.status, body: download.json });
  const fetched = await downloadBytes(download.json.url);
  assert(fetched.ok, 'Signed download returned a failure', { status: fetched.status, contentType: fetched.contentType });
  assert(fetched.bytes.equals(params.body), 'Download returned a corrupted file', {
    expectedBytes: params.body.length,
    actualBytes: fetched.bytes.length,
  });
  return {
    fileId: presign.json.fileId as string,
    key: presign.json.key as string,
    publicUrl: presign.json.publicUrl as string,
    downloadUrl: download.json.url as string,
    put,
    confirm: confirm.json,
    fetched,
  };
}

async function createRuntimeEntities(token: string, tenantId: string) {
  const artist = await http('POST', '/artists', {
    token,
    tenantId,
    body: {
      stage_name: `Upload Artist ${runId}`,
      full_name: `Upload Artist Civil ${runId}`,
      status: 'active',
      email: `upload.artist.${runId}@example.com`,
      metadata: { phase: '7D', runId },
    },
  });
  assert(artist.res.ok, 'Failed creating artist for upload', { status: artist.res.status, body: artist.json });
  const artistId = getId(artist.json);
  assert(artistId, 'Artist without id', artist.json);

  const release = await http('POST', '/releases', {
    token,
    tenantId,
    body: {
      title: `Upload Release ${runId}`,
      type: 'single',
      artistId,
      releasedAt: '2026-05-23T12:00:00-03:00',
      metadata: { phase: '7D', runId },
    },
  });
  assert(release.res.ok, 'Failed creating release for upload', { status: release.res.status, body: release.json });
  const releaseId = getId(release.json);
  assert(releaseId, 'Release without id', release.json);

  const client = await http('POST', '/clients', {
    token,
    tenantId,
    body: {
      name: `Upload Client ${runId}`,
      type: 'company',
      category: 'CORPORATE_CLIENT',
      email: `upload.client.${runId}@example.com`,
      metadata: { phase: '7D', runId },
    },
  });
  assert(client.res.ok, 'Failed creating client for upload', { status: client.res.status, body: client.json });
  const clientId = getId(client.json);
  assert(clientId, 'Client without id', client.json);

  const contract = await http('POST', '/contracts', {
    token,
    tenantId,
    body: {
      title: `Upload Contract ${runId}`,
      type: 'recording',
      artist_id: artistId,
      client_id: clientId,
      value: 1000,
      start_date: '2026-05-23',
      end_date: '2027-05-23',
      notes: `Contrato upload ${runId}`,
      metadata: { phase: '7D', runId },
    },
  });
  assert(contract.res.ok, 'Failed creating contract for upload', { status: contract.res.status, body: contract.json });
  const contractId = getId(contract.json);
  assert(contractId, 'Contract without id', contract.json);
  return { artistId, releaseId, clientId, contractId };
}

async function validateReleaseCover(token: string, tenantId: string, releaseId: string) {
  const upload = await presignUpload(token, tenantId, {
    fileName: `cover-${runId}.png`,
    mimeType: 'image/png',
    category: 'images',
    body: PNG_1X1,
    entity: 'release',
    entityId: releaseId,
  });
  const patch = await http('PATCH', `/releases/${releaseId}`, { token, tenantId, body: { coverUrl: upload.downloadUrl } });
  assert(patch.res.ok, 'Failed attaching cover to release', { status: patch.res.status, body: patch.json });
  const reloaded = await http('GET', `/releases/${releaseId}`, { token, tenantId });
  assert(reloaded.res.ok, 'Failed reloading release', { status: reloaded.res.status, body: reloaded.json });
  assert(reloaded.json?.cover_url === upload.downloadUrl, 'Release did not persist cover_url', reloaded.json);
  const preview = await downloadBytes(reloaded.json.cover_url);
  assert(preview.ok && preview.bytes.equals(PNG_1X1), 'Cover preview failed or was corrupted', { status: preview.status });
  const newSession = await authA();
  const sessionReload = await http('GET', `/releases/${releaseId}`, { token: newSession.token, tenantId: newSession.tenantId });
  assert(sessionReload.res.ok && sessionReload.json?.cover_url === upload.downloadUrl, 'New session did not reload the release cover', {
    status: sessionReload.res.status,
    body: sessionReload.json,
  });
  checks.release = {
    fileId: upload.fileId,
    r2Key: upload.key,
    presignPut: upload.put.status,
    preview: preview.status,
    reload: reloaded.res.status,
    newSession: sessionReload.res.status,
  };
  return upload;
}

async function validateContractPdf(token: string, tenantId: string, contractId: string) {
  const upload = await presignUpload(token, tenantId, {
    fileName: `contract-${runId}.pdf`,
    mimeType: 'application/pdf',
    category: 'documents',
    body: PDF_MIN,
    entity: 'contract',
    entityId: contractId,
  });
  const patch = await http('PATCH', `/contracts/${contractId}`, { token, tenantId, body: { file_url: upload.downloadUrl } });
  assert(patch.res.ok, 'Failed attaching PDF to contract', { status: patch.res.status, body: patch.json });
  const reloaded = await http('GET', `/contracts/${contractId}`, { token, tenantId });
  assert(reloaded.res.ok, 'Failed reloading contract', { status: reloaded.res.status, body: reloaded.json });
  assert(reloaded.json?.file_url === upload.downloadUrl, 'Contract did not persist file_url', reloaded.json);
  const downloaded = await downloadBytes(reloaded.json.file_url);
  assert(downloaded.ok && downloaded.bytes.equals(PDF_MIN), 'Downloaded PDF failed or was corrupted', {
    status: downloaded.status,
    contentType: downloaded.contentType,
  });
  const newSession = await authA();
  const sessionReload = await http('GET', `/contracts/${contractId}`, { token: newSession.token, tenantId: newSession.tenantId });
  assert(sessionReload.res.ok && sessionReload.json?.file_url === upload.downloadUrl, 'New session did not reload the contract PDF', {
    status: sessionReload.res.status,
    body: sessionReload.json,
  });
  checks.contractPdf = {
    fileId: upload.fileId,
    r2Key: upload.key,
    download: downloaded.status,
    reload: reloaded.res.status,
    newSession: sessionReload.res.status,
  };
  return upload;
}

async function validateDelete(s3: S3Client, pg: PgClient, bucket: string, token: string, tenantId: string, releaseId: string) {
  const upload = await presignUpload(token, tenantId, {
    fileName: `delete-${runId}.png`,
    mimeType: 'image/png',
    category: 'images',
    body: PNG_1X1,
    entity: 'release',
    entityId: releaseId,
  });
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: upload.key }));
  let headDeleted = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: upload.key }));
  } catch {
    headDeleted = true;
  }
  assert(headDeleted, 'HeadObject found the object after delete', { key: upload.key });
  await pg.query("update uploads set status = 'deleted', deleted_at = now() where file_id = $1", [upload.fileId]);
  const row = await pg.query('select file_id, status, deleted_at from uploads where file_id = $1', [upload.fileId]);
  assert(row.rows[0]?.status === 'deleted' && row.rows[0]?.deleted_at, 'DB did not mark the upload as deleted', row.rows[0]);
  const download = await http('GET', `/uploads/${upload.fileId}/download`, { token, tenantId });
  assert(download.res.status === 404, 'Download of a deleted upload still returned a URL', {
    status: download.res.status,
    body: download.json,
  });
  checks.delete = { fileId: upload.fileId, r2Key: upload.key, headAfterDelete: 'not-found', dbStatus: row.rows[0].status };
}

async function validateSecurity(s3: S3Client, bucket: string, token: string, tenantId: string, fileId: string) {
  const other = oppositeTenantAuth(tenantId);
  const cross = await http('GET', `/uploads/${fileId}/download`, { token: other.token, tenantId: other.tenantId });
  assert(cross.res.status === 404, 'Cross-tenant download did not return 404', { status: cross.res.status, body: cross.json });
  const noAuth = await http('POST', '/uploads/presign', {
    tenantId,
    body: { fileName: 'noauth.png', mimeType: 'image/png', sizeBytes: PNG_1X1.length, category: 'images' },
  });
  assert(noAuth.res.status === 401, 'Upload without auth did not return 401', { status: noAuth.res.status, body: noAuth.json });

  const key = `diag/7d/expired-${runId}.txt`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from('expired') }));
  const expiredUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 1 });
  await delay(2200);
  const expired = await fetch(expiredUrl);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  assert(expired.status === 403, 'Expired URL did not return 403', { status: expired.status, body: (await expired.text()).slice(0, 300) });
  checks.security = { crossTenant: cross.res.status, noAuth: noAuth.res.status, expiredUrl: expired.status };
}

async function main() {
  loadEnvFile('apps/api/.env.development');
  loadEnvFile('.env.development');

  const bucket = process.env.R2_BUCKET_NAME!;
  const s3 = createS3Client();
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  await sdkCycle(s3, bucket);

  const auth = await authA();
  assert(auth.tenantId === TENANT_A || auth.tenantId, 'Tenant A ausente', auth);
  const entities = await createRuntimeEntities(auth.token, auth.tenantId);
  const releaseUpload = await validateReleaseCover(auth.token, auth.tenantId, entities.releaseId);
  await validateContractPdf(auth.token, auth.tenantId, entities.contractId);
  await validateDelete(s3, pg, bucket, auth.token, auth.tenantId, entities.releaseId);
  await validateSecurity(s3, bucket, auth.token, auth.tenantId, releaseUpload.fileId);

  const uploadRows = await pg.query(
    `select file_id, tenant_id, r2_key, status, size_bytes, mime_type, entity, entity_id, deleted_at
       from uploads
      where file_id = any($1::text[])
      order by created_at desc`,
    [[releaseUpload.fileId]],
  );
  checks.db = uploadRows.rows;
  await pg.end();

  console.log(JSON.stringify(redactSensitiveObject({ runId, result: 'PASSED', checks, requests }), null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ runId, result: 'FAILED', error: errInfo(err), detail: (err as any).detail, checks, requests }, null, 2));
  process.exit(1);
});
