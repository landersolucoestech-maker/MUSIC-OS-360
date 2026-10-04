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
import { isVerificationScript, isTestFile, PROOF_CLASSES } from "./compat-boundary-audit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.resolve(arg("--root") ?? REPO);
const require = createRequire(path.join(REPO, "apps/api/package.json"));
const ts = require("typescript");

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
// one definition of "test file" and of the proof classes, shared with the audit: a drift makes the two disagree on what is runtime
export { isVerificationScript, isTestFile, PROOF_CLASSES };

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
/**
 * A route name of the ledger (`/artists/stats/generos`) is written in a controller as the path relative to the controller
 * prefix (`stats/generos`): the relative forms are aliases of the ledger name, and the mutation keeps the ledger name as its label
 * so the audit can attribute the kill to the row.
 */
export function routeAliases(names) {
  const out = new Map();
  for (const n of names) {
    if (typeof n !== "string" || !n.startsWith("/")) continue;
    const segs = n.split("/").filter(Boolean);
    if (segs.length > 1) out.set(segs.slice(1).join("/"), n); // controller prefix = first segment; never a bare last segment (too broad)
  }
  return out;
}

export function findMutations(text, file, names, wildcardWords = null) {
  const aliases = routeAliases(names);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : undefined);
  const isLegacy = (n) => n != null && (names.has(n) || aliases.has(n) || (wildcardWords ? wildcardWords(n) : false));
  const labelOf = (n) => aliases.get(n) ?? n;
  const lit = [];
  const swap = [];
  const guard = [];
  const legacyFirst = [];
  const declarations = [];
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node) => {
    // CANONICAL_FIRST
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      const l = memberName(node.left);
      const r = memberName(node.right);
      const op = node.operatorToken.getText(sf);
      if (isLegacy(r) && !isLegacy(l)) {
        swap.push({ operator: "CANONICAL_FIRST", line: lineOf(node), start: node.getStart(sf), end: node.getEnd(), label: labelOf(r), labels: [labelOf(r)], replacement: `(${node.right.getText(sf)}) ${op} (${node.left.getText(sf)})` });
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
        if (reads.some(isLegacy)) { const legacyReads = [...new Set(reads.filter(isLegacy).map(labelOf))]; guard.push({ operator: "ALIAS_OVERRIDE", line: lineOf(node), start: node.expression.getStart(sf), end: node.expression.getEnd(), label: legacyReads[0], labels: legacyReads, replacement: "true" }); }
      }
    }
    // declaration-only occurrences: a legacy name that only names a type, interface, property signature, function or class declaration
    // has no runtime value to mutate; renaming it breaks every reader at compile time (the monorepo typecheck is the proof)
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) || ts.isPropertySignature(node) || (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))) && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && isLegacy(node.name.text)) {
      declarations.push({ line: lineOf(node), label: labelOf(node.name.text) });
    }
    // LEGACY_LITERAL
    if (ts.isStringLiteralLike(node) && isLegacy(node.text) && !(node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isLiteralTypeNode(node.parent) || ts.isImportTypeNode(node.parent)))) {
      const q = text[node.getStart(sf)];
      if (q === "'" || q === '"' || q === "`") lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.getStart(sf), end: node.getEnd(), replacement: `${q}__mutated__${q}`, label: labelOf(node.text) });
    } else if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && isLegacy(node.name.text)) {
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: "__mutated__", label: labelOf(node.name.text) });
    } else if (ts.isPropertyDeclaration(node) && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && isLegacy(node.name.text)) {
      // a deprecated DTO/entity property (the alias a pre-rename caller still sends)
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: ts.isStringLiteralLike(node.name) ? `'__mutated__'` : "__mutated__", label: labelOf(node.name.text) });
    } else if (ts.isPropertyAccessExpression(node) && isLegacy(node.name.text) && !ts.isTypeReferenceNode(node.parent)) {
      lit.push({ operator: "LEGACY_LITERAL", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: "__mutated__", label: labelOf(node.name.text) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // FALLBACK operators, only for a ledger name that has no ordinary site (no literal, key, member read, swap or guard):
  //   ENUM_MEMBER     the enum member named by the ledger row is renamed (the legacy member disappears from the exported enum);
  //   PREFIX_LITERAL  a namespaced key `<name>:<rest>` (the legacy permission/event namespace) loses its legacy namespace.
  // They never apply to a name that already has a site, so the records of every other pair keep their meaning.
  const labelled = new Set([...swap, ...guard].flatMap((m) => m.labels ?? []).concat(lit.map((m) => m.label)));
  const orphans = [...names].filter((n) => typeof n === "string" && !labelled.has(n) && !n.startsWith("/"));
  if (orphans.length) {
    const fallback = (node) => {
      if (ts.isEnumMember(node) && ts.isIdentifier(node.name) && orphans.includes(node.name.text)) {
        lit.push({ operator: "ENUM_MEMBER", line: lineOf(node), start: node.name.getStart(sf), end: node.name.getEnd(), replacement: "__mutated__", label: node.name.text });
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) {
        const raw = text.slice(node.getStart(sf), node.getEnd());
        const q = raw[0];
        for (const n of orphans) {
          if (/^[a-z][a-z0-9_]*$/.test(n) && (q === "'" || q === '"' || q === "`") && raw.slice(1).startsWith(`${n}:`)) {
            lit.push({ operator: "PREFIX_LITERAL", line: lineOf(node), start: node.getStart(sf) + 1, end: node.getStart(sf) + 1 + n.length, replacement: "__mutated__", label: n });
          }
        }
      }
      ts.forEachChild(node, fallback);
    };
    fallback(sf);
  }
  return { lit, swap, guard, legacyFirst, declarations };
}

export const apply = (text, m) => text.slice(0, m.start) + m.replacement + text.slice(m.end);

/** jest / vitest / node:test result text -> "pass" | "assertion-failure" | "inconclusive". */
export function classifyRun(status, output) {
  if (status === 0) return "pass";
  const o = output.replace(/\u001b\[[0-9;]*m/g, "");
  if (/Test suite failed to run|SyntaxError|TSError|Cannot find module|error TS\d+|Transform failed|Failed to resolve import|ERR_MODULE_NOT_FOUND/.test(o) && !/Tests:\s+\d+ failed|Tests\s+\d+ failed/.test(o)) return "inconclusive";
  if (/Tests:\s+(?:\d+ skipped, )?[1-9]\d* failed|Tests\s+[1-9]\d* failed|# fail [1-9]/.test(o) && /expect\(|Expected|Received|AssertionError|assert\.|toBe|toEqual|toThrow|toHaveBeenCalled|toContain|toMatch/.test(o)) return "assertion-failure";
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

/** In a --root copy only: ts-jest type diagnostics off, so a mutation that breaks a type (a renamed DTO property) is judged by behavior, not by a compile error. */
function relaxSandboxDiagnostics() {
  if (ROOT === REPO) return;
  const f = path.join(ROOT, "apps/api/jest.config.ts");
  const text = fs.readFileSync(f, "utf8");
  if (text.includes("diagnostics: true")) fs.writeFileSync(f, text.replace("diagnostics: true", "diagnostics: false"));
}


async function main() {
  // the harness rewrites sources: it must never run against the working tree being edited
  if (ROOT === REPO && !process.argv.includes("--list")) throw new Error("refusing to mutate the working tree: pass --root <copy of the repository> (or --list to only print the pairs)");
  relaxSandboxDiagnostics();
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
    const shaOf = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? sha256(fs.readFileSync(path.join(ROOT, rel), "utf8")) : null);
    // a file is settled when some record PROVEN is bound to the current sources of the file AND of its test (a later edit makes it unsettled)
    const settled = new Set(prev.filter((r) => r.verdict === "PROVEN" && r.fileSha256 === shaOf(r.file) && r.testSha256 === shaOf(r.test)).map((r) => r.file));
    const bad = new Set(pairsFromLedger(map).map((p) => p.file).filter((f) => !settled.has(f)));
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
    // resume: a pair already judged against the SAME file and test bytes is not run again (an interrupted run continues where it stopped)
    const done = results.get(`${pair.file}\u0000${pair.test}`);
    if (done && done.verdict && done.exhaustive === true && !(done.namesWithoutSite?.length && done.fallbackOperators !== 1) && !["NO_MUTATION_SITE", "COMPILER_CHECKED"].includes(done.verdict) && done.fileSha256 === sha256(original) && fs.existsSync(path.join(ROOT, pair.test)) && done.testSha256 === sha256(fs.readFileSync(path.join(ROOT, pair.test), "utf8"))) { console.log(`[${i + 1}/${pairs.length}] RESUMED ${done.verdict} ${pair.file} <= ${pair.test}`); continue; }
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
    rec.declarations = muts.declarations.map((d) => d.label);
    // (string literals first, they never break compilation, then keys and member names)
    // EVERY site of EVERY legacy name (ledger names and, for wildcard rows, every legacy word of the file) is mutated, one defect at a time:
    // a name is credited only when all of its sites are killed (a survivor at any site blocks it) and never by a sibling's kill.
    const perNameAll = [...muts.lit].sort((x, y) => Number(/^['"`]/.test(y.replacement)) - Number(/^['"`]/.test(x.replacement)) || x.label.localeCompare(y.label) || x.line - y.line);
    const perNameChosen = perNameAll;
    const labelled = new Set([...muts.swap, ...muts.guard].flatMap((m) => m.labels ?? []).concat(perNameAll.map((m) => m.label)));
    rec.namesWithoutSite = [...pair.names].filter((n) => !labelled.has(n));
    rec.exhaustive = true;
    rec.fallbackOperators = 1;
    const queue = [...muts.swap, ...muts.guard, ...perNameChosen];
    try {
      for (const m of queue) {
        fs.writeFileSync(abs, apply(original, m));
        const r = runTest(pair.test);
        const c = classifyRun(r.status, r.output);
        rec.mutations.push({ operator: m.operator, line: m.line, label: m.label ?? null, labels: m.labels ?? undefined, outcome: c === "assertion-failure" ? "KILLED" : c === "pass" ? "SURVIVED" : "INCONCLUSIVE" });
      }
    } finally { fs.writeFileSync(abs, original); }
    rec.inconclusive = rec.mutations.filter((m) => m.outcome === "INCONCLUSIVE").length;
    rec.diagnosticsRelaxed = ROOT !== REPO && pair.test.startsWith("apps/api/");
    const killed = rec.mutations.filter((m) => m.outcome === "KILLED").length;
    const survivedStrong = rec.mutations.some((m) => m.outcome === "SURVIVED" && m.operator !== "LEGACY_LITERAL");
    const survivedName = rec.mutations.some((m) => m.outcome === "SURVIVED" && m.operator === "LEGACY_LITERAL");
    rec.verdict = rec.mutations.length === 0 ? (muts.declarations.length > 0 ? "COMPILER_CHECKED" : "NO_MUTATION_SITE") : survivedStrong ? "CANONICAL_FIRST_UNENFORCED" : survivedName ? (killed ? "PARTIAL" : "SURVIVED") : killed ? "PROVEN" : "SURVIVED";
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
