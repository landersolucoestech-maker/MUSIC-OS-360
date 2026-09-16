/**
 * scripts/canary-notifications-rls.ts  ·  P2-4
 *
 * Staging-equivalent canary harness for the notifications session-context wiring.
 * Exercises the REAL NotificationsService + DatabaseContextService against:
 *   - BASELINE: owner connection (DATABASE_URL, BYPASSRLS) + flag OFF  → current behaviour
 *   - CANARY:   app connection   (APP_DATABASE_URL, NOBYPASSRLS) + flag ON → RLS enforced
 *
 * Proves: functional parity, cross-tenant blocked at DB, no context leak between
 * interleaved "requests", and basic latency. NEVER prints connection URLs/secrets.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ALL_ENTITIES, NotificationEntity } from '../src/database/entities';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { DatabaseContextService } from '../src/database/database-context.service';
import { assertDatabaseCommandEnv } from '../src/core/config/env.schema';

try {
  // Never override an explicitly-provided process env with .env.development —
  // an explicit DATABASE_URL/APP_DATABASE_URL/DB_SSL must always win.
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') });
} catch { /* optional */ }

const apiEnvText = fs.existsSync(path.resolve(process.cwd(), '.env.development'))
  ? fs.readFileSync(path.resolve(process.cwd(), '.env.development'), 'utf8')
  : '';
const OWNER_URL = process.env['DATABASE_URL'] || apiEnvText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const APP_URL = process.env['APP_DATABASE_URL'] || apiEnvText.match(/^APP_DATABASE_URL=(.+)$/m)?.[1]?.trim();
const DB_SSL = process.env['DB_SSL'] || apiEnvText.match(/^DB_SSL=(.+)$/m)?.[1]?.trim();
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const fakeWs = { sendToTenant: () => undefined } as never;
const cfg = (flag: 'true' | 'false') => ({ get: () => flag }) as never;
const pag = { offset: 0, limit: 20 } as never;

function dsFor(url: string) {
  return new DataSource({
    type: 'postgres', url, entities: ALL_ENTITIES, synchronize: false, logging: false,
    ssl: DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
}

async function main() {
  if (!OWNER_URL || !APP_URL) throw new Error('DATABASE_URL and APP_DATABASE_URL required');

  // Valida as URLs realmente usadas (parseadas do .env), não só process.env.
  assertDatabaseCommandEnv('canary-notifications-rls', {
    ...process.env,
    DATABASE_URL: OWNER_URL,
    APP_DATABASE_URL: APP_URL,
  });

  const owner = await dsFor(OWNER_URL).initialize();
  const app = await dsFor(APP_URL).initialize();
  const results: Record<string, unknown> = {};

  try {
    // ── verify app role attributes (no secret printed) ─────────────────────────
    const attrs = await app.query(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    results['app_role'] = { rolsuper: attrs[0].rolsuper, rolbypassrls: attrs[0].rolbypassrls };

    // ── seed via owner (bypass) ────────────────────────────────────────────────
    const ownerRepo = owner.getRepository(NotificationEntity);
    await owner.query(`DELETE FROM notifications WHERE tenant_id IN ($1,$2)`, [TENANT_A, TENANT_B]);
    const nA = await ownerRepo.save(ownerRepo.create({
      id: randomUUID(), tenant_id: TENANT_A, user_id: 'uA', title: 'A-notif', type: 'info', metadata: {},
    } as never)) as unknown as NotificationEntity;
    const nB = await ownerRepo.save(ownerRepo.create({
      id: randomUUID(), tenant_id: TENANT_B, user_id: 'uB', title: 'B-notif', type: 'info', metadata: {},
    } as never)) as unknown as NotificationEntity;

    // ── BASELINE: owner + flag OFF ─────────────────────────────────────────────
    const baseSvc = new NotificationsService(owner as never, null, fakeWs, new DatabaseContextService(owner as never, cfg('false')));
    const baseList = await baseSvc.list(TENANT_A, 'uA', pag);
    const baseUnread = await baseSvc.countUnread(TENANT_A, 'uA');
    results['baseline'] = { listCount: (baseList as any).data.length, unread: baseUnread, ok: true };

    // ── CANARY: app (NOBYPASSRLS) + flag ON ────────────────────────────────────
    const ctxSvc = new DatabaseContextService(app as never, cfg('true'));
    const canarySvc = new NotificationsService(app as never, null, fakeWs, ctxSvc);
    const ctxA = { orgId: null, role: 'manager' };

    const cList = await canarySvc.list(TENANT_A, 'uA', pag, ctxA);
    const cUnread = await canarySvc.countUnread(TENANT_A, 'uA', ctxA);
    const cMark = await canarySvc.markRead(TENANT_A, nA.id, ctxA);
    const cAll = await canarySvc.markAllRead(TENANT_A, 'uA', ctxA);
    results['canary_functional'] = {
      listCount: (cList as any).data.length,
      listTitles: (cList as any).data.map((r: any) => r.title),
      unread: cUnread,
      markReadId: cMark?.id === nA.id,
      markAllUpdated: (cAll as any).updated,
    };

    // ── CROSS-TENANT: tenant A context tries to mark tenant B's notification ────
    let crossResult = 'UNEXPECTED';
    try {
      await canarySvc.markRead(TENANT_A, nB.id, ctxA);
      crossResult = 'LEAKED'; // must not happen
    } catch (e) {
      crossResult = (e as Error).constructor.name; // expect NotFoundException
    }
    const bRow = await owner.query(`SELECT read_at FROM notifications WHERE id = $1`, [nB.id]);
    results['cross_tenant'] = { markResult: crossResult, tenantB_read_at_unchanged: bRow[0].read_at === null };

    // ── NO LEAK: interleaved A and B contexts in parallel ──────────────────────
    const [seesA, seesB] = await Promise.all([
      canarySvc.list(TENANT_A, undefined, pag, { orgId: null, role: null }),
      canarySvc.list(TENANT_B, undefined, pag, { orgId: null, role: null }),
    ]);
    const aTitles = (seesA as any).data.map((r: any) => r.title);
    const bTitles = (seesB as any).data.map((r: any) => r.title);
    results['no_leak'] = {
      A_sees_only_A: aTitles.every((t: string) => t === 'A-notif') && aTitles.length > 0,
      B_sees_only_B: bTitles.every((t: string) => t === 'B-notif') && bTitles.length > 0,
      A_titles: aTitles, B_titles: bTitles,
    };

    // ── LATENCY: 50 markAllRead under canary ───────────────────────────────────
    const N = 50; const lat: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = Date.now();
      await canarySvc.list(TENANT_A, 'uA', pag, ctxA);
      lat.push(Date.now() - t);
    }
    lat.sort((a, b) => a - b);
    results['latency_ms'] = {
      avg: +(lat.reduce((s, v) => s + v, 0) / N).toFixed(2),
      p95: lat[Math.floor(N * 0.95)],
      max: lat[N - 1],
    };

    // ── ROLLBACK proof: app + flag OFF → NOBYPASSRLS w/o context = fail-closed ──
    const offOnApp = new NotificationsService(app as never, null, fakeWs, new DatabaseContextService(app as never, cfg('false')));
    const offList = await offOnApp.list(TENANT_A, 'uA', pag);
    results['rollback_flagoff_appuser'] = { listCount: (offList as any).data.length, note: 'NOBYPASSRLS without context → fail-closed (0)' };

    // cleanup
    await owner.query(`DELETE FROM notifications WHERE tenant_id IN ($1,$2)`, [TENANT_A, TENANT_B]);

    console.log('CANARY_RESULTS=' + JSON.stringify(results, null, 2));
  } finally {
    await app.destroy();
    await owner.destroy();
  }
}

main().catch((e) => { console.error('CANARY_FAILED:', e.message); process.exit(1); });
