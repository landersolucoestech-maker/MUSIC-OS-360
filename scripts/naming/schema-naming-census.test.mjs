/**
 * Guard tests for the schema naming census (node --test, no database: catalog rows are fixtures).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanCatalog, schemaCensus, literalValues } from "./schema-naming-census.mjs";

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

test("tooling error: no DATABASE_URL fails explicitly (exit 2), never false success", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync(process.execPath, [path.join(here, "schema-naming-census.mjs"), "--check"], { env, encoding: "utf8" });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /DATABASE_URL is not set/);
});
