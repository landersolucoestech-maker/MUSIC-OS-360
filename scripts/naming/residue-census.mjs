#!/usr/bin/env node
/**
 * Read-only residue census of the persisted legacy-vocabulary backfills.
 *
 * For every covered backfill migration it counts the rows that still hold legacy values, inside
 * `BEGIN READ ONLY` against DATABASE_URL (never a write, always ROLLBACK). One line per check:
 * migration, table, column/expression, legacy values (or predicate), count.
 *
 * Nothing is typed from memory: the predicates and legacy values are harvested from the migrations'
 * own code. Every migration `up()` is executed against a recording query runner (no database): the
 * jsonb row backfills expose their `candidatePredicate` in the SELECT they issue, and the scalar
 * backfills expose their exact-match legacy list as the bound parameters of their UPDATE.
 *
 * Exit codes: 0 every count is 0 | 1 residue found | 2 derivation/query error (never PASS)
 *             3 BLOCKED (no DATABASE_URL, connection failure, or a role that cannot see every tenant).
 *
 * Not covered (no mechanical exact-match backfill to harvest; listed in every run, never silently dropped):
 * see UNCOVERED below.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");
const API_ROOT = path.join(REPO_ROOT, "apps", "api");
const MIGRATIONS_DIR = path.join(API_ROOT, "src", "database", "migrations");

export const EXIT = { CLEAN: 0, RESIDUE: 1, ERROR: 2, BLOCKED: 3 };

/** jsonb row backfills (RowBackfillSpec): the predicate is read from the SELECT the migration issues. */
export const SPEC_MIGRATIONS = [
  "20260930000019", "20260930000023", "20260930000024", "20260930000025", "20260930000026",
  "20260930000027", "20260930000028", "20260930000029", "20260930000031", "20260930000032",
];

/** Scalar / exact-match backfills: legacy values are the bound parameters of the migration's own UPDATE. */
export const SCALAR_MIGRATIONS = [
  "20260930000002", "20260930000003", "20260930000010", "20260930000012", "20260930000013",
  "20260930000014", "20260930000021", "20260928000019",
];

/** Related migrations of the REQUIRES_ENVIRONMENT_BACKFILL_PROOF groups that this census does not cover. */
export const UNCOVERED = [
  { migration: "20260930000001", reason: "RBAC alias seeding (no value rewrite to harvest)" },
  { migration: "20260930000030", reason: "RBAC in-place role canonicalization draft (not an applied migration)" },
  { migration: "20260930000011", reason: "constraint validation only (counts values outside the canonical set, not legacy values)" },
  { migration: "20260930000016", reason: "operational list classification (legacy_slug census is a separate preflight)" },
  { migration: "20260930000017", reason: "external rights receipts / category slugs (custom SQL)" },
  { migration: "20260930000018", reason: "transaction taxonomy (custom SQL, free-text residue)" },
  { migration: "20260928000022", reason: "artist column renames and team_contacts rewrite (custom SQL)" },
  { migration: "20260526000002", reason: "financial_categories seed slugs (no backfill)" },
];

// ---------------------------------------------------------------------------------------------
// Recording runner: execute a migration's up() without a database and keep every query it issues.
// ---------------------------------------------------------------------------------------------

const apiRequire = createRequire(path.join(API_ROOT, "package.json"));

function loadTsModule(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const ts = apiRequire("typescript");
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  cache.set(file, module);
  const localRequire = (id) => {
    if (id.startsWith(".")) {
      const base = path.resolve(path.dirname(file), id);
      const target = [`${base}.ts`, path.join(base, "index.ts")].find((candidate) => fs.existsSync(candidate));
      if (!target) throw new Error(`cannot resolve ${id} from ${file}`);
      return loadTsModule(target, cache);
    }
    return apiRequire(id);
  };
  new Function("require", "module", "exports", out)(localRequire, module, module.exports);
  return module.exports;
}

const zeroRow = () => new Proxy({}, { get: () => 0 });

function recordingRunner() {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql: String(sql), params });
      if (/FROM pg_roles WHERE rolname = current_user/.test(sql)) return [{ bypass: true }];
      // Row-listing reads (batches, DISTINCT audits): an empty database has none, so no guard aborts the recording.
      if (/ORDER BY "id" LIMIT|SELECT DISTINCT/.test(sql)) return [];
      if (/to_regclass/.test(sql)) return [{ present: false }];
      return [zeroRow()];
    },
  };
}

export async function recordMigration(prefix, dir = MIGRATIONS_DIR) {
  const file = fs.readdirSync(dir).filter((name) => name.startsWith(`${prefix}_`) && name.endsWith(".ts") && !name.includes(".spec."))[0];
  if (!file) throw new Error(`migration ${prefix} not found in ${dir}`);
  const exports = loadTsModule(path.join(dir, file));
  const Migration = Object.values(exports).find((value) => typeof value === "function" && /^\s*class\s/.test(Function.prototype.toString.call(value)));
  if (!Migration) throw new Error(`migration ${prefix}: no migration class exported`);
  const runner = recordingRunner();
  const log = console.log;
  console.log = () => {};
  try {
    await new Migration().up(runner);
  } finally {
    console.log = log;
  }
  return { file, queries: runner.queries };
}

// ---------------------------------------------------------------------------------------------
// Harvesting: queries -> checks. A check is { migration, table, column, legacy, sql, params }.
// ---------------------------------------------------------------------------------------------

const SPEC_SELECT = /^\s*SELECT .* FROM "(\w+)" WHERE \(([\s\S]*)\) AND "id" > \$1 ORDER BY "id" LIMIT/;

export function harvestSpecChecks(migration, queries) {
  const seen = new Set();
  const checks = [];
  for (const { sql } of queries) {
    const match = SPEC_SELECT.exec(sql);
    if (!match) continue;
    const [, table, predicate] = match;
    const key = `${table}|${predicate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checks.push({
      migration, table, column: "(candidatePredicate)", legacy: predicate.replace(/\s+/g, " ").trim(),
      sql: `SELECT count(*)::int AS n FROM "${table}" WHERE (${predicate})`, params: [],
    });
  }
  return checks;
}

const ANY = (expr) => `${expr} = ANY($1::text[])`;
/** Each rule recognises one UPDATE shape of a scalar backfill and says where its legacy values and predicate are. */
const SCALAR_RULES = [
  { // UPDATE "t" SET "c" = $2 WHERE "c" = $1
    re: /UPDATE "(\w+)" SET "(\w+)" = \$2 WHERE "\2" = \$1/,
    pick: (m, q) => ({ table: m[1], column: m[2], expr: `"${m[2]}"`, legacy: [q.params[0]], predicate: ANY(`"${m[2]}"`) }),
  },
  { // UPDATE "t" SET "c" = $2 WHERE <normalized expression> = $1 AND "c" <> $2
    re: /UPDATE "(\w+)" SET "(\w+)" = \$2\s+WHERE ([\s\S]+?) = \$1 AND "\2" <> \$2/,
    pick: (m, q) => ({ table: m[1], column: m[2], expr: m[3], legacy: [q.params[0]], predicate: ANY(m[3]) }),
  },
  { // UPDATE "t" AS x SET "c" = m.canonical FROM unnest($1::text[], $2::text[]) ...
    re: /UPDATE "(\w+)" AS \w+ SET "(\w+)" = m\.canonical\s+FROM unnest\(\$1::text\[\]/,
    pick: (m, q) => ({ table: m[1], column: m[2], expr: `"${m[2]}"`, legacy: q.params[0], predicate: ANY(`"${m[2]}"`) }),
  },
  { // UPDATE "t" SET "metadata" = ..., "c" = $2 WHERE "c" = $1 AND <metadata guard>
    re: /UPDATE "(\w+)"\s+SET "metadata"[\s\S]*?"(\w+)" = \$2\s+WHERE "\2" = \$1 AND/,
    pick: (m, q) => ({ table: m[1], column: m[2], expr: `"${m[2]}"`, legacy: [q.params[0]], predicate: ANY(`"${m[2]}"`) }),
  },
  { // UPDATE "t" SET "metadata" = ..., "c" = $1 WHERE lower(trim("c")) = $2
    re: /UPDATE "(\w+)"\s+SET "metadata"[\s\S]*?"(\w+)" = \$1\s+WHERE lower\(trim\("\2"\)\) = \$2/,
    pick: (m, q) => ({ table: m[1], column: m[2], expr: `lower(trim("${m[2]}"))`, legacy: [q.params[1]], predicate: ANY(`lower(trim("${m[2]}"))`) }),
  },
  { // UPDATE "t" SET "metadata" = jsonb_set("metadata", '{k}', ...) WHERE jsonb_typeof("metadata"->'k') = 'string' AND lower(trim("metadata"->>'k')) = $1
    re: /UPDATE "(\w+)" SET "metadata" = jsonb_set\("metadata", '\{(\w+)\}'[\s\S]*?WHERE jsonb_typeof\("metadata"->'\2'\) = 'string'\s+AND lower\(trim\("metadata"->>'\2'\)\) = \$1/,
    pick: (m, q) => ({
      table: m[1], column: `metadata->>${m[2]}`, expr: `lower(trim("metadata"->>'${m[2]}'))`, legacy: [q.params[0]],
      predicate: `jsonb_typeof("metadata"->'${m[2]}') = 'string' AND ${ANY(`lower(trim("metadata"->>'${m[2]}'))`)}`,
    }),
  },
];

const ARRAY_GUARD = /UPDATE "(\w+)" SET "(\w+)" = \([\s\S]*?WHERE (jsonb_typeof\("\2"\) = 'array' AND "\2" \?\| ARRAY\[([^\]]*)\])/;

export function harvestScalarChecks(migration, queries) {
  const merged = new Map();
  for (const query of queries) {
    const guard = ARRAY_GUARD.exec(query.sql);
    if (guard) {
      const [, table, column, predicate, list] = guard;
      const legacy = [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      merged.set(`${table}|${column}|array`, { migration, table, column, legacy, sql: `SELECT count(*)::int AS n FROM "${table}" WHERE ${predicate}`, params: [] });
      continue;
    }
    for (const rule of SCALAR_RULES) {
      const m = rule.re.exec(query.sql);
      if (!m) continue;
      const hit = rule.pick(m, query);
      const key = `${hit.table}|${hit.column}|${hit.expr}`;
      const existing = merged.get(key);
      const legacy = [...new Set([...(existing?.legacy ?? []), ...hit.legacy])];
      merged.set(key, {
        migration, table: hit.table, column: hit.column, legacy,
        sql: `SELECT count(*)::int AS n FROM "${hit.table}" WHERE ${hit.predicate}`, params: [legacy],
      });
      break;
    }
  }
  return [...merged.values()];
}

/** Derive every check from the migrations' own code. Throws when a listed migration yields no check. */
export async function deriveChecks({ dir = MIGRATIONS_DIR, specMigrations = SPEC_MIGRATIONS, scalarMigrations = SCALAR_MIGRATIONS } = {}) {
  const checks = [];
  for (const [list, harvest] of [[specMigrations, harvestSpecChecks], [scalarMigrations, harvestScalarChecks]]) {
    for (const prefix of list) {
      const { queries } = await recordMigration(prefix, dir);
      const found = harvest(prefix, queries);
      if (found.length === 0) throw new Error(`migration ${prefix}: no residue predicate could be harvested from its up()`);
      checks.push(...found);
    }
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------------------------

const describe = (legacy) => (Array.isArray(legacy) ? `[${legacy.join(", ")}]` : legacy);
export const formatLine = (check, count) =>
  `${count === 0 ? "OK     " : "RESIDUE"} migration=${check.migration} table=${check.table} column=${check.column} legacy=${describe(check.legacy)} count=${count}`;

/**
 * Runs every check in one READ ONLY transaction. Returns { code, lines }.
 * `client` is any object with connect/query/end (pg.Client or a fake).
 */
export async function runCensus(client, checks, { uncovered = UNCOVERED } = {}) {
  const lines = [];
  try {
    await client.connect();
  } catch (error) {
    return { code: EXIT.BLOCKED, lines: [`BLOCKED: cannot connect to the database (${error.code ?? error.message}); residue not measured`] };
  }
  let started = false;
  try {
    await client.query("BEGIN READ ONLY");
    started = true;
    const role = await client.query("SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user");
    if (role.rows?.[0]?.bypass !== true) {
      return { code: EXIT.BLOCKED, lines: ["BLOCKED: the connected role is neither superuser nor BYPASSRLS, tenant row-level security would hide residue; residue not measured"] };
    }
    let residue = 0;
    for (const check of checks) {
      const result = await client.query(check.sql, check.params);
      const count = Number(result.rows?.[0]?.n);
      if (!Number.isInteger(count) || count < 0) throw new Error(`unexpected count for ${check.migration} ${check.table}`);
      residue += count;
      lines.push(formatLine(check, count));
    }
    for (const item of uncovered) lines.push(`NOT COVERED migration=${item.migration} (${item.reason})`);
    lines.push(residue === 0 ? `RESIDUE CENSUS CLEAN: ${checks.length} check(s), 0 legacy row(s)` : `RESIDUE CENSUS FOUND ${residue} legacy row(s) across ${checks.length} check(s)`);
    return { code: residue === 0 ? EXIT.CLEAN : EXIT.RESIDUE, lines };
  } catch (error) {
    return { code: EXIT.ERROR, lines: [...lines, `ERROR: ${error.message}`] };
  } finally {
    if (started) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

export async function main(env = process.env) {
  const url = env.DATABASE_URL;
  if (!url) {
    console.error("BLOCKED: DATABASE_URL is not set; residue not measured (this is not a pass)");
    return EXIT.BLOCKED;
  }
  let checks;
  try {
    checks = await deriveChecks();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return EXIT.ERROR;
  }
  const { Client } = apiRequire("pg");
  const { code, lines } = await runCensus(new Client({ connectionString: url }), checks);
  for (const line of lines) (code === EXIT.CLEAN || code === EXIT.RESIDUE ? console.log : console.error)(line);
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
