#!/usr/bin/env ts-node
/**
 * scripts/smoke-test.ts
 *
 * Smoke test HTTP ponta a ponta.
 *
 * Usage:
 *   API_URL=http://localhost:3001 SMOKE_TOKEN=<jwt> SMOKE_TENANT=<org_id> pnpm smoke-test
 *
 * Without SMOKE_TOKEN/SMOKE_TENANT, the script tries GET /dev-auth/token in
 * local/staging environments. If credentials are unavailable, authenticated
 * tests are skipped and public liveness is still validated.
 */

import 'reflect-metadata';
import * as path from 'path';

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
} catch { /* optional */ }

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
let SMOKE_TOKEN = process.env['SMOKE_TOKEN'] ?? '';
let SMOKE_TENANT = process.env['SMOKE_TENANT'] ?? '';

let passed = 0;
let failed = 0;
let skipped = 0;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  code?: number;
  reason?: string;
}

const results: TestResult[] = [];

function apiPath(pathname: string): string {
  return `${API_URL}/api/v1${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Error(
      `API unavailable at ${API_URL}. Start the API before smoke-test: pnpm --filter @music-os-360/api start:dev. Detail: ${(err as Error).message}`,
    );
  }
}

async function bootstrapAuth(): Promise<void> {
  if (SMOKE_TOKEN && SMOKE_TENANT) return;

  const res = await safeFetch(apiPath('/dev-auth/token'));
  const json = await res.json() as any;
  const payload = (json.data ?? json) as { token?: string; tenantId?: string; orgId?: string };

  SMOKE_TOKEN = SMOKE_TOKEN || payload.token || '';
  SMOKE_TENANT = SMOKE_TENANT || payload.orgId || payload.tenantId || '';
}

async function request(
  method: Method,
  pathname: string,
  body?: unknown,
  requireAuth = true,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth && SMOKE_TOKEN) headers['Authorization'] = `Bearer ${SMOKE_TOKEN}`;
  if (requireAuth && SMOKE_TENANT) headers['X-Tenant-ID'] = SMOKE_TENANT;

  const res = await safeFetch(apiPath(pathname), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function test(name: string, fn: () => Promise<void>, skip = false): Promise<void> {
  if (skip) {
    console.log(`  SKIP  ${name}`);
    results.push({ name, status: 'SKIP', reason: 'credentials not provided' });
    skipped++;
    return;
  }

  try {
    await fn();
    console.log(`  PASS  ${name}`);
    results.push({ name, status: 'PASS' });
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name} - ${(err as Error).message}`);
    results.push({ name, status: 'FAIL', reason: (err as Error).message });
    failed++;
  }
}

function expect(val: unknown, label: string) {
  return {
    toBe(expected: unknown) {
      if (val !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeOneOf(arr: unknown[]) {
      if (!arr.includes(val)) throw new Error(`${label}: expected one of ${JSON.stringify(arr)}, got ${JSON.stringify(val)}`);
    },
  };
}

async function healthCheck(): Promise<void> {
  const url = `${API_URL}/api/v1/health/live`;
  const res = await safeFetch(url);
  if (res.status !== 200) throw new Error(`${url} => ${res.status}`);
}

async function main(): Promise<void> {
  console.log('\nMUSIC OS 360 - End-to-End Smoke Test\n');
  console.log(`  API_URL: ${API_URL}`);

  try {
    await bootstrapAuth();
    console.log(`  Token:    ${SMOKE_TOKEN ? SMOKE_TOKEN.substring(0, 20) + '...' : '(unavailable)'}`);
    console.log(`  TenantId: ${SMOKE_TENANT || '(unavailable)'}`);
  } catch (err) {
    console.warn(`  [WARN] bootstrapAuth failed: ${(err as Error).message} - authenticated tests will be skipped`);
  }
  console.log('');

  const hasAuth = !!SMOKE_TOKEN;
  const hasTenant = !!SMOKE_TENANT && !!SMOKE_TOKEN;

  await test('Public liveness health responds 200', healthCheck);

  await test('Protected endpoint without token -> 401/403', async () => {
    const r = await request('GET', '/artists', undefined, false);
    expect(r.status, 'status').toBeOneOf([401, 403]);
  });

  await test('Protected endpoint with a token but no X-Tenant-ID -> 403', async () => {
    const res = await safeFetch(apiPath('/artists'), {
      headers: {
        Authorization: `Bearer ${SMOKE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status, 'status').toBe(403);
  }, !hasAuth);

  await test('GET /analytics/dashboard with auth', async () => {
    const r = await request('GET', '/analytics/dashboard');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  await test('GET /artists -> 200 with data', async () => {
    const r = await request('GET', '/artists');
    expect(r.status, 'status').toBe(200);
    const d = r.data as { data?: unknown[] };
    if (!Array.isArray(d?.data)) throw new Error('data.data is not an array');
  }, !hasTenant);

  let createdArtistId: string | null = null;
  await test('POST /artists -> 201', async () => {
    const r = await request('POST', '/artists', {
      stage_name: `Smoke Artist ${Date.now()}`,
    });
    expect(r.status, 'status').toBeOneOf([200, 201]);
    const d = r.data as { id?: string; data?: { id?: string } };
    createdArtistId = d.id ?? d.data?.id ?? null;
    if (!createdArtistId) throw new Error('created artist has no id');
  }, !hasTenant);

  await test('GET /contacts -> 200', async () => {
    const r = await request('GET', '/contacts');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  await test('GET /campaigns -> 200', async () => {
    const r = await request('GET', '/campaigns');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  await test('GET /analytics/revenue -> 200', async () => {
    const r = await request('GET', '/analytics/revenue?months=3');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  await test('public POST /forms/:id/submit without auth with X-Tenant-ID -> 200/201/404', async () => {
    const demoFormId = '10000000-0000-0000-0000-000000000050';
    const res = await safeFetch(apiPath(`/forms/${demoFormId}/submit`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': SMOKE_TENANT,
      },
      body: JSON.stringify({ data: { name: 'Smoke Test User', email: 'smoke@test.example.com' } }),
    });
    expect(res.status, 'status').toBeOneOf([200, 201, 404]);
  }, !SMOKE_TENANT);

  await test('POST /forms/:id/submit public without X-Tenant-ID -> 400', async () => {
    const demoFormId = '10000000-0000-0000-0000-000000000050';
    const res = await safeFetch(apiPath(`/forms/${demoFormId}/submit`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { name: 'Smoke Test User', email: 'smoke@test.example.com' } }),
    });
    expect(res.status, 'status').toBe(400);
  });

  await test('Invalid X-Tenant-ID -> 401/403/404', async () => {
    const res = await safeFetch(apiPath('/artists'), {
      headers: {
        Authorization: `Bearer ${SMOKE_TOKEN}`,
        'X-Tenant-ID': '00000000-0000-0000-0000-ffffffff0000',
        'Content-Type': 'application/json',
      },
    });
    expect(res.status, 'status cross-tenant').toBeOneOf([401, 403, 404]);
  }, !hasAuth);

  await test('GET /activity-logs -> 200', async () => {
    const r = await request('GET', '/activity-logs?limit=5');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  await test('GET /conversations -> 200', async () => {
    const r = await request('GET', '/conversations');
    expect(r.status, 'status').toBe(200);
  }, !hasTenant);

  if (createdArtistId) {
    await test(`DELETE /artists/${createdArtistId} cleanup`, async () => {
      const r = await request('DELETE', `/artists/${createdArtistId}`);
      expect(r.status, 'status').toBeOneOf([200, 204]);
    }, !hasTenant);
  }

  console.log('\nResultado\n');
  console.log(`  Passed    : ${passed}`);
  console.log(`  Failed    : ${failed}`);
  console.log(`  Skipped   : ${skipped} (no credentials)`);

  if (skipped > 0) {
    console.log('\n  Tests skipped because credentials were not found.');
    console.log('  Check that the API is running and the seeds were executed.');
  }

  if (failed === 0 && skipped === 0) {
    console.log('\n  SMOKE TEST PASSED - platform operational.\n');
  } else if (failed === 0) {
    console.log('\n  SMOKE TEST INCOMPLETE - required credentials missing.\n');
    process.exit(2);
  } else {
    console.log('\n  SMOKE TEST FAILED - check the failures above.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[smoke-test] Fatal error:', (err as Error).message);
  process.exit(1);
});
