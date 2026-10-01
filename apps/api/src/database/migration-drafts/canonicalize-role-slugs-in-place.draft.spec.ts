import * as fs from 'fs';
import * as path from 'path';
import { ALL_MIGRATIONS } from '../migrations';
import {
  BATCH_SIZE,
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  MAX_MESSAGE,
  MEMBER_ONLY_PAIR,
  ROLE_SLUG_PAIRS,
  CanonicalizeRoleSlugsInPlaceAndBackfillMembers20260930000030 as Draft,
} from './20260930000030_CanonicalizeRoleSlugsInPlaceAndBackfillMembers';
import { ENGLISH_ROLE_ALIASES } from '../../core/rbac/role-hierarchy';

/**
 * S4b DRAFT guard (docs/engineering/rbac-retirement-plan.md): never registered, gated by an explicit
 * confirmation, fail-closed pre-flight before any write, bounded messages, ordered writes.
 */
interface Script {
  bypass?: boolean;
  badPairs?: Array<{ legacy: string; problem: string }>;
  conflicts?: Array<{ slug: string; source: string; n: number }>;
  unconvertible?: Array<{ slug: string; source: string; n: number }>;
  deleted?: number;
  renamed?: number;
  memberBatches?: Record<string, string[][]>;
  inviteRoleColumn?: boolean;
  residue?: Array<{ slug: string; source: string; n: number }>;
  shape?: { renamed: number; aliases: number };
  references?: Array<{ slug: string; source: string; n: number }>;
  back?: number;
}

function runner(script: Script = {}) {
  const sql: Array<{ text: string; params?: unknown[] }> = [];
  const batches: Record<string, string[][]> = {};
  for (const [k, v] of Object.entries(script.memberBatches ?? {})) batches[k] = [...v];
  const query = jest.fn(async (text: string, params?: unknown[]) => {
    sql.push({ text, params });
    if (text.includes('rolbypassrls')) return [{ bypass: script.bypass ?? true }];
    if (text.includes(`'legacy_row_missing_or_archived'`)) return script.badPairs ?? [];
    if (text.includes(`'english_alias_referenced_by_members'`)) return script.conflicts ?? [];
    if (text.includes(`'role_id_not_canonical_row'`)) return script.unconvertible ?? [];
    if (text.includes('DELETE FROM "roles" e')) return Array.from({ length: script.deleted ?? ROLE_SLUG_PAIRS.length }, (_, i) => ({ id: `d${i}` }));
    if (text.includes('UPDATE "roles" l SET "slug"')) return Array.from({ length: script.renamed ?? ROLE_SLUG_PAIRS.length }, (_, i) => ({ id: `r${i}` }));
    if (text.includes('SELECT m."id" FROM "org_members" m')) {
      const from = (params as string[])[0];
      const next = batches[from]?.shift() ?? [];
      return next.map((id) => ({ id }));
    }
    if (text.includes('information_schema.columns')) return script.inviteRoleColumn ? [{ ok: 1 }] : [];
    if (text.includes(`'legacy_slug_left_in_org_members'`)) return script.residue ?? [];
    if (text.includes('AS renamed')) return [script.shape ?? { renamed: 5, aliases: 5 }];
    if (text.includes(`'legacy_alias_referenced_by_members'`)) return script.references ?? [];
    if (text.includes('SELECT count(*)::int AS n FROM "roles" e JOIN')) return [{ n: script.back ?? 5 }];
    return [];
  });
  return { query, sql };
}
const writes = (sql: Array<{ text: string }>) => sql.filter((s) => /^\s*(INSERT|UPDATE|DELETE)\b/.test(s.text));
const idx = (sql: Array<{ text: string }>, needle: string) => sql.findIndex((s) => s.text.includes(needle));

describe('S4b draft: CanonicalizeRoleSlugsInPlaceAndBackfillMembers20260930000030', () => {
  const migration = new Draft();
  const OLD = process.env[CONFIRM_ENV];
  beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });
  afterAll(() => { if (OLD === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD; });

  describe('gating', () => {
    it('is NOT registered in ALL_MIGRATIONS and not referenced by migrations/index.ts', () => {
      expect(ALL_MIGRATIONS.map((m) => m.name)).not.toContain(migration.name);
      const index = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8');
      expect(index).not.toMatch(/20260930000030|CanonicalizeRoleSlugsInPlace/);
    });

    it('does not exist under migrations/ (only under migration-drafts/)', () => {
      const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'));
      expect(files.filter((f) => f.includes('CanonicalizeRoleSlugsInPlace'))).toEqual([]);
    });

    it.each(['up', 'down'] as const)('%s() refuses without the explicit confirmation and sends no SQL', async (method) => {
      for (const value of [undefined, '', 'true', '1', CONFIRM_TOKEN.toUpperCase()]) {
        if (value === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = value;
        const { query } = runner();
        await expect(migration[method]({ query } as never)).rejects.toThrow(/gated draft/);
        expect(query).not.toHaveBeenCalled();
      }
    });

    it.each(['up', 'down'] as const)('%s() refuses a role that cannot bypass RLS before anything else', async (method) => {
      const { query } = runner({ bypass: false });
      await expect(migration[method]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('pairs are exactly the five persisted aliases plus the member-only artista -> artist', () => {
      expect(Object.fromEntries(ROLE_SLUG_PAIRS.map(([l, c]) => [c, l]))).toEqual({ ...ENGLISH_ROLE_ALIASES });
      expect(MEMBER_ONLY_PAIR).toEqual(['artista', 'artist']);
    });
  });

  describe('up(): fail-closed pre-flight, nothing written on refusal', () => {
    it.each([
      ['catalog not in S4a state', { badPairs: [{ legacy: 'juridico', problem: 'canonical_row_not_inert_alias_of_legacy' }] }, /not in the S4a expand state/],
      ['conflicting references / tenant squatter', { conflicts: [{ slug: 'legal', source: 'tenant_custom_role', n: 1 }] }, /conflicting references \(legal:tenant_custom_role=1\)/],
      ['unconvertible members', { unconvertible: [{ slug: 'sales', source: 'role_id_not_canonical_row', n: 3 }] }, /unresolvable role\/role_id pair.*sales:role_id_not_canonical_row=3/],
    ] as const)('refuses: %s', async (_name, script, message) => {
      const { query, sql } = runner(script as unknown as Script);
      await expect(migration.up({ query } as never)).rejects.toThrow(message);
      expect(writes(sql)).toEqual([]);
    });

    it('refuses with a bounded message even when the offender list is huge (no PII, no unbounded text)', async () => {
      const many = Array.from({ length: 500 }, (_, i) => ({ slug: `slug_${i}`, source: 'tenant_custom_role', n: i }));
      const { query } = runner({ conflicts: many });
      const err = await migration.up({ query } as never).catch((e: Error) => e);
      expect((err as Error).message.length).toBeLessThanOrEqual(MAX_MESSAGE + 60);
      expect((err as Error).message).toMatch(/chars\)/);
    });
  });

  describe('up(): ordered, scoped writes', () => {
    it('sets lock_timeout first, runs all pre-flight reads before the first write, then delete -> rename -> alias insert -> member backfill', async () => {
      const { query, sql } = runner({ memberBatches: { juridico: [['a', 'b']], artista: [['c']] } });
      await migration.up({ query } as never);
      expect(idx(sql, `SET LOCAL lock_timeout = '15s'`)).toBeLessThan(idx(sql, `'legacy_row_missing_or_archived'`));
      const firstWrite = sql.findIndex((s) => /^\s*(INSERT|UPDATE|DELETE)\b/.test(s.text));
      expect(idx(sql, `'role_id_not_canonical_row'`)).toBeLessThan(firstWrite);
      const del = idx(sql, 'DELETE FROM "roles" e');
      const ren = idx(sql, 'UPDATE "roles" l SET "slug"');
      const ins = idx(sql, 'INSERT INTO "roles"');
      const mem = idx(sql, 'UPDATE "org_members"');
      expect([del, ren, ins, mem].every((n) => n > 0)).toBe(true);
      expect(del).toBeLessThan(ren);
      expect(ren).toBeLessThan(ins);
      expect(ins).toBeLessThan(mem);
      expect(idx(sql, `'legacy_slug_left_in_org_members'`)).toBeGreaterThan(mem);
    });

    it('only touches global role rows and never deletes members, invitations, permissions or inheritance', async () => {
      const { query, sql } = runner();
      await migration.up({ query } as never);
      for (const w of writes(sql)) {
        expect(w.text).not.toMatch(/DELETE FROM "(org_members|tenant_invitations|role_permissions|role_inheritance|permissions)"/);
        if (/"roles"/.test(w.text)) expect(w.text).toMatch(/"tenant_id" IS NULL|NULL::uuid/);
      }
      expect(sql.some((s) => /DROP |TRUNCATE|ALTER /.test(s.text))).toBe(false);
    });

    it('rewrites members in keyset batches of BATCH_SIZE only where role_id is the role row, including artista -> artist', async () => {
      const ids = Array.from({ length: BATCH_SIZE }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
      const { query, sql } = runner({ memberBatches: { juridico: [ids, ['00000000-0000-0000-0000-999999999999']], artista: [['x']] } });
      await migration.up({ query } as never);
      const selects = sql.filter((s) => s.text.includes('SELECT m."id" FROM "org_members" m') && s.params?.[0] === 'juridico');
      expect(selects).toHaveLength(3); // full batch, partial batch, empty terminator
      expect(selects[1].params?.[1]).toBe(ids[ids.length - 1]); // keyset cursor advances
      expect(selects[0].text).toContain(`LIMIT ${BATCH_SIZE}`);
      const updates = sql.filter((s) => s.text.includes('UPDATE "org_members"'));
      expect(updates.length).toBeGreaterThanOrEqual(3);
      for (const u of updates) {
        expect(u.text).toContain('"role_id" = (SELECT r."id" FROM "roles" r');
        expect(u.text).toContain('"canonical_role_id" IS NULL');
      }
      expect(updates.some((u) => u.params?.[1] === 'artist' && u.params?.[2] === 'artista')).toBe(true);
      expect(updates.some((u) => u.params?.[1] === 'legal' && u.params?.[2] === 'juridico')).toBe(true);
    });

    it('rewrites a tenant_invitations.role string only if such a column exists (today it does not: role_id only)', async () => {
      const without = runner();
      await migration.up({ query: without.query } as never);
      expect(without.sql.some((s) => s.text.includes('UPDATE "tenant_invitations"'))).toBe(false);
      const withCol = runner({ inviteRoleColumn: true });
      await migration.up({ query: withCol.query } as never);
      expect(withCol.sql.filter((s) => s.text.includes('UPDATE "tenant_invitations"'))).toHaveLength(ROLE_SLUG_PAIRS.length + 1);
    });

    it.each([
      ['legacy slug left behind', { residue: [{ slug: 'juridico', source: 'legacy_slug_left_in_org_members', n: 2 }] }],
      ['wrong renamed-row count', { shape: { renamed: 4, aliases: 5 } }],
      ['wrong alias count', { shape: { renamed: 5, aliases: 3 } }],
    ] as const)('residue audit failure (%s) throws so the transaction rolls back', async (_n, script) => {
      const { query } = runner(script as unknown as Script);
      await expect(migration.up({ query } as never)).rejects.toThrow(/residue audit failed.*Rolled back/);
    });

    it('throws when the delete/rename row counts are not exactly five', async () => {
      await expect(migration.up({ query: runner({ deleted: 4 }).query } as never)).rejects.toThrow(/expected to remove 5/);
      await expect(migration.up({ query: runner({ renamed: 6 }).query } as never)).rejects.toThrow(/expected to rename 5/);
    });
  });

  describe('down()', () => {
    it('refuses, changing nothing, while inert legacy aliases are referenced or English members have a foreign role_id', async () => {
      const { query, sql } = runner({ references: [{ slug: 'juridico', source: 'legacy_alias_referenced_by_members', n: 1 }] });
      await expect(migration.down({ query } as never)).rejects.toThrow(/refusing down\(\).*juridico:legacy_alias_referenced_by_members=1/);
      expect(writes(sql)).toEqual([]);
    });

    it('reverses in order: members -> delete legacy aliases -> rename back -> re-insert English aliases; artista is not restored', async () => {
      const { query, sql } = runner({ memberBatches: { legal: [['a']], artist: [['z']] } });
      await migration.down({ query } as never);
      const mem = idx(sql, 'UPDATE "org_members"');
      const del = idx(sql, 'DELETE FROM "roles" a');
      const ren = idx(sql, 'UPDATE "roles" r SET "slug" = v.legacy');
      const ins = idx(sql, 'INSERT INTO "roles"');
      expect(mem).toBeGreaterThan(0);
      expect(mem).toBeLessThan(del);
      expect(del).toBeLessThan(ren);
      expect(ren).toBeLessThan(ins);
      expect(sql.some((s) => s.text.includes('SELECT m."id"') && s.params?.[0] === 'artist')).toBe(false);
      expect(sql.some((s) => /DELETE FROM "org_members"/.test(s.text))).toBe(false);
    });

    it('fails verification (rolls back) when the aliases were not restored', async () => {
      await expect(migration.down({ query: runner({ back: 2 }).query } as never)).rejects.toThrow(/down\(\) verification failed/);
    });
  });
});
