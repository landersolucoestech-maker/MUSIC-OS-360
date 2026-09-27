import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import * as entities from './entities';

/**
 * Permanent guard: raw SQL must not reference columns that no longer exist.
 *
 * Column renames (e.g. the technical-English canonicalization) update the
 * TypeORM entities, but raw SQL strings passed to `.query()` are invisible to
 * the compiler, and unit specs mock the driver — so a stale `c.nome` after
 * `campaigns.nome -> name` stays green until it fails in production.
 *
 * For every string/template literal in apps/api/src that looks like SQL, this
 * spec resolves `FROM|JOIN <table> [AS] <alias>` pairs and checks each
 * `<alias>.<column>` reference against the entity columns of that table.
 * Tables without an entity are skipped (nothing to check against).
 */

const SRC = path.resolve(__dirname, '..');

function entityColumnsByTable(): Map<string, Set<string>> {
  void entities; // ensure every @Entity decorator has run
  const storage = getMetadataArgsStorage();
  const byTarget = new Map<unknown, string>();
  for (const t of storage.tables) {
    if (typeof t.name === 'string') byTarget.set(t.target, t.name);
  }
  const out = new Map<string, Set<string>>();
  for (const c of storage.columns) {
    const table = byTarget.get(c.target);
    if (!table) continue;
    const name = (c.options?.name as string | undefined) ?? c.propertyName;
    if (!out.has(table)) out.set(table, new Set());
    out.get(table)!.add(name);
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'migrations' || e.name === 'node_modules') continue;
      walk(full, acc);
    } else if (/\.ts$/.test(e.name) && !/\.(spec|e2e-spec)\.ts$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Tables whose TypeORM entity is known to have drifted from the real schema,
 * so the entity cannot be used as the reference. Each entry is a recorded
 * finding, not a waiver for new code: remove it once the entity is fixed.
 */
const ENTITY_DRIFT_TABLES: Record<string, string> = {
  financial_categories:
    'FinancialCategoryEntity still describes the pre-M2 structure (slug/depth_level/category_kind) replaced by ' +
    '20260718000002; the service queries the real table (level, nature, includes_in_pnl) with raw SQL.',
};

const SQL_HINT = /\b(SELECT|UPDATE|INSERT|DELETE)\b[\s\S]*\b(FROM|INTO|JOIN|SET)\b/i;
const RESERVED = new Set([
  'where', 'on', 'join', 'left', 'right', 'inner', 'outer', 'full', 'cross', 'group', 'order',
  'limit', 'offset', 'set', 'using', 'returning', 'lateral', 'union', 'having', 'for', 'as', 'natural',
]);

export function staleColumnReferences(
  source: string,
  columns: Map<string, Set<string>>,
): Array<{ alias: string; table: string; column: string }> {
  const found: Array<{ alias: string; table: string; column: string }> = [];
  const literals = source.match(/`[^`]*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) ?? [];
  for (const raw of literals) {
    const sql = raw.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
    if (!SQL_HINT.test(sql)) continue;
    const aliases = new Map<string, string>();
    // `(...subquery...) alias` shadows any table of the same name
    const subqueryAliases = new Set(
      [...sql.matchAll(/\)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)\b/gi)].map((m) => m[1]).filter((a) => !RESERVED.has(a.toLowerCase())),
    );
    for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+"?([a-z_][a-z0-9_]*)"?(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi)) {
      const table = m[1].toLowerCase();
      if (!columns.has(table) || table in ENTITY_DRIFT_TABLES) continue;
      const alias = m[2] && !RESERVED.has(m[2].toLowerCase()) ? m[2] : table;
      aliases.set(alias, table);
      aliases.set(table, table);
    }
    for (const m of sql.matchAll(/\b([a-z_][a-z0-9_]*)\."?([a-z_][a-z0-9_]*)"?/gi)) {
      const table = aliases.get(m[1]);
      if (!table || subqueryAliases.has(m[1])) continue;
      const column = m[2];
      if (!columns.get(table)!.has(column)) found.push({ alias: m[1], table, column });
    }
  }
  return found;
}

describe('raw SQL column references (permanent guard)', () => {
  const columns = entityColumnsByTable();

  it('resolves entity metadata for the core tables', () => {
    expect(columns.get('campaigns')?.has('name')).toBe(true);
    expect(columns.get('artists')?.size).toBeGreaterThan(10);
  });

  it('detects a stale column reference (self-test)', () => {
    const src = 'q(`SELECT c.nome FROM campaigns c WHERE c.id = $1`)';
    expect(staleColumnReferences(src, columns)).toEqual([{ alias: 'c', table: 'campaigns', column: 'nome' }]);
  });

  it('ignores a subquery alias that shadows a table name (self-test)', () => {
    const src = 'q(`SELECT artists.artists_count FROM tenants t LEFT JOIN LATERAL (SELECT COUNT(*) AS artists_count FROM artists a) artists ON true`)';
    expect(staleColumnReferences(src, columns)).toEqual([]);
  });

  it('accepts valid references (self-test)', () => {
    const src = 'q(`SELECT c.name, a.id FROM campaigns c LEFT JOIN artists a ON a.id = c.artist_id`)';
    expect(staleColumnReferences(src, columns)).toEqual([]);
  });

  it('no raw SQL in apps/api/src references a column missing from its entity', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      for (const v of staleColumnReferences(fs.readFileSync(file, 'utf8'), columns)) {
        violations.push(`${path.relative(SRC, file)}: ${v.alias}.${v.column} (table ${v.table})`);
      }
    }
    expect(violations).toEqual([]);
  });
});
