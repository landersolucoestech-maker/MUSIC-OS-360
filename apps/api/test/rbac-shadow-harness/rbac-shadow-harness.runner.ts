/**
 * STEP 12-J.5 — Runner of the RBAC SHADOW traffic E2E harness.
 *
 * Makes REAL HTTP requests against the staging API, authenticating real users via
 * Supabase (password grant). Does NOT touch rbac_decision_logs (the API populates it by itself
 * when processing each request). Does NOT mock JWT/tenant/guards.
 *
 * Usage: STAGING_API_URL=... SUPABASE_URL=... ... npx tsx test/rbac-shadow-harness/rbac-shadow-harness.runner.ts
 */
import { randomUUID } from 'crypto';
import { loadHarnessConfig, ROLE_LEVEL, type HarnessRole, type RoleCredential } from './rbac-shadow-harness.config';
import { MATRIX, type MatrixController } from './rbac-shadow-harness.matrix';
import { reportHarness, type RequestRecord } from './rbac-shadow-harness.reporter';

interface Session { role: HarnessRole; token: string; }

async function login(cfg: ReturnType<typeof loadHarnessConfig>, cred: RoleCredential): Promise<Session | null> {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
    body: JSON.stringify({ email: cred.email, password: cred.password }),
  });
  if (!res.ok) {
    console.error(`[harness] login failed for ${cred.role} (${res.status})`);
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) return null;
  return { role: cred.role, token: json.access_token };
}

function expectedAllow(role: HarnessRole, minLevel: number): boolean {
  return ROLE_LEVEL[role] >= minLevel;
}

async function callApi(
  cfg: ReturnType<typeof loadHarnessConfig>,
  session: Session, tenantId: string,
  method: string, path: string, body?: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-Tenant-ID': tenantId,
      'X-Request-ID': randomUUID(),
      'X-Trace-ID': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function resolveSampleId(
  cfg: ReturnType<typeof loadHarnessConfig>, session: Session, tenantId: string, ctrl: MatrixController,
): Promise<string | null> {
  try {
    const { json } = await callApi(cfg, session, tenantId, 'GET', ctrl.basePath);
    const arr = json?.data ?? json?.items ?? json;
    if (Array.isArray(arr) && arr[0]?.id) return String(arr[0].id);
  } catch { /* ignora */ }
  return null;
}

async function main() {
  const runId = randomUUID();
  process.env['RBAC_HARNESS_RUN_ID'] = runId;
  const cfg = loadHarnessConfig();
  console.log(`[harness] runId=${runId} api=${cfg.apiUrl} tenants=${cfg.tenants.length} roles=${cfg.credentials.length} alvo=${cfg.targets.requests} requests`);

  // 1) Real authentication of each role
  const sessions: Session[] = [];
  for (const cred of cfg.credentials) {
    const s = await login(cfg, cred);
    if (s) sessions.push(s);
  }
  if (sessions.length === 0) throw new Error('[harness] no authenticated session — aborting');

  const records: RequestRecord[] = [];
  const created: Array<{ ctrl: MatrixController; tenantId: string; session: Session; id: string }> = [];

  const exec = async (session: Session, tenantId: string, ctrl: MatrixController): Promise<void> => {
    const sampleId = await resolveSampleId(cfg, session, tenantId, ctrl);
    for (const a of ctrl.actions) {
      if (a.needsId && !sampleId && a.kind !== 'create') continue;
      const path = ctrl.basePath + a.pathSuffix.replace(':id', sampleId ?? 'none');
      const allow = expectedAllow(session.role, a.minLevel);
      try {
        const { status, json } = await callApi(cfg, session, tenantId, a.method, path, a.body?.());
        // RBAC correctness: deny ⇒ 403; allow ⇒ anything != 403/401 (400/422 = passed the guard, invalid body).
        const rbacPass = allow ? status !== 403 && status !== 401 : status === 403;
        records.push({ role: session.role, tenantId, controller: ctrl.name, resource: ctrl.resource, action: a.kind, method: a.method, path, status, expectedAllow: allow, rbacPass });
        if (a.kind === 'create' && status >= 200 && status < 300 && json?.id) {
          created.push({ ctrl, tenantId, session, id: String(json.id) });
        }
      } catch (e) {
        records.push({ role: session.role, tenantId, controller: ctrl.name, resource: ctrl.resource, action: a.kind, method: a.method, path, status: 0, expectedAllow: allow, rbacPass: false, error: (e as Error).message });
      }
    }
  };

  // 2) Full pass: roles × tenants × controllers × actions
  for (const session of sessions) {
    for (const tenantId of cfg.tenants) {
      for (const ctrl of MATRIX) await exec(session, tenantId, ctrl);
    }
  }

  // 3) Repeat READS until the request target is reached
  let guard = 0;
  while (records.length < cfg.targets.requests && guard < 50) {
    guard++;
    for (const session of sessions) {
      for (const tenantId of cfg.tenants) {
        for (const ctrl of MATRIX) {
          if (records.length >= cfg.targets.requests) break;
          const path = ctrl.basePath;
          try {
            const { status } = await callApi(cfg, session, tenantId, 'GET', path);
            records.push({ role: session.role, tenantId, controller: ctrl.name, resource: ctrl.resource, action: 'list', method: 'GET', path, status, expectedAllow: true, rbacPass: status !== 403 && status !== 401 });
          } catch { /* ignora */ }
        }
      }
    }
  }

  // 4) Best-effort cleanup (only what the harness created; respects RBAC)
  let cleaned = 0, cleanupBlocked = 0;
  for (const c of created) {
    try {
      const { status } = await callApi(cfg, c.session, c.tenantId, 'DELETE', `${c.ctrl.basePath}/${c.id}`);
      if (status >= 200 && status < 300) cleaned++; else cleanupBlocked++;
    } catch { cleanupBlocked++; }
  }

  await reportHarness({ runId, cfg, records, createdCount: created.length, cleaned, cleanupBlocked });
}

main().catch((e) => { console.error('[harness] ERROR:', e?.message ?? e); process.exit(1); });
