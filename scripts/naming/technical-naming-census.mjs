#!/usr/bin/env node
/**
 * scripts/naming/technical-naming-census.mjs — technical naming census and CI ratchet.
 *
 * Rule: engineering names are English; Portuguese only in end-user visible
 * frontend content (and in the exception classes of the canonical naming map).
 * The Portuguese lexicon (pt-lexicon.mjs) is a SIGNAL: a hit is a candidate for
 * semantic review, never an automatic rename.
 *
 * Surfaces and enforcement (see docs/NAMING_NORMALIZATION_CANONICAL_MAP.md):
 *   enforced          identifiers (functions, classes, interfaces, types, enums
 *                     and members, methods, properties, variables, parameters),
 *                     file names, directory names, env var names, event / queue /
 *                     job names, API route paths, test titles, technical comments
 *   report-only       frontend route paths, object-literal keys (mostly wire/DB
 *                     field names), migration file names (historical),
 *                     DB columns (enforced separately by
 *                     apps/api/src/database/pt-column-naming-baseline.guard.spec.ts)
 *   not scanned       user-facing strings (JSX text, string values, labels),
 *                     localization values, fixtures, user documentation
 *
 * Baseline = known, classified debt (technical-naming-baseline.json), keyed by
 * path + kind + name so each entry is traceable. Names registered in the
 * canonical map's exception ledger are not debt and never enter the baseline.
 *
 *   node scripts/naming/technical-naming-census.mjs --check   # CI guard
 *   node scripts/naming/technical-naming-census.mjs --write   # regenerate baseline
 *   node scripts/naming/technical-naming-census.mjs --report  # coverage summary (JSON)
 *
 * --check fails when the current census differs from the baseline in EITHER
 * direction: growth is a new Portuguese technical name; shrinkage means a fixed
 * name whose entry must be removed in the same commit (so it can never be
 * reintroduced silently). Tooling errors (no files, missing baseline, parse
 * failure) exit non-zero; the guard never reports success on an empty scan.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ptWords, isPtProse } from "./pt-lexicon.mjs";
import { ROOT, loadAuthority, exceptionIndex } from "./canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE = process.env.NAMING_BASELINE_PATH ? path.resolve(process.env.NAMING_BASELINE_PATH) : path.join(here, "technical-naming-baseline.json");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

export const layerOf = (f) => (f.startsWith("apps/web") ? "web" : f.startsWith("apps/api") ? "api" : f.startsWith("packages") ? "packages" : "scripts");
const TECHNICAL_NAME = /^[a-z0-9][a-z0-9_.:-]*$/; // event/queue/job/i18n-key shaped (never a UX label)

/**
 * Scans one source file. Returns technical-name hits:
 * { surface, kind, name, line }. Pure: no filesystem access.
 */
export function scanSource(relPath, text) {
  const hits = [];
  const add = (surface, kind, name, line) => hits.push({ surface, kind, name, line });
  const segs = relPath.split("/");
  for (const d of segs.slice(0, -1)) if (ptWords(d).length) add("directory", "directory", d, 0);
  const base = segs[segs.length - 1];
  if (ptWords(base.replace(/\.(test|spec|e2e-spec)?\.?(tsx?|mts|cts|mjs|js)$/, "")).length) add("filename", "filename", base, 0);
  if (!/\.(ts|tsx|mts|cts|mjs|js)$/.test(relPath)) return hits;

  const kind = relPath.endsWith("x") ? ts.ScriptKind.TSX : /\.(mjs|js)$/.test(relPath) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const ident = (kind, nameNode, at) => {
    if (!nameNode) return;
    const name = ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isPrivateIdentifier(nameNode) ? nameNode.text : null;
    if (!name) return;
    // i18n/label maps: string-literal keys are technical keys; values are UX and never scanned
    if (ts.isStringLiteral(nameNode) && !TECHNICAL_NAME.test(name)) return;
    if (ptWords(name).length) add("identifier", kind, name, lineOf(at));
  };
  const isEnvAccess = (e) => ts.isPropertyAccessExpression(e) && e.name.text === "env"
    && ((ts.isIdentifier(e.expression) && e.expression.text === "process") || ts.isMetaProperty(e.expression));
  const env = (name, at) => { if (/^[A-Z][A-Z0-9_]+$/.test(name) && ptWords(name).length) add("envVar", "env", name, lineOf(at)); };
  const evt = (name, at) => { if (TECHNICAL_NAME.test(name) && ptWords(name).length) add("eventQueueJob", "name", name, lineOf(at)); };
  const isEnvSchema = relPath.endsWith("env.schema.ts");
  let controllerBase = null;

  const visit = (n) => {
    if (ts.isFunctionDeclaration(n)) ident("function", n.name, n);
    else if (ts.isClassDeclaration(n)) ident("class", n.name, n);
    else if (ts.isInterfaceDeclaration(n)) ident("interface", n.name, n);
    else if (ts.isTypeAliasDeclaration(n)) {
      ident("type", n.name, n);
      // event/analytics name unions: type AnalyticsEventName = "release.created" | ...
      if (/event|queue|job/i.test(n.name.text)) {
        const lits = [];
        const collect = (t) => { if (ts.isUnionTypeNode(t)) t.types.forEach(collect); else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) lits.push(t.literal); };
        collect(n.type);
        for (const l of lits) evt(l.text, l);
      }
    }
    else if (ts.isEnumDeclaration(n)) ident("enum", n.name, n);
    else if (ts.isEnumMember(n)) ident("enum-member", n.name, n);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      ident("variable", n.name, n);
      let init = n.initializer;
      while (init && (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(init)))) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init) && /event|queue|job/i.test(n.name.text)) {
        for (const p of init.properties) if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) evt(p.initializer.text, p);
      }
    } else if (ts.isMethodDeclaration(n) || ts.isMethodSignature(n)) ident("method", n.name, n);
    else if (ts.isPropertyDeclaration(n) || ts.isPropertySignature(n)) ident("property", n.name, n);
    else if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      if (isEnvSchema && ts.isIdentifier(n.name)) env(n.name.text, n);
      else if (ts.isStringLiteral(n.name) && TECHNICAL_NAME.test(n.name.text) && n.name.text.includes(".")) ident("i18n-key", n.name, n);
      else if ((ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && TECHNICAL_NAME.test(n.name.text.replace(/[A-Z]/g, (c) => c.toLowerCase())) && ptWords(n.name.text).length) {
        add("objectKey", "object-key", n.name.text, lineOf(n)); // report-only: mostly wire/DB field names
      }
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) ident("parameter", n.name, n);
    else if (ts.isPropertyAccessExpression(n) && isEnvAccess(n.expression)) env(n.name.text, n);
    else if (ts.isElementAccessExpression(n) && isEnvAccess(n.expression) && ts.isStringLiteral(n.argumentExpression)) env(n.argumentExpression.text, n);
    else if (ts.isDecorator(n) && ts.isCallExpression(n.expression)) {
      const callee = n.expression.expression.getText(sf);
      const arg = n.expression.arguments[0];
      const lit = arg && ts.isStringLiteral(arg) ? arg.text : null;
      if (callee === "Controller" && lit != null) {
        controllerBase = lit;
        if (ptWords(lit).length) add("apiRoute", "route", `/${lit}`, lineOf(n));
      } else if (["Get", "Post", "Put", "Patch", "Delete"].includes(callee) && lit && ptWords(lit).length) {
        add("apiRoute", "route", `/${controllerBase ?? ""}/${lit}`, lineOf(n));
      } else if (["OnEvent", "Processor", "InjectQueue"].includes(callee) && lit) evt(lit, n);
    } else if (ts.isCallExpression(n)) {
      const target = n.expression;
      const callee = ts.isIdentifier(target) ? target.text
        : ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression) ? target.expression.text : null;
      const method = ts.isPropertyAccessExpression(target) ? target.name.text : callee;
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a) && ["emit", "emitAsync", "registerQueue"].includes(method ?? "")) evt(a.text, n);
      if (callee && ["describe", "it", "test"].includes(callee) && a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && isPtProse(a.text)) {
        add("testTitle", "test-title", a.text, lineOf(n));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const m of text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) {
    if (isPtProse(m[0])) add("comment", "comment", "", text.slice(0, m.index).split("\n").length);
  }
  return hits;
}

function trackedSources() {
  const files = execFileSync("git", ["ls-files", "apps", "packages", "scripts"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  const code = files.filter((f) => /\.(ts|tsx|mts|cts|mjs|js)$/.test(f) && !f.includes("/dist/") && !f.endsWith(".d.ts") && fs.existsSync(path.join(ROOT, f)));
  if (code.length === 0) throw new Error("technical-naming census: no source files found (git ls-files returned nothing) — refusing to report success");
  return code;
}

const isMigration = (f) => f.includes("/migrations/");

/** Full census: debt (baseline-comparable), exceptions and report-only surfaces. */
export function census({ exceptions = exceptionIndex(loadAuthority()) } = {}) {
  const debt = {};
  const excepted = {};
  const reportOnly = { migrationFiles: 0, frontendRoutes: {}, objectKeys: {} };
  const surfaces = Object.fromEntries(["apiRoute", "comment", "directory", "envVar", "eventQueueJob", "filename", "identifier", "testTitle"].map((k) => [k, { candidates: 0, exceptions: 0 }]));
  let filesScanned = 0;
  const dirs = new Set();
  for (const f of trackedSources()) {
    filesScanned++;
    for (const d of path.dirname(f).split("/")) dirs.add(d);
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    if (isMigration(f)) {
      if (ptWords(path.basename(f)).length) reportOnly.migrationFiles++;
      continue; // historical: published migration names and SQL are immutable history
    }
    for (const h of scanSource(f, text)) {
      if (h.surface === "objectKey") { reportOnly.objectKeys[h.name] = (reportOnly.objectKeys[h.name] ?? 0) + 1; continue; }
      {
        const key = h.surface === "comment" ? `comment::${f}` : h.surface === "directory" ? `directory::${h.name}` : `${h.surface}::${f}::${h.kind}::${h.name}`;
        const exc = h.name && exceptions.get(h.name);
        const bucket = exc ? excepted : debt;
        bucket[key] = (bucket[key] ?? 0) + 1;
        surfaces[h.surface] = surfaces[h.surface] ?? { candidates: 0, exceptions: 0 };
        surfaces[h.surface].candidates++;
        if (exc) surfaces[h.surface].exceptions++;
      }
    }
    if (f.startsWith("apps/web/src/") && /\.tsx?$/.test(f)) {
      for (const m of text.matchAll(/\bpath(?:=|:\s*)["'](\/[^"']*)["']/g)) if (ptWords(m[1]).length) reportOnly.frontendRoutes[m[1]] = true;
    }
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    filesScanned, directoriesScanned: dirs.size,
    surfaces: sorted(surfaces),
    debt: sorted(debt),
    excepted: sorted(excepted),
    reportOnly: {
      migrationFiles: reportOnly.migrationFiles,
      frontendRoutes: Object.keys(reportOnly.frontendRoutes).sort(),
      objectKeys: sorted(reportOnly.objectKeys),
    },
  };
}

export function totalsBySurface(debt) {
  const t = {};
  for (const [k, v] of Object.entries(debt)) { const s = k.split("::")[0]; t[s] = (t[s] ?? 0) + v; }
  return Object.fromEntries(Object.entries(t).sort());
}

/** Compares a census with a baseline; returns { grown, shrunk }. */
export function compare(debt, baselineDebt) {
  const grown = [];
  const shrunk = [];
  for (const [k, v] of Object.entries(debt)) if (v > (baselineDebt[k] ?? 0)) grown.push(`${k} (${baselineDebt[k] ?? 0} -> ${v})`);
  for (const [k, v] of Object.entries(baselineDebt)) if ((debt[k] ?? 0) < v) shrunk.push(`${k} (${v} -> ${debt[k] ?? 0})`);
  return { grown, shrunk };
}

function main() {
  const mode = process.argv[2] ?? "--check";
  const c = census();
  if (mode === "--write") {
    const out = { totals: totalsBySurface(c.debt), debt: c.debt };
    fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1) + "\n");
    console.log("baseline written", out.totals);
    return;
  }
  if (mode === "--report") {
    console.log(JSON.stringify({ filesScanned: c.filesScanned, directoriesScanned: c.directoriesScanned, surfaces: c.surfaces, debtTotals: totalsBySurface(c.debt), exceptionHits: Object.values(c.excepted).reduce((a, b) => a + b, 0), reportOnly: c.reportOnly }, null, 1));
    return;
  }
  if (mode !== "--check") throw new Error(`unknown mode ${mode}`);
  if (!fs.existsSync(BASELINE)) throw new Error(`baseline not found: ${path.relative(ROOT, BASELINE)}`);
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  if (!base.debt || typeof base.debt !== "object") throw new Error("baseline has no debt section");
  const { grown, shrunk } = compare(c.debt, base.debt);
  console.log(`technical-naming census: ${c.filesScanned} files, debt ${JSON.stringify(totalsBySurface(c.debt))}`);
  if (grown.length) {
    console.error(`\nNEW Portuguese technical names (engineering = English; Portuguese only in user-visible UX text):\n  ${grown.slice(0, 200).join("\n  ")}`);
    console.error("\nRename to English. Only a documented exception (canonical-naming-map.json exceptions[]) may keep a Portuguese technical name.");
  }
  if (shrunk.length) {
    console.error(`\nBaseline is stale — these debts were removed and must be dropped from the baseline in the same commit (run --write):\n  ${shrunk.slice(0, 200).join("\n  ")}`);
  }
  if (grown.length || shrunk.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`technical-naming census FAILED: ${err.message}`); process.exit(2); }
}
