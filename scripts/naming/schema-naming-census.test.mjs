/**
 * Guard tests for the schema naming census (node --test, no database: catalog rows are fixtures).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanCatalog, schemaCensus, literalValues, CATALOG_SQL } from "./schema-naming-census.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const keys = (rows) => scanCatalog(rows).map((h) => h.key);

test("object names: Portuguese tables, columns, indexes, constraints, functions, triggers, policies and enum labels are flagged", () => {
  const rows = [
    { kind: "table", object: "lancamentos" },
    { kind: "column", object: "clients.nome" },
    { kind: "index", object: "contracts.idx_contracts_data_fim" },
    { kind: "constraint", object: "shares.chk_shares_percentual_range", detail: "CHECK ((percentage >= 0))" },
    { kind: "function", object: "calcular_repasse" },
    { kind: "trigger", object: "releases.trg_atualizar_status" },
    { kind: "policy", object: "clients.clientes_tenant_isolation" },
    { kind: "enum", object: "release_status=planejamento" },
  ];
  assert.deepEqual(keys(rows), [
    "schema::table::lancamentos", "schema::column::clients.nome", "schema::index::contracts.idx_contracts_data_fim",
    "schema::constraint::shares.chk_shares_percentual_range", "schema::function::calcular_repasse",
    "schema::trigger::releases.trg_atualizar_status", "schema::policy::clients.clientes_tenant_isolation", "schema::enum::release_status=planejamento",
  ]);
});

test("persisted values: Portuguese CHECK literals and column defaults are flagged; English ones and UX-shaped text are not", () => {
  const rows = [
    { kind: "constraint", object: "project_track_participants.chk_role", detail: "CHECK (((role)::text = ANY ((ARRAY['compositor'::character varying, 'performer'::character varying])::text[])))" },
    { kind: "default", object: "releases.status", detail: "'planejamento'::character varying" },
    { kind: "default", object: "leads.status", detail: "'new'::character varying" },
    { kind: "default", object: "settings.greeting", detail: "'Olá, seja bem-vindo'::text" },
  ];
  assert.deepEqual(keys(rows), [
    "schema::constraint-value::project_track_participants.chk_role::compositor",
    "schema::default-value::releases.status::planejamento",
  ]);
});

test("English schema and the migrations tracking table are never flagged", () => {
  const rows = [
    { kind: "table", object: "musicos360_migrations" },
    { kind: "column", object: "musicos360_migrations.name" },
    { kind: "column", object: "releases.release_date" },
    { kind: "index", object: "contracts.idx_contracts_end_date" },
    { kind: "function", object: "current_tenant_id" },
  ];
  assert.deepEqual(keys(rows), []);
});

test("literalValues: reads quoted literals (with escaped quotes) and keeps only token-shaped values", () => {
  assert.deepEqual(literalValues("CHECK (status IN ('pendente', 'it''s fine', 'pago'))"), ["pendente", "pago"]);
  assert.deepEqual(literalValues(null), []);
});

test("exceptions: legal-domain words and schema-surface exceptions are not debt", () => {
  const exceptions = { get: (file, name, surface) => (surface === "schema" && ["cnpj", "tomador_uf"].includes(name) ? { currentName: name } : undefined) };
  const c = schemaCensus([{ kind: "column", object: "invoices.cnpj" }, { kind: "column", object: "invoices.tomador_uf" }, { kind: "column", object: "clients.nome" }], { exceptions });
  assert.deepEqual(Object.keys(c.debt), ["schema::column::clients.nome"]);
  assert.deepEqual(Object.keys(c.excepted).sort(), ["schema::column::invoices.cnpj", "schema::column::invoices.tomador_uf"]);
});

test("stale schema rows: an ACTIVE database-schema row matching no catalog object is reported, a matching one is not", () => {
  const live = { currentName: "invoices.nome_x", surface: "schema", path: "database-schema" };
  const stale = { currentName: "gone.table_col", surface: "schema", path: "database-schema" };
  const other = { currentName: "elsewhere", surface: "schema", path: "apps/api/src/x.ts" };
  const exceptions = { rows: [live, stale, other], get: (file, name, surface) => (surface === "schema" && name === "nome_x" ? live : undefined) };
  const c = schemaCensus([{ kind: "column", object: "invoices.nome_x" }], { exceptions });
  assert.deepEqual(c.unusedRows, [stale]);
  assert.deepEqual(Object.keys(c.debt), []);
});

test("tooling error: no DATABASE_URL fails explicitly (exit 2), never false success", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync(process.execPath, [path.join(here, "schema-naming-census.mjs"), "--check"], { env, encoding: "utf8" });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /DATABASE_URL is not set/);
});

test("catalog SQL: object and detail are text, so long table.constraint keys are never clipped at 63 characters", () => {
  // The first UNION branch reads pg_class.relname (type `name`); without the casts the whole column resolves to `name`
  // and a 74-character key loses its tail — hiding real words and flagging the clipped fragment ("amou").
  assert.match(CATALOG_SQL, /c\.relname::text AS object/);
  assert.match(CATALOG_SQL, /NULL::text AS detail/);
});

test("an ambiguous date column named `data` is flagged by table.column, a non-date `data` column is not", () => {
  const rows = [
    { kind: "column", object: "events.data", detail: "timestamp without time zone" },
    { kind: "column", object: "interactions.data", detail: "date" },
    { kind: "column", object: "blobs.data", detail: "bytea" },
    { kind: "column", object: "docs.data", detail: "jsonb" },
  ];
  assert.deepEqual(scanCatalog(rows).map((h) => h.name), ["events.data", "interactions.data"]);
});
