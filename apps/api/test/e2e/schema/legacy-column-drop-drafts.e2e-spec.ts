/**
 * LC1 legacy column drop drafts against a REAL disposable PostgreSQL (docs/engineering/legacy-column-drop-plan.md).
 *
 * Safety: DATABASE_URL must point at a LOCAL disposable BASE database (host 127.0.0.1/localhost, name `music_os_*`)
 * already migrated with the repository migrations. The spec creates its own COPY (`CREATE DATABASE <copy> TEMPLATE
 * <base>`), runs every DROP against the copy ONLY, and drops the copy at the end. The base is never written.
 * The drafts are imported directly (they are, and must stay, unregistered in migrations/index.ts).
 *
 * Per group: seed representative legacy rows, preflight counts (printed as `PREFLIGHT ...`), negative abort with
 * nothing dropped, up() -> archive exists + columns gone, down() -> values restored by id, up() again.
 */
import { Client } from 'pg';
import { CONFIRM_ENV, CONFIRM_TOKEN, DropTablePlan, archiveOf, archiveTableOf } from '../../../src/database/migration-drafts/legacy-column-drop.base';
import { DropWorksLegacyColumns20260930000040, PLANS as WORKS } from '../../../src/database/migration-drafts/20260930000040_DropWorksLegacyColumns';
import { DropPhonogramsLegacyColumns20260930000041, PLANS as PHONOGRAMS } from '../../../src/database/migration-drafts/20260930000041_DropPhonogramsLegacyColumns';
import { DropTransactionsLegacyColumns20260930000042, PLANS as TRANSACTIONS } from '../../../src/database/migration-drafts/20260930000042_DropTransactionsLegacyColumns';
import { DropClientsLegacyContactStatus20260930000043, PLANS as CLIENTS } from '../../../src/database/migration-drafts/20260930000043_DropClientsLegacyContactStatus';
import { DropSharesLegacyArtistProjectId20260930000044, PLANS as SHARES } from '../../../src/database/migration-drafts/20260930000044_DropSharesLegacyArtistProjectId';
import { DropHrLegacyMirrors20260930000045, PLANS as HR } from '../../../src/database/migration-drafts/20260930000045_DropHrLegacyMirrors';
import { DropEmployeesLegacyPiiColumns20260930000053, PLANS as EMPLOYEES_PII } from '../../../src/database/migration-drafts/20260930000053_DropEmployeesLegacyPiiColumns';
import { DropEventsDataAndSyncTrigger20260930000046 } from '../../../src/database/migration-drafts/20260930000046_DropEventsDataAndSyncTrigger';

const T = '10000000-0000-0000-0000-000000000002';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const E1 = id(9001), E2 = id(9002);

type Migration = { name: string; up(q: unknown): Promise<void>; down(q: unknown): Promise<void> };

interface Group {
  name: string;
  migration: Migration;
  plans: readonly DropTablePlan[];
  /** Seed rows (consistent with the canonical columns: preflight must be 0) and return nothing. */
  seed: string[];
  /** One extra row that violates exactly the named check (label -> table), so up() must abort. */
  /** Absent when the plan has no machine check (employees PII: no canonical counterpart, the owner census is the gate). */
  violation?: { prepare?: string; table: string; insert: string; expect: string };
  archivedIds: Record<string, string[]>;
}

const GROUPS: Group[] = [
  {
    name: 'works', migration: new DropWorksLegacyColumns20260930000040(), plans: WORKS,
    seed: [
      `INSERT INTO works (id, tenant_id, title, type, language, is_instrumental, ai_used, alternative_titles, lyrics,
         legacy_language_label, legacy_instrumental_flag, legacy_ai_used, legacy_alternative_titles, legacy_lyrics)
       VALUES ('${id(1)}', '${T}', 'W1', 'song', 'pt', true, false, '["Alt"]', 'la la',
         'pt', 'true', false, '["Alt"]', 'la la')`,
      `INSERT INTO works (id, tenant_id, title, type) VALUES ('${id(2)}', '${T}', 'W2 no legacy', 'song')`,
    ],
    violation: { table: 'works', insert: `INSERT INTO works (id, tenant_id, title, type, legacy_lyrics) VALUES ('${id(3)}', '${T}', 'W3 bad', 'song', 'orphan lyrics')`, expect: 'works:lyrics_without_lyrics=1' },
    archivedIds: { works: [id(1)] },
  },
  {
    name: 'phonograms', migration: new DropPhonogramsLegacyColumns20260930000041(), plans: PHONOGRAMS,
    seed: [
      `INSERT INTO phonograms (id, tenant_id, title, type, recording_date, release_date, duration_seconds, country_of_recording,
         legacy_recording_date, legacy_release_date, legacy_duration_minutes, legacy_duration_seconds_part, legacy_origin_country)
       VALUES ('${id(11)}', '${T}', 'P1', 'master', '2020-01-02', '2021-03-04', 215, 'BR', '2020-01-02', '2021-03-04', 3, 35, 'Brasil')`,
      `INSERT INTO phonograms (id, tenant_id, title, type) VALUES ('${id(12)}', '${T}', 'P2 no legacy', 'master')`,
    ],
    violation: { table: 'phonograms', insert: `INSERT INTO phonograms (id, tenant_id, title, type, legacy_origin_country) VALUES ('${id(13)}', '${T}', 'P3 bad', 'master', 'Chile')`, expect: 'phonograms:country_of_recording_missing=1' },
    archivedIds: { phonograms: [id(11)] },
  },
  {
    name: 'transactions', migration: new DropTransactionsLegacyColumns20260930000042(), plans: TRANSACTIONS,
    seed: [
      `INSERT INTO transactions (id, tenant_id, type, category, amount, transaction_date, attachment_url, notes,
         legacy_transaction_type, legacy_transaction_date, legacy_attachment_url, legacy_reference)
       VALUES ('${id(21)}', '${T}', 'revenue', 'sales', 10.50, '2024-05-06', 'https://x.invalid/a.pdf', 'ref-1',
         'receita', '2024-05-06', 'https://x.invalid/a.pdf', 'ref-1')`,
      `INSERT INTO transactions (id, tenant_id, type, category, amount, transaction_date) VALUES ('${id(22)}', '${T}', 'expense', 'rent', 5, '2024-05-07')`,
    ],
    violation: { table: 'transactions', insert: `INSERT INTO transactions (id, tenant_id, type, category, amount, transaction_date, legacy_attachment_url) VALUES ('${id(23)}', '${T}', 'expense', 'rent', 1, '2024-05-08', 'https://x.invalid/b.pdf')`, expect: 'transactions:attachment_url_missing=1' },
    archivedIds: { transactions: [id(21)] },
  },
  {
    name: 'clients', migration: new DropClientsLegacyContactStatus20260930000043(), plans: CLIENTS,
    seed: [
      `INSERT INTO clients (id, tenant_id, category, profile, name, status, legacy_contact_status) VALUES ('${id(31)}', '${T}', 'label', 'b2b', 'C1', 'active', 'ativo')`,
      `INSERT INTO clients (id, tenant_id, category, profile, name, status) VALUES ('${id(32)}', '${T}', 'label', 'b2b', 'C2 no legacy', 'active')`,
    ],
    violation: { prepare: `ALTER TABLE clients DROP CONSTRAINT chk_clients_status`, table: 'clients', insert: `INSERT INTO clients (id, tenant_id, category, profile, name, status, legacy_contact_status) VALUES ('${id(33)}', '${T}', 'label', 'b2b', 'C3 bad', '', 'ativo')`, expect: 'clients:contact_status_without_status=1' },
    archivedIds: { clients: [id(31)] },
  },
  {
    name: 'shares', migration: new DropSharesLegacyArtistProjectId20260930000044(), plans: SHARES,
    seed: [
      `INSERT INTO shares (id, tenant_id, artist_id, legacy_artist_project_id) VALUES ('${id(41)}', '${T}', '${id(500)}', '${id(500)}')`,
      `INSERT INTO shares (id, tenant_id) VALUES ('${id(42)}', '${T}')`,
    ],
    violation: { table: 'shares', insert: `INSERT INTO shares (id, tenant_id, artist_id, legacy_artist_project_id) VALUES ('${id(43)}', '${T}', '${id(501)}', '${id(502)}')`, expect: 'shares:artist_project_id_differs_from_artist_id=1' },
    archivedIds: { shares: [id(41)] },
  },
  {
    name: 'hr', migration: new DropHrLegacyMirrors20260930000045(), plans: HR,
    seed: [
      `INSERT INTO employees (id, tenant_id, name, department, salary, legacy_full_name, legacy_sector, legacy_base_salary)
       VALUES ('${id(51)}', '${T}', 'Emp One', 'Ops', 1234.56, 'Emp One', 'Ops', 1234.56)`,
      `INSERT INTO employees (id, tenant_id, name) VALUES ('${id(52)}', '${T}', 'Emp Two no legacy')`,
      `INSERT INTO payroll_entries (id, tenant_id, employee_id, legacy_employee_id, reference_month, legacy_reference_month, gross_salary, net_salary)
       VALUES ('${id(61)}', '${T}', '${id(51)}', '${id(51)}', '2024-05', '2024-05', 1234.56, 1000)`,
      `INSERT INTO leave_requests (id, tenant_id, employee_id, legacy_employee_id, type, start_date, end_date)
       VALUES ('${id(71)}', '${T}', '${id(51)}', '${id(51)}', 'vacation', '2024-06-01', '2024-06-10')`,
    ],
    violation: { table: 'employees', insert: `INSERT INTO employees (id, tenant_id, name, legacy_full_name) VALUES ('${id(53)}', '${T}', 'Emp Three', 'Other Name')`, expect: 'employees:full_name_differs_from_name=1' },
    archivedIds: { employees: [id(51)], payroll_entries: [id(61)], leave_requests: [id(71)] },
  },
  {
    name: 'employees-pii', migration: new DropEmployeesLegacyPiiColumns20260930000053(), plans: EMPLOYEES_PII,
    seed: [
      `INSERT INTO employees (id, tenant_id, name, rg, birth_date, address)
       VALUES ('${id(81)}', '${T}', 'Pii One', '12.345.678-9', '1990-02-03', 'Rua Exemplo 1')`,
      `INSERT INTO employees (id, tenant_id, name, rg) VALUES ('${id(82)}', '${T}', 'Pii Two rg only', '98.765.432-1')`,
      `INSERT INTO employees (id, tenant_id, name) VALUES ('${id(83)}', '${T}', 'Pii Three no pii')`,
    ],
    archivedIds: { employees: [id(81), id(82)] },
  },
];

describe('LC1 legacy column drop drafts, real disposable PostgreSQL (COPY database only)', () => {
  const baseUrl = new URL(process.env['DATABASE_URL'] ?? 'postgresql://invalid/invalid');
  const baseDb = baseUrl.pathname.replace(/^\//, '');
  const copyDb = `${baseDb}_copy_lc1_${process.pid}`;
  const url = (db: string) => { const u = new URL(baseUrl.toString()); u.pathname = `/${db}`; return u.toString(); };
  let admin: Client;
  let c: Client;
  const prevConfirm = process.env[CONFIRM_ENV];
  const counts: Record<string, number> = {};

  // Same contract as TypeORM's QueryRunner.query for the calls the drafts make.
  const qr = () => ({ query: async (text: string, params?: unknown[]) => (await c.query(text, params as never)).rows });
  const run = async (m: Migration, dir: 'up' | 'down') => {
    await c.query('BEGIN');
    try { await m[dir](qr()); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; }
  };
  const cols = async (table: string) =>
    (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table])).rows.map((r) => r.column_name as string);
  const archiveExists = async (archive: string) =>
    (await c.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`)).rows[0].ok as boolean;
  const legacyJson = async (plan: DropTablePlan, ids: string[]) =>
    (await c.query(
      `SELECT id, to_jsonb(t) - ARRAY(SELECT jsonb_object_keys(to_jsonb(t)) EXCEPT SELECT unnest($2::text[])) AS v FROM "${plan.table}" t WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [ids, plan.columns.map((x) => x.name).concat(['id'])],
    )).rows;

  beforeAll(async () => {
    expect(['127.0.0.1', 'localhost']).toContain(baseUrl.hostname);
    expect(baseDb).toMatch(/^music_os_[a-z0-9_]+$/);
    expect(baseDb).not.toMatch(/_copy_/);
    admin = new Client({ connectionString: url('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${copyDb}"`);
    await admin.query(`CREATE DATABASE "${copyDb}" TEMPLATE "${baseDb}"`);
    c = new Client({ connectionString: url(copyDb) });
    await c.connect();
    expect((await c.query('SELECT current_database() AS d')).rows[0].d).toBe(copyDb); // every DROP below runs here
    // Seed with FK enforcement off for this session only (superuser): rows reference tenants/employees/artists that are not needed here.
    await c.query(`SET session_replication_role = replica`);
    await c.query(`INSERT INTO tenants (id, name, slug) VALUES ('${T}', 'lc1', 'lc1') ON CONFLICT DO NOTHING`).catch(() => undefined);
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
  }, 120000);

  afterAll(async () => {
    if (prevConfirm === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = prevConfirm;
    await c?.end().catch(() => undefined);
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${copyDb}"`); await admin.end(); }
    // eslint-disable-next-line no-console
    console.log(`LC1 PREFLIGHT COUNTS ${JSON.stringify(counts)}`);
  }, 60000);

  it('the base database is untouched and drafts are unregistered', async () => {
    const b = new Client({ connectionString: url(baseDb) });
    await b.connect();
    try {
      for (const g of GROUPS) for (const p of g.plans) {
        expect((await b.query(`SELECT to_regclass('public.${archiveOf(p)}') IS NOT NULL AS ok`)).rows[0].ok).toBe(false);
      }
    } finally { await b.end(); }
  });

  describe.each(GROUPS)('$name', (g) => {
    const allPlansColumns = g.plans.flatMap((p) => p.columns.map((x) => x.name));
    void allPlansColumns;

    it('without LEGACY_DROP_CONFIRM up() throws and changes nothing', async () => {
      delete process.env[CONFIRM_ENV];
      try { await expect(run(g.migration, 'up')).rejects.toThrow(/gated draft/); } finally { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; }
      for (const p of g.plans) expect(await archiveExists(archiveOf(p))).toBe(false);
    });

    it('seeds representative legacy rows and records preflight counts (all 0 on consistent data)', async () => {
      for (const s of g.seed) await c.query(s);
      for (const p of g.plans) for (const chk of p.checks) {
        const n = (await c.query(`SELECT count(*)::int AS n FROM "${p.table}" WHERE ${chk.where}`)).rows[0].n as number;
        counts[`${p.table}:${chk.label}:clean`] = n;
        expect(n).toBe(0);
      }
    });

    it('a violating row aborts up() with the exact count; nothing archived, nothing dropped', async () => {
      const v = g.violation;
      if (!v) return; // see Group.violation
      if (v.prepare) await c.query(v.prepare); // clients: chk_clients_status makes the check unreachable on a constrained schema; dropped in the COPY only
      await c.query(v.insert);
      const plan = g.plans.find((p) => p.table === v.table)!;
      const n = (await c.query(`SELECT count(*)::int AS n FROM "${plan.table}" WHERE ${plan.checks.find((k) => v.expect.includes(`:${k.label}=`))!.where}`)).rows[0].n as number;
      counts[v.expect.replace(/=\d+$/, '') + ':violating'] = n;
      await expect(run(g.migration, 'up')).rejects.toThrow(v.expect);
      for (const p of g.plans) {
        expect(await archiveExists(archiveOf(p))).toBe(false);
        const present = await cols(p.table);
        for (const col of p.columns) expect(present).toContain(col.name);
      }
      await c.query(`DELETE FROM "${v.table}" WHERE id = '${/'(0{8}-[^']+)'/.exec(v.insert)![1]}'`);
    });

    it('up() archives, locks the archive down and drops the columns; down() restores by id; up() again', async () => {
      const before: Record<string, unknown[]> = {};
      for (const p of g.plans) {
        const ids = g.archivedIds[p.table];
        before[p.table] = await legacyJson(p, ids);
        expect(before[p.table]).toHaveLength(ids.length);
      }

      await run(g.migration, 'up');
      for (const p of g.plans) {
        expect(await archiveExists(archiveOf(p))).toBe(true);
        const present = await cols(p.table);
        for (const col of p.columns) expect(present).not.toContain(col.name);
        const arch = (await c.query(`SELECT id FROM "${archiveOf(p)}" ORDER BY id`)).rows.map((r) => r.id);
        expect(arch).toEqual(g.archivedIds[p.table]); // only rows holding legacy values (the no-legacy row is not archived)
        counts[`${p.table}:archived_rows`] = arch.length;
        const rls = (await c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.${archiveOf(p)}')`)).rows[0];
        expect(rls).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
        const grants = (await c.query(`SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_name = $1 AND grantee IN ('PUBLIC','anon','authenticated','musicos_app')`, [archiveOf(p)])).rows[0].n;
        expect(grants).toBe(0);
      }

      await run(g.migration, 'down');
      for (const p of g.plans) {
        const present = await cols(p.table);
        for (const col of p.columns) expect(present).toContain(col.name);
        expect(await legacyJson(p, g.archivedIds[p.table])).toEqual(before[p.table]); // restored by id, same values
        expect(await archiveExists(archiveOf(p))).toBe(true); // archives are never dropped by down()
        const nulls = (await c.query(`SELECT count(*)::int AS n FROM "${p.table}" WHERE ${p.columns.map((x) => `"${x.name}" IS NOT NULL`).join(' OR ')}`)).rows[0].n;
        expect(nulls).toBe(g.archivedIds[p.table].length); // rows without legacy values stay NULL
      }

      await run(g.migration, 'up'); // repeatability: archive rows match live values, so no stale abort
      for (const p of g.plans) {
        const present = await cols(p.table);
        for (const col of p.columns) expect(present).not.toContain(col.name);
      }
      await run(g.migration, 'up'); // idempotent re-run: columns already absent, no-op
    });
  });

  describe('employees PII (draft 53) beside draft 45', () => {
    const m = new DropEmployeesLegacyPiiColumns20260930000053();
    const piiArchive = archiveOf(EMPLOYEES_PII[0]);
    const rgOf = async (table: string, rowId: string) => (await c.query(`SELECT rg FROM "${table}" WHERE id = $1`, [rowId])).rows[0]?.rg as string | undefined;

    it('uses its own archive table, distinct from the employees archive of draft 45, and both coexist', async () => {
      expect(piiArchive).toBe('employees_pii_legacy_archive_20260930');
      expect(await archiveExists(piiArchive)).toBe(true);
      expect(await archiveExists(archiveTableOf('employees'))).toBe(true);
      expect(piiArchive).not.toBe(archiveTableOf('employees'));
      const cols45 = (await cols(archiveTableOf('employees'))).sort();
      expect(cols45).not.toContain('rg');
      expect((await cols(piiArchive)).sort()).toEqual(['address', 'archived_at', 'birth_date', 'id', 'rg', 'tenant_id']);
    });

    it('a stale archive row (live value edited between a down() and the next up()) aborts up(): nothing dropped, archive untouched', async () => {
      await run(m, 'down');
      expect(await cols('employees')).toEqual(expect.arrayContaining(['rg', 'birth_date', 'address']));
      await c.query(`UPDATE employees SET rg = 'CHANGED' WHERE id = '${id(81)}'`);
      await expect(run(m, 'up')).rejects.toThrow(/archive verification failed|stale archive rows/);
      expect(await cols('employees')).toEqual(expect.arrayContaining(['rg', 'birth_date', 'address']));
      expect(await rgOf(piiArchive, id(81))).toBe('12.345.678-9');
      await c.query(`UPDATE employees SET rg = '12.345.678-9' WHERE id = '${id(81)}'`);
      await run(m, 'up');
      expect(await cols('employees')).not.toEqual(expect.arrayContaining(['rg']));
    });

    it('down() refuses when the PII archive is missing (nothing re-added)', async () => {
      await c.query(`ALTER TABLE "${piiArchive}" RENAME TO "${piiArchive}_x"`);
      try {
        await expect(run(m, 'down')).rejects.toThrow(/archive table .* is missing/);
        expect(await cols('employees')).not.toContain('rg');
      } finally { await c.query(`ALTER TABLE "${piiArchive}_x" RENAME TO "${piiArchive}"`); }
    });
  });

  describe('events (data column + sync trigger)', () => {
    const m = new DropEventsDataAndSyncTrigger20260930000046();
    const trigger = async () => (await c.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'trg_events_sync_start_columns' AND NOT tgisinternal`)).rows[0].n as number;
    const fn = async () => (await c.query(`SELECT to_regprocedure('public.sync_events_start_columns()') IS NOT NULL AS ok`)).rows[0].ok as boolean;
    const idx = async (n: string) => (await c.query(`SELECT to_regclass('public.${n}') IS NOT NULL AS ok`)).rows[0].ok as boolean;
    const starts = async () => (await c.query(`SELECT id, starts_at::text AS s FROM events WHERE id = ANY($1::uuid[]) ORDER BY id`, [[E1, E2]])).rows;

    it('seeds events (trigger keeps data = starts_at) and records the preflight count', async () => {
      await c.query(`SET session_replication_role = origin`); // triggers must fire for events
      await c.query(`INSERT INTO events (id, tenant_id, title, type, data, starts_at) VALUES ('${E1}', '${T}', 'E1', 'show', '2025-01-02 10:00', '2025-01-02 10:00')`);
      await c.query(`INSERT INTO events (id, tenant_id, title, type, starts_at) VALUES ('${E2}', '${T}', 'E2 data via trigger', 'show', '2025-02-03 20:30')`);
      const r = (await c.query(`SELECT count(*) FILTER (WHERE data IS DISTINCT FROM starts_at)::int AS diverging, count(*) FILTER (WHERE starts_at IS NULL)::int AS null_start FROM events`)).rows[0];
      counts['events:diverging:clean'] = r.diverging; counts['events:null_start:clean'] = r.null_start;
      expect(r).toEqual({ diverging: 0, null_start: 0 });
      expect(await trigger()).toBe(1);
    });

    it('a diverging row (trigger disabled to seed it) aborts up() with the exact count and drops nothing', async () => {
      await c.query(`ALTER TABLE events DISABLE TRIGGER trg_events_sync_start_columns`);
      await c.query(`UPDATE events SET data = data + interval '1 day' WHERE id = '${E1}'`);
      await c.query(`ALTER TABLE events ENABLE TRIGGER trg_events_sync_start_columns`);
      const n = (await c.query(`SELECT count(*)::int AS n FROM events WHERE data IS DISTINCT FROM starts_at`)).rows[0].n as number;
      counts['events:diverging:violating'] = n;
      expect(n).toBe(1);
      await expect(run(m, 'up')).rejects.toThrow(/events rows with data <> starts_at: 1/);
      expect(await cols('events')).toContain('data');
      expect(await trigger()).toBe(1);
      await c.query(`ALTER TABLE events DISABLE TRIGGER trg_events_sync_start_columns`);
      await c.query(`UPDATE events SET data = starts_at WHERE id = '${E1}'`);
      await c.query(`ALTER TABLE events ENABLE TRIGGER trg_events_sync_start_columns`);
    });

    it('up() drops data, trigger and function; down() rebuilds them from starts_at; up() again', async () => {
      const before = await starts();
      expect(before).toHaveLength(2);
      await run(m, 'up');
      expect(await cols('events')).not.toContain('data');
      expect(await trigger()).toBe(0);
      expect(await fn()).toBe(false);
      expect(await idx('idx_events_tenant_data')).toBe(false);
      expect(await idx('idx_events_tenant_starts_at')).toBe(true);
      expect(await starts()).toEqual(before);

      await run(m, 'down');
      expect(await cols('events')).toContain('data');
      expect(await trigger()).toBe(1);
      expect(await fn()).toBe(true);
      expect(await idx('idx_events_tenant_data')).toBe(true);
      const restored = (await c.query(`SELECT id, (data = starts_at) AS same FROM events WHERE id = ANY($1::uuid[]) ORDER BY id`, [[E1, E2]])).rows;
      expect(restored).toEqual([{ id: E1, same: true }, { id: E2, same: true }]);
      const nullable = (await c.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='data'`)).rows[0].is_nullable;
      expect(nullable).toBe('NO');

      await run(m, 'up');
      expect(await cols('events')).not.toContain('data');
      expect(await trigger()).toBe(0);
    });
  });
});
