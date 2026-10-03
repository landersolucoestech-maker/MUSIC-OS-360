/**
 * Guard tests for the persisted-residue census (node --test).
 * Logic runs against a fake pg client; derivation runs against the real migration sources (no database);
 * the integration case runs only when RESIDUE_CENSUS_DISPOSABLE_DB=1 and DATABASE_URL points to a disposable PostgreSQL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXIT, SPEC_MIGRATIONS, SCALAR_MIGRATIONS, UNCOVERED, deriveChecks, harvestScalarChecks, harvestSpecChecks, runCensus,
} from "./residue-census.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "residue-census.mjs");

/** Fake pg client: counts by check table, records every statement. */
function fakeClient({ counts = {}, bypass = true, connectError = null, failOn = null } = {}) {
  const statements = [];
  return {
    statements,
    async connect() { if (connectError) throw connectError; },
    async end() { statements.push("END"); },
    async query(sql, params) {
      statements.push(sql);
      if (/pg_roles/.test(sql)) return { rows: [{ bypass }] };
      if (failOn && sql.includes(failOn)) throw new Error("relation does not exist");
      const table = /FROM "(\w+)"/.exec(sql)?.[1];
      if (table) return { rows: [{ n: counts[table] ?? 0 }] };
      return { rows: [] };
    },
  };
}

const checks = [
  { migration: "m1", table: "table_a", column: "col_a", legacy: ["legacy_a"], sql: 'SELECT count(*)::int AS n FROM "table_a" WHERE "col_a" = ANY($1::text[])', params: [["legacy_a"]] },
  { migration: "m2", table: "table_b", column: "col_b", legacy: "predicate_b", sql: 'SELECT count(*)::int AS n FROM "table_b" WHERE (predicate_b)', params: [] },
];

test("exit 0 only when every count is 0; one line per check", async () => {
  const { code, lines } = await runCensus(fakeClient(), checks, { uncovered: [] });
  assert.equal(code, EXIT.CLEAN);
  assert.equal(lines.filter((l) => l.startsWith("OK")).length, 2);
  assert.match(lines[0], /migration=m1 table=table_a column=col_a legacy=\[legacy_a\] count=0/);
  assert.match(lines.at(-1), /CLEAN/);
});

test("exit 1 as soon as any count is above 0, and the residue line names table, column, legacy values and count", async () => {
  const { code, lines } = await runCensus(fakeClient({ counts: { table_b: 3 } }), checks, { uncovered: [] });
  assert.equal(code, EXIT.RESIDUE);
  assert.ok(lines.some((l) => /^RESIDUE .*table=table_b column=col_b legacy=predicate_b count=3/.test(l)));
  assert.match(lines.at(-1), /FOUND 3 legacy row/);
});

test("every statement runs inside BEGIN READ ONLY and is rolled back, never committed", async () => {
  const client = fakeClient({ counts: { table_a: 1 } });
  await runCensus(client, checks, { uncovered: [] });
  assert.equal(client.statements[0], "BEGIN READ ONLY");
  assert.equal(client.statements.at(-2), "ROLLBACK");
  assert.equal(client.statements.at(-1), "END");
  assert.ok(!client.statements.some((s) => /\b(COMMIT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i.test(s)));
});

test("BLOCKED (distinct code, never PASS) when the connection fails", async () => {
  const { code, lines } = await runCensus(fakeClient({ connectError: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }) }), checks);
  assert.equal(code, EXIT.BLOCKED);
  assert.match(lines[0], /^BLOCKED:/);
  assert.notEqual(EXIT.BLOCKED, EXIT.CLEAN);
  assert.notEqual(EXIT.BLOCKED, EXIT.RESIDUE);
});

test("BLOCKED when the role cannot bypass RLS (a zero count would be a false green)", async () => {
  const client = fakeClient({ bypass: false });
  const { code, lines } = await runCensus(client, checks);
  assert.equal(code, EXIT.BLOCKED);
  assert.match(lines[0], /BYPASSRLS/);
  assert.equal(client.statements.filter((s) => s.startsWith("SELECT count")).length, 0);
  assert.ok(client.statements.includes("ROLLBACK"));
});

test("a failing census query is an error (code 2), not a pass", async () => {
  const { code, lines } = await runCensus(fakeClient({ failOn: '"table_b"' }), checks);
  assert.equal(code, EXIT.ERROR);
  assert.match(lines.at(-1), /^ERROR:/);
});

test("uncovered migrations are always listed, never silently dropped", async () => {
  const { lines } = await runCensus(fakeClient(), checks);
  assert.equal(lines.filter((l) => l.startsWith("NOT COVERED")).length, UNCOVERED.length);
});

test("CLI: without DATABASE_URL it prints BLOCKED and exits with the BLOCKED code", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const run = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
  assert.equal(run.status, EXIT.BLOCKED);
  assert.match(run.stderr, /BLOCKED/);
  assert.doesNotMatch(run.stdout, /CLEAN/);
});

test("CLI: an unreachable database is BLOCKED, never PASS", () => {
  const env = { ...process.env, DATABASE_URL: "postgres://nobody:nopass@127.0.0.1:1/none" };
  const run = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
  assert.equal(run.status, EXIT.BLOCKED);
  assert.match(run.stderr, /BLOCKED/);
});

test("harvest: scalar UPDATE shapes yield table, column and the bound legacy values", () => {
  const found = harvestScalarChecks("mx", [
    { sql: 'WITH updated AS (UPDATE "things" SET "kind" = $2 WHERE "kind" = $1 RETURNING id) SELECT count(*)::int AS affected FROM updated', params: ["old_a", "new_a"] },
    { sql: 'WITH updated AS (UPDATE "things" SET "kind" = $2 WHERE "kind" = $1 RETURNING id) SELECT count(*)::int AS affected FROM updated', params: ["old_b", "new_b"] },
  ]);
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].table, found[0].column, found[0].legacy], ["things", "kind", ["old_a", "old_b"]]);
  assert.deepEqual(found[0].params, [["old_a", "old_b"]]);
});

test("harvest: a row backfill's candidatePredicate is copied from the SELECT the migration issues", () => {
  const found = harvestSpecChecks("my", [
    { sql: `SELECT "id", "tenant_id" AS "tenant_id", "metadata" FROM "things" WHERE ("metadata" ?| ARRAY['k1']::text[]) AND "id" > $1 ORDER BY "id" LIMIT 500`, params: ["0"] },
    { sql: "INSERT INTO log VALUES (1)", params: [] },
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].table, "things");
  assert.equal(found[0].sql, `SELECT count(*)::int AS n FROM "things" WHERE ("metadata" ?| ARRAY['k1']::text[])`);
});

test("harvest: a jsonb array guard becomes a syntactically balanced count check over the legacy keys", () => {
  const found = harvestScalarChecks("mz", [
    { sql: `UPDATE "things" SET "kinds" = (SELECT jsonb_agg(x) FROM jsonb_array_elements_text("kinds") x) WHERE jsonb_typeof("kinds") = 'array' AND "kinds" ?| ARRAY['old_a', 'old_b']`, params: [] },
  ]);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].legacy, ["old_a", "old_b"]);
  assert.equal(found[0].sql, `SELECT count(*)::int AS n FROM "things" WHERE jsonb_typeof("kinds") = 'array' AND "kinds" ?| ARRAY['old_a', 'old_b']`);
});

test("derivation from the real migration sources: every listed migration yields read-only count checks with legacy values", async () => {
  const derived = await deriveChecks();
  const byMigration = new Map();
  for (const check of derived) byMigration.set(check.migration, [...(byMigration.get(check.migration) ?? []), check]);
  for (const prefix of [...SPEC_MIGRATIONS, ...SCALAR_MIGRATIONS]) assert.ok(byMigration.has(prefix), `no check derived for ${prefix}`);
  for (const check of derived) {
    assert.match(check.sql, /^SELECT count\(\*\)::int AS n FROM "\w+" WHERE /, check.migration);
    const bare = check.sql.replace(/'[^']*'/g, "''");
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      assert.equal(bare.split(open).length, bare.split(close).length, `${check.migration} ${check.table}.${check.column}: unbalanced ${open}${close} in ${check.sql}`);
    }
    assert.ok(check.legacy.length > 0, `${check.migration} ${check.table}: empty legacy`);
    if (check.params.length > 0) {
      assert.ok(check.params[0].length > 0 && check.params[0].every((v) => typeof v === "string"), `${check.migration} ${check.table}: legacy params`);
      assert.match(check.sql, /\$1::text\[\]/);
    } else {
      assert.doesNotMatch(check.sql, /\$\d/);
    }
  }
});

const disposable = process.env.RESIDUE_CENSUS_DISPOSABLE_DB === "1" && Boolean(process.env.DATABASE_URL);
test("integration (disposable PostgreSQL only): residue is counted, then cleared, and the census wrote nothing", { skip: !disposable && "set RESIDUE_CENSUS_DISPOSABLE_DB=1 and DATABASE_URL to a disposable PostgreSQL" }, async () => {
  const { Client } = createRequire(path.join(here, "..", "..", "apps", "api", "package.json"))("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("CREATE TEMP TABLE invoices (payment_method text)");
    const [check] = await deriveChecks({ specMigrations: [], scalarMigrations: ["20260930000021"] });
    const run = async () => {
      // runCensus owns the connection lifecycle; hand it a session-sharing wrapper so the TEMP table stays visible.
      const shared = { connect: async () => {}, end: async () => {}, query: (sql, params) => client.query(sql, params) };
      return runCensus(shared, [check], { uncovered: [] });
    };
    await client.query("INSERT INTO invoices VALUES ($1)", [check.legacy[0]]);
    const dirty = await run();
    assert.equal(dirty.code, EXIT.RESIDUE);
    assert.match(dirty.lines[0], /count=1/);
    await client.query("DELETE FROM invoices");
    const clean = await run();
    assert.equal(clean.code, EXIT.CLEAN);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM invoices")).rows[0].n, 0);
  } finally {
    await client.end();
  }
});
