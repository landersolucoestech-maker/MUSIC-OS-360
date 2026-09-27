#!/usr/bin/env tsx
/**
 * scripts/verify-fase3-multitenant.ts
 *
 * PHASE 3 — Multi-tenant validation via real HTTP.
 *
 * Runs the 9 sub-tests defined in the plan:
 *   3.1 Preparation (tenants + auth/context)
 *   3.2 Creation of isolated data in A and B
 *   3.3 Isolated listing
 *   3.4 Cross-tenant detail
 *   3.5 Cross-tenant update
 *   3.6 Cross-tenant delete
 *   3.7 Tenant-safe JOIN (releases ↔ artist)
 *   3.8 Tenant-safe analytics
 *   3.9 Tenant-safe audit/activity
 *
 * Usage:
 *   npx tsx apps/api/scripts/verify-fase3-multitenant.ts
 */

import 'reflect-metadata';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
} catch { /* opcional */ }

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] ?? '';

// Tenants already existing in the database
const TENANT_A = {
  tenantId: '10000000-0000-0000-0000-000000000002',
  orgId:    '10000000-0000-0000-0000-000000000001',
  userId:   '025d7498-52a9-4a9c-938d-99519c96b053', // smoke-test@musicos360.dev
  name:     'MUSIC OS 360 Demo',
};
const TENANT_B = {
  tenantId: '20000000-0000-0000-0000-000000000002',
  orgId:    '20000000-0000-0000-0000-000000000001',
  userId:   '025d7498-52a9-4a9c-938d-99519c96b053', // same user (member of both)
  name:     'FASE 3 Tenant B',
};

const TS = Date.now();
const TAG_A = `MT_A_${TS}`;
const TAG_B = `MT_B_${TS}`;

function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function fail(msg: string) { console.log(`  ✗  ${msg}`); }
function info(msg: string) { console.log(`  →  ${msg}`); }
function section(title: string) { console.log(`\n── ${title} ──`); }

function signDevToken(orgId: string, userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      session_id: `fase3-${orgId.slice(0, 8)}-${TS}`,
      app_metadata: { org_id: orgId, role: 'owner' },
    },
    ENCRYPTION_KEY,
    { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
  );
}

let TOKEN_A: string;
let TOKEN_B: string;
let passed = 0;
let failed = 0;
const errors: Array<{ where: string; detail: string }> = [];

interface CallResult {
  status: number;
  body: any;
}

async function call(
  method: string,
  pathname: string,
  opts: { token?: string; tenantId?: string; body?: unknown } = {},
): Promise<CallResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token)    headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.tenantId) headers['X-Tenant-ID']   = opts.tenantId;

  const url = `${API_URL}/api/v1${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

function expect(label: string, cond: boolean, detail?: string): boolean {
  if (cond) { ok(label); passed++; return true; }
  fail(`${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
  errors.push({ where: label, detail: detail ?? '' });
  return false;
}

function pickId(body: any): string | null {
  if (!body) return null;
  if (typeof body.id === 'string') return body.id;
  if (body.data && typeof body.data.id === 'string') return body.data.id;
  return null;
}

function extractList(body: any): any[] {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.items)) return body.items;
  if (body.data && Array.isArray(body.data.items)) return body.data.items;
  if (body.data && Array.isArray(body.data.data)) return body.data.data;
  return [];
}

// ============================================================================
// PHASE 3.1 — PREPARATION
// ============================================================================

async function fase31(): Promise<void> {
  section('PHASE 3.1 — SETUP');

  if (!ENCRYPTION_KEY) {
    fail('ENCRYPTION_KEY not found in apps/api/.env.development — aborting');
    process.exit(2);
  }

  TOKEN_A = signDevToken(TENANT_A.orgId, TENANT_A.userId);
  TOKEN_B = signDevToken(TENANT_B.orgId, TENANT_B.userId);
  info(`Token A assinado (org ${TENANT_A.orgId.slice(0, 8)}…)`);
  info(`Token B assinado (org ${TENANT_B.orgId.slice(0, 8)}…)`);

  const ctxA = await call('GET', '/auth/context', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  expect('GET /auth/context Tenant A → 200', ctxA.status === 200, `status=${ctxA.status}`);
  const tenantIdA = ctxA.body?.data?.workspace?.id ?? ctxA.body?.data?.tenant?.id ?? ctxA.body?.workspace?.id;
  expect('Tenant A retorna workspace.id correto', tenantIdA === TENANT_A.tenantId, `got=${tenantIdA}`);

  const ctxB = await call('GET', '/auth/context', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('GET /auth/context Tenant B → 200', ctxB.status === 200, `status=${ctxB.status}`);
  const tenantIdB = ctxB.body?.data?.workspace?.id ?? ctxB.body?.data?.tenant?.id ?? ctxB.body?.workspace?.id;
  expect('Tenant B retorna workspace.id correto', tenantIdB === TENANT_B.tenantId, `got=${tenantIdB}`);

  // Wrong X-Tenant-ID must fail (token A + header B)
  const wrong = await call('GET', '/auth/context', { token: TOKEN_A, tenantId: TENANT_B.tenantId });
  expect('Token A + Header B → 403', wrong.status === 403, `status=${wrong.status}`);
}

// ============================================================================
// PHASE 3.2 — CREATE ISOLATED DATA
// ============================================================================

interface CreatedSet {
  artistId?:      string;
  releaseId?:     string;
  contractId?:    string;
  eventId?:       string;
  transactionId?: string;
  leadId?:        string;
  clientId?:      string;
}

async function createSetFor(
  tenant: typeof TENANT_A,
  token: string,
  tag: string,
): Promise<CreatedSet> {
  const set: CreatedSet = {};

  // Client
  const cli = await call('POST', '/clients', {
    token, tenantId: tenant.tenantId,
    body: { name: `${tag}_CLIENT`, type: 'company' },
  });
  if (cli.status === 201 || cli.status === 200) {
    set.clientId = pickId(cli.body) ?? undefined;
    ok(`[${tag}] Cliente criado id=${set.clientId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /clients → ${cli.status} ${JSON.stringify(cli.body).slice(0, 200)}`);
    failed++;
  }

  // Artist
  const art = await call('POST', '/artists', {
    token, tenantId: tenant.tenantId,
    body: { nome_artistico: `${tag}_ARTIST` },
  });
  if (art.status === 201 || art.status === 200) {
    set.artistId = pickId(art.body) ?? undefined;
    ok(`[${tag}] Artista criado id=${set.artistId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /artists → ${art.status} ${JSON.stringify(art.body).slice(0, 200)}`);
    failed++;
  }

  // Release
  const rel = await call('POST', '/releases', {
    token, tenantId: tenant.tenantId,
    body: { title: `${tag}_RELEASE`, type: 'single', artistId: set.artistId },
  });
  if (rel.status === 201 || rel.status === 200) {
    set.releaseId = pickId(rel.body) ?? undefined;
    ok(`[${tag}] Release criado id=${set.releaseId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /releases → ${rel.status} ${JSON.stringify(rel.body).slice(0, 200)}`);
    failed++;
  }

  // Contract
  const ctr = await call('POST', '/contracts', {
    token, tenantId: tenant.tenantId,
    body: {
      titulo: `${tag}_CONTRACT`,
      tipo: 'gravacao',
      artista_id: set.artistId,
      cliente_id: set.clientId,
      data_inicio: '2026-01-01',
      data_fim: '2026-12-31',
      valor: 1000,
    },
  });
  if (ctr.status === 201 || ctr.status === 200) {
    set.contractId = pickId(ctr.body) ?? undefined;
    ok(`[${tag}] Contrato criado id=${set.contractId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /contracts → ${ctr.status} ${JSON.stringify(ctr.body).slice(0, 200)}`);
    failed++;
  }

  // Event
  const ev = await call('POST', '/events', {
    token, tenantId: tenant.tenantId,
    body: {
      title: `${tag}_EVENT`,
      type: 'show',
      artistId: set.artistId,
      venue: `Venue ${tag}`,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  if (ev.status === 201 || ev.status === 200) {
    set.eventId = pickId(ev.body) ?? undefined;
    ok(`[${tag}] Evento criado id=${set.eventId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /events → ${ev.status} ${JSON.stringify(ev.body).slice(0, 200)}`);
    failed++;
  }

  // Transaction — the schema uses pt-BR names (Zod validator)
  // NB: categoria is mandatory in the DB (NOT NULL) but the validator accepts a
  // transferencia without categoria → the service does not include it in the payload → 500.
  // We send an explicit categoria to unblock it.
  const tx = await call('POST', '/transactions', {
    token, tenantId: tenant.tenantId,
    body: {
      tipoTransacao:  'transferencia',
      descricao:      `${tag}_TRANSACTION`,
      valor:          '1500.00',
      dataTransacao:  new Date().toISOString().slice(0, 10),
      formaPagamento: 'pix',
      categoria:      'outros',
    },
  });
  if (tx.status === 201 || tx.status === 200) {
    set.transactionId = pickId(tx.body) ?? undefined;
    ok(`[${tag}] Transaction created id=${set.transactionId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /transactions → ${tx.status} ${JSON.stringify(tx.body).slice(0, 200)}`);
    failed++;
  }

  // Lead
  const ld = await call('POST', '/leads', {
    token, tenantId: tenant.tenantId,
    body: { name: `${tag}_LEAD`, email: `${tag.toLowerCase()}@fase3.dev`, stage: 'prospect' },
  });
  if (ld.status === 201 || ld.status === 200) {
    set.leadId = pickId(ld.body) ?? undefined;
    ok(`[${tag}] Lead criado id=${set.leadId?.slice(0, 8)}…`);
    passed++;
  } else {
    fail(`[${tag}] POST /leads → ${ld.status} ${JSON.stringify(ld.body).slice(0, 200)}`);
    failed++;
  }

  return set;
}

let DATA_A: CreatedSet = {};
let DATA_B: CreatedSet = {};

async function fase32(): Promise<void> {
  section('PHASE 3.2 — CREATE ISOLATED DATA');
  DATA_A = await createSetFor(TENANT_A, TOKEN_A, TAG_A);
  DATA_B = await createSetFor(TENANT_B, TOKEN_B, TAG_B);
}

// ============================================================================
// PHASE 3.3 — ISOLATED LISTING
// ============================================================================

const ENDPOINTS = [
  { path: '/artists',     tagMatcher: (r: any) => r.nome_artistico ?? r.name ?? r.title },
  { path: '/releases',    tagMatcher: (r: any) => r.title ?? r.titulo ?? r.name },
  { path: '/contracts',   tagMatcher: (r: any) => r.titulo ?? r.title },
  { path: '/events',      tagMatcher: (r: any) => r.title ?? r.titulo },
  { path: '/transactions',tagMatcher: (r: any) => r.descricao ?? r.description },
  { path: '/leads',       tagMatcher: (r: any) => r.name ?? r.nome },
  { path: '/clients',     tagMatcher: (r: any) => r.name ?? r.nome },
];

async function fase33(): Promise<void> {
  section('FASE 3.3 — LISTAGEM ISOLADA');

  for (const ep of ENDPOINTS) {
    const respA = await call('GET', `${ep.path}?limit=200`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    const respB = await call('GET', `${ep.path}?limit=200`, { token: TOKEN_B, tenantId: TENANT_B.tenantId });
    expect(`GET ${ep.path} (A) → 200`, respA.status === 200, `status=${respA.status}`);
    expect(`GET ${ep.path} (B) → 200`, respB.status === 200, `status=${respB.status}`);

    const listA = extractList(respA.body);
    const listB = extractList(respB.body);

    const seesBInA = listA.some((r: any) => {
      const v = ep.tagMatcher(r);
      return typeof v === 'string' && v.includes(TAG_B);
    });
    const seesAInB = listB.some((r: any) => {
      const v = ep.tagMatcher(r);
      return typeof v === 'string' && v.includes(TAG_A);
    });
    expect(`${ep.path} — A does not see B data`, !seesBInA);
    expect(`${ep.path} — B does not see A data`, !seesAInB);
  }

  // audit-logs & activity-logs (we do not create them directly, but the lists must respond)
  const auditA = await call('GET', '/audit-logs?limit=10', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const auditB = await call('GET', '/audit-logs?limit=10', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('GET /audit-logs (A) → 200', auditA.status === 200, `status=${auditA.status}`);
  expect('GET /audit-logs (B) → 200', auditB.status === 200, `status=${auditB.status}`);

  const actA = await call('GET', '/activity-logs?limit=10', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const actB = await call('GET', '/activity-logs?limit=10', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('GET /activity-logs (A) → 200', actA.status === 200, `status=${actA.status}`);
  expect('GET /activity-logs (B) → 200', actB.status === 200, `status=${actB.status}`);

  // analytics/dashboard
  const dashA = await call('GET', '/analytics/dashboard', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const dashB = await call('GET', '/analytics/dashboard', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('GET /analytics/dashboard (A) → 200', dashA.status === 200, `status=${dashA.status}`);
  expect('GET /analytics/dashboard (B) → 200', dashB.status === 200, `status=${dashB.status}`);
}

// ============================================================================
// PHASE 3.4 — DETAIL CROSS-TENANT
// ============================================================================

const DETAIL_TARGETS = [
  { path: '/artists',     keyA: 'artistId',      keyB: 'artistId' },
  { path: '/releases',    keyA: 'releaseId',     keyB: 'releaseId' },
  { path: '/contracts',   keyA: 'contractId',    keyB: 'contractId' },
  { path: '/events',      keyA: 'eventId',       keyB: 'eventId' },
  { path: '/transactions',keyA: 'transactionId', keyB: 'transactionId' },
  { path: '/leads',       keyA: 'leadId',        keyB: 'leadId' },
  { path: '/clients',     keyA: 'clientId',      keyB: 'clientId' },
] as const;

async function fase34(): Promise<void> {
  section('FASE 3.4 — DETAIL CROSS-TENANT');
  for (const t of DETAIL_TARGETS) {
    const idA = (DATA_A as any)[t.keyA];
    const idB = (DATA_B as any)[t.keyB];
    if (!idA || !idB) {
      info(`${t.path}: skip (id A/B ausente)`);
      continue;
    }
    // Token B tries to read id A
    const ra = await call('GET', `${t.path}/${idA}`, { token: TOKEN_B, tenantId: TENANT_B.tenantId });
    expect(`GET ${t.path}/{A} via Tenant B → 403/404`, [403, 404].includes(ra.status), `got=${ra.status}`);
    // Token A tries to read id B
    const rb = await call('GET', `${t.path}/${idB}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    expect(`GET ${t.path}/{B} via Tenant A → 403/404`, [403, 404].includes(rb.status), `got=${rb.status}`);

    // Sanity: the correct token returns 200
    const okA = await call('GET', `${t.path}/${idA}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    expect(`GET ${t.path}/{A} via Tenant A → 200`, okA.status === 200, `got=${okA.status}`);
  }
}

// ============================================================================
// PHASE 3.5 — UPDATE CROSS-TENANT
// ============================================================================

async function fase35(): Promise<void> {
  section('FASE 3.5 — UPDATE CROSS-TENANT');
  const updates = [
    { path: '/artists',      keyA: 'artistId',      keyB: 'artistId',      body: { nome_artistico: `HACKED_${TS}` } },
    { path: '/releases',     keyA: 'releaseId',     keyB: 'releaseId',     body: { title: `HACKED_${TS}` } },
    { path: '/contracts',    keyA: 'contractId',    keyB: 'contractId',    body: { titulo: `HACKED_${TS}` } },
    { path: '/events',       keyA: 'eventId',       keyB: 'eventId',       body: { title: `HACKED_${TS}` } },
    { path: '/transactions', keyA: 'transactionId', keyB: 'transactionId', body: { descricao: `HACKED_${TS}` } },
    { path: '/leads',        keyA: 'leadId',        keyB: 'leadId',        body: { name: `HACKED_${TS}` } },
    { path: '/clients',      keyA: 'clientId',      keyB: 'clientId',      body: { name: `HACKED_${TS}` } },
  ] as const;

  for (const u of updates) {
    const idA = (DATA_A as any)[u.keyA];
    const idB = (DATA_B as any)[u.keyB];
    if (!idA || !idB) { info(`${u.path}: skip update (id ausente)`); continue; }

    const ra = await call('PATCH', `${u.path}/${idA}`, { token: TOKEN_B, tenantId: TENANT_B.tenantId, body: u.body });
    expect(`PATCH ${u.path}/{A} via B → 403/404`, [403, 404].includes(ra.status), `got=${ra.status}`);
    const rb = await call('PATCH', `${u.path}/${idB}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId, body: u.body });
    expect(`PATCH ${u.path}/{B} via A → 403/404`, [403, 404].includes(rb.status), `got=${rb.status}`);
  }
}

// ============================================================================
// PHASE 3.6 — DELETE CROSS-TENANT
// ============================================================================

async function fase36(): Promise<void> {
  section('FASE 3.6 — DELETE CROSS-TENANT');
  const dels = [
    { path: '/artists',      keyA: 'artistId',      keyB: 'artistId' },
    { path: '/releases',     keyA: 'releaseId',     keyB: 'releaseId' },
    { path: '/contracts',    keyA: 'contractId',    keyB: 'contractId' },
    { path: '/events',       keyA: 'eventId',       keyB: 'eventId' },
    { path: '/transactions', keyA: 'transactionId', keyB: 'transactionId' },
    { path: '/leads',        keyA: 'leadId',        keyB: 'leadId' },
    { path: '/clients',      keyA: 'clientId',      keyB: 'clientId' },
  ] as const;

  for (const d of dels) {
    const idA = (DATA_A as any)[d.keyA];
    const idB = (DATA_B as any)[d.keyB];
    if (!idA || !idB) { info(`${d.path}: skip delete (id ausente)`); continue; }

    const ra = await call('DELETE', `${d.path}/${idA}`, { token: TOKEN_B, tenantId: TENANT_B.tenantId });
    expect(`DELETE ${d.path}/{A} via B → 403/404`, [403, 404].includes(ra.status), `got=${ra.status}`);
    const rb = await call('DELETE', `${d.path}/${idB}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    expect(`DELETE ${d.path}/{B} via A → 403/404`, [403, 404].includes(rb.status), `got=${rb.status}`);
  }
}

// ============================================================================
// PHASE 3.7 — JOIN TENANT-SAFE
// ============================================================================

async function fase37(): Promise<void> {
  section('FASE 3.7 — JOIN TENANT-SAFE');

  function checkArtistRef(label: string, artistRef: any, expectedArtistId: string | undefined, tag: string): void {
    if (artistRef === undefined || artistRef === null) {
      info(`${label}: release did not return an artist embed/ref — nothing to leak`);
      return;
    }
    let isSame = false;
    let detail = '';
    if (typeof artistRef === 'string') {
      isSame = artistRef === expectedArtistId;
      detail = `artistId=${artistRef}`;
    } else if (typeof artistRef === 'object') {
      const id = (artistRef as any).id;
      const nome = (artistRef as any).nome_artistico ?? (artistRef as any).name;
      isSame = (expectedArtistId && id === expectedArtistId) || (typeof nome === 'string' && nome.includes(tag));
      detail = `id=${id} nome=${nome}`;
    }
    expect(label, isSame, detail);
  }

  // Releases: the detail must bring the artist of the same tenant
  if (DATA_A.releaseId) {
    const r = await call('GET', `/releases/${DATA_A.releaseId}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    expect('GET release A retorna 200', r.status === 200, `got=${r.status}`);
    const releaseA = r.body?.data ?? r.body ?? {};
    const artistInRelease = releaseA?.artist ?? releaseA?.artista ?? releaseA?.artistId ?? releaseA?.artist_id ?? releaseA?.artista_id;
    checkArtistRef('Release A only references Artist A (same tenant)', artistInRelease, DATA_A.artistId, TAG_A);
  }
  if (DATA_B.releaseId) {
    const r = await call('GET', `/releases/${DATA_B.releaseId}`, { token: TOKEN_B, tenantId: TENANT_B.tenantId });
    expect('GET release B retorna 200', r.status === 200, `got=${r.status}`);
    const releaseB = r.body?.data ?? r.body ?? {};
    const artistInRelease = releaseB?.artist ?? releaseB?.artista ?? releaseB?.artistId ?? releaseB?.artist_id ?? releaseB?.artista_id;
    checkArtistRef('Release B only references Artist B (same tenant)', artistInRelease, DATA_B.artistId, TAG_B);
  }

  // Contracts: the detail must bring the artist/client of the same tenant
  if (DATA_A.contractId) {
    const r = await call('GET', `/contracts/${DATA_A.contractId}`, { token: TOKEN_A, tenantId: TENANT_A.tenantId });
    expect('GET contract A retorna 200', r.status === 200, `got=${r.status}`);
    const contractA = r.body?.data ?? r.body;
    const aid = contractA?.artista_id ?? contractA?.artistId ?? contractA?.artista?.id;
    const cid = contractA?.cliente_id ?? contractA?.clientId ?? contractA?.cliente?.id;
    expect('Contract A referencia Artist A (mesmo tenant)', !aid || aid === DATA_A.artistId, `aid=${aid}`);
    expect('Contract A referencia Cliente A (mesmo tenant)', !cid || cid === DATA_A.clientId, `cid=${cid}`);
  }
  if (DATA_B.contractId) {
    const r = await call('GET', `/contracts/${DATA_B.contractId}`, { token: TOKEN_B, tenantId: TENANT_B.tenantId });
    expect('GET contract B retorna 200', r.status === 200, `got=${r.status}`);
    const contractB = r.body?.data ?? r.body;
    const aid = contractB?.artista_id ?? contractB?.artistId ?? contractB?.artista?.id;
    const cid = contractB?.cliente_id ?? contractB?.clientId ?? contractB?.cliente?.id;
    expect('Contract B referencia Artist B (mesmo tenant)', !aid || aid === DATA_B.artistId, `aid=${aid}`);
    expect('Contract B referencia Cliente B (mesmo tenant)', !cid || cid === DATA_B.clientId, `cid=${cid}`);
  }
}

// ============================================================================
// PHASE 3.8 — ANALYTICS TENANT-SAFE
// ============================================================================

async function fase38(): Promise<void> {
  section('FASE 3.8 — ANALYTICS TENANT-SAFE');
  const dashA = await call('GET', '/analytics/dashboard', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const dashB = await call('GET', '/analytics/dashboard', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('/analytics/dashboard A → 200', dashA.status === 200, `got=${dashA.status}`);
  expect('/analytics/dashboard B → 200', dashB.status === 200, `got=${dashB.status}`);

  // Collect numbers: B has only 1 of each (created now). A accumulated previous history + 1.
  // We expect them to differ (or at least B to reflect our 1).
  const a = dashA.body?.data ?? dashA.body;
  const b = dashB.body?.data ?? dashB.body;

  info(`A: ${JSON.stringify({
    artists:     a?.totalArtists ?? a?.artists ?? a?.artistsCount ?? a?.summary?.artists,
    contracts:   a?.totalContracts ?? a?.contracts ?? a?.contractsCount ?? a?.summary?.contracts,
    releases:    a?.totalReleases ?? a?.releases ?? a?.releasesCount ?? a?.summary?.releases,
  })}`);
  info(`B: ${JSON.stringify({
    artists:     b?.totalArtists ?? b?.artists ?? b?.artistsCount ?? b?.summary?.artists,
    contracts:   b?.totalContracts ?? b?.contracts ?? b?.contractsCount ?? b?.summary?.contracts,
    releases:    b?.totalReleases ?? b?.releases ?? b?.releasesCount ?? b?.summary?.releases,
  })}`);

  // Direct comparison of the JSONs — if they are exactly equal with different data in the tenants, there is a global leak.
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  expect('Analytics A e B retornam corpos distintos', aStr !== bStr, 'identical bodies → suspected global leak');

  // revenue endpoint
  const revA = await call('GET', '/analytics/revenue?months=3', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const revB = await call('GET', '/analytics/revenue?months=3', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('/analytics/revenue A → 200', revA.status === 200, `got=${revA.status}`);
  expect('/analytics/revenue B → 200', revB.status === 200, `got=${revB.status}`);
}

// ============================================================================
// PHASE 3.9 — AUDIT / ACTIVITY TENANT-SAFE
// ============================================================================

async function fase39(): Promise<void> {
  section('FASE 3.9 — AUDIT / ACTIVITY TENANT-SAFE');

  const auditA = await call('GET', '/audit-logs?limit=200', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const auditB = await call('GET', '/audit-logs?limit=200', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('/audit-logs A → 200', auditA.status === 200, `got=${auditA.status}`);
  expect('/audit-logs B → 200', auditB.status === 200, `got=${auditB.status}`);

  const auditListA = extractList(auditA.body);
  const auditListB = extractList(auditB.body);

  const tenantIdsInA = new Set(auditListA.map((r: any) => r.tenant_id ?? r.tenantId).filter(Boolean));
  const tenantIdsInB = new Set(auditListB.map((r: any) => r.tenant_id ?? r.tenantId).filter(Boolean));
  expect('audit-logs A only contains tenant_id=A',
    tenantIdsInA.size === 0 || (tenantIdsInA.size === 1 && tenantIdsInA.has(TENANT_A.tenantId)),
    `tenants observados: ${[...tenantIdsInA].join(',')}`);
  expect('audit-logs B only contains tenant_id=B',
    tenantIdsInB.size === 0 || (tenantIdsInB.size === 1 && tenantIdsInB.has(TENANT_B.tenantId)),
    `tenants observados: ${[...tenantIdsInB].join(',')}`);

  const actA = await call('GET', '/activity-logs?limit=200', { token: TOKEN_A, tenantId: TENANT_A.tenantId });
  const actB = await call('GET', '/activity-logs?limit=200', { token: TOKEN_B, tenantId: TENANT_B.tenantId });
  expect('/activity-logs A → 200', actA.status === 200, `got=${actA.status}`);
  expect('/activity-logs B → 200', actB.status === 200, `got=${actB.status}`);
  const actListA = extractList(actA.body);
  const actListB = extractList(actB.body);
  const actTenantsA = new Set(actListA.map((r: any) => r.tenant_id ?? r.tenantId).filter(Boolean));
  const actTenantsB = new Set(actListB.map((r: any) => r.tenant_id ?? r.tenantId).filter(Boolean));
  expect('activity-logs A only contains tenant_id=A',
    actTenantsA.size === 0 || (actTenantsA.size === 1 && actTenantsA.has(TENANT_A.tenantId)),
    `tenants observados: ${[...actTenantsA].join(',')}`);
  expect('activity-logs B only contains tenant_id=B',
    actTenantsB.size === 0 || (actTenantsB.size === 1 && actTenantsB.has(TENANT_B.tenantId)),
    `tenants observados: ${[...actTenantsB].join(',')}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  MUSIC OS 360 — PHASE 3: Multi-Tenant Validation (HTTP)  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  API_URL    : ${API_URL}`);
  console.log(`  Tenant A   : ${TENANT_A.tenantId} (${TENANT_A.name})`);
  console.log(`  Tenant B   : ${TENANT_B.tenantId} (${TENANT_B.name})`);
  console.log(`  Tag A      : ${TAG_A}`);
  console.log(`  Tag B      : ${TAG_B}`);

  try {
    await fase31();
    await fase32();
    await fase33();
    await fase34();
    await fase35();
    await fase36();
    await fase37();
    await fase38();
    await fase39();
  } catch (err) {
    console.error('\n[FATAL] Error during execution:', (err as Error).message);
    failed++;
    errors.push({ where: 'main', detail: (err as Error).message });
  }

  console.log('\n── RESULTADO ──');
  console.log(`  Passados : ${passed}`);
  console.log(`  Falhados : ${failed}`);
  if (errors.length > 0) {
    console.log('\n── ERROS ──');
    for (const e of errors) console.log(`  - ${e.where} :: ${e.detail}`);
  }

  console.log('\n── IDs CRIADOS ──');
  console.log('  A:', JSON.stringify(DATA_A));
  console.log('  B:', JSON.stringify(DATA_B));

  if (failed === 0) {
    console.log('\n  ✓ FASE 3 PASSOU — multi-tenant isolado ponta-a-ponta.\n');
    process.exit(0);
  } else {
    console.log('\n  ✗ PHASE 3 FAILED — leaks or errors detected.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[verify:fase3] Fatal error:', err);
  process.exit(1);
});
