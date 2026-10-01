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
