/**
 * test/e2e/rls/rls-isolation.e2e-spec.ts  ·  PHASE 3B
 *
 * REUSABLE harness for multi-tenant isolation via REAL RLS against PostgreSQL.
 *
 * Two connections:
 *   - OWNER (DATABASE_URL, role bypassrls=true): seeds/cleans rows for both
 *     tenants without being blocked by RLS — simulates only the fixture.
 *   - APP   (APP_DATABASE_URL, role musicos_app, NOBYPASSRLS): runs the
 *     operations UNDER RLS, with the tenant context injected per transaction
 *     via `set_config('app.current_tenant_id', <uuid>, true)` — exactly the
 *     runtime mechanism (private_get_tenant_id() reads this GUC).
 *
 * For each table validates: isolated SELECT (A sees A / does not see B, and
 * vice versa), isolated INSERT (valid passes; cross-tenant is blocked by
 * WITH CHECK), cross-tenant UPDATE blocked (0 rows), cross-tenant DELETE
 * blocked (0).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';

// Both tenants are REAL (exist in the tenants table) — necessary because
// marketing_content_posts has FK tenant_id → tenants. For the other tables
// (without that FK) any distinct pair would work; real tenants work for all.
const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = 'fb6f3d4f-6161-4b55-8e4f-b4443c509b7c';

function readEnv(key: string): string {
  // An explicitly-provided process env must always win over .env.development.
  const envPath = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

async function ensureE2eTenants(owner: DataSource): Promise<void> {
  const organizationId = '90000000-0000-0000-0000-000000000001';

  await owner.query(
    `
      INSERT INTO organizations (
        id,
        name,
        slug,
        plan,
        billing_status,
        industry,
        address,
        config,
        metadata
      )
      VALUES (
        $1,
        'MUSIC OS 360 E2E',
        'music-os-360-e2e',
        'starter',
        'trial',
        'gravadora',
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
    `,
    [organizationId],
  );

  await owner.query(
    `
      INSERT INTO tenants (
        id,
        org_id,
        name,
        slug,
        plan,
        features,
        settings,
        active
      )
      VALUES
        (
          $1,
          $3,
          'MUSIC OS 360 E2E Tenant A',
          'music-os-360-e2e-tenant-a',
          'starter',
          '{}'::jsonb,
          '{}'::jsonb,
          true
        ),
        (
          $2,
          $3,
          'MUSIC OS 360 E2E Tenant B',
          'music-os-360-e2e-tenant-b',
          'starter',
          '{}'::jsonb,
          '{}'::jsonb,
          true
        )
      ON CONFLICT (id) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        name = EXCLUDED.name,
        active = true,
        updated_at = NOW()
    `,
    [TENANT_A, TENANT_B, organizationId],
  );

  const rows = await owner.query(
    `
      SELECT id
      FROM tenants
      WHERE id = ANY($1::uuid[])
      ORDER BY id
    `,
    [[TENANT_A, TENANT_B]],
  );

  if (rows.length !== 2) {
    throw new Error(
      `Failed to create E2E tenants: expected 2, found ${rows.length}`,
    );
  }
}

/**
 * Extra required columns (besides id + tenant_id) per table.
 * `extra` receives the map of already-seeded FKs (fkCol → id of the current
 * tenant's parent).
 * `parents` lists parents to seed per tenant when the FK column references
 * another tenanted table (e.g.: artist_platform_profiles.artist_id → artists).
 */
type ExtraFn = (fk: Record<string, string>) => Record<string, string>;
interface ParentCfg { fkCol: string; table: string; extra: () => Record<string, string>; }
interface TableCfg {
  table: string;
  extra: ExtraFn;
  parents?: ParentCfg[];
  replaceFixtureForValidInsert?: boolean;
}

const SUBLOTE_A: TableCfg[] = [
  { table: 'inventory_items', extra: () => ({ name: 'RLS_TEST' }) },
  { table: 'licenses',        extra: () => ({ title: 'RLS_TEST' }) },
  { table: 'financial_rules', extra: () => ({ name: 'RLS_TEST', type: 'receita' }) },
];
const SUBLOTE_B: TableCfg[] = [
  { table: 'assets',           extra: () => ({ name: 'RLS_TEST', source: 'upload' }) },
  { table: 'asset_versions',   extra: () => ({ asset_id: randomUUID(), file_url: 'http://x/a' }) },
  { table: 'project_assets',   extra: () => ({ project_id: randomUUID(), asset_id: randomUUID() }) },
  { table: 'task_assets',      extra: () => ({ task_id: randomUUID(), asset_id: randomUUID() }) },
  { table: 'asset_usage_logs', extra: () => ({ asset_id: randomUUID(), action: 'view' }) },
];

// PHASE 3D — Batch 3C-A (19 tables). uuid columns without FK use a random
// uuid; the 3 with a real FK seed the parent per tenant via `parents`.
const SUBLOTE_3CA: TableCfg[] = [
  { table: 'audiovisual_projects',        extra: () => ({ title: 'RLS_TEST' }) },
  { table: 'audiovisual_briefings',       extra: () => ({ audiovisual_project_id: randomUUID() }) },
  { table: 'audiovisual_shots',           extra: () => ({ audiovisual_project_id: randomUUID() }) },
  { table: 'audiovisual_production_days',  extra: () => ({ audiovisual_project_id: randomUUID(), shooting_date: '2026-06-13' }) },
  { table: 'audiovisual_team_members',    extra: () => ({ audiovisual_project_id: randomUUID() }) },
  { table: 'audiovisual_deliverables',    extra: () => ({ audiovisual_project_id: randomUUID(), title: 'RLS_TEST' }) },
  { table: 'audiovisual_approvals',       extra: () => ({ audiovisual_project_id: randomUUID() }) },
  { table: 'audiovisual_tasks',           extra: () => ({ audiovisual_project_id: randomUUID(), title: 'RLS_TEST' }) },
  { table: 'audiovisual_assets',          extra: () => ({ audiovisual_project_id: randomUUID(), name: 'RLS_TEST', file_url: 'http://x/a' }) },
  { table: 'rights_holders',              extra: () => ({ legal_name: 'RLS_TEST' }) },
  { table: 'external_identifiers',        extra: () => ({ entity_type: 'WORK', entity_id: randomUUID(), provider: 'ECAD', identifier_type: 'ISRC', identifier_value: 'ISRC_' + randomUUID().slice(0, 12) }) },
  { table: 'society_accounts',            extra: () => ({ society: 'ECAD', driver: 'MANUAL_EXPORT', account_name: 'RLS_TEST' }) },
  { table: 'society_submissions',         extra: () => ({ society: 'ECAD', driver: 'MANUAL_EXPORT', entity_type: 'WORK', entity_id: randomUUID() }) },
  { table: 'society_submission_events',   parents: [{ fkCol: 'submission_id', table: 'society_submissions', extra: () => ({ society: 'ECAD', driver: 'MANUAL_EXPORT', entity_type: 'WORK', entity_id: randomUUID() }) }],
                                          extra: (fk) => ({ submission_id: fk.submission_id, event_type: 'created' }) },
  { table: 'society_payload_snapshots',   parents: [{ fkCol: 'submission_id', table: 'society_submissions', extra: () => ({ society: 'ECAD', driver: 'MANUAL_EXPORT', entity_type: 'WORK', entity_id: randomUUID() }) }],
                                          // version unique per call → does not collide with UNIQUE(submission_id, version)
                                          extra: (fk) => ({ submission_id: fk.submission_id, version: String(Math.floor(Math.random() * 1e9)), payload: '{}', payload_hash: 'h' }) },
  { table: 'society_validation_errors',   extra: () => ({ entity_type: 'WORK', entity_id: randomUUID(), severity: 'ERROR', code: 'E1', message: 'x' }) },
  { table: 'society_sync_jobs',           extra: () => ({ society: 'ECAD', driver: 'MANUAL_EXPORT' }) },
  { table: 'marketing_content_posts',     extra: () => ({ title: 'RLS_TEST', target_type: 'artist', target_name: 'X', channel: 'instagram', content_type: 'post', publish_date: '2026-06-13', publish_time: '10:00', scheduled_for: '2026-06-13T10:00:00Z', copy: 'x' }) },
  { table: 'artist_platform_profiles',    parents: [{ fkCol: 'artist_id', table: 'artists', extra: () => ({ nome_artistico: 'RLS_PARENT' }) }],
                                          // platform unique per call → does not collide with UNIQUE(tenant_id, artist_id, platform)
                                          extra: (fk) => ({ artist_id: fk.artist_id, platform: 'spotify_' + randomUUID().slice(0, 8) }) },
];

const SUBLOTE_MUSICCHAT_AUTOMATION: TableCfg[] = [
  {
    table: 'musicchat_automation_settings',
    replaceFixtureForValidInsert: true,
    extra: () => ({
      welcome_message: 'RLS_TEST',
      main_menu_message: 'RLS_TEST',
      menu_options: '[]',
      templates: '[]',
      required_fields: '[]',
      optional_fields: '[]',
      invalid_option_message: 'RLS_TEST',
      absence_message: 'RLS_TEST',
      out_of_hours_message: 'RLS_TEST',
      closing_message: 'RLS_TEST',
    }),
  },
  {
    table: 'musicchat_automation_events',
    extra: () => ({ event_type: 'rls.test', summary: 'RLS_TEST' }),
  },
  {
    table: 'musicchat_automation_notifications',
    parents: [{
      fkCol: 'conversation_id',
      table: 'conversations',
      extra: () => ({ subject: 'RLS_MUSICCHAT_PARENT' }),
    }],
    extra: (fk) => ({
      conversation_id: fk.conversation_id,
      level: `rls_${randomUUID().slice(0, 8)}`,
      channel: 'in_app',
      recipient_user_id: 'rls-test-user',
      title: 'RLS_TEST',
    }),
  },
];

const SUBLOTE_SKILL_WORKFLOW_EXECUTIONS: TableCfg[] = [
  {
    table: 'skill_runs',
    extra: () => ({
      skill_name: `rls-test-${randomUUID().slice(0, 8)}`,
    }),
  },
  {
    table: 'workflow_executions',
    extra: () => ({
      rule_id: `rls-test-${randomUUID().slice(0, 8)}`,
      rule_name: 'RLS_TEST',
      event_type: 'rls.test',
    }),
  },
];

// PHASE 3V-A — representatives of the 3 harmonized families (RAW ::uuid → standard).
// Same uniform policy applied to all 21; here we validate the behavior.
const SUBLOTE_HARMONIZED_3VA: TableCfg[] = [
  { table: 'conversations',    extra: () => ({}) },                                  // FORCE-RLS
  // 'forms' removed: table dropped by DropGenericFormsModule20260822000005
  // (deliberate product decision — the generic forms module was retired).
  { table: 'marketing_assets', extra: () => ({ title: 'RLS_TEST', asset_type: 'COVER' }) },
];

// PHASE 3V-B — representatives of the 2 harmonized families (RAW ::text → standard).
// financial_* (FORCE ON) and marketing_* (FORCE OFF); identical policy to the 15.
const SUBLOTE_HARMONIZED_3VB: TableCfg[] = [
  {
    table: 'financial_categories',
    extra: () => ({
      name: `RLS_TEST_${randomUUID().slice(0, 8)}`,
      nature: 'operating_expense',
      level: '1',
    }),
  },
  { table: 'marketing_projects', extra: () => ({ type: 'ARTIST', title: 'RLS_TEST' }) },
];

describe('RLS isolation harness (PHASE 3B) — real PostgreSQL', () => {
  let owner: DataSource;
  let app: DataSource;

  beforeAll(async () => {
    const ownerUrl = readEnv('DATABASE_URL');
    const appUrl = readEnv('APP_DATABASE_URL');
    owner = await new DataSource({ type: 'postgres', url: ownerUrl, ssl: false }).initialize();
    await ensureE2eTenants(owner);
    app = await new DataSource({ type: 'postgres', url: appUrl, ssl: false }).initialize();

    // Harness precondition: app role must NOT have bypassrls (otherwise the test is empty).
    const who = await app.query(
      `SELECT current_user cu, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) b`,
    );
    if (who[0].b === true) {
      throw new Error(`APP role ${who[0].cu} has bypassrls=true — RLS would not be exercised`);
    }
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) await owner.destroy();
    if (app?.isInitialized) await app.destroy();
  });

  /** Runs fn under the given tenant context (isolated transaction, rollback). */
  async function asTenant<T>(tenantId: string, fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = app.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return await fn(qr);
    } finally {
      await qr.rollbackTransaction().catch(() => undefined);
      await qr.release();
    }
  }

  // TypeORM may return `rows` or the tuple `[rows, affected]`; normalizes to the RETURNING rows.
  const returnedRows = (r: unknown): unknown[] => {
    if (Array.isArray(r) && Array.isArray(r[0])) return r[0] as unknown[]; // [rows, affected]
    return Array.isArray(r) ? (r as unknown[]) : [];
  };
  const cols = (extra: Record<string, string>) => Object.keys(extra);
  const insertSql = (table: string, extra: Record<string, string>) => {
    const c = ['id', 'tenant_id', ...cols(extra)];
    const ph = c.map((_, i) => `$${i + 1}`).join(', ');
    return `INSERT INTO "${table}" (${c.map((x) => `"${x}"`).join(', ')}) VALUES (${ph})`;
  };

  const ALL = [
    ...SUBLOTE_A,
    ...SUBLOTE_B,
    ...SUBLOTE_3CA,
    ...SUBLOTE_MUSICCHAT_AUTOMATION,
    ...SUBLOTE_SKILL_WORKFLOW_EXECUTIONS,
    ...SUBLOTE_HARMONIZED_3VA,
    ...SUBLOTE_HARMONIZED_3VB,
  ];

  describe.each(ALL)('%s', (cfg: TableCfg) => {
    const {
      table,
      extra,
      parents = [],
      replaceFixtureForValidInsert = false,
    } = cfg;
    const idA = randomUUID();
    const idB = randomUUID();
    let fkA: Record<string, string> = {};
    let fkB: Record<string, string> = {};
    const createdParents: Array<[string, string]> = []; // [table, id] for cleanup

    /** Seeds (via OWNER) the tenant's FK parents and returns { fkCol → id }. */
    async function seedParents(tenantId: string): Promise<Record<string, string>> {
      const fk: Record<string, string> = {};
      for (const p of parents) {
        const pid = randomUUID();
        const pe = p.extra();
        await owner.query(insertSql(p.table, pe), [pid, tenantId, ...Object.values(pe)]);
        createdParents.push([p.table, pid]);
        fk[p.fkCol] = pid;
      }
      return fk;
    }

    beforeAll(async () => {
      fkA = await seedParents(TENANT_A);
      fkB = await seedParents(TENANT_B);
      const ea = extra(fkA); const eb = extra(fkB);
      await owner.query(insertSql(table, ea), [idA, TENANT_A, ...Object.values(ea)]);
      await owner.query(insertSql(table, eb), [idB, TENANT_B, ...Object.values(eb)]);
    });

    afterAll(async () => {
      await owner.query(`DELETE FROM "${table}" WHERE id IN ($1,$2)`, [idA, idB]);
      for (const [ptable, pid] of createdParents.reverse()) {
        await owner.query(`DELETE FROM "${ptable}" WHERE id = $1`, [pid]);
      }
    });

    it('isolated SELECT: A sees A and does NOT see B; B sees B and does NOT see A', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const a = await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idA]);
        const b = await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]);
        expect(a[0].n).toBe(1);
        expect(b[0].n).toBe(0);
      });
      await asTenant(TENANT_B, async (qr) => {
        const a = await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idA]);
        const b = await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]);
        expect(a[0].n).toBe(0);
        expect(b[0].n).toBe(1);
      });
    });

    it('isolated INSERT: valid (current tenant) passes; cross-tenant is BLOCKED', async () => {
      // valid (context A, tenant_id A) → passes and is visible only to A
      await asTenant(TENANT_A, async (qr) => {
        const ev = extra(fkA); const newId = randomUUID();
        if (replaceFixtureForValidInsert) {
          await qr.query(`DELETE FROM "${table}" WHERE id=$1`, [idA]);
        }
        await qr.query(insertSql(table, ev), [newId, TENANT_A, ...Object.values(ev)]);
        const n = await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [newId]);
        expect(n[0].n).toBe(1); // rollback discards it afterward
      });
      // cross-tenant (context A, tenant_id B) → WITH CHECK rejects
      let blocked = false; let code = '';
      await asTenant(TENANT_A, async (qr) => {
        const ev = extra(fkB); const newId = randomUUID();
        try {
          await qr.query(insertSql(table, ev), [newId, TENANT_B, ...Object.values(ev)]);
        } catch (e) {
          blocked = true;
          code = (e as { driverError?: { code?: string }; code?: string }).driverError?.code
            ?? (e as { code?: string }).code ?? '';
        }
      });
      expect(blocked).toBe(true);
      expect(code).toBe('42501'); // insufficient_privilege (RLS WITH CHECK)
    });

    it('cross-tenant UPDATE is blocked (0 rows affected; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        // RETURNING id → rows affected = number of rows returned (B invisible to A → 0)
        const r = await qr.query(`UPDATE "${table}" SET tenant_id = tenant_id WHERE id=$1 RETURNING id`, [idB]);
        expect(returnedRows(r).length).toBe(0);
      });
      const still = await owner.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]);
      expect(still[0].n).toBe(1); // B still exists
    });

    it('cross-tenant DELETE is blocked (0 rows affected; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const r = await qr.query(`DELETE FROM "${table}" WHERE id=$1 RETURNING id`, [idB]);
        expect(returnedRows(r).length).toBe(0);
      });
      const still = await owner.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]);
      expect(still[0].n).toBe(1); // B was not deleted by A
    });
  });

  // ── PHASE 3F — composite key + tenant inheritance via FK (release_works) ──
  // Reuses owner/app/asTenant/returnedRows; identity via (release_id, work_id),
  // since the table has no id column. Isolation inherited from releases AND works.
  describe('release_works (composite key, FK inheritance)', () => {
    let relA = '', wrkA = '', relB = '', wrkB = '', relA2 = '', wrkA2 = '';

    const insRelease = async (tenantId: string) => {
      const id = randomUUID();
      await owner.query(`INSERT INTO "releases" (id, tenant_id, title) VALUES ($1,$2,'RW_REL')`, [id, tenantId]);
      return id;
    };
    const insWork = async (tenantId: string) => {
      const id = randomUUID();
      await owner.query(`INSERT INTO "works" (id, tenant_id, title, type) VALUES ($1,$2,'RW_WORK','single')`, [id, tenantId]);
      return id;
    };
    const cnt = async (qr: QueryRunner, rel: string, wrk: string): Promise<number> =>
      (await qr.query(`SELECT count(*)::int n FROM "release_works" WHERE release_id=$1 AND work_id=$2`, [rel, wrk]))[0].n;

    beforeAll(async () => {
      relA = await insRelease(TENANT_A); wrkA = await insWork(TENANT_A);
      relB = await insRelease(TENANT_B); wrkB = await insWork(TENANT_B);
      relA2 = await insRelease(TENANT_A); wrkA2 = await insWork(TENANT_A); // extra A pair for valid INSERT
      await owner.query(`INSERT INTO "release_works" (release_id, work_id) VALUES ($1,$2)`, [relA, wrkA]);
      await owner.query(`INSERT INTO "release_works" (release_id, work_id) VALUES ($1,$2)`, [relB, wrkB]);
    });

    afterAll(async () => {
      await owner.query(`DELETE FROM "release_works" WHERE release_id = ANY($1) OR work_id = ANY($2)`,
        [[relA, relB, relA2], [wrkA, wrkB, wrkA2]]);
      await owner.query(`DELETE FROM "works" WHERE id = ANY($1)`, [[wrkA, wrkB, wrkA2]]);
      await owner.query(`DELETE FROM "releases" WHERE id = ANY($1)`, [[relA, relB, relA2]]);
    });

    it('isolated SELECT: A sees (relA,wrkA) and does not see (relB,wrkB); B the reverse', async () => {
      await asTenant(TENANT_A, async (qr) => {
        expect(await cnt(qr, relA, wrkA)).toBe(1);
        expect(await cnt(qr, relB, wrkB)).toBe(0);
      });
      await asTenant(TENANT_B, async (qr) => {
        expect(await cnt(qr, relB, wrkB)).toBe(1);
        expect(await cnt(qr, relA, wrkA)).toBe(0);
      });
    });

    it('valid INSERT (both parents tenant A) passes; cross-tenant (relA,wrkB) and (relB,wrkA) → 42501', async () => {
      // valid: new pair, both tenant A
      await asTenant(TENANT_A, async (qr) => {
        await qr.query(`INSERT INTO "release_works" (release_id, work_id) VALUES ($1,$2)`, [relA2, wrkA2]);
        expect(await cnt(qr, relA2, wrkA2)).toBe(1); // rollback discards it
      });
      // cross-tenant: release A + work B → 2nd EXISTS fails
      const mix = async (rel: string, wrk: string): Promise<string> => {
        let code = '';
        await asTenant(TENANT_A, async (qr) => {
          try { await qr.query(`INSERT INTO "release_works" (release_id, work_id) VALUES ($1,$2)`, [rel, wrk]); }
          catch (e) {
            code = (e as { driverError?: { code?: string }; code?: string }).driverError?.code
              ?? (e as { code?: string }).code ?? '';
          }
        });
        return code;
      };
      expect(await mix(relA, wrkB)).toBe('42501'); // work from another tenant
      expect(await mix(relB, wrkA)).toBe('42501'); // release from another tenant
    });

    it('cross-tenant UPDATE is blocked (0 rows affected; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const r = await qr.query(
          `UPDATE "release_works" SET work_id = work_id WHERE release_id=$1 AND work_id=$2 RETURNING release_id`,
          [relB, wrkB],
        );
        expect(returnedRows(r).length).toBe(0);
      });
      const still = await owner.query(
        `SELECT count(*)::int n FROM "release_works" WHERE release_id=$1 AND work_id=$2`, [relB, wrkB]);
      expect(still[0].n).toBe(1);
    });

    it('cross-tenant DELETE is blocked (0 rows affected; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const r = await qr.query(
          `DELETE FROM "release_works" WHERE release_id=$1 AND work_id=$2 RETURNING release_id`, [relB, wrkB]);
        expect(returnedRows(r).length).toBe(0);
      });
      const still = await owner.query(
        `SELECT count(*)::int n FROM "release_works" WHERE release_id=$1 AND work_id=$2`, [relB, wrkB]);
      expect(still[0].n).toBe(1);
    });
  });

  // ── PHASE 3T — logs without tenant_id, inheritance via FK to tenanted parent ──
  // Identity via `id`; isolation via EXISTS on the parent (skill_runs / workflow_executions).
  const LOG_SPECS = [
    {
      table: 'skill_run_logs', fkCol: 'skill_run_id', parent: 'skill_runs',
      parentCols: (tenant: string) => ({ tenant_id: tenant, skill_name: 'RLS_PARENT' }),
      logCols: (fk: string) => ({ skill_run_id: fk, message: 'RLS_TEST' }),
    },
    {
      table: 'workflow_execution_logs', fkCol: 'execution_id', parent: 'workflow_executions',
      parentCols: (tenant: string) => ({ tenant_id: tenant, rule_id: 'r', rule_name: 'R', event_type: 'e' }),
      logCols: (fk: string) => ({ execution_id: fk, action_type: 'a', status: 'pending' }),
    },
  ];

  describe.each(LOG_SPECS)('$table (log without tenant_id, FK inheritance)', (spec) => {
    const { table, fkCol, parent, parentCols, logCols } = spec;
    let parentA = '', parentB = '';
    const idA = randomUUID();
    const idB = randomUUID();

    const insRow = async (tbl: string, cols: Record<string, string>): Promise<string> => {
      const id = randomUUID();
      const keys = ['id', ...Object.keys(cols)];
      const ph = keys.map((_, i) => `$${i + 1}`).join(', ');
      await owner.query(`INSERT INTO "${tbl}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${ph})`,
        [id, ...Object.values(cols)]);
      return id;
    };
    const cntById = async (qr: QueryRunner, id: string): Promise<number> =>
      (await qr.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [id]))[0].n;

    beforeAll(async () => {
      parentA = await insRow(parent, parentCols(TENANT_A));
      parentB = await insRow(parent, parentCols(TENANT_B));
      // logs with explicit id pointing to the respective tenant's parent
      await owner.query(`INSERT INTO "${table}" ("id","${fkCol}",${Object.keys(logCols(parentA)).filter((k) => k !== fkCol).map((k) => `"${k}"`).join(',')}) VALUES ($1,$2,${Object.keys(logCols(parentA)).filter((k) => k !== fkCol).map((_, i) => `$${i + 3}`).join(',')})`,
        [idA, parentA, ...Object.entries(logCols(parentA)).filter(([k]) => k !== fkCol).map(([, v]) => v)]);
      await owner.query(`INSERT INTO "${table}" ("id","${fkCol}",${Object.keys(logCols(parentB)).filter((k) => k !== fkCol).map((k) => `"${k}"`).join(',')}) VALUES ($1,$2,${Object.keys(logCols(parentB)).filter((k) => k !== fkCol).map((_, i) => `$${i + 3}`).join(',')})`,
        [idB, parentB, ...Object.entries(logCols(parentB)).filter(([k]) => k !== fkCol).map(([, v]) => v)]);
    });

    afterAll(async () => {
      await owner.query(`DELETE FROM "${table}" WHERE id IN ($1,$2)`, [idA, idB]);
      await owner.query(`DELETE FROM "${parent}" WHERE id IN ($1,$2)`, [parentA, parentB]);
    });

    const insLog = async (qr: QueryRunner, fk: string): Promise<void> => {
      const cols = logCols(fk);
      const keys = ['id', ...Object.keys(cols)];
      const ph = keys.map((_, i) => `$${i + 1}`).join(', ');
      await qr.query(`INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${ph})`,
        [randomUUID(), ...Object.values(cols)]);
    };

    it('isolated SELECT: A sees log A and does not see log B; B the reverse', async () => {
      await asTenant(TENANT_A, async (qr) => {
        expect(await cntById(qr, idA)).toBe(1);
        expect(await cntById(qr, idB)).toBe(0);
      });
      await asTenant(TENANT_B, async (qr) => {
        expect(await cntById(qr, idA)).toBe(0);
        expect(await cntById(qr, idB)).toBe(1);
      });
    });

    it('valid INSERT (current tenant\'s parent) passes; cross-tenant (other tenant\'s parent) → 42501', async () => {
      await asTenant(TENANT_A, async (qr) => { await insLog(qr, parentA); }); // valid
      let code = '';
      await asTenant(TENANT_A, async (qr) => {
        try { await insLog(qr, parentB); } // log pointing to tenant B's parent
        catch (e) {
          code = (e as { driverError?: { code?: string }; code?: string }).driverError?.code
            ?? (e as { code?: string }).code ?? '';
        }
      });
      expect(code).toBe('42501');
    });

    it('cross-tenant UPDATE blocked (0 rows; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const r = await qr.query(`UPDATE "${table}" SET ${fkCol} = ${fkCol} WHERE id=$1 RETURNING id`, [idB]);
        expect(returnedRows(r).length).toBe(0);
      });
      expect((await owner.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]))[0].n).toBe(1);
    });

    it('cross-tenant DELETE blocked (0 rows; B intact)', async () => {
      await asTenant(TENANT_A, async (qr) => {
        const r = await qr.query(`DELETE FROM "${table}" WHERE id=$1 RETURNING id`, [idB]);
        expect(returnedRows(r).length).toBe(0);
      });
      expect((await owner.query(`SELECT count(*)::int n FROM "${table}" WHERE id=$1`, [idB]))[0].n).toBe(1);
    });
  });
});