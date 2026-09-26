/**
 * storage-e2e.ts — Real end-to-end smoke test against Cloudflare R2.
 *
 * Exercises the SAME S3Client config the app uses (see storage.module.ts):
 *   HeadBucket → PutObject → GetObject(+hash) → presigned PUT → presigned GET
 *   → ListObjects(prefix) → DeleteObject → confirm removal.
 *
 * Writes a single tiny object under a clearly-temporary, tenant-prefixed key and
 * deletes it at the end (cleanup runs even on failure). Requires real R2 creds.
 *
 * Run: pnpm --filter @music-os-360/api storage:e2e
 */
import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ── Load repo-root .env (no dotenv dependency) ────────────────────────────────
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const candidate of [join(process.cwd(), '.env.development'), join(process.cwd(), '../../.env.development')]) {
    try {
      for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      break;
    } catch { /* try next */ }
  }
  return out;
}

const env = loadEnv();
const results: Array<[string, 'OK' | 'FAIL', string]> = [];
function record(step: string, ok: boolean, detail = ''): void {
  results.push([step, ok ? 'OK' : 'FAIL', detail]);
  // eslint-disable-next-line no-console
  console.log(`[storage-e2e] ${ok ? 'OK  ' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<number> {
  const accountId = env['R2_ACCOUNT_ID'];
  const accessKey = env['R2_ACCESS_KEY'] ?? env['R2_ACCESS_KEY_ID'];
  const secretKey = env['R2_SECRET_KEY'] ?? env['R2_SECRET_ACCESS_KEY'];
  const bucket    = env['R2_BUCKET_NAME'] ?? 'music-os-360';
  if (!accountId || !accessKey || !secretKey) {
    console.error('[storage-e2e] R2 credentials ausentes (R2_ACCOUNT_ID/R2_ACCESS_KEY/R2_SECRET_KEY).');
    return 2;
  }

  // Endpoint: uses R2_ENDPOINT when defined (allows a TEST S3-compatible
  // target — e.g. local MinIO — without touching the production R2 bucket); otherwise
  // derives it from R2_ACCOUNT_ID (standard R2 behavior, unchanged). forcePathStyle
  // is enabled for local endpoints (MinIO requires it) — also correct for R2.
  const endpoint = env['R2_ENDPOINT'] ?? `https://${accountId}.r2.cloudflarestorage.com`;
  const forcePathStyle =
    env['R2_FORCE_PATH_STYLE'] === 'true' || /localhost|127\.0\.0\.1|:9000/.test(endpoint);
  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const tenantA = `e2e-tenant-${randomUUID()}`;
  const tenantB = `e2e-tenant-${randomUUID()}`;
  const key   = `tenants/${tenantA}/__storage-e2e__/${randomUUID()}/probe.txt`;
  const pkey  = `tenants/${tenantA}/__storage-e2e__/${randomUUID()}/presigned.txt`;
  const body  = `music-os-360 storage e2e ${new Date().toISOString()}`;
  const hash  = createHash('sha256').update(body).digest('hex');

  try {
    // 1. HeadBucket
    try { await client.send(new HeadBucketCommand({ Bucket: bucket })); record('HeadBucket', true, bucket); }
    catch (e) { record('HeadBucket', false, (e as Error).message); }

    // 2. PutObject
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain', Metadata: { tenant_id: tenantA } }));
      record('PutObject', true, key);
    } catch (e) { record('PutObject', false, (e as Error).message); }

    // 3. GetObject + hash verify
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const got = await res.Body!.transformToString();
      const okHash = createHash('sha256').update(got).digest('hex') === hash;
      record('GetObject+hash', okHash, okHash ? 'hash match' : 'HASH MISMATCH');
    } catch (e) { record('GetObject+hash', false, (e as Error).message); }

    // 4. Presigned PUT → HTTP PUT
    try {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: pkey, ContentType: 'text/plain' }), { expiresIn: 300 });
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body });
      record('Presigned PUT', put.ok, `HTTP ${put.status}`);
    } catch (e) { record('Presigned PUT', false, (e as Error).message); }

    // 5. Presigned GET → HTTP GET
    try {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: pkey }), { expiresIn: 300 });
      const get = await fetch(url);
      const got = await get.text();
      record('Presigned GET', get.ok && got === body, `HTTP ${get.status}`);
    } catch (e) { record('Presigned GET', false, (e as Error).message); }

    // 6. ListObjects(prefix) — tenant isolation check
    try {
      const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `tenants/${tenantA}/` }));
      const keys = (res.Contents ?? []).map((o) => o.Key ?? '');
      const leak = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `tenants/${tenantB}/` }));
      const leakCount = (leak.Contents ?? []).length;
      record('ListObjects(prefix)', keys.length >= 1, `${keys.length} sob tenantA`);
      record('TenantIsolation(prefix)', leakCount === 0, `tenantB prefix=${leakCount} objetos`);
    } catch (e) { record('ListObjects(prefix)', false, (e as Error).message); }

    // 7. Delete both + confirm removal
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pkey }));
      let stillThere = true;
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); }
      catch { stillThere = false; }
      record('DeleteObject+confirm', !stillThere, stillThere ? 'object still exists' : 'removido');
    } catch (e) { record('DeleteObject+confirm', false, (e as Error).message); }
  } finally {
    // Best-effort cleanup
    for (const k of [key, pkey]) {
      try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k })); } catch { /* ignore */ }
    }
    // Closes the SDK's keep-alive sockets so the process exits cleanly
    // (avoids libuv's teardown assertion on Windows at process.exit).
    try { client.destroy(); } catch { /* ignore */ }
  }

  const failed = results.filter((r) => r[1] === 'FAIL');
  console.log(`\n[storage-e2e] ${results.length - failed.length}/${results.length} passos OK.`);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error(e); process.exitCode = 1; });
