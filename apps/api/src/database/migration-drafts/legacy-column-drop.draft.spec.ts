import * as fs from 'fs';
import * as path from 'path';
import { ALL_MIGRATIONS } from '../migrations';
import { CONFIRM_ENV, CONFIRM_TOKEN, DropTablePlan, archiveTableOf } from './legacy-column-drop.base';
import { DropWorksLegacyColumns20260930000040 as Works, PLANS as WORKS } from './20260930000040_DropWorksLegacyColumns';
import { DropPhonogramsLegacyColumns20260930000041 as Phonograms, PLANS as PHONOGRAMS } from './20260930000041_DropPhonogramsLegacyColumns';
import { DropTransactionsLegacyColumns20260930000042 as Transactions, PLANS as TRANSACTIONS } from './20260930000042_DropTransactionsLegacyColumns';
import { DropClientsLegacyContactStatus20260930000043 as Clients, PLANS as CLIENTS } from './20260930000043_DropClientsLegacyContactStatus';
import { DropSharesLegacyArtistProjectId20260930000044 as Shares, PLANS as SHARES } from './20260930000044_DropSharesLegacyArtistProjectId';
import { DropHrLegacyMirrors20260930000045 as Hr, PLANS as HR } from './20260930000045_DropHrLegacyMirrors';
import { DropEventsDataAndSyncTrigger20260930000046 as EventsData } from './20260930000046_DropEventsDataAndSyncTrigger';
import { DropTakedownsUrlMirror20260930000047 as Takedowns, PLANS as TAKEDOWNS } from './20260930000047_DropTakedownsUrlMirror';
import { RelaxInvoicesLegacyAmountNotNull20260930000048 as InvoicesRelax } from './20260930000048_RelaxInvoicesLegacyAmountNotNull';
import { DropInvoicesLegacyAmount20260930000049 as InvoicesDrop, PLANS as INVOICES } from './20260930000049_DropInvoicesLegacyAmount';

/**
 * LC1 drafts guard (docs/engineering/legacy-column-drop-plan.md): never registered, gated by an explicit
 * confirmation, fail-closed preconditions before any write, archive before DROP, DROP last, rollback from the archive.
 */
type Ctor = new () => { name: string; up(q: unknown): Promise<void>; down(q: unknown): Promise<void> };
const GENERIC: Array<[string, Ctor, readonly DropTablePlan[]]> = [
  ['works', Works, WORKS], ['phonograms', Phonograms, PHONOGRAMS], ['transactions', Transactions, TRANSACTIONS],
  ['clients', Clients, CLIENTS], ['shares', Shares, SHARES], ['hr', Hr, HR], ['takedowns', Takedowns, TAKEDOWNS],
  ['invoices', InvoicesDrop, INVOICES],
];
const ALL_DRAFTS: Array<[string, Ctor]> = [...GENERIC.map(([n, c]): [string, Ctor] => [n, c]), ['events', EventsData], ['invoices-relax', InvoicesRelax]];

interface Script {
  bypass?: boolean;
  present?: (table: string) => string[];
  counts?: Record<string, number>; // `${table}:${label}` is resolved through the predicate text
  missingArchive?: number;
  archiveExists?: boolean;
}

function runner(plans: readonly DropTablePlan[], script: Script = {}) {
  const sql: Array<{ text: string; params?: unknown[] }> = [];
  const query = jest.fn(async (text: string, params?: unknown[]) => {
    sql.push({ text, params });
    if (text.includes('rolbypassrls')) return [{ bypass: script.bypass ?? true }];
    if (text.includes('information_schema.columns')) {
      const table = /table_name = '(\w+)'/.exec(text)![1];
      const plan = plans.find((p) => p.table === table)!;
      return (script.present ? script.present(table) : plan.columns.map((c) => c.name)).map((column_name) => ({ column_name }));
    }
    if (text.includes('to_regclass')) return [{ ok: script.archiveExists ?? true }];
    if (text.includes('NOT EXISTS (SELECT 1 FROM')) return [{ n: script.missingArchive ?? 0 }];
    if (text.startsWith('SELECT count(*)::int AS n FROM')) {
      for (const [needle, n] of Object.entries(script.counts ?? {})) if (text.includes(needle)) return [{ n }];
      return [{ n: 0 }];
    }
    return [];
  });
  return { query, sql };
}
const idx = (sql: Array<{ text: string }>, needle: string | RegExp) =>
  sql.findIndex((s) => (typeof needle === 'string' ? s.text.includes(needle) : needle.test(s.text)));

describe('LC1 legacy column drop drafts', () => {
  const prev = process.env[CONFIRM_ENV];
  afterEach(() => { if (prev === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = prev; });

  describe('never registered', () => {
    it('no draft class is in ALL_MIGRATIONS and migrations/index.ts does not import migration-drafts', () => {
      const registered = new Set(ALL_MIGRATIONS.map((m) => m.name));
      for (const [, Draft] of ALL_DRAFTS) expect(registered.has(Draft.name)).toBe(false);
      const index = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8');
      expect(index).not.toContain('migration-drafts');
      for (const [, Draft] of ALL_DRAFTS) expect(index).not.toContain(Draft.name);
    });

    it('drafts use the reserved 20260930000040+ timestamps and are not under migrations/', () => {
      for (const [, Draft] of ALL_DRAFTS) {
        const ts = Number(/(\d{14})$/.exec(new Draft().name)![1]);
        expect(ts).toBeGreaterThanOrEqual(20260930000040);
      }
      const migrations = fs.readdirSync(path.join(__dirname, '..', 'migrations'));
      expect(migrations.some((f) => /^2026093000004\d_/.test(f))).toBe(false);
    });
  });

  describe('confirmation gate', () => {
    it.each(ALL_DRAFTS)('%s up() and down() throw without LEGACY_DROP_CONFIRM and run no SQL', async (_n, Draft) => {
      delete process.env[CONFIRM_ENV];
      for (const direction of ['up', 'down'] as const) {
        const query = jest.fn();
        await expect(new Draft()[direction]({ query })).rejects.toThrow(/gated draft.*LEGACY_DROP_CONFIRM/);
        expect(query).not.toHaveBeenCalled();
      }
    });

    it.each(ALL_DRAFTS)('%s rejects a wrong confirmation value', async (_n, Draft) => {
      process.env[CONFIRM_ENV] = 'yes';
      const query = jest.fn();
      await expect(new Draft().up({ query })).rejects.toThrow(/gated draft/);
      expect(query).not.toHaveBeenCalled();
    });

    it.each(ALL_DRAFTS)('%s stops at the RLS-bypass guard', async (_n, Draft) => {
      process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
      for (const direction of ['up', 'down'] as const) {
        const query = jest.fn().mockResolvedValue([{ bypass: false }]);
        await expect(new Draft()[direction]({ query })).rejects.toThrow(/BYPASSRLS/);
        expect(query).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe.each(GENERIC)('%s drop skeleton', (_name, Draft, plans) => {
    beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });

    it('orders guard, lock_timeout, presence, preconditions, archive (locked down), verify, DROP last', async () => {
      const { query, sql } = runner(plans);
      await new Draft().up({ query } as never);
      expect(sql[0].text).toContain('rolbypassrls');
      expect(sql[1].text).toContain(`SET LOCAL lock_timeout = '15s'`);
      const firstCheck = idx(sql, /^SELECT count\(\*\)::int AS n FROM "\w+" WHERE/);
      const firstCreate = idx(sql, 'CREATE TABLE IF NOT EXISTS');
      const firstDrop = idx(sql, 'DROP COLUMN');
      expect(idx(sql, 'information_schema.columns')).toBeLessThan(firstCheck);
      expect(firstCheck).toBeLessThan(firstCreate);
      expect(firstCreate).toBeLessThan(firstDrop);
      for (const plan of plans) {
        const archive = archiveTableOf(plan.table);
        const create = idx(sql, `CREATE TABLE IF NOT EXISTS "${archive}"`);
        expect(create).toBeGreaterThan(-1);
        expect(idx(sql, `ALTER TABLE "${archive}" ENABLE ROW LEVEL SECURITY`)).toBeGreaterThan(create);
        expect(idx(sql, `ALTER TABLE "${archive}" FORCE ROW LEVEL SECURITY`)).toBeGreaterThan(create);
        expect(idx(sql, `REVOKE ALL ON TABLE "${archive}" FROM PUBLIC`)).toBeGreaterThan(create);
        const insert = idx(sql, `INSERT INTO "${archive}"`);
        expect(insert).toBeGreaterThan(create);
        const verify = idx(sql, `NOT EXISTS (SELECT 1 FROM "${archive}"`);
        expect(verify).toBeGreaterThan(insert);
        const drop = sql.find((s) => s.text.includes(`ALTER TABLE "${plan.table}" DROP COLUMN`))!.text;
        for (const c of plan.columns) expect(drop).toContain(`DROP COLUMN IF EXISTS "${c.name}"`);
        expect(sql.findIndex((s) => s.text === drop)).toBeGreaterThan(verify);
      }
      // The ONLY destructive statements are the column drops; archives are never dropped.
      expect(sql.filter((s) => /DROP\s+TABLE/i.test(s.text))).toHaveLength(0);
      expect(sql.filter((s) => /\bDELETE\b|TRUNCATE/i.test(s.text))).toHaveLength(0);
      expect(sql.filter((s) => /DROP COLUMN/.test(s.text))).toHaveLength(plans.length);
    });

    it('archive stores only legacy values + id/tenant_id and is retained for rollback', async () => {
      const { query, sql } = runner(plans);
      await new Draft().up({ query } as never);
      for (const plan of plans) {
        const create = sql.find((s) => s.text.includes(`CREATE TABLE IF NOT EXISTS "${archiveTableOf(plan.table)}"`))!.text;
        for (const c of plan.columns) expect(create).toContain(`"${c.name}" ${c.type}`);
        expect(create).toContain('"id" uuid PRIMARY KEY');
        expect(create).toContain('"tenant_id" uuid NOT NULL');
      }
    });

    it('aborts on any failing zero-use check: counts only, nothing archived or dropped', async () => {
      const first = plans[0].checks[0];
      const { query, sql } = runner(plans, { counts: { [first.where]: 3 } });
      const error = await new Draft().up({ query } as never).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(`${plans[0].table}:${first.label}=3`);
      expect((error as Error).message.length).toBeLessThan(700);
      expect(sql.some((s) => /CREATE TABLE|INSERT|DROP|UPDATE/.test(s.text))).toBe(false);
    });

    it('aborts when the archive does not cover every row, before any DROP', async () => {
      const { query, sql } = runner(plans, { missingArchive: 2 });
      await expect(new Draft().up({ query } as never)).rejects.toThrow(/archive verification failed/);
      expect(sql.some((s) => /DROP COLUMN/.test(s.text))).toBe(false);
    });

    it('a partially present column set aborts (unknown state), none present is a no-op re-run', async () => {
      if (plans[0].columns.length > 1) {
        const partial = runner(plans, { present: () => [plans[0].columns[0].name] });
        await expect(new Draft().up({ query: partial.query } as never)).rejects.toThrow(/partial state/);
      }
      const none = runner(plans, { present: () => [] });
      await new Draft().up({ query: none.query } as never);
      expect(none.sql.some((s) => /CREATE TABLE|INSERT|DROP COLUMN/.test(s.text))).toBe(false);
    });

    it('down() re-adds the columns (nullable, same type) and restores by id from the archive, never dropping it', async () => {
      const { query, sql } = runner(plans);
      await new Draft().down({ query } as never);
      for (const plan of plans) {
        const add = sql.find((s) => s.text.includes(`ALTER TABLE "${plan.table}" ADD COLUMN`))!.text;
        for (const c of plan.columns) {
          expect(add).toContain(`ADD COLUMN IF NOT EXISTS "${c.name}" ${c.type}`);
          expect(add).not.toContain(`${c.type} NOT NULL`);
        }
        const restore = sql.find((s) => s.text.startsWith(`UPDATE "${plan.table}" t SET`))!.text;
        expect(restore).toContain(`FROM "${archiveTableOf(plan.table)}" a WHERE a."id" = t."id"`);
        for (const c of plan.columns) expect(restore).toContain(`"${c.name}" = a."${c.name}"`);
        expect(restore).not.toMatch(/SET\s+t\./);
      }
      expect(sql.some((s) => /DROP/i.test(s.text))).toBe(false);
    });

    it('down() refuses when the archive table is missing', async () => {
      const { query, sql } = runner(plans, { archiveExists: false });
      await expect(new Draft().down({ query } as never)).rejects.toThrow(/archive table .* is missing/);
      expect(sql.some((s) => /ADD COLUMN|UPDATE/.test(s.text))).toBe(false);
    });
  });

  describe('events.data', () => {
    beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });
    function eventsRunner(over: { diverging?: number; nullStart?: number; hasColumn?: boolean; hasIndex?: boolean } = {}) {
      const sql: string[] = [];
      const query = jest.fn(async (text: string) => {
        sql.push(text);
        if (text.includes('rolbypassrls')) return [{ bypass: true }];
        if (text.includes('information_schema.columns')) return [{ n: over.hasColumn === false ? 0 : 1 }];
        if (text.includes('to_regclass')) return [{ ok: over.hasIndex ?? true }];
        if (text.includes('FILTER')) return [{ diverging: over.diverging ?? 0, null_start: over.nullStart ?? 0 }];
        return [];
      });
      return { query, sql };
    }

    it('up(): proves data == starts_at, drops the trigger and function BEFORE the column', async () => {
      const { query, sql } = eventsRunner();
      await new EventsData().up({ query } as never);
      const at = (needle: string) => sql.findIndex((s) => s.includes(needle));
      expect(at('FILTER')).toBeLessThan(at('DROP TRIGGER'));
      expect(at('DROP TRIGGER IF EXISTS "trg_events_sync_start_columns"')).toBeLessThan(at('DROP FUNCTION IF EXISTS public.sync_events_start_columns()'));
      expect(at('DROP FUNCTION')).toBeLessThan(at('ALTER TABLE "events" DROP COLUMN IF EXISTS "data"'));
      expect(sql.filter((s) => /DROP COLUMN/.test(s))).toHaveLength(1);
    });

    it.each([[{ diverging: 2 }], [{ nullStart: 1 }]])('up() aborts before any DDL when the precondition fails %j', async (over) => {
      const { query, sql } = eventsRunner(over);
      await expect(new EventsData().up({ query } as never)).rejects.toThrow(/precondition failed/);
      expect(sql.some((s) => /DROP/.test(s))).toBe(false);
    });

    it('up() refuses without the replacement index and is a no-op when already dropped', async () => {
      const noIndex = eventsRunner({ hasIndex: false });
      await expect(new EventsData().up({ query: noIndex.query } as never)).rejects.toThrow(/idx_events_tenant_starts_at/);
      expect(noIndex.sql.some((s) => /DROP/.test(s))).toBe(false);
      const gone = eventsRunner({ hasColumn: false });
      await new EventsData().up({ query: gone.query } as never);
      expect(gone.sql.some((s) => /DROP/.test(s))).toBe(false);
    });

    it('down() rebuilds data from starts_at, NOT NULL, then function, trigger and index', async () => {
      const { query, sql } = eventsRunner();
      await new EventsData().down({ query } as never);
      const at = (needle: string) => sql.findIndex((s) => s.includes(needle));
      expect(at('ADD COLUMN IF NOT EXISTS "data" timestamp')).toBeLessThan(at('SET "data" = "starts_at"'));
      expect(at('SET "data" = "starts_at"')).toBeLessThan(at('SET NOT NULL'));
      expect(at('SET NOT NULL')).toBeLessThan(at('CREATE OR REPLACE FUNCTION public.sync_events_start_columns()'));
      expect(at('CREATE OR REPLACE FUNCTION')).toBeLessThan(at('CREATE TRIGGER "trg_events_sync_start_columns"'));
      expect(sql.join('\n')).toContain('BEFORE INSERT OR UPDATE OF "data", "starts_at" ON "events"');
      expect(sql.join('\n')).toContain('CREATE INDEX IF NOT EXISTS "idx_events_tenant_data" ON "events" ("tenant_id", "data")');
    });
  });

  describe('invoices.legacy_amount staging', () => {
    beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });

    it('relax: aborts while any row only has the legacy value; otherwise only drops NOT NULL', async () => {
      const bad = jest.fn(async (t: string) => (t.includes('rolbypassrls') ? [{ bypass: true }] : t.startsWith('SELECT count') ? [{ n: 2 }] : []));
      await expect(new InvoicesRelax().up({ query: bad } as never)).rejects.toThrow(/20260930000022 backfill/);
      const sql: string[] = [];
      const ok = jest.fn(async (t: string) => { sql.push(t); return t.includes('rolbypassrls') ? [{ bypass: true }] : t.startsWith('SELECT count') ? [{ n: 0 }] : []; });
      await new InvoicesRelax().up({ query: ok } as never);
      expect(sql.filter((s) => /ALTER TABLE/.test(s))).toEqual(['ALTER TABLE "invoices" ALTER COLUMN "legacy_amount" DROP NOT NULL']);
      expect(sql.some((s) => /DROP COLUMN/.test(s))).toBe(false);
    });

    it('relax down() refills NULLs then restores NOT NULL', async () => {
      const sql: string[] = [];
      const query = jest.fn(async (t: string) => { sql.push(t); return t.includes('rolbypassrls') ? [{ bypass: true }] : []; });
      await new InvoicesRelax().down({ query } as never);
      const fill = sql.findIndex((s) => s.includes('COALESCE("service_amount", 0)'));
      expect(fill).toBeGreaterThan(-1);
      expect(sql.findIndex((s) => s.includes('SET NOT NULL'))).toBeGreaterThan(fill);
    });

    it('the final drop also demands service_amount to be present and equal (reconciled) before archiving', () => {
      const wheres = INVOICES[0].checks.map((c) => c.where).join(' | ');
      expect(wheres).toContain('"service_amount" IS NULL');
      expect(wheres).toContain('"legacy_amount" <> "service_amount"');
    });
  });

  describe('coverage', () => {
    it('every legacy_* column of the entities (except operational_list_items.legacy_slug) is covered by a drop plan, HR columns included', () => {
      const entities = fs.readFileSync(path.join(__dirname, '..', 'entities.ts'), 'utf8');
      const declared = new Set([...entities.matchAll(/\blegacy_[a-z_]+(?=\s*[:?]\s)/g)].map((m) => m[0]));
      declared.delete('legacy_slug'); // operational-list provenance, not a retirement target of LC1
      declared.delete('legacy_key'); // permission_aliases.legacy_key: RBAC alias table, kept (not legacy debt)
      const covered = GENERIC.flatMap(([, , plans]) => plans.flatMap((p) => p.columns.map((c) => c.name)));
      for (const name of declared) expect(covered).toContain(name);
      // HR mirrors have no entity declaration at all (physical columns only).
      for (const name of ['legacy_full_name', 'legacy_sector', 'legacy_base_salary', 'legacy_reference_month']) expect(covered).toContain(name);
      expect(covered.filter((n) => n === 'legacy_employee_id')).toHaveLength(2); // payroll_entries + leave_requests
    });
  });
});
