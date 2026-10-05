import * as fs from 'fs';
import * as path from 'path';
import { ALL_MIGRATIONS } from '../migrations';
import {
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  RenameLegacyHrPermissionsInPlace20260930000051 as Draft,
} from './20260930000051_RenameLegacyHrPermissionsInPlace';
import { CONFIRM_TOKEN as ROLE_TOKEN } from './20260930000030_CanonicalizeRoleSlugsInPlaceAndBackfillMembers';

function runner(script: { bypass?: boolean; hr?: number; residue?: number; legacy?: number } = {}) {
  const sql: string[] = [];
  const query = jest.fn(async (text: string) => {
    sql.push(text);
    if (text.includes('rolbypassrls')) return [{ bypass: script.bypass ?? true }];
    if (text.includes(`WHERE "resource" = 'hr'`) && text.startsWith('SELECT')) return [{ n: script.hr ?? 0 }];
    if (text.includes(`"resource" = 'rh' OR`)) return [{ n: script.residue ?? 0 }];
    if (text.includes(`WHERE "resource" = 'rh'`) && text.startsWith('SELECT')) return [{ n: script.legacy ?? 0 }];
    return [];
  });
  return { query, sql };
}
const writes = (sql: string[]) => sql.filter((s) => /^\s*UPDATE|^\s*DELETE|^\s*INSERT/.test(s));

describe('S4b companion DRAFT: rename rh permissions to hr in place', () => {
  const draft = new Draft();
  const OLD = process.env[CONFIRM_ENV];
  afterEach(() => { if (OLD === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD; });

  it('is not registered and lives only under migration-drafts/', () => {
    expect(ALL_MIGRATIONS.map((m) => m.name)).not.toContain(draft.name);
    expect(fs.existsSync(path.join(__dirname, '..', 'migrations', '20260930000051_RenameLegacyHrPermissionsInPlace.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8')).not.toContain('RenameLegacyHrPermissionsInPlace');
  });

  it('uses a token distinct from the role-slug draft', () => {
    expect(CONFIRM_TOKEN).not.toBe(ROLE_TOKEN);
  });

  it('refuses without the confirmation token and does not touch the database', async () => {
    delete process.env[CONFIRM_ENV];
    const r = runner();
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    process.env[CONFIRM_ENV] = ROLE_TOKEN;
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    await expect(draft.down({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    expect(r.query).not.toHaveBeenCalled();
  });

  it('renames in place (UPDATE only, never DELETE) when confirmed and clean', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const r = runner();
    await draft.up({ query: r.query } as never);
    const w = writes(r.sql);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/UPDATE "permissions" SET "resource" = 'hr', "key" = 'hr:' \|\| "action"/);
    expect(r.sql.some((s) => /DELETE/.test(s))).toBe(false);
  });

  it('fails closed before any write when hr rows already exist, or when residue remains', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const pre = runner({ hr: 3 });
    await expect(draft.up({ query: pre.query } as never)).rejects.toThrow(/refusing/);
    expect(writes(pre.sql)).toHaveLength(0);
    const post = runner({ residue: 2 });
    await expect(draft.up({ query: post.query } as never)).rejects.toThrow(/rolling back/);
  });

  it('requires a BYPASSRLS role', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const r = runner({ bypass: false });
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow();
    expect(writes(r.sql)).toHaveLength(0);
  });

  it('down refuses while rh rows exist, otherwise renames back', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const bad = runner({ legacy: 1 });
    await expect(draft.down({ query: bad.query } as never)).rejects.toThrow(/refusing to revert/);
    expect(writes(bad.sql)).toHaveLength(0);
    const ok = runner();
    await draft.down({ query: ok.query } as never);
    expect(writes(ok.sql)).toHaveLength(1);
  });
});

/**
 * The legacy `rh` resource literal (permissions.resource = 'rh', key prefix 'rh:'): exact SQL the draft sends, per statement.
 * A renamed/misspelled literal changes one of these predicates (and, on a real database, which rows move).
 */
describe('S4b companion DRAFT: the legacy `rh` literal in every statement', () => {
  const draft = new Draft();
  const OLD = process.env[CONFIRM_ENV];
  beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });
  afterEach(() => { if (OLD === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD; });
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

  it('up: renames exactly the rows whose resource is `rh`, and audits residue by resource `rh` OR key prefix `rh:`', async () => {
    const r = runner();
    await draft.up({ query: r.query } as never);
    const sql = r.sql.map(norm);
    expect(sql).toContain(`UPDATE "permissions" SET "resource" = 'hr', "key" = 'hr:' || "action", "updated_at" = now() WHERE "resource" = 'rh'`);
    expect(sql).toContain(`SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'rh' OR "key" LIKE 'rh:%'`);
    expect(sql).toContain(`SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'hr'`);
    // order: pre-flight (hr rows) before the rename, residue audit after it
    const iPre = sql.findIndex((s) => s.endsWith(`WHERE "resource" = 'hr'`) && s.startsWith('SELECT'));
    const iUpd = sql.findIndex((s) => s.startsWith('UPDATE "permissions"'));
    const iRes = sql.findIndex((s) => s.includes(`LIKE 'rh:%'`));
    expect(iPre).toBeGreaterThanOrEqual(0);
    expect(iUpd).toBeGreaterThan(iPre);
    expect(iRes).toBeGreaterThan(iUpd);
  });

  it('down: guards on resource `rh` rows, then renames hr back to the key prefix `rh:`', async () => {
    const r = runner();
    await draft.down({ query: r.query } as never);
    const sql = r.sql.map(norm);
    expect(sql).toContain(`SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'rh'`);
    expect(sql).toContain(`UPDATE "permissions" SET "resource" = 'rh', "key" = 'rh:' || "action", "updated_at" = now() WHERE "resource" = 'hr'`);
  });

  it('negative: a runner that only knows near-miss literals (rhx, rh_, RH) is never matched as `rh`', async () => {
    const r = runner({ legacy: 0 });
    await draft.up({ query: r.query } as never);
    for (const s of r.sql.map(norm)) {
      expect(s).not.toMatch(/'(rhx|rh_|RH|Rh|rh )'/);
      expect(s).not.toMatch(/LIKE 'rh[^:]/);
    }
  });
});

const pgUrl = process.env.PG_INTEGRATION_URL;
(pgUrl ? describe : describe.skip)('S4b companion DRAFT on a real PostgreSQL (TEMP table, always rolled back)', () => {
  const draft = new Draft();
  const OLD = process.env[CONFIRM_ENV];
  afterEach(() => { if (OLD === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD; });

  async function withTemp(fn: (q: (sql: string) => Promise<unknown[]>) => Promise<void>) {
    const { Client } = await import('pg');
    const c = new Client({ connectionString: pgUrl });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`CREATE TEMP TABLE permissions (resource text NOT NULL, action text NOT NULL, key text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
      await c.query(`INSERT INTO permissions(resource, action, key) VALUES ('rh','read','rh:read'),('rh','write','rh:write'),('rhx','read','rhx:read'),('RH','read','RH:read'),('finance','read','finance:read')`);
      await fn(async (sql) => (await c.query(sql)).rows);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      await c.end();
    }
  }
  const runnerOn = (q: (sql: string) => Promise<unknown[]>) => ({ query: (s: string) => q(s) }) as never;
  const keys = async (q: (sql: string) => Promise<unknown[]>) =>
    ((await q(`SELECT resource, key FROM permissions ORDER BY key`)) as Array<{ resource: string; key: string }>).map((r) => `${r.resource}|${r.key}`);

  it('up moves exactly `rh` rows to `hr` (key rewritten) and leaves near-miss resources untouched', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    await withTemp(async (q) => {
      await draft.up(runnerOn(q));
      expect(await keys(q)).toEqual(['RH|RH:read', 'finance|finance:read', 'hr|hr:read', 'hr|hr:write', 'rhx|rhx:read']);
    });
  });

  it('down moves `hr` rows back to `rh` once no `rh` row exists, and refuses while one exists', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    await withTemp(async (q) => {
      await expect(draft.down(runnerOn(q))).rejects.toThrow(/refusing to revert, 2 rh/);
      await draft.up(runnerOn(q));
      await draft.down(runnerOn(q));
      expect(await keys(q)).toEqual(['RH|RH:read', 'finance|finance:read', 'rh|rh:read', 'rh|rh:write', 'rhx|rhx:read']);
    });
  });

  it('up refuses (nothing changed) when an `hr` row already exists', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    await withTemp(async (q) => {
      await q(`INSERT INTO permissions(resource, action, key) VALUES ('hr','read','hr:read')`);
      await expect(draft.up(runnerOn(q))).rejects.toThrow(/refusing, 1 permission row/);
      expect((await keys(q)).filter((k) => k.startsWith('rh|'))).toHaveLength(2);
    });
  });
});
