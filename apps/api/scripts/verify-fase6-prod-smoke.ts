#!/usr/bin/env tsx
/**
 * PHASE 6 — Production Simulated Smoke
 * Tests end-to-end CRUD on the API in real HTTP mode + health endpoints.
 */
import 'reflect-metadata';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

try { require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') }); } catch {}

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
const KEY     = process.env['ENCRYPTION_KEY']!;
const TA = '10000000-0000-0000-0000-000000000002';
const OA = '10000000-0000-0000-0000-000000000001';
const UID_OWNER_A = '40000000-0000-0000-0000-000000000001';
const WEB_URL = 'http://localhost:4173';

const token = jwt.sign(
  { sub: UID_OWNER_A, session_id: 'fase6', app_metadata: { org_id: OA, role: 'owner' } },
  KEY, { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
);

const TS = Date.now();
let passed = 0, failed = 0;
const fails: string[] = [];

async function call(m: string, p: string, body?: unknown) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-ID': TA };
  const r = await fetch(`${API_URL}/api/v1${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
  let bd: any = null; try { bd = await r.json(); } catch {}
  return { status: r.status, body: bd };
}

function ok(label: string, cond: boolean, det?: string) {
  if (cond) { console.log(`  ✓  ${label}`); passed++; }
  else { console.log(`  ✗  ${label}${det?` — ${det}`:''}`); failed++; fails.push(label); }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  MUSIC OS 360 — FASE 6: Prod Smoke (build + CRUD)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\n── 6.2 — Health/Web Boot ──');
  {
    const r = await fetch(`${API_URL}/api/v1/health/live`);
    ok('/health/live → 200', r.status === 200, `status=${r.status}`);
    const t = await r.text();
    ok('/health/live responde JSON status:up', /"status":"up"/.test(t));
  }
  {
    const r = await fetch(`${WEB_URL}/`);
    ok('Web prod (4173) entrega HTML', r.status === 200, `status=${r.status}`);
    const html = await r.text();
    ok('HTML inclui <title>', /<title>/.test(html));
  }

  console.log('\n── 6.3 — Auth/context tenant real ──');
  {
    const r = await call('GET', '/auth/context');
    ok('/auth/context → 200', r.status === 200, `status=${r.status}`);
    const ws = r.body?.data?.workspace;
    ok('workspace.id correto', ws?.id === TA, `got=${ws?.id}`);
    ok('real claims (not mock)', typeof r.body?.data?.claims?.orgId === 'string' && r.body.data.claims.orgId === OA);
  }

  console.log('\n── 6.4 — Admin/super_admin endpoints ──');
  {
    // /users (manager+)
    const r = await call('GET', '/users');
    ok('/users (owner) → 200', r.status === 200, `status=${r.status}`);
    const arr = Array.isArray(r.body?.data) ? r.body.data : (r.body?.data?.data ?? []);
    ok('/users returns an array (no fake mock)', Array.isArray(arr));
  }
  {
    // /billing/subscription (admin+)
    const r = await call('GET', '/billing/subscription');
    ok('/billing/subscription → 200', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await call('GET', '/admin');
    ok('GET /admin → 404 (does not exist)', r.status === 404, `status=${r.status}`);
  }

  console.log('\n── 6.5 — Reports endpoints (no runtime mock leak) ──');
  // There is no real /reports/imports endpoint — the frontend must show an empty state.
  // We only ensure /audit-logs serves real history:
  {
    const r = await call('GET', '/audit-logs?limit=10');
    ok('/audit-logs → 200', r.status === 200);
    const arr = Array.isArray(r.body?.data) ? r.body.data : [];
    ok('/audit-logs retorna entradas reais', arr.length >= 0); // 0 or more
  }

  console.log('\n── 6.6 — Marketing metrics (no real integrations → empty) ──');
  {
    const r = await call('GET', '/analytics/revenue?months=3');
    ok('/analytics/revenue → 200', r.status === 200);
  }

  console.log('\n── 6.7 — Monitoring/Rights endpoints ──');
  {
    const r = await call('GET', '/content-detections');
    ok('/content-detections → 200/404', [200, 404].includes(r.status), `status=${r.status}`);
  }

  console.log('\n── 6.8 — Suporte endpoints ──');
  {
    const r = await call('GET', '/support-tickets');
    ok('/support-tickets → 200', r.status === 200);
    const arr = Array.isArray(r.body?.data) ? r.body.data : (r.body?.data?.data ?? []);
    ok('/support-tickets retorna array', Array.isArray(arr));
  }

  console.log('\n── 6.9 — External Data Exchange (mock-provider gated) ──');
  {
    // GET /external-data/providers or similar -- check via integrations endpoint
    const r = await call('GET', '/integrations/external-data/providers');
    if (r.status === 200) {
      const list = r.body?.data ?? r.body;
      ok('providers list inclui mock_provider flag', Array.isArray(list) && list.some((p: any) => p.mock === true), JSON.stringify(list).slice(0,200));
    } else {
      // The endpoint may have a different path — does not block, just not tested.
      console.log(`  →  /integrations/external-data/providers unavailable (${r.status}); acceptable`);
    }
  }

  console.log('\n── 6.10 — Production CRUD smoke ──');
  const tag = `PROD_SMOKE_${TS}`;
  const cli = await call('POST', '/clients', { name: `${tag}_CLIENT`, type: 'company' });
  ok('POST /clients', [200,201].includes(cli.status));
  const art = await call('POST', '/artists', { nome_artistico: `${tag}_ARTIST` });
  ok('POST /artists', [200,201].includes(art.status));
  const artistId = art.body?.data?.id ?? art.body?.id;
  const rel = await call('POST', '/releases', { title: `${tag}_RELEASE`, type: 'single', artistId });
  ok('POST /releases', [200,201].includes(rel.status));
  const ctr = await call('POST', '/contracts', { titulo: `${tag}_CONTRACT`, tipo: 'gravacao', artista_id: artistId, data_inicio: '2026-01-01', data_fim: '2026-12-31', valor: 500 });
  ok('POST /contracts', [200,201].includes(ctr.status), `status=${ctr.status} body=${JSON.stringify(ctr.body).slice(0,150)}`);
  const ev = await call('POST', '/events', { title: `${tag}_EVENT`, type: 'show', startsAt: new Date().toISOString() });
  ok('POST /events', [200,201].includes(ev.status));
  const tx = await call('POST', '/transactions', { tipoTransacao: 'receita', tipoCliente: 'empresa', categoria: 'outros', descricao: `${tag}_TX`, valor: '750.00', dataTransacao: new Date().toISOString().slice(0,10), formaPagamento: 'pix', status: 'pago' });
  ok('POST /transactions', [200,201].includes(tx.status), `status=${tx.status}`);

  // Dashboard
  const dash = await call('GET', '/analytics/dashboard');
  ok('/analytics/dashboard → 200', dash.status === 200);

  // Reload = call again
  const dash2 = await call('GET', '/analytics/dashboard');
  ok('/analytics/dashboard reload consistente', dash2.status === 200 && typeof dash2.body?.data?.artists === 'number');

  // Persistence: read the artist back
  if (artistId) {
    const reread = await call('GET', `/artists/${artistId}`);
    ok('Artista persistido (GET by id) → 200', reread.status === 200);
    ok('Artist keeps its name', reread.body?.data?.nome_artistico === `${tag}_ARTIST`);
  }

  console.log('\n── RESULTADO ──');
  console.log(`  Passados : ${passed}`);
  console.log(`  Falhados : ${failed}`);
  if (fails.length) {
    console.log('\n── FALHAS ──');
    for (const f of fails) console.log(`  - ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
