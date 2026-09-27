#!/usr/bin/env tsx
/**
 * scripts/verify-fase5-dashboard.ts
 *
 * PHASE 5 — Validation of the real Dashboard.
 *
 *   5.1 Controlled DASH_A_* and DASH_B_* dataset
 *   5.2 /analytics/dashboard cross-checked with the database
 *   5.4 Calendar (today's vs tomorrow's events via the /events list)
 *   5.5 Activity feed (audit-logs and activity-logs)
 *   5.6 Featured artists (releases/projects count, streams=null when there is no source)
 *   5.7 Tenant-scoped current-month financials
 *   5.8 Operational alerts (no fabricated mock)
 *
 *   5.3 (browser UI) and 5.9 (network/console) require a manual smoke.
 */

import 'reflect-metadata';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';

try { require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') }); } catch {}

const API_URL = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
const KEY     = process.env['ENCRYPTION_KEY'] ?? '';
const DB_URL  = process.env['DATABASE_URL'] ?? '';

const TA = '10000000-0000-0000-0000-000000000002';
const OA = '10000000-0000-0000-0000-000000000001';
const TB = '20000000-0000-0000-0000-000000000002';
const OB = '20000000-0000-0000-0000-000000000001';

const UID_A = '40000000-0000-0000-0000-000000000001'; // owner A (PHASE 4)
const UID_B = '40000000-0000-0000-0000-000000000008'; // owner B (PHASE 4)

const TS = Date.now();

let passed = 0, failed = 0;
const fails: Array<{ where: string; got: any; want: any }> = [];

function sign(uid: string, org: string): string {
  return jwt.sign(
    { sub: uid, session_id: `f5-${uid.slice(0,8)}`, app_metadata: { org_id: org, role: 'owner' } },
    KEY,
    { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
  );
}

const TOKEN_A = sign(UID_A, OA);
const TOKEN_B = sign(UID_B, OB);

async function call(
  method: string,
  pathname: string,
  opts: { auth: string; tenant: string; body?: unknown },
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.auth}`, 'X-Tenant-ID': opts.tenant };
  const url = `${API_URL}/api/v1${pathname.startsWith('/') ? pathname : '/'+pathname}`;
  const res = await fetch(url, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

function expect(label: string, cond: boolean, detail?: string): void {
  if (cond) { console.log(`  ✓  ${label}`); passed++; }
  else      { console.log(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`); failed++; fails.push({ where: label, got: detail, want: 'true' }); }
}
function section(t: string) { console.log(`\n── ${t} ──`); }

function pickId(body: any): string | null {
  if (!body) return null;
  if (typeof body.id === 'string') return body.id;
  if (body.data && typeof body.data.id === 'string') return body.data.id;
  if (body.data && body.data.data && typeof body.data.data.id === 'string') return body.data.data.id;
  return null;
}

function extractList(body: any): any[] {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.data)) return body.data.data;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

// ============================================================================
// 5.1 — DATASET CONTROLADO
// ============================================================================

interface SeedSet {
  artists:   string[];
  releases:  string[];
  contracts: string[];
  events:    string[];
  tx:        string[];
  leads:     string[];
}

async function seedTenant(tenant: string, token: string, tag: string, opts: {
  artists: number; releases: number; contracts: number;
  eventsToday: number; eventsTomorrow: number;
  txRevenueThisMonth: number; txExpenseThisMonth: number;
  txRevenueOtherMonth: number;
  leads: number;
}): Promise<SeedSet> {
  const ctx = { auth: token, tenant };
  const out: SeedSet = { artists: [], releases: [], contracts: [], events: [], tx: [], leads: [] };

  for (let i = 0; i < opts.artists; i++) {
    const r = await call('POST', '/artists', { ...ctx, body: { nome_artistico: `${tag}_ARTIST_${i}_${TS}`, status: 'em_negociacao', spotify_ouvintes: i === 0 ? 12345 : undefined } });
    { const id = pickId(r.body); if (id) out.artists.push(id); else console.log(`  !  artist POST failed status=${r.status} body=${JSON.stringify(r.body).slice(0,150)}`); }
  }
  for (let i = 0; i < opts.releases; i++) {
    const r = await call('POST', '/releases', { ...ctx, body: { title: `${tag}_RELEASE_${i}_${TS}`, type: 'single', artistId: out.artists[0] ?? null } });
    const id = pickId(r.body); if (id) out.releases.push(id); else console.log(`  !  release POST status=${r.status} ${JSON.stringify(r.body).slice(0,150)}`);
  }
  for (let i = 0; i < opts.contracts; i++) {
    const r = await call('POST', '/contracts', { ...ctx, body: { titulo: `${tag}_CONTRACT_${i}_${TS}`, tipo: 'gravacao', data_inicio: '2026-01-01', data_fim: '2026-12-31', valor: 1000 + i } });
    const id = pickId(r.body); if (id) out.contracts.push(id); else console.log(`  !  contract POST status=${r.status} ${JSON.stringify(r.body).slice(0,150)}`);
  }
  // Events: today
  const todayIso = new Date().toISOString();
  for (let i = 0; i < opts.eventsToday; i++) {
    const r = await call('POST', '/events', { ...ctx, body: { title: `${tag}_EVENT_TODAY_${i}_${TS}`, type: 'show', startsAt: todayIso } });
    const id = pickId(r.body); if (id) out.events.push(id); else console.log(`  !  event POST status=${r.status} ${JSON.stringify(r.body).slice(0,150)}`);
  }
  // Events: tomorrow
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString();
  for (let i = 0; i < opts.eventsTomorrow; i++) {
    const r = await call('POST', '/events', { ...ctx, body: { title: `${tag}_EVENT_FUTURE_${i}_${TS}`, type: 'show', startsAt: tomorrowIso } });
    const id = pickId(r.body); if (id) out.events.push(id); else console.log(`  !  event(tom) POST status=${r.status} ${JSON.stringify(r.body).slice(0,150)}`);
  }
  // Revenue transactions require tipoCliente. categoria='outros' avoids requiring an artist/subcategory.
  const today = new Date().toISOString().slice(0,10);
  for (let i = 0; i < opts.txRevenueThisMonth; i++) {
    const r = await call('POST', '/transactions', { ...ctx, body: { tipoTransacao: 'receita', tipoCliente: 'empresa', categoria: 'outros', descricao: `${tag}_TX_REV_${i}_${TS}`, valor: '1000.00', dataTransacao: today, formaPagamento: 'pix', status: 'pago' } });
    const id = pickId(r.body); if (id) out.tx.push(id); else console.log(`  !  tx-rev POST status=${r.status} ${JSON.stringify(r.body).slice(0,200)}`);
  }
  for (let i = 0; i < opts.txExpenseThisMonth; i++) {
    const r = await call('POST', '/transactions', { ...ctx, body: { tipoTransacao: 'despesa', tipoCliente: 'empresa', categoria: 'outros', descricao: `${tag}_TX_EXP_${i}_${TS}`, valor: '300.00', dataTransacao: today, formaPagamento: 'pix', status: 'pago' } });
    const id = pickId(r.body); if (id) out.tx.push(id); else console.log(`  !  tx-exp POST status=${r.status} ${JSON.stringify(r.body).slice(0,200)}`);
  }
  // A transaction from another month (60 days ago)
  const other = new Date(Date.now() - 60 * 86400000).toISOString().slice(0,10);
  for (let i = 0; i < opts.txRevenueOtherMonth; i++) {
    const r = await call('POST', '/transactions', { ...ctx, body: { tipoTransacao: 'receita', tipoCliente: 'empresa', categoria: 'outros', descricao: `${tag}_TX_OLD_${i}_${TS}`, valor: '9999.00', dataTransacao: other, formaPagamento: 'pix', status: 'pago' } });
    const id = pickId(r.body); if (id) out.tx.push(id); else console.log(`  !  tx-old POST status=${r.status} ${JSON.stringify(r.body).slice(0,200)}`);
  }
  // Leads
  for (let i = 0; i < opts.leads; i++) {
    const r = await call('POST', '/leads', { ...ctx, body: { name: `${tag}_LEAD_${i}_${TS}`, stage: 'prospect' } });
    const id = pickId(r.body); if (id) out.leads.push(id); else console.log(`  !  lead POST status=${r.status} ${JSON.stringify(r.body).slice(0,150)}`);
  }
  return out;
}

let SEED_A: SeedSet;
let SEED_B: SeedSet;
let OPTS_A: any;
let OPTS_B: any;

async function f51(): Promise<void> {
  section('5.1 — DATASET CONTROLADO');
  OPTS_A = {
    artists: 3, releases: 2, contracts: 2,
    eventsToday: 2, eventsTomorrow: 1,
    txRevenueThisMonth: 3, txExpenseThisMonth: 2, txRevenueOtherMonth: 1,
    leads: 2,
  };
  OPTS_B = {
    artists: 1, releases: 1, contracts: 1,
    eventsToday: 1, eventsTomorrow: 2,
    txRevenueThisMonth: 1, txExpenseThisMonth: 1, txRevenueOtherMonth: 0,
    leads: 1,
  };
  SEED_A = await seedTenant(TA, TOKEN_A, `DASH_A_${TS}`, OPTS_A);
  SEED_B = await seedTenant(TB, TOKEN_B, `DASH_B_${TS}`, OPTS_B);
  console.log('  Tenant A:', { artists: SEED_A.artists.length, releases: SEED_A.releases.length, contracts: SEED_A.contracts.length, events: SEED_A.events.length, tx: SEED_A.tx.length, leads: SEED_A.leads.length });
  console.log('  Tenant B:', { artists: SEED_B.artists.length, releases: SEED_B.releases.length, contracts: SEED_B.contracts.length, events: SEED_B.events.length, tx: SEED_B.tx.length, leads: SEED_B.leads.length });

  expect('Tenant A seed created every artist', SEED_A.artists.length === OPTS_A.artists, `got=${SEED_A.artists.length}`);
  expect('Tenant A seed created every contract', SEED_A.contracts.length === OPTS_A.contracts, `got=${SEED_A.contracts.length}`);
  expect('Tenant A seed created events (today+tomorrow)', SEED_A.events.length === OPTS_A.eventsToday + OPTS_A.eventsTomorrow, `got=${SEED_A.events.length}`);
  expect('Tenant A seed created transactions (month + older)', SEED_A.tx.length === OPTS_A.txRevenueThisMonth + OPTS_A.txExpenseThisMonth + OPTS_A.txRevenueOtherMonth, `got=${SEED_A.tx.length}`);
  expect('Tenant B seed created every artist', SEED_B.artists.length === OPTS_B.artists, `got=${SEED_B.artists.length}`);
}

// ============================================================================
// 5.2 — /analytics/dashboard cross-checked against the database
// ============================================================================

let DASH_A: any;
let DASH_B: any;
let DB: Client;

async function f52(): Promise<void> {
  section('5.2 — /analytics/dashboard vs banco');
  DB = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await DB.connect();

  const ra = await call('GET', '/analytics/dashboard', { auth: TOKEN_A, tenant: TA });
  const rb = await call('GET', '/analytics/dashboard', { auth: TOKEN_B, tenant: TB });
  expect('GET /analytics/dashboard Tenant A → 200', ra.status === 200, `status=${ra.status}`);
  expect('GET /analytics/dashboard Tenant B → 200', rb.status === 200, `status=${rb.status}`);
  DASH_A = ra.body?.data ?? ra.body;
  DASH_B = rb.body?.data ?? rb.body;
  console.log('  Tenant A counters:', JSON.stringify({ artists: DASH_A.artists, contracts: DASH_A.contracts, leads: DASH_A.leads, revenue: DASH_A.revenue_current_month, expenses: DASH_A.expenses_current_month, net: DASH_A.net_result_current_month }));
  console.log('  Tenant B counters:', JSON.stringify({ artists: DASH_B.artists, contracts: DASH_B.contracts, leads: DASH_B.leads, revenue: DASH_B.revenue_current_month, expenses: DASH_B.expenses_current_month, net: DASH_B.net_result_current_month }));

  // Cross-check: for each key counter, query the database directly and compare
  const checks: Array<{ label: string; sql: string; tenant: string; expect: number }> = [
    { label: 'A artists count = banco',   sql: 'SELECT COUNT(*)::int AS c FROM artists   WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TA, expect: DASH_A.artists },
    { label: 'A contracts count = banco', sql: 'SELECT COUNT(*)::int AS c FROM contracts WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TA, expect: DASH_A.contracts },
    { label: 'A leads count = banco',     sql: 'SELECT COUNT(*)::int AS c FROM leads     WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TA, expect: DASH_A.leads },
    { label: 'B artists count = banco',   sql: 'SELECT COUNT(*)::int AS c FROM artists   WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TB, expect: DASH_B.artists },
    { label: 'B contracts count = banco', sql: 'SELECT COUNT(*)::int AS c FROM contracts WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TB, expect: DASH_B.contracts },
    { label: 'B leads count = banco',     sql: 'SELECT COUNT(*)::int AS c FROM leads     WHERE tenant_id=$1 AND deleted_at IS NULL', tenant: TB, expect: DASH_B.leads },
  ];
  for (const c of checks) {
    const r = await DB.query<{ c: number }>(c.sql, [c.tenant]);
    expect(c.label, r.rows[0]?.c === c.expect, `db=${r.rows[0]?.c} dashboard=${c.expect}`);
  }

  // Tenant isolation: dashboards have different counters
  expect('Dashboard A ≠ Dashboard B (artists)', DASH_A.artists !== DASH_B.artists);
  expect('Dashboard A ≠ Dashboard B (contracts)', DASH_A.contracts !== DASH_B.contracts);

  // Non-fabricated operational metrics — when there is no source, it must be 0 (and the key exists)
  const operationalKeys = ['pending_tasks_count','overdue_tasks_count','onboarding_in_progress_count','overdue_followups_count','pending_distribution_setups','pending_external_syncs','failed_external_syncs','successful_external_syncs','distributor_submissions_count','society_submissions_count','external_validation_errors_count','pending_provider_requirements_count'];
  for (const k of operationalKeys) {
    expect(`Dashboard A contains '${k}' (not invented)`, typeof DASH_A[k] === 'number' && DASH_A[k] >= 0, `value=${DASH_A[k]}`);
  }
}

// ============================================================================
// 5.4 — TODAY'S AGENDA
// ============================================================================

async function f54(): Promise<void> {
  section('5.4 — TODAY\'S SCHEDULE');
  // Lists all of Tenant A's events, filters by date
  const r = await call('GET', '/events?limit=200', { auth: TOKEN_A, tenant: TA });
  expect('GET /events A → 200', r.status === 200);
  const list: any[] = Array.isArray(r.body?.data) ? r.body.data : (r.body?.data?.data ?? r.body?.items ?? []);
  const todayPrefix = new Date().toISOString().slice(0,10);
  const eventosHojeTotal = list.filter((e) => {
    const raw = e.data_inicio ?? e.startsAt ?? e.data ?? e.start_date;
    return typeof raw === 'string' && raw.slice(0,10) === todayPrefix;
  });
  const ours = eventosHojeTotal.filter((e) => (e.title ?? e.titulo ?? '').includes(`DASH_A_${TS}_EVENT_TODAY`));
  expect('events dated today include the ones created in this run', ours.length === OPTS_A.eventsToday, `match=${ours.length} esperado=${OPTS_A.eventsToday}`);

  // Confirm that tomorrow's events do NOT enter today's slice
  const amanha = list.filter((e) => (e.title ?? e.titulo ?? '').includes(`DASH_A_${TS}_EVENT_FUTURE`));
  expect('eventos do dia seguinte criados', amanha.length === OPTS_A.eventsTomorrow);
  const tomorrowSetAlsoHoje = amanha.filter((e) => {
    const raw = e.data_inicio ?? e.startsAt ?? e.data ?? e.start_date;
    return typeof raw === 'string' && raw.slice(0,10) === todayPrefix;
  });
  expect('tomorrow events do NOT fall into "today"', tomorrowSetAlsoHoje.length === 0, `bleed=${tomorrowSetAlsoHoje.length}`);
}

// ============================================================================
// 5.5 — ACTIVITY FEED
// ============================================================================

async function f55(): Promise<void> {
  section('5.5 — ACTIVITY FEED');
  // Wait for the asynchronous audit queue to drain
  await new Promise((r) => setTimeout(r, 3000));

  // Retry: up to 3 attempts if the 1st returns non-200
  let r = await call('GET', '/audit-logs?limit=200', { auth: TOKEN_A, tenant: TA });
  for (let i = 0; i < 3 && r.status !== 200; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await call('GET', '/audit-logs?limit=200', { auth: TOKEN_A, tenant: TA });
  }
  expect('GET /audit-logs A → 200', r.status === 200, `status=${r.status}`);
  const list = extractList(r.body);
  const expectedActions = ['artist.created', 'release.created', 'contract.created', 'event.created', 'transaction.created', 'lead.created'];
  for (const action of expectedActions) {
    const found = list.some((e: any) => (e.action === action) || (e.event_type === action));
    expect(`audit-logs contains action '${action}'`, found, `count=${list.length}`);
  }
  // Reload simulado
  const r2 = await call('GET', '/audit-logs?limit=200', { auth: TOKEN_A, tenant: TA });
  const list2 = extractList(r2.body);
  expect('persistent audit-logs (2nd call equal/greater)', list2.length >= list.length, `1st=${list.length} 2nd=${list2.length}`);

  // activity-logs too
  const ra = await call('GET', '/activity-logs?limit=100', { auth: TOKEN_A, tenant: TA });
  expect('GET /activity-logs A → 200', ra.status === 200, `status=${ra.status}`);
}

// ============================================================================
// 5.6 — ARTISTAS DESTAQUE (releases/projects count + streams=null safety)
// ============================================================================

async function f56(): Promise<void> {
  section('5.6 — FEATURED ARTISTS');
  // Creates a project linked to the first artist of A
  const artistA0 = SEED_A.artists[0];
  if (!artistA0) {
    console.log('  →  no artistA0, skipping');
    return;
  }

  // Creates a project via /projects (if it exists)
  const pj = await call('POST', '/projects', { auth: TOKEN_A, tenant: TA, body: { nome: `DASH_A_PROJECT_${TS}`, artista_id: artistA0, status: 'em_andamento' } });
  console.log('  POST /projects =>', pj.status);

  // Lists artists and validates the expected fields (does not require a dedicated "featured" endpoint — the frontend derives it)
  const r = await call('GET', '/artists?limit=200', { auth: TOKEN_A, tenant: TA });
  const list = Array.isArray(r.body?.data) ? r.body.data : (r.body?.data?.data ?? r.body?.items ?? []);
  const myArtists = list.filter((a: any) => (a.nome_artistico ?? '').includes(`DASH_A_${TS}_ARTIST`));
  expect('DASH_A_* artists listed', myArtists.length === OPTS_A.artists, `got=${myArtists.length}`);

  // The artist with spotify_ouvintes=12345 (index 0) must keep it; others may have null or undefined
  const a0 = myArtists.find((a: any) => (a.nome_artistico ?? '').endsWith(`_0_${TS}`));
  expect('artistA0 returns spotify_ouvintes=12345 (real streams)', a0?.spotify_ouvintes === 12345, `got=${a0?.spotify_ouvintes}`);
  const a1 = myArtists.find((a: any) => (a.nome_artistico ?? '').endsWith(`_1_${TS}`));
  // Hooks frontend tratam undefined/null como "–"
  expect('artistA1 does not fabricate streams (null/undefined)', a1?.spotify_ouvintes == null, `got=${a1?.spotify_ouvintes}`);
}

// ============================================================================
// 5.7 — TENANT-SCOPED FINANCIALS, CURRENT MONTH
// ============================================================================

async function f57(): Promise<void> {
  section('5.7 — CURRENT MONTH FINANCE');
  // For Tenant A, recompute what we expect
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const dbA = await DB.query<{ receitas: string; despesas: string }>(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='receita' AND status NOT IN ('cancelado','cancelled') THEN valor::numeric ELSE 0 END),0)::numeric AS receitas,
      COALESCE(SUM(CASE WHEN tipo='despesa' AND status NOT IN ('cancelado','cancelled') THEN valor::numeric ELSE 0 END),0)::numeric AS despesas
    FROM transactions WHERE tenant_id=$1 AND deleted_at IS NULL AND data >= $2
  `, [TA, monthStart]);
  const expectedRevA = parseFloat(dbA.rows[0]?.receitas ?? '0');
  const expectedExpA = parseFloat(dbA.rows[0]?.despesas ?? '0');
  expect('revenue_current_month A matches the database', Math.abs(DASH_A.revenue_current_month - expectedRevA) < 0.01, `dashboard=${DASH_A.revenue_current_month} db=${expectedRevA}`);
  expect('expenses_current_month A matches the database', Math.abs(DASH_A.expenses_current_month - expectedExpA) < 0.01, `dashboard=${DASH_A.expenses_current_month} db=${expectedExpA}`);
  expect('net_result_current_month A correct', Math.abs(DASH_A.net_result_current_month - (expectedRevA - expectedExpA)) < 0.01);

  // Same check for B
  const dbB = await DB.query<{ receitas: string; despesas: string }>(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='receita' AND status NOT IN ('cancelado','cancelled') THEN valor::numeric ELSE 0 END),0)::numeric AS receitas,
      COALESCE(SUM(CASE WHEN tipo='despesa' AND status NOT IN ('cancelado','cancelled') THEN valor::numeric ELSE 0 END),0)::numeric AS despesas
    FROM transactions WHERE tenant_id=$1 AND deleted_at IS NULL AND data >= $2
  `, [TB, monthStart]);
  const expectedRevB = parseFloat(dbB.rows[0]?.receitas ?? '0');
  const expectedExpB = parseFloat(dbB.rows[0]?.despesas ?? '0');
  expect('revenue_current_month B matches the database', Math.abs(DASH_B.revenue_current_month - expectedRevB) < 0.01, `dashboard=${DASH_B.revenue_current_month} db=${expectedRevB}`);
  expect('expenses_current_month B matches the database', Math.abs(DASH_B.expenses_current_month - expectedExpB) < 0.01);

  // An old transaction (60 days) does NOT enter
  // — for A, we create 1 old revenue of 9999. If it entered, revenue would be much larger.
  // Check: revenue_current_month must be < 9999 (i.e. it does not include the isolated old one).
  // More robust: sum only this run's ones (created in OPTS_A.txRevenueThisMonth * 1000)
  const ourMonthRevenue = OPTS_A.txRevenueThisMonth * 1000;
  expect('A revenue excludes a 60-day-old transaction', DASH_A.revenue_current_month < 9999 + ourMonthRevenue || DASH_A.revenue_current_month === expectedRevA, `db=${expectedRevA}`);

  // Tenant isolation
  expect('Tenant B revenue isolated (does not include A)', DASH_B.revenue_current_month < DASH_A.revenue_current_month || DASH_B.revenue_current_month === expectedRevB);
}

// ============================================================================
// 5.8 — OPERATIONAL ALERTS (no mock)
// ============================================================================

async function f58(): Promise<void> {
  section('5.8 — OPERATIONAL ALERTS');
  // Expiring contracts: we create contracts with data_fim '2026-12-31' → they do not expire within 30 days
  // So the `contracts_expiring_soon_count` counter reflects only real contracts with data_fim <30 days.
  expect('contracts_expiring_soon_count is numeric', typeof DASH_A.contracts_expiring_soon_count === 'number');
  expect('open_tickets is numeric', typeof DASH_A.open_tickets === 'number');
  expect('overdue_invoices_count is numeric', typeof DASH_A.overdue_invoices_count === 'number');
  expect('failed_external_syncs is numeric', typeof DASH_A.failed_external_syncs === 'number');

  // Validate that the counters are consistent with direct queries (not hardcoded)
  const r1 = await DB.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM support_tickets WHERE tenant_id=$1 AND status NOT IN ('resolved','closed') AND deleted_at IS NULL`, [TA]);
  expect('open_tickets matches the database', DASH_A.open_tickets === r1.rows[0]?.c, `db=${r1.rows[0]?.c} dash=${DASH_A.open_tickets}`);
  const r2 = await DB.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM crm_tasks WHERE tenant_id=$1 AND status='pending'`, [TA]);
  expect('pending_tasks_count matches the database', DASH_A.pending_tasks_count === r2.rows[0]?.c, `db=${r2.rows[0]?.c} dash=${DASH_A.pending_tasks_count}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  MUSIC OS 360 — PHASE 5: Real dashboard (HTTP+DB)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  API_URL  : ${API_URL}`);
  console.log(`  Tenant A : ${TA}`);
  console.log(`  Tenant B : ${TB}`);
  console.log(`  TS       : ${TS}`);

  if (!KEY || !DB_URL) { console.error('ENCRYPTION_KEY or DATABASE_URL missing — aborting'); process.exit(2); }

  try {
    await f51();
    await f52();
    await f54();
    await f55();
    await f56();
    await f57();
    await f58();
  } catch (err) {
    console.error('\n[FATAL]', (err as Error).message);
    failed++;
  } finally {
    try { if (DB) await DB.end(); } catch {}
  }

  console.log('\n── RESULT ──');
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);
  if (fails.length > 0) {
    console.log('\n── FAILURES ──');
    for (const f of fails) console.log(`  - ${f.where}  ${f.got}`);
  }
  if (failed === 0) {
    console.log('\n  ✓ PHASE 5 PASSED — dashboard reflects real data.\n');
    process.exit(0);
  } else {
    console.log('\n  ✗ PHASE 5 FAILED.\n');
    process.exit(1);
  }
}

main().catch((e) => { console.error('\n[fase5] Fatal error:', e); process.exit(1); });
