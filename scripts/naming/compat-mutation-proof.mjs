#!/usr/bin/env node
/**
 * scripts/naming/compat-mutation-proof.mjs: mutation proof for the legitimate compatibility boundaries.
 *
 *   node scripts/naming/compat-mutation-proof.mjs [--root <dir>] [--only <path-substring>] [--shard i/n] [--out <file>] [--list]
 *
 * For every (runtime file, covering test) pair of the ledger's compatibility rows it injects a real defect into the
 * runtime file and runs the covering test; the pair is PROVEN only when the test FAILS on an assertion (KILLED).
 * Operators (all applied with the TypeScript AST, one mutation at a time, the file is always restored):
 *   LEGACY_LITERAL   one occurrence of a ledger legacy name (string literal, property key, member read) is renamed:
 *                    the legacy handling disappears, so a test that really exercises it must fail;
 *   CANONICAL_FIRST  `canonical ?? legacy` / `canonical || legacy` is swapped to `legacy ?? canonical`;
 *   ALIAS_OVERRIDE   the guard `if (x[canonical] === undefined) x[canonical] = x[legacy]` is replaced by `true`,
 *                    so the legacy value overrides the canonical one.
 * A mutation that makes the suite fail to compile or run (no failed assertion) is INCONCLUSIVE, never a kill.
 * The unmutated test must pass first (otherwise the pair is BASELINE_RED).
 *
 * Run it on a COPY of the repository (`--root`), never on the working tree being edited: it rewrites sources.
 * Output: a JSON file with one record per pair, bound to the sha256 of the runtime file and of the test, so the
 * audit (compat-boundary-audit.mjs) can prove the result is about the current sources.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.resolve(arg("--root") ?? REPO);
const require = createRequire(path.join(REPO, "apps/api/package.json"));
const ts = require("typescript");

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
/** Opt-in executable checks of the API (they insert legacy-shape rows into a disposable database or smoke a running API): test code, not runtime. */
export const isVerificationScript = (f) => /^apps\/api\/scripts\/(verify|smoke|reports-smoke)[-.\w]*\.ts$/.test(f);
export const isTestFile = (f) => /[.-](test|spec|e2e-spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(e2e|__tests__|__fixtures__|fixtures)\//.test(f) || isVerificationScript(f);
export const PROOF_CLASSES = new Set(["TEMPORARY_MIGRATION_COMPATIBILITY", "LEGACY_DATABASE_COMPATIBILITY", "PUBLIC_API_COMPATIBILITY", "EXTERNAL_CONTRACT", "PROVIDER_DEFINED"]);

/** Ledger rows -> [{file, tests[], names:Set, wildcard:boolean}] for runtime files. */
export function pairsFromLedger(map) {
  const out = new Map();
  for (const e of map.exceptions ?? []) {
    if (e.status === "REMOVED" || e.census === "baselined" || !PROOF_CLASSES.has(e.exceptionClass) || !e.coveringTest) continue;
    const tests = String(e.coveringTest).split(/\s*,\s*/);
    for (const p of String(e.path).split(/\s*,\s*/)) {
      if (p === "*" || isTestFile(p) || p.startsWith(".claude/") || !/\.[cm]?[jt]sx?$/.test(p)) continue;
      for (const t of tests) {
        const k = `${p}\u0000${t}`;
        const rec = out.get(k) ?? { file: p, test: t, names: new Set(), wildcard: false };
        if (e.currentName === "*") rec.wildcard = true; else rec.names.add(e.currentName);
        out.set(k, rec);
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.file + a.test).localeCompare(b.file + b.test));
}

const nameOf = (node) => (ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null);

/** The member name read by an expression: `a.b`, `a['b']`, `a?.b`, `a?.['b']`; null otherwise. */
function memberName(expr) {
  const e = ts.isParenthesizedExpression(expr) ? expr.expression : expr;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)) return e.argumentExpression.text;
  return null;
}

/** Candidate mutations of one source text for the given legacy names. Pure. */
export function findMutations(text, file, names, wildcardWords = null) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : undefined);
  const isLegacy = (n) => n != null && (names.has(n) || (wildcardWords ? wildcardWords(n) : false));
  const lit = [];
  const swap = [];
  const guard = [];
  const legacyFirst = [];
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node) => {
    // CANONICAL_FIRST
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      const l = memberName(node.left);
      const r = memberName(node.right);
      const op = node.operatorToken.getText(sf);
      if (isLegacy(r) && !isLegacy(l)) {
        swap.push({ operator: "CANONICAL_FIRST", line: lineOf(node), start: node.getStart(sf), end: node.getEnd(), replacement: `(${node.right.getText(sf)}) ${op} (${node.left.getText(sf)})` });
      } else if (isLegacy(l) && !isLegacy(r) && r != null) {
        legacyFirst.push({ line: lineOf(node), text: node.getText(sf).slice(0, 120) });
      }
    }
    // ALIAS_OVERRIDE: if (<x> === undefined) <x> = <...legacy read...>
    if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)
      && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.expression.operatorToken.kind)
      && node.expression.right.getText(sf) === "undefined") {
      const stmt = ts.isBlock(node.thenStatement) ? node.thenStatement.statements[0] : node.thenStatement;
      if (stmt && ts.isExpressionStatement(stmt) && ts.isBinaryExpression(stmt.expression) && stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const rhs = stmt.expression.right;
        const reads = [];
        const collect = (n) => { const m = memberName(n); if (m) reads.push(m); ts.forEachChild(n, collect); };
        collect(rhs);
        if (reads.some(isLegacy)) guard.push({ operator: "ALIAS_OVERRIDE", line: lineOf(node), start: node.expression.getStart(sf), end: node.expression.getEnd(), replacement: "true" });
      }
    }
    // LEGACY_LITERAL
    if (ts.isStringLiteralLike(node) && isLegacy(node.text) && !(node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isLiteralTypeNode(node.parent) || ts.isImportTypeNode(node.parent)))) {
      const q = text[node.getStart(sf)];
      if (q === "'" || q === '"' || q === "`") lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.getStart(sf), end: node.getEnd(), replacement: `${q}__mutated__${q}`, label: node.text });
    } else if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && isLegacy(node.name.text)) {
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: "__mutated__", label: node.name.text });
    } else if (ts.isPropertyDeclaration(node) && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && isLegacy(node.name.text)) {
      // a deprecated DTO/entity property (the alias a pre-rename caller still sends)
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: ts.isStringLiteralLike(node.name) ? `'__mutated__'` : "__mutated__", label: node.name.text });
    } else if (ts.isPropertyAccessExpression(node) && isLegacy(node.name.text) && !ts.isTypeReferenceNode(node.parent)) {
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: "__mutated__", label: node.name.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { lit, swap, guard, legacyFirst };
}

export const apply = (text, m) => text.slice(0, m.start) + m.replacement + text.slice(m.end);

/** jest / vitest / node:test result text -> "pass" | "assertion-failure" | "inconclusive". */
export function classifyRun(status, output) {
  if (status === 0) return "pass";
  const o = output.replace(/\u001b\[[0-9;]*m/g, "");
  if (/Test suite failed to run|SyntaxError|TSError|Cannot find module|error TS\d+|Transform failed|Failed to resolve import|ERR_MODULE_NOT_FOUND/.test(o) && !/Tests:\s+\d+ failed|Tests\s+\d+ failed/.test(o)) return "inconclusive";
  if (/Tests:\s+(?:\d+ skipped, )?[1-9]\d* failed|Tests\s+[1-9]\d* failed|# fail [1-9]/.test(o)) return "assertion-failure";
  return "inconclusive";
}

function runTest(test) {
  let cmd; let args; let cwd;
  if (test.startsWith("apps/api/")) { cwd = path.join(ROOT, "apps/api"); cmd = "npx"; args = ["jest", "--config", "jest.config.ts", test.slice("apps/api/".length), "--silent", "--forceExit", "--ci"]; }
  else if (test.startsWith("apps/web/")) { cwd = path.join(ROOT, "apps/web"); cmd = "npx"; args = ["vitest", "run", "--config", "vitest.config.mjs", test.slice("apps/web/".length)]; }
  else { cwd = ROOT; cmd = "node"; args = ["--test", test]; }
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, env: { ...process.env, CI: "1", FORCE_COLOR: "0" } });
  return { status: r.status ?? 1, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

/** Test files of the --root tree that exercise `file`: they import it by basename or quote one of its legacy names. */
let TEST_INDEX = null;
export function candidateTests(file, names, limit = 5) {
  if (!TEST_INDEX) {
    TEST_INDEX = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(e.name)) TEST_INDEX.push({ rel: path.relative(ROOT, full).split(path.sep).join("/"), text: fs.readFileSync(full, "utf8") });
      }
    };
    for (const d of ["apps/api/src", "apps/web/src", "apps/api/test"]) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  }
  const base = path.basename(file).replace(/\.[cm]?[jt]sx?$/, "");
  const scored = [];
  for (const { rel, text } of TEST_INDEX) {
    if (rel.startsWith("apps/api/test/e2e")) continue;
    let s = 0;
    if (new RegExp(`from\\s+['"][^'"]*/${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`).test(text)) s += 3;
    for (const n of names) if (n.length > 2 && (text.includes(`'${n}'`) || text.includes(`"${n}"`) || text.includes(`.${n}`))) s += 1;
    if (path.dirname(rel) === path.dirname(file)) s += 1;
    if (s >= 3) scored.push({ rel, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.rel.localeCompare(b.rel)).slice(0, limit).map((x) => x.rel);
}

async function main() {
  const map = JSON.parse(fs.readFileSync(path.join(REPO, "docs/naming/canonical-naming-map.json"), "utf8"));
  const only = arg("--only");
  const out = path.resolve(arg("--out") ?? path.join(REPO, "docs/naming/audit/compat-mutation-proof.json"));
  const { ptWords } = await import("./pt-lexicon.mjs");
  const wildcardWords = (n) => /^[A-Za-z_][\w-]*$/.test(n) && n.length > 2 && ptWords(n).length > 0;
  let pairs = pairsFromLedger(map).filter((p) => !only || (p.file + p.test).includes(only));
  const shard = arg("--shard"); // "i/n": this process handles the pairs whose index modulo n equals i (n sandboxes in parallel)
  if (shard && !arg("--rebind")) { const [i, n] = shard.split("/").map(Number); pairs = pairs.filter((_, k) => k % n === i); }
  const rebind = arg("--rebind");
  const declaredFor = new Map();
  if (rebind) {
    // second pass: files whose pair was not PROVEN are retried with the declared tests (new operators) and with other tests that exercise them
    const prev = JSON.parse(fs.readFileSync(path.resolve(rebind), "utf8")).results;
    const bad = new Set(prev.filter((r) => r.verdict !== "PROVEN").map((r) => r.file));
    const byFile = new Map();
    for (const p of pairsFromLedger(map)) {
      const e = byFile.get(p.file) ?? { file: p.file, names: new Set(), wildcard: false, tests: new Set() };
      p.names.forEach((n) => e.names.add(n)); e.wildcard ||= p.wildcard; e.tests.add(p.test); byFile.set(p.file, e);
    }
    pairs = [];
    let k = 0;
    for (const f of [...bad].sort()) {
      const e = byFile.get(f); if (!e) continue;
      if (shard) { const [i, n] = shard.split("/").map(Number); if (k++ % n !== i) continue; }
      declaredFor.set(f, e.tests);
      for (const t of [...e.tests, ...candidateTests(f, e.names).filter((x) => !e.tests.has(x))]) pairs.push({ file: f, test: t, names: e.names, wildcard: e.wildcard });
    }
  }
  if (process.argv.includes("--list")) { for (const p of pairs) console.log(`${p.file} <= ${p.test} [${[...p.names].slice(0, 4).join(",")}${p.wildcard ? ",*" : ""}]`); console.log(pairs.length, "pairs"); return; }
  const prior = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : { schemaVersion: 1, results: [] };
  const results = new Map(prior.results.map((r) => [`${r.file}\u0000${r.test}`, r]));
  const baselineCache = new Map();
  for (const [i, pair] of pairs.entries()) {
    // rebind pass: a candidate test is only tried while no test has proven the file yet
    if (rebind && !declaredFor.get(pair.file)?.has(pair.test) && [...results.values()].some((r) => r.file === pair.file && r.verdict === "PROVEN" && r.fileSha256 === sha256(fs.readFileSync(path.join(ROOT, pair.file), "utf8")))) continue;
    const abs = path.join(ROOT, pair.file);
    const original = fs.readFileSync(abs, "utf8");
    // the hashes bind to the sources that were actually mutated and tested (the --root copy); the audit compares
    // them with the repository, so any later edit of either file makes the result stale
    const realText = original;
    const testAbs = path.join(ROOT, pair.test);
    if (!fs.existsSync(testAbs)) { results.set(`${pair.file}\u0000${pair.test}`, { file: pair.file, test: pair.test, fileSha256: sha256(realText), testSha256: null, verdict: "TEST_MISSING", mutations: [] }); continue; }
    if (!baselineCache.has(pair.test)) { const b = runTest(pair.test); baselineCache.set(pair.test, classifyRun(b.status, b.output)); }
    const rec = { file: pair.file, test: pair.test, fileSha256: sha256(realText), testSha256: sha256(fs.readFileSync(testAbs, "utf8")), verdict: "", mutations: [], legacyFirst: [] };
    if (baselineCache.get(pair.test) !== "pass") { rec.verdict = "BASELINE_RED"; results.set(`${pair.file}\u0000${pair.test}`, rec); console.log(`[${i + 1}/${pairs.length}] BASELINE_RED ${pair.file} <= ${pair.test}`); continue; }
    const muts = findMutations(original, pair.file, pair.names, pair.wildcard ? wildcardWords : null);
    rec.legacyFirst = muts.legacyFirst;
    // string literals first (they never break compilation), then keys and member names; up to 14 candidates, 8 conclusive attempts
    const litSorted = [...muts.lit].sort((a, b) => Number(/^['"`]/.test(b.replacement)) - Number(/^['"`]/.test(a.replacement)));
    const queue = [...muts.swap, ...muts.guard, ...litSorted.slice(0, 14)];
    let litKilled = false; let litTried = 0;
    try {
      for (const m of queue) {
        if (m.operator === "LEGACY_LITERAL" && (litKilled || litTried >= 8)) continue;
        fs.writeFileSync(abs, apply(original, m));
        const r = runTest(pair.test);
        const c = classifyRun(r.status, r.output);
        rec.mutations.push({ operator: m.operator, line: m.line, outcome: c === "assertion-failure" ? "KILLED" : c === "pass" ? "SURVIVED" : "INCONCLUSIVE" });
        if (m.operator === "LEGACY_LITERAL" && c !== "inconclusive") litTried++;
        if (m.operator === "LEGACY_LITERAL" && c === "assertion-failure") litKilled = true;
      }
    } finally { fs.writeFileSync(abs, original); }
    const killed = rec.mutations.filter((m) => m.outcome === "KILLED").length;
    const survivedStrong = rec.mutations.filter((m) => m.outcome === "SURVIVED" && m.operator !== "LEGACY_LITERAL").length;
    rec.verdict = rec.mutations.length === 0 ? "NO_MUTATION_SITE" : survivedStrong ? "CANONICAL_FIRST_UNENFORCED" : killed ? "PROVEN" : "SURVIVED";
    results.set(`${pair.file}\u0000${pair.test}`, rec);
    console.log(`[${i + 1}/${pairs.length}] ${rec.verdict} ${pair.file} <= ${pair.test} (${rec.mutations.map((m) => `${m.operator}:${m.outcome}`).join(" ") || "-"})`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ schemaVersion: 1, results: [...results.values()].sort((a, b) => (a.file + a.test).localeCompare(b.file + b.test)) }, null, 1) + "\n");
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ schemaVersion: 1, results: [...results.values()].sort((a, b) => (a.file + a.test).localeCompare(b.file + b.test)) }, null, 1) + "\n");
  const tally = {}; for (const r of results.values()) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log("verdicts", tally);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`compat-mutation-proof FAILED: ${err.stack ?? err.message}`); process.exit(2); });
}
