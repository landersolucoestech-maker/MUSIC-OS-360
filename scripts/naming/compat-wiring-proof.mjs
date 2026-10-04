#!/usr/bin/env node
/**
 * scripts/naming/compat-wiring-proof.mjs: proof that the WIRING of compatibility code in production is needed.
 *
 *   node scripts/naming/compat-wiring-proof.mjs --check [--list]      gate: every call site has a fresh record that was KILLED (exit 1 otherwise)
 *   node scripts/naming/compat-wiring-proof.mjs --prove [--shards N] [--only <substr>]
 *                                                                      mutate every call site on sandbox copies and (re)write the proof file
 *
 * The per-name mutation proof (compat-mutation-proof.mjs) renames the legacy names INSIDE a credited runtime file. It cannot see that a CONSUMER
 * stopped calling that file (the credited table or normalizer is intact and its own spec passes, but the app no longer applies it, so a pre-rename
 * client, draft or URL breaks). This script closes that class by construction. Two kinds of production call sites are bypassed one at a time:
 *   HELPER    a call of a deprecated-field alias helper (HELPERS below), e.g. `applyDeprecatedFieldAliases(dto, TABLE)`;
 *   CONSUMER  a call, in another production file, of a function imported from a file that a ledger row credits as a compatibility boundary
 *             (relative, `@/` and barrel re-exports are resolved), e.g. `canonicalFeatureKeys(raw)` or `{legacyRoutes()}`.
 * The call is replaced by its first argument (`undefined` when it has none) and the tests of the owning module must fail by ASSERTION; a compile
 * or load error is inconclusive, never a kill. Records are bound to the sha256 of the file and of every spec of the module, so any later edit of
 * either makes the record stale until `--prove` runs again.
 *
 * Not covered (documented in docs/engineering/naming-state-separation.md): a consumer that reads a credited constant or table without calling
 * a function, imports through a workspace package (`@music-os-360/*`), or calls a method of an object; helpers that return structured results.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { pairsFromLedger } from "./compat-mutation-proof.mjs";
import { makeSandbox } from "./compat-prove-sandbox.mjs";
import { loadAuthority } from "./canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const ARG = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const HAS = (n) => process.argv.includes(n);
// --proof <file>: read/write an isolated proof file (several people can verify their sites in parallel without touching the shared one)
export const PROOF_FILE = ARG("--proof") ? path.resolve(ARG("--proof")) : path.join(REPO, "docs/naming/audit/compat-wiring-proof.json");
export const HELPERS = new Set(["applyDeprecatedFieldAliases"]);
const SOURCE_DIRS = ["apps/api/src", "apps/web/src"];
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const require = createRequire(path.join(REPO, "apps/api/package.json"));
const ts = require("typescript");

const isSpec = (f) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(test|__tests__)\//.test(f);
const isSource = (f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts");

function walk(root, dir, out) {
  if (!fs.existsSync(path.join(root, dir))) return out;
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(root, rel, out);
    else if (isSource(rel)) out.push(rel);
  }
  return out;
}

/**
 * Verdict of a test run after a wiring bypass. A bypass changes what a CONSUMER does, so the effect often surfaces as a thrown error inside a render or a
 * service call rather than as a failed `expect(...)` frame: any individual test that FAILS in a suite that LOADED means the tests noticed the removal. A suite that
 * fails to load, compile or resolve a module is inconclusive (the mutation did not run as behavior), never a kill.
 */
export function classifyWiring(status, output) {
  if (status === 0) return "pass";
  const o = String(output).replace(/\u001b\[[0-9;]*m/g, "");
  const failedTests = /Tests:\s+(?:\d+ skipped, )?[1-9]\d* failed|Tests\s+[1-9]\d* failed/.test(o);
  if (failedTests) return "assertion-failure"; // a failure while the suite could not load is reported by the runner as a suite error, not as failed tests
  return "inconclusive";
}

/** Production files that are not wired into the application and are excluded as CONSUMERS by an explicit rule: gated draft migrations (their own draft specs prove the names). */
export const isUnwiredDraft = (f) => /^apps\/api\/src\/database\/migration-drafts\//.test(f);

/** The directory whose specs must notice a bypass at `file`: the owning module (api/web), else the file's directory, else the whole app. */
export function moduleDirOf(file) {
  let m = /^(apps\/api\/src\/(?:modules|core)\/[^/]+)\//.exec(file);
  if (m) return m[1];
  if (/^apps\/api\/src\/database\/(?:migrations|seeds)\//.test(file)) return "apps/api/src/database"; // the *.migration.spec.ts files live beside the folders
  m = /^(apps\/web\/src\/(?:modules|shared|app|lib|constants)\/[^/]+)\//.exec(file);
  if (m) return m[1];
  m = /^(apps\/web\/src)\/[^/]+$/.exec(file); // App.tsx, main.tsx: the whole web suite
  if (m) return m[1];
  return path.posix.dirname(file);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** import specifier -> repository path of the target file (relative and `@/`), or null. */
function resolveSpec(from, spec, has) {
  let base = null;
  if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else if (spec.startsWith("@/") && from.startsWith("apps/web/")) base = `apps/web/src/${spec.slice(2)}`;
  if (!base) return null;
  for (const x of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (has(base + x)) return base + x;
  return null;
}

/**
 * Production call sites to bypass: [{ kind, file, line, text, start, end, first, target? }]. Pure over the file texts and the set of credited files.
 * `credited` are the runtime files that a ledger row proves (CONSUMER sites are calls of functions imported from them).
 */
export function wiringSites(files, credited = new Set()) {
  const out = [];
  const has = (f) => files.has(f);
  const parsed = new Map();
  const parse = (file) => {
    if (!parsed.has(file)) { const text = files.get(file); parsed.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : undefined)); }
    return parsed.get(file);
  };
  // barrel files: a non-credited file that re-exports from a credited one
  const reexports = new Map();
  for (const [file, text] of files) {
    if (isSpec(file) || credited.has(file) || !/export\s*(\*|\{)[^;]*from/.test(text)) continue;
    const sf = parse(file);
    const edges = [];
    for (const s of sf.statements) if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) { const t = resolveSpec(file, s.moduleSpecifier.text, has); if (t) edges.push(t); }
    if (edges.length) reexports.set(file, edges);
  }
  const creditedTarget = (file, depth = 0) => {
    if (credited.has(file)) return file;
    if (depth > 2) return null;
    for (const t of reexports.get(file) ?? []) { const r = creditedTarget(t, depth + 1); if (r) return r; }
    return null;
  };
  for (const [file, text] of files) {
    if (isSpec(file) || isUnwiredDraft(file)) continue;
    const isHelperDef = [...HELPERS].some((h) => new RegExp(`export (?:async )?function ${h}\\b`).test(text));
    const mayHelper = !isHelperDef && [...HELPERS].some((h) => text.includes(h));
    const mayConsumer = credited.size > 0 && /\bimport\b/.test(text);
    if (!mayHelper && !mayConsumer) continue;
    const sf = parse(file);
    const bound = new Map(); // local name -> credited target file
    const namespaces = new Map();
    if (mayConsumer) {
      for (const s of sf.statements) {
        if (!ts.isImportDeclaration(s) || !s.importClause || s.importClause.isTypeOnly || !ts.isStringLiteral(s.moduleSpecifier)) continue;
        const t = resolveSpec(file, s.moduleSpecifier.text, has);
        const target = t ? creditedTarget(t) : null;
        if (!target || target === file) continue;
        const nb = s.importClause.namedBindings;
        if (nb && ts.isNamedImports(nb)) { for (const el of nb.elements) if (!el.isTypeOnly) bound.set(el.name.text, target); }
        else if (nb && ts.isNamespaceImport(nb)) namespaces.set(nb.name.text, target);
      }
    }
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let kind = null; let target = null;
        if (ts.isIdentifier(callee)) {
          if (mayHelper && HELPERS.has(callee.text) && node.arguments.length >= 1) kind = "HELPER";
          else if (bound.has(callee.text)) { kind = "CONSUMER"; target = bound.get(callee.text); }
        } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text)) { kind = "CONSUMER"; target = namespaces.get(callee.expression.text); }
        if (kind) {
          out.push({ kind, file, line: lineOf(sf, node), text: node.getText(sf).slice(0, 120), start: node.getStart(sf), end: node.getEnd(), first: node.arguments.length ? node.arguments[0].getText(sf) : "undefined", ...(target ? { target } : {}) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

function readTree(root) {
  const files = new Map();
  for (const d of SOURCE_DIRS) for (const f of walk(root, d, [])) files.set(f, fs.readFileSync(path.join(root, f), "utf8"));
  return files;
}

/** Runtime files that a proof-class ledger row credits (the same set the mutation proof judges). */
export function creditedFiles() {
  return new Set(pairsFromLedger(loadAuthority()).map((p) => p.file).filter((f) => isSource(f) && !isSpec(f)));
}

/** sha256 over every spec file under the directory (path + content), sorted. */
export function testsSha(root, dir) {
  const specs = walk(root, dir, []).filter(isSpec).sort();
  return sha(specs.map((f) => `${f}\u0000${sha(fs.readFileSync(path.join(root, f), "utf8"))}`).join("\u0001"));
}
// walk() only lists source files; specs are source files with a spec/test name, so they are included above. Test helpers under /test/ count as specs.

export const EXEMPTIONS_FILE = path.join(REPO, "docs/naming/audit/compat-wiring-exemptions.json");
/** An exemption is an EQUIVALENT mutant proven by hand: { file, text, reason }, matched by file and exact call text, reason of 40+ characters. */
export const validExemption = (x) => x && typeof x.file === "string" && typeof x.text === "string" && String(x.reason ?? "").trim().length >= 40;

export const siteKey = (s) => `${s.file}\u0000${s.line}\u0000${s.text}`;

/** Pure gate: sites without a fresh KILLED record and without a valid exemption. */
export function unprovenSites(sites, records, fileSha, specsSha, exemptions = []) {
  const byKey = new Map(records.map((r) => [siteKey(r), r]));
  const ex = exemptions.filter(validExemption);
  return sites.filter((s) => {
    const r = byKey.get(siteKey(s));
    if (r && r.verdict === "KILLED" && r.fileSha256 === fileSha(s.file) && r.testsSha256 === specsSha(moduleDirOf(s.file))) return false;
    return !ex.some((x) => x.file === s.file && x.text === s.text);
  });
}

/** Exemptions that match no production call site any more (the code changed): they must be removed, never kept as a blanket allowance. */
export function staleExemptions(sites, exemptions = []) {
  return exemptions.filter((x) => !validExemption(x) || !sites.some((s) => s.file === x.file && s.text === x.text));
}

function check() {
  const files = readTree(REPO);
  const sites = wiringSites(files, creditedFiles());
  const records = fs.existsSync(PROOF_FILE) ? JSON.parse(fs.readFileSync(PROOF_FILE, "utf8")).results : [];
  const shaCache = new Map();
  const specsSha = (dir) => { if (!shaCache.has(dir)) shaCache.set(dir, testsSha(REPO, dir)); return shaCache.get(dir); };
  const exemptions = fs.existsSync(EXEMPTIONS_FILE) ? JSON.parse(fs.readFileSync(EXEMPTIONS_FILE, "utf8")).exemptions ?? [] : [];
  const stale = staleExemptions(sites, exemptions);
  const bad = unprovenSites(sites, records, (f) => sha(files.get(f)), specsSha, exemptions);
  const helper = sites.filter((s) => s.kind === "HELPER").length;
  console.log(`compat-wiring audit: ${sites.length} production call sites (${helper} of ${[...HELPERS].join(", ")}, ${sites.length - helper} consumer calls of credited files), WIRING_SITES_UNPROVEN=${bad.length}`);
  if (HAS("--list") || bad.length) for (const s of bad.slice(0, 80)) console.error(`  ${s.kind} ${s.file}:${s.line} ${s.text}`);
  if (stale.length) for (const x of stale) console.error(`  STALE_EXEMPTION ${x.file} ${String(x.text).slice(0, 70)}`);
  if (bad.length || stale.length) process.exit(1);
}

function relaxDiagnostics(root) {
  const f = path.join(root, "apps/api/jest.config.ts");
  const text = fs.readFileSync(f, "utf8");
  if (text.includes("diagnostics: true")) fs.writeFileSync(f, text.replace("diagnostics: true", "diagnostics: false"));
}

function runModule(root, dir) {
  const env = { ...process.env, CI: "1", FORCE_COLOR: "0" };
  const r = dir.startsWith("apps/web")
    ? spawnSync("npx", ["vitest", "run", "--config", "vitest.config.mjs", dir === "apps/web/src" ? "src" : dir.slice("apps/web/".length)], { cwd: path.join(root, "apps/web"), encoding: "utf8", maxBuffer: 1 << 28, timeout: 1800000, env })
    : spawnSync("npx", ["jest", "--config", "jest.config.ts", dir.slice("apps/api/".length), "--silent", "--forceExit", "--ci"], { cwd: path.join(root, "apps/api"), encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, env });
  return classifyWiring(r.status ?? 1, `${r.stdout ?? ""}\n${r.stderr ?? ""}`);
}

/** One shard: mutate the call sites whose index modulo n equals i, inside the sandbox `root`. */
function worker() {
  const root = path.resolve(ARG("--root"));
  const [i, n] = String(ARG("--shard") ?? "0/1").split("/").map(Number);
  const out = path.resolve(ARG("--out"));
  const only = ARG("--only");
  relaxDiagnostics(root);
  const files = readTree(root);
  const sites = wiringSites(files, creditedFiles()).filter((s, k) => k % n === i && (!only || s.file.includes(only)));
  const baseline = new Map();
  const results = [];
  const prior = fs.existsSync(PROOF_FILE) ? JSON.parse(fs.readFileSync(PROOF_FILE, "utf8")).results : [];
  const priorByKey = new Map(prior.map((r) => [siteKey(r), r]));
  const shaOfDir = new Map();
  const specsShaOf = (dir) => { if (!shaOfDir.has(dir)) shaOfDir.set(dir, testsSha(root, dir)); return shaOfDir.get(dir); };
  for (const [k, s] of sites.entries()) {
    const dir = moduleDirOf(s.file);
    const done = priorByKey.get(siteKey(s));
    // resume: a site already KILLED against the same file and module specs is not run again
    if (done && done.verdict === "KILLED" && done.fileSha256 === sha(files.get(s.file)) && done.testsSha256 === specsShaOf(dir)) { results.push(done); console.log(`[${k + 1}/${sites.length}] RESUMED KILLED ${s.kind} ${s.file}:${s.line}`); continue; }
    if (!baseline.has(dir)) { let b = runModule(root, dir); if (b !== "pass") b = runModule(root, dir); baseline.set(dir, b); } // one retry: a load failure under shard load is not a red baseline
    const abs = path.join(root, s.file);
    const original = fs.readFileSync(abs, "utf8");
    const rec = { kind: s.kind, file: s.file, line: s.line, text: s.text, ...(s.target ? { target: s.target } : {}), fileSha256: sha(original), testsSha256: specsShaOf(dir), testDir: dir, operator: "CALL_BYPASS", verdict: "" };
    if (baseline.get(dir) !== "pass") rec.verdict = "BASELINE_RED";
    else {
      fs.writeFileSync(abs, original.slice(0, s.start) + s.first + original.slice(s.end));
      try {
        const c = runModule(root, dir);
        rec.verdict = c === "assertion-failure" ? "KILLED" : c === "pass" ? "SURVIVED" : "INCONCLUSIVE";
      } finally { fs.writeFileSync(abs, original); }
    }
    results.push(rec);
    console.log(`[${k + 1}/${sites.length}] ${rec.verdict} ${s.kind} ${s.file}:${s.line} ${s.text.slice(0, 70)}`);
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
  const live = new Set(wiringSites(readTree(REPO), creditedFiles()).map(siteKey));
  const merged = [...byKey.values()].filter((r) => live.has(siteKey(r))).sort((a, b) => siteKey(a).localeCompare(siteKey(b)));
  fs.mkdirSync(path.dirname(PROOF_FILE), { recursive: true });
  fs.writeFileSync(PROOF_FILE, JSON.stringify({ schemaVersion: 1, results: merged }, null, 1) + "\n");
  const tally = {}; for (const r of merged) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log("wiring proof written:", merged.length, "sites", JSON.stringify(tally));
}

/** Merges the shard outputs of an interrupted --prove (its kept sandbox directory) into the proof file. */
function mergeFrom(dir) {
  const fresh = fs.readdirSync(dir).filter((f) => /^out\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).results);
  const prior = fs.existsSync(PROOF_FILE) ? JSON.parse(fs.readFileSync(PROOF_FILE, "utf8")).results : [];
  const byKey = new Map(prior.map((r) => [siteKey(r), r]));
  for (const r of fresh) byKey.set(siteKey(r), r);
  const files = readTree(REPO);
  const live = new Map(wiringSites(files, creditedFiles()).map((x) => [siteKey(x), x]));
  // a record is kept only for a site that still exists with the same file bytes
  const merged = [...byKey.values()].filter((r) => live.has(siteKey(r)) && r.fileSha256 === sha(files.get(r.file))).sort((a, b) => siteKey(a).localeCompare(siteKey(b)));
  fs.writeFileSync(PROOF_FILE, JSON.stringify({ schemaVersion: 1, results: merged }, null, 1) + "\n");
  const tally = {}; for (const r of merged) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log("merged", fresh.length, "shard records;", merged.length, "kept", JSON.stringify(tally));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (HAS("--merge")) mergeFrom(path.resolve(ARG("--merge")));
  else if (HAS("--worker")) worker();
  else if (HAS("--prove")) prove().catch((err) => { console.error(`compat-wiring-proof FAILED: ${err.stack ?? err.message}`); process.exit(2); });
  else check();
}
