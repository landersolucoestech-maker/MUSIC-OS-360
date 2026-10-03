import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENVS, buildCensus, evaluate, parseTemplate, parseSchema, looksLikeRealSecret, isSecretName, loaderDivergences, renderMatrix, loadConfig,
} from "./env-contract-census.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = () => structuredClone(loadConfig());

test("parseTemplate: active and commented assignments, values dropped from the result", () => {
  const { vars } = parseTemplate("A=1\n# B=2\n#C = not an assignment\n  D=<X>\n# prose: E=1\n");
  assert.deepEqual([...vars], [["A", "active"], ["B", "commented"], ["D", "active"]]);
});

test("looksLikeRealSecret: real shapes are caught, placeholders and truncated JWT prefixes are not", () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b({ alg: "HS256" })}.${b({ ref: "x".repeat(20), role: "anon" })}.${"s".repeat(40)}`;
  assert.equal(looksLikeRealSecret(jwt, "SUPABASE_ANON_KEY"), true);
  assert.equal(looksLikeRealSecret(`${jwt.split(".")[0]}.${b({ a: 1 }).slice(0, 13)}`, "SUPABASE_ANON_KEY"), false);
  assert.equal(looksLikeRealSecret("a".repeat(64), "ENCRYPTION_KEY"), true);
  assert.equal(looksLikeRealSecret("a".repeat(64), "SUPABASE_ANON_KEY"), false, "a non-JWT value cannot be a working Supabase JWT");
  assert.equal(looksLikeRealSecret("sk_live_" + "A".repeat(24), "STRIPE_SECRET_KEY"), true);
  assert.equal(looksLikeRealSecret("<ENCRYPTION_KEY>", "ENCRYPTION_KEY"), false);
  assert.equal(looksLikeRealSecret("postgresql://musicos_app:<APP_DB_PASSWORD>@<DB_HOST>:5432/<DB_NAME>", "APP_DATABASE_URL"), false);
  assert.equal(looksLikeRealSecret("postgresql://u:realpassword123@db.host:5432/x", "DATABASE_URL"), true);
  assert.equal(looksLikeRealSecret("http://localhost:5173", "CORS_ORIGINS"), false);
});

test("isSecretName: secrets by name, public identifiers are not", () => {
  for (const n of ["STRIPE_SECRET_KEY", "ENCRYPTION_KEY", "DATABASE_URL", "ADMIN_QUEUES_PASS", "METRICS_TOKEN", "SENTRY_DSN"]) assert.equal(isSecretName(n), true, n);
  for (const n of ["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SPOTIFY_CLIENT_ID", "META_REDIRECT_URI", "DB_SSL", "PORT", "AUTH_DISABLED"]) assert.equal(isSecretName(n), false, n);
});

test("parseSchema: the real schema yields required-in-production and defaults", () => {
  const schema = parseSchema(fsRead("apps/api/src/core/config/env.schema.ts"));
  assert.equal(schema.get("DATABASE_URL").requiredInProduction, true);
  assert.equal(schema.get("PORT").hasDefault, true);
  assert.equal(schema.get("REDIS_URL").requiredInProduction, false);
  assert.ok(schema.has("DB_SSL") && schema.has("METRICS_TOKEN"), "operational variables read by modules are validated");
});

import fs from "node:fs";
function fsRead(rel) { return fs.readFileSync(path.join(here, "..", rel), "utf8"); }

const baseCensus = () => buildCensus();
const clone = (c) => ({ ...c, tpl: Object.fromEntries(Object.entries(c.tpl).map(([k, m]) => [k, new Map(m)])), cfg: cfg(), rows: structuredClone(c.rows).map((r) => ({ ...r, schemaField: r.schemaField })) });

test("the real tree satisfies the environment contract (0 violations; pending items are declared with a reason)", () => {
  const c = baseCensus();
  const v = evaluate(c);
  const violations = Object.entries(v).filter(([k]) => k !== "PENDING_PROTECTED_TEMPLATE_CLEANUP").flatMap(([k, list]) => list.map((x) => `${k}: ${x}`));
  assert.deepEqual(violations, []);
  for (const item of v.PENDING_PROTECTED_TEMPLATE_CLEANUP) assert.match(item, /authorization/, "every pending item states why it is pending");
});

test("all three environments of the API and the web have a template, and they are the names the loaders document", () => {
  const c = baseCensus();
  assert.deepEqual(c.missingTemplates, []);
  for (const app of ["api", "web"]) for (const env of ENVS) assert.ok(c.tpl[`${app}.${env}`].size > 5, `${app}.${env}`);
});

test("every config declaration carries a reason", () => {
  const c = cfg();
  for (const group of ["environmentSpecific", "templatePrefixes", "templateOnly", "unvalidatedReads", "acceptedSecretDefaults", "buildInjected", "pendingTemplateCleanup", "pendingTemplateAdditions", "undocumentedOk", "documentationOnlyNames"]) {
    for (const [name, reason] of Object.entries(c[group] ?? {})) assert.ok(typeof reason === "string" && reason.trim().length >= 12, `${group}.${name} needs a reason`);
  }
});

test("mutation: removing a production-required variable from the production template is a missing required variable", () => {
  const c = clone(baseCensus());
  c.tpl["api.production"].delete("DATABASE_URL");
  c.rows.find((r) => r.name === "DATABASE_URL").production = "-";
  const v = evaluate(c);
  assert.ok(v.MISSING_REQUIRED_VARIABLES.some((x) => x.startsWith("DATABASE_URL")));
});

test("mutation: dropping a variable from the development template is drift (staging and production document it)", () => {
  const c = clone(baseCensus());
  c.tpl["api.development"].delete("SENTRY_DSN");
  const v = evaluate(c);
  assert.ok(v.COMMON_OBLIGATION_DRIFT.some((x) => x.startsWith("SENTRY_DSN")), JSON.stringify(v.COMMON_OBLIGATION_DRIFT));
});

test("mutation: a variable only in staging (not production) is drift unless it is declared environment-specific", () => {
  const c = clone(baseCensus());
  c.tpl["api.staging"].set("BRAND_NEW_FLAG", "active");
  assert.ok(evaluate(c).COMMON_OBLIGATION_DRIFT.some((x) => x.startsWith("BRAND_NEW_FLAG")));
  const c2 = clone(baseCensus());
  c2.tpl["api.staging"].set("BRAND_NEW_FLAG", "active");
  c2.cfg.environmentSpecific.BRAND_NEW_FLAG = "staging-only on purpose";
  assert.ok(!evaluate(c2).COMMON_OBLIGATION_DRIFT.some((x) => x.startsWith("BRAND_NEW_FLAG")));
});

test("mutation: a web variable missing from one environment template is flagged", () => {
  const c = clone(baseCensus());
  c.tpl["web.production"].delete("VITE_POSTHOG_KEY");
  assert.ok(evaluate(c).COMMON_OBLIGATION_DRIFT.some((x) => x.startsWith("VITE_POSTHOG_KEY")));
});

test("mutation: the build-injected web variable is not a template obligation", () => {
  const v = evaluate(baseCensus());
  assert.ok(![...v.WEB_TEMPLATE_DRIFT, ...v.COMMON_OBLIGATION_DRIFT, ...v.ENV_SCHEMA_DIVERGENCES].some((x) => x.startsWith("VITE_COMMIT_SHA")));
});

test("mutation: a secret-looking value in a template is reported without printing it", () => {
  const c = clone(baseCensus());
  c.secretValueViolations = ["apps/api/.env.staging: ENCRYPTION_KEY"];
  const v = evaluate(c);
  assert.deepEqual(v.SECRET_LOOKING_VALUES, ["apps/api/.env.staging: ENCRYPTION_KEY"]);
});

test("mutation: a template variable the schema does not know and nothing declares is a schema divergence", () => {
  const c = clone(baseCensus());
  c.tpl["api.production"].set("GHOST_SETTING", "active");
  c.tpl["api.staging"].set("GHOST_SETTING", "active");
  c.tpl["api.development"].set("GHOST_SETTING", "commented");
  c.rows.push({ name: "GHOST_SETTING", development: "opt:api", staging: "set:api", production: "set:api", api: "-", web: "-", required: "-", defaultValue: "-", validated: "NO", secret: "no", source: "x", schemaField: null, apiUsedIn: [], webUsedIn: [], isWeb: false });
  assert.ok(evaluate(c).ENV_SCHEMA_DIVERGENCES.some((x) => x.startsWith("GHOST_SETTING")));
});

test("mutation: an API read that the schema does not validate and nothing declares is an unvalidated variable", () => {
  const c = clone(baseCensus());
  c.rows.push({ name: "NEW_RUNTIME_KNOB", development: "-", staging: "-", production: "-", api: "Y", web: "-", required: "-", defaultValue: "-", validated: "NO", secret: "no", source: "api-src", schemaField: null, apiUsedIn: ["apps/api/src/x.ts"], webUsedIn: [], isWeb: false });
  assert.ok(evaluate(c).UNVALIDATED_VARIABLES.some((x) => x.startsWith("NEW_RUNTIME_KNOB")));
});

test("mutation: a literal fallback on a secret-named variable is an unsafe default unless accepted with a reason", () => {
  const c = clone(baseCensus());
  c.fallbacks = new Map([...c.fallbacks, ["BRAND_NEW_SECRET", ["apps/api/src/x.ts"]]]);
  assert.ok(evaluate(c).UNSAFE_DEFAULTS.some((x) => x.startsWith("BRAND_NEW_SECRET")));
  assert.ok(!evaluate(baseCensus()).UNSAFE_DEFAULTS.length);
});

test("loaderDivergences: a bare dotenv load and an undeclared dotenv dependency are reported", () => {
  const files = ["apps/api/scripts/zz-fixture-never-tracked.ts"];
  // fixtures are exercised through the pure rule on in-memory sources
  const src = { "apps/api/scripts/a.ts": "require('dotenv').config();", "apps/api/scripts/b.ts": "import 'dotenv/config';", "apps/api/scripts/c.ts": "require('dotenv').config({ path: p });" };
  const origRead = fs.readFileSync;
  fs.readFileSync = (p, ...rest) => (Object.keys(src).some((k) => String(p).endsWith(k)) ? src[Object.keys(src).find((k) => String(p).endsWith(k))] : origRead(p, ...rest));
  try {
    const declared = loaderDivergences(Object.keys(src), { dependencies: { dotenv: "16.4.5" } });
    assert.equal(declared.filter((x) => x.includes("bare dotenv")).length, 2);
    assert.ok(!declared.some((x) => x.startsWith("apps/api/scripts/c.ts")));
    const undeclared = loaderDivergences(["apps/api/scripts/c.ts"], { dependencies: {} });
    assert.ok(undeclared.some((x) => x.includes("does not declare")));
  } finally { fs.readFileSync = origRead; }
  assert.deepEqual(files.length, 1);
});

test("the real API declares dotenv and has no bare loader", () => {
  assert.deepEqual(baseCensus().loaderDivergences, []);
});

test("renderMatrix: the matrix has the eleven requested columns and never contains a value", () => {
  const c = baseCensus();
  const { tsv, md } = renderMatrix(c, evaluate(c));
  assert.equal(tsv.split("\n")[0], "VARIABLE\tDEVELOPMENT\tSTAGING\tPRODUCTION\tAPI\tWEB\tREQUIRED\tDEFAULT\tVALIDATED\tSECRET\tSOURCE");
  assert.ok(md.startsWith("| VARIABLE | DEVELOPMENT | STAGING | PRODUCTION | API | WEB | REQUIRED | DEFAULT | VALIDATED | SECRET | SOURCE |"));
  assert.doesNotMatch(tsv, /eyJ[A-Za-z0-9_-]{10,}\./);
  const row = tsv.split("\n").find((l) => l.startsWith("DATABASE_URL\t"));
  assert.match(row, /set:api/);
});

test("CLI: --check exits 0 on the real tree", () => {
  const run = spawnSync(process.execPath, [path.join(here, "env-contract-census.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /0 violation\(s\)/);
});
