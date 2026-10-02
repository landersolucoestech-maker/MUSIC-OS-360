#!/usr/bin/env node
/**
 * scripts/naming/schema-naming-census.mjs — naming census of the MIGRATED database schema.
 *
 * Published migrations are immutable history, so the source files cannot show what the
 * schema is today. This guard reads the live catalog of a database migrated from scratch
 * (CI: the fresh-PostgreSQL job, after db:migrate) and ratchets every Portuguese technical
 * name in it: tables, columns (including columns no entity maps), views, indexes,
 * constraints, functions, triggers, RLS policies, enum labels, and the persisted values
 * CHECK constraints and column defaults allow.
 *
 *   DATABASE_URL=... node scripts/naming/schema-naming-census.mjs --check   # CI guard
 *   DATABASE_URL=... node scripts/naming/schema-naming-census.mjs --write   # regenerate baseline
 *   DATABASE_URL=... node scripts/naming/schema-naming-census.mjs --list
 *
 * Same contract as technical-naming-census.mjs: growth and shrinkage both fail; exceptions
 * only through docs/naming/canonical-naming-map.json (surface "schema", or the legal-domain
 * words registered for every file). No DATABASE_URL, no objects read, or a catalog error
 * exits non-zero: the guard never reports success on an empty scan.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ptWords } from "./pt-lexicon.mjs";
import { ROOT, loadAuthority, exceptionIndex } from "./canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_BASELINE = process.env.SCHEMA_NAMING_BASELINE_PATH
  ? path.resolve(process.env.SCHEMA_NAMING_BASELINE_PATH) : path.join(here, "schema-naming-baseline.json");
const SCHEMA_FILE = "database-schema";
const TRACKING_TABLE = "musicos360_migrations";
const VALUE = /^[a-z][a-zA-Z0-9]*(?:[_-][a-zA-Z0-9]+)*$/;

// `object` and `detail` are cast to text: the first branch is a `name` column, so without the cast the
// UNION resolves to `name` and clips every `table.constraint` / `table.index` key at 63 characters,
// hiding the tail of long names and flagging truncated fragments as words.
export const CATALOG_SQL = `
  SELECT 'table' AS kind, c.relname::text AS object, NULL::text AS detail FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  UNION ALL SELECT 'view', table_name, NULL FROM information_schema.views WHERE table_schema = 'public'
  UNION ALL SELECT 'column', table_name || '.' || column_name, NULL FROM information_schema.columns WHERE table_schema = 'public'
  UNION ALL SELECT 'index', tablename || '.' || indexname, NULL FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL SELECT 'constraint', c.conrelid::regclass::text || '.' || c.conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'
  UNION ALL SELECT 'function', p.proname, NULL FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  UNION ALL SELECT 'trigger', event_object_table || '.' || trigger_name, NULL FROM information_schema.triggers WHERE trigger_schema = 'public'
  UNION ALL SELECT 'policy', tablename || '.' || policyname, NULL FROM pg_policies WHERE schemaname = 'public'
  UNION ALL SELECT 'enum', t.typname || '=' || e.enumlabel, NULL FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
  UNION ALL SELECT 'default', table_name || '.' || column_name, column_default FROM information_schema.columns
   WHERE table_schema = 'public' AND column_default IS NOT NULL`;

/** Quoted literals of a CHECK definition or a column default that look like technical values. */
export function literalValues(sql) {
  return [...String(sql ?? "").matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]).filter((v) => VALUE.test(v));
}

/**
 * Classifies catalog rows into hits { key, name }. Pure: the caller provides the rows.
 * `name` is the word-bearing part the exception ledger is matched against.
 */
export function scanCatalog(rows) {
  const hits = [];
  for (const { kind, object, detail } of rows) {
    if (object === TRACKING_TABLE || object.startsWith(`${TRACKING_TABLE}.`)) continue;
    if (kind === "default" || kind === "constraint") {
      for (const v of literalValues(detail)) if (ptWords(v).length) hits.push({ key: `schema::${kind}-value::${object}::${v}`, name: v });
      if (kind === "default") continue;
    }
    const name = kind === "enum" ? object.split("=").pop() : object.split(".").pop();
    if (ptWords(name).length) hits.push({ key: `schema::${kind}::${object}`, name });
  }
  return hits;
}

export function schemaCensus(rows, { exceptions = exceptionIndex(loadAuthority()) } = {}) {
  const debt = {};
  const excepted = {};
  for (const h of scanCatalog(rows)) {
    const bucket = exceptions.get(SCHEMA_FILE, h.name, "schema") ? excepted : debt;
    bucket[h.key] = (bucket[h.key] ?? 0) + 1;
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { debt: sorted(debt), excepted: sorted(excepted) };
}

async function readCatalog() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — the schema census needs a migrated database");
  const require = createRequire(path.join(ROOT, "apps/api/package.json"));
  const { Client } = require("pg");
  const client = new Client({ connectionString: url, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    const { rows } = await client.query(CATALOG_SQL);
    if (!rows.some((r) => r.kind === "table")) throw new Error("no tables in schema public — refusing to report success on an unmigrated database");
    return rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  const rows = await readCatalog();
  const c = schemaCensus(rows);
  const total = Object.values(c.debt).reduce((a, b) => a + b, 0);
  if (mode === "--write") {
    fs.writeFileSync(SCHEMA_BASELINE, JSON.stringify({ total, debt: c.debt }, null, 1) + "\n");
    console.log(`schema naming baseline written: ${total} entries`);
    return;
  }
  if (mode === "--list") { for (const k of Object.keys(c.debt)) console.log(k); return; }
  if (mode !== "--check") throw new Error(`unknown mode ${mode}`);
  if (!fs.existsSync(SCHEMA_BASELINE)) throw new Error(`baseline not found: ${path.relative(ROOT, SCHEMA_BASELINE)}`);
  const base = JSON.parse(fs.readFileSync(SCHEMA_BASELINE, "utf8"));
  if (!base.debt || typeof base.debt !== "object") throw new Error("schema baseline has no debt section");
  const grown = Object.keys(c.debt).filter((k) => !(k in base.debt));
  const shrunk = Object.keys(base.debt).filter((k) => !(k in c.debt));
  console.log(`schema naming census: ${rows.length} catalog objects, ${total} Portuguese names (${Object.keys(c.excepted).length} excepted)`);
  if (grown.length) console.error(`\nNEW Portuguese schema names (rename in a migration, or register an exception):\n  ${grown.join("\n  ")}`);
  if (shrunk.length) console.error(`\nSchema baseline is stale — these names are gone; drop them in the same commit (--write):\n  ${shrunk.join("\n  ")}`);
  if (grown.length || shrunk.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`schema naming census FAILED: ${err.message}`); process.exit(2); });
}
