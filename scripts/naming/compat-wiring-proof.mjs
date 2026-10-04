#!/usr/bin/env node
/**
 * scripts/naming/compat-wiring-proof.mjs: proof that the WIRING of a deprecated-field alias helper in production code is needed.
 *
 *   node scripts/naming/compat-wiring-proof.mjs --check [--list]      gate: every call site has a fresh record that was KILLED (exit 1 otherwise)
 *   node scripts/naming/compat-wiring-proof.mjs --prove [--shards N] [--only <substr>]
 *                                                                      mutate every call site on sandbox copies and (re)write the proof file
 *
 * The per-name mutation proof (compat-mutation-proof.mjs) renames the legacy names of a row's runtime file. It cannot see that a SERVICE stopped
 * calling the alias helper: the DTO still accepts the legacy field and the table spec still passes, but a pre-rename client's value is silently
 * dropped (r14 re-review F3: 6 of 43 call sites). This script closes that class by construction: for every production call
 * `applyDeprecatedFieldAliases(x, TABLE)` the call is replaced by its first argument (`x`) and the tests of the owning module must fail
 * by ASSERTION. A compile/load error is inconclusive, never a kill. Records are bound to the sha256 of the file and of every spec file of
 * the module, so any later edit of either makes the record stale until `--prove` runs again.
 *
 * Covered helpers: HELPERS below. The other alias helpers (resolveContractAliases, resolvePhonogramAliases, ...) return structured results and
 * need their own operator; they are listed in docs/engineering/naming-state-separation.md under known limits, not hidden.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { classifyRun } from "./compat-mutation-proof.mjs";
import { makeSandbox } from "./compat-prove-sandbox.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const ARG = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const HAS = (n) => process.argv.includes(n);
export const PROOF_FILE = path.join(REPO, "docs/naming/audit/compat-wiring-proof.json");
export const HELPERS = new Set(["applyDeprecatedFieldAliases"]);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const require = createRequire(path.join(REPO, "apps/api/package.json"));
const ts = require("typescript");

const isSpec = (f) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(f);

function walk(root, dir, out) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(root, rel, out);
    else if (/\.ts$/.test(e.name)) out.push(rel);
  }
  return out;
}

/** The module that owns a production file: its spec files are the tests that must notice the wiring. */
export function moduleDirOf(file) {
  const m = /^(apps\/api\/src\/(?:modules|core)\/[^/]+)\//.exec(file);
  return m ? m[1] : path.posix.dirname(file);
}

/** Every production call of a covered helper: { file, line, text, start, end, first }. Pure over the file texts. */
export function wiringSites(files) {
  const out = [];
  for (const [file, text] of files) {
    if (isSpec(file) || ![...HELPERS].some((h) => text.includes(h))) continue;
    if ([...HELPERS].some((h) => new RegExp(`export (?:async )?function ${h}\\b`).test(text))) continue; // the helper's own definition
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && HELPERS.has(node.expression.text) && node.arguments.length >= 1) {
        out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: node.getText(sf).slice(0, 120), start: node.getStart(sf), end: node.getEnd(), first: node.arguments[0].getText(sf) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

function readTree(root) {
  const files = new Map();
  for (const f of walk(root, "apps/api/src", [])) files.set(f, fs.readFileSync(path.join(root, f), "utf8"));
  return files;
}

/** sha256 over every spec file under the module directory (path + content), sorted. */
export function testsSha(root, dir) {
  const specs = walk(root, dir, []).filter(isSpec).sort();
  return sha(specs.map((f) => `${f}\u0000${sha(fs.readFileSync(path.join(root, f), "utf8"))}`).join("\u0001"));
}

export const siteKey = (s) => `${s.file}\u0000${s.line}\u0000${s.text}`;

/** Pure gate: sites without a fresh KILLED record. */
export function unprovenSites(sites, records, fileSha, specsSha) {
  const byKey = new Map(records.map((r) => [siteKey(r), r]));
  return sites.filter((s) => {
    const r = byKey.get(siteKey(s));
    return !(r && r.verdict === "KILLED" && r.fileSha256 === fileSha(s.file) && r.testsSha256 === specsSha(moduleDirOf(s.file)));
  });
}

function check() {
  const files = readTree(REPO);
  const sites = wiringSites(files);
  const records = fs.existsSync(PROOF_FILE) ? JSON.parse(fs.readFileSync(PROOF_FILE, "utf8")).results : [];
  const shaCache = new Map();
  const specsSha = (dir) => { if (!shaCache.has(dir)) shaCache.set(dir, testsSha(REPO, dir)); return shaCache.get(dir); };
  const bad = unprovenSites(sites, records, (f) => sha(files.get(f)), specsSha);
  console.log(`compat-wiring audit: ${sites.length} production call sites of ${[...HELPERS].join(", ")}, WIRING_SITES_UNPROVEN=${bad.length}`);
  if (HAS("--list") || bad.length) for (const s of bad.slice(0, 80)) console.error(`  ${s.file}:${s.line} ${s.text}`);
  if (bad.length) process.exit(1);
}

function relaxDiagnostics(root) {
  const f = path.join(root, "apps/api/jest.config.ts");
  const text = fs.readFileSync(f, "utf8");
  if (text.includes("diagnostics: true")) fs.writeFileSync(f, text.replace("diagnostics: true", "diagnostics: false"));
}

function runModule(root, dir) {
  const r = spawnSync("npx", ["jest", "--config", "jest.config.ts", dir.slice("apps/api/".length), "--silent", "--forceExit", "--ci"], {
    cwd: path.join(root, "apps/api"), encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });
  return classifyRun(r.status ?? 1, `${r.stdout ?? ""}\n${r.stderr ?? ""}`);
}

/** One shard: mutate the call sites whose index modulo n equals i, inside the sandbox `root`. */
function worker() {
  const root = path.resolve(ARG("--root"));
  const [i, n] = String(ARG("--shard") ?? "0/1").split("/").map(Number);
  const out = path.resolve(ARG("--out"));
  const only = ARG("--only");
  relaxDiagnostics(root);
  const files = readTree(root);
  const sites = wiringSites(files).filter((s, k) => k % n === i && (!only || s.file.includes(only)));
  const baseline = new Map();
  const results = [];
  for (const [k, s] of sites.entries()) {
    const dir = moduleDirOf(s.file);
    if (!baseline.has(dir)) baseline.set(dir, runModule(root, dir));
    const abs = path.join(root, s.file);
    const original = fs.readFileSync(abs, "utf8");
    const rec = { file: s.file, line: s.line, text: s.text, fileSha256: sha(original), testsSha256: testsSha(root, dir), testDir: dir, operator: "CALL_BYPASS", verdict: "" };
    if (baseline.get(dir) !== "pass") rec.verdict = "BASELINE_RED";
    else {
      fs.writeFileSync(abs, original.slice(0, s.start) + s.first + original.slice(s.end));
      try {
        const c = runModule(root, dir);
        rec.verdict = c === "assertion-failure" ? "KILLED" : c === "pass" ? "SURVIVED" : "INCONCLUSIVE";
      } finally { fs.writeFileSync(abs, original); }
    }
    results.push(rec);
    console.log(`[${k + 1}/${sites.length}] ${rec.verdict} ${s.file}:${s.line} ${s.text.slice(0, 70)}`);
    fs.writeFileSync(out, JSON.stringify({ schemaVersion: 1, results }, null, 1) + "\n");
  }
  fs.writeFileSync(out, JSON.stringify({ schemaVersion: 1, results }, null, 1) + "\n");
}

async function prove() {
  const shards = Math.max(1, Number(ARG("--shards") ?? 3));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "compat-wiring-"));
  const procs = [];
  for (let i = 0; i < shards; i++) {
    const root = path.join(tmp, `root${i}`);
    makeSandbox(root);
    const out = path.join(tmp, `out${i}.json`);
    const args = [path.join(here, "compat-wiring-proof.mjs"), "--worker", "--root", root, "--shard", `${i}/${shards}`, "--out", out];
    if (ARG("--only")) args.push("--only", ARG("--only"));
    const child = spawn(process.execPath, args, { stdio: ["ignore", "inherit", "inherit"], cwd: REPO });
    console.log(`shard ${i}/${shards} pid ${child.pid}`);
    procs.push(new Promise((resolve) => child.on("exit", (code) => resolve({ i, code, out }))));
  }
  const done = await Promise.all(procs);
  const failed = done.filter((d) => d.code !== 0);
  if (failed.length) { console.error(`shards failed: ${failed.map((f) => f.i).join(", ")}; proof file NOT written (sandbox kept at ${tmp})`); process.exit(1); }
  const fresh = done.flatMap((d) => JSON.parse(fs.readFileSync(d.out, "utf8")).results);
  const prior = fs.existsSync(PROOF_FILE) ? JSON.parse(fs.readFileSync(PROOF_FILE, "utf8")).results : [];
  const byKey = new Map(prior.map((r) => [siteKey(r), r]));
  for (const r of fresh) byKey.set(siteKey(r), r);
  // keep only records of sites that still exist in the working tree
  const live = new Set(wiringSites(readTree(REPO)).map(siteKey));
  const merged = [...byKey.values()].filter((r) => live.has(siteKey(r))).sort((a, b) => siteKey(a).localeCompare(siteKey(b)));
  fs.mkdirSync(path.dirname(PROOF_FILE), { recursive: true });
  fs.writeFileSync(PROOF_FILE, JSON.stringify({ schemaVersion: 1, results: merged }, null, 1) + "\n");
  const tally = {}; for (const r of merged) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log("wiring proof written:", merged.length, "sites", JSON.stringify(tally));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (HAS("--worker")) worker();
  else if (HAS("--prove")) prove().catch((err) => { console.error(`compat-wiring-proof FAILED: ${err.stack ?? err.message}`); process.exit(2); });
  else check();
}
