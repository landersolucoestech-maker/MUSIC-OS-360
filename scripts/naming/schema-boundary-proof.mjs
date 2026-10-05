#!/usr/bin/env node
/**
 * scripts/naming/schema-boundary-proof.mjs — own-mutation proof of the compatibility boundaries that live in the database schema.
 *
 *   DATABASE_URL=postgresql://…/musicos360 node scripts/naming/schema-boundary-proof.mjs --prove   # needs a migrated disposable PostgreSQL
 *   node scripts/naming/schema-boundary-proof.mjs --check                                         # offline: the recorded proof is fresh and complete
 *
 * Boundary -> own mutation -> relevant check -> mutant killed:
 *   invoices.payment_method legacy value   mutant: chk_invoices_payment_method recreated WITHOUT the legacy value
 *   events.data                               mutant: trigger trg_events_sync_start_columns disabled
 * The covering check is apps/api/scripts/verify-schema-compat-boundaries.ts. For each mutant a THROWAWAY database is created from the
 * migrated one as a template (the migrated database is never altered), the check runs against it and must FAIL; the unmutated copy must PASS.
 * The result is recorded in docs/naming/audit/schema-boundary-proof.json bound to the sha256 of the check script; the classifier
 * (compat-boundary-classify.mjs) credits the two `database-schema` ledger rows only while that record is fresh and complete.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
export const PROOF_FILE = path.join(ROOT, "docs/naming/audit/schema-boundary-proof.json");
export const CHECK_SCRIPT = "apps/api/scripts/verify-schema-compat-boundaries.ts";
export const MUTANTS = [
  { id: "payment-method-legacy-value", ledgerItem: "invoices.payment_method",
    sql: `ALTER TABLE invoices DROP CONSTRAINT chk_invoices_payment_method;
          ALTER TABLE invoices ADD CONSTRAINT chk_invoices_payment_method CHECK (payment_method IN ('pix','ted','boleto','credit_card','debit_card','cash','check','bank_transfer'))` },
  { id: "events-data-sync-trigger", ledgerItem: "events.data", sql: "ALTER TABLE events DISABLE TRIGGER trg_events_sync_start_columns" },
];
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, f))).digest("hex");

/** Offline freshness check of the recorded proof: returns the set of ledger item prefixes proven, or the reason it is not. */
export function loadProof() {
  if (!fs.existsSync(PROOF_FILE)) return { proven: new Set(), reason: "no proof record" };
  const rec = JSON.parse(fs.readFileSync(PROOF_FILE, "utf8"));
  if (rec.checkScriptSha256 !== sha(CHECK_SCRIPT)) return { proven: new Set(), reason: "the check script changed after the proof" };
  if (rec.baseline?.status !== 0) return { proven: new Set(), reason: "the unmutated database did not pass the check" };
  const proven = new Set();
  for (const m of MUTANTS) {
    const r = (rec.mutants ?? []).find((x) => x.id === m.id);
    if (r && r.killed === true && r.status === 1 && r.sqlSha256 === crypto.createHash("sha256").update(m.sql).digest("hex")) proven.add(m.ledgerItem);
  }
  return { proven, reason: proven.size === MUTANTS.length ? "" : "a mutant is missing or survived" };
}

function runCheck(url) {
  const r = spawnSync("npx", ["tsx", "scripts/verify-schema-compat-boundaries.ts"], { cwd: path.join(ROOT, "apps/api"), encoding: "utf8", env: { ...process.env, DATABASE_URL: url, DB_SSL: "false" } });
  return { status: r.status, tail: (r.stdout + r.stderr).trim().split("\n").slice(-3).join(" | ") };
}

async function prove() {
  const base = process.env.DATABASE_URL;
  if (!base) { console.error("DATABASE_URL (a migrated disposable database) is required"); process.exit(2); }
  const { Client } = createRequire(path.join(ROOT, "apps/api/package.json"))("pg");
  const u = new URL(base);
  const template = u.pathname.slice(1);
  const withDb = (db) => { const c = new URL(base); c.pathname = `/${db}`; return c.toString(); };
  const admin = new Client({ connectionString: withDb("postgres") });
  await admin.connect();
  const created = [];
  const copy = async (tag) => { const name = `${template}_boundary_${tag}_${process.pid}`.slice(0, 60); await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`); created.push(name); return name; };
  const rec = { schemaVersion: 1, checkScript: CHECK_SCRIPT, checkScriptSha256: sha(CHECK_SCRIPT), generatedAt: new Date().toISOString(), baseline: null, mutants: [] };
  try {
    const b = await copy("base");
    rec.baseline = runCheck(withDb(b));
    for (const m of MUTANTS) {
      const name = await copy(m.id.replace(/[^a-z]/g, "").slice(0, 8));
      const c = new Client({ connectionString: withDb(name) });
      await c.connect(); await c.query(m.sql); await c.end();
      const r = runCheck(withDb(name));
      rec.mutants.push({ id: m.id, ledgerItem: m.ledgerItem, sqlSha256: crypto.createHash("sha256").update(m.sql).digest("hex"), status: r.status, killed: r.status === 1, tail: r.tail });
    }
  } finally {
    for (const n of created) await admin.query(`DROP DATABASE IF EXISTS "${n}"`).catch(() => undefined);
    await admin.end();
  }
  fs.writeFileSync(PROOF_FILE, JSON.stringify(rec, null, 1) + "\n");
  const survivors = rec.mutants.filter((m) => !m.killed);
  console.log(`schema boundary proof: baseline exit ${rec.baseline.status}; mutants killed ${rec.mutants.length - survivors.length}/${rec.mutants.length}`);
  if (rec.baseline.status !== 0 || survivors.length) process.exit(1);
}

function check() {
  const { proven, reason } = loadProof();
  console.log(`schema boundary proof: ${proven.size}/${MUTANTS.length} boundaries proven${reason ? ` (${reason})` : ""}`);
  if (proven.size !== MUTANTS.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? "--check";
  if (mode === "--prove") prove().catch((e) => { console.error(`schema boundary proof FAILED: ${e.message}`); process.exit(2); });
  else check();
}
