#!/usr/bin/env node
/**
 * scripts/naming/compat-apply-proven.mjs: binds a ledger row to the test that PROVED its boundary.
 *
 *   node scripts/naming/compat-apply-proven.mjs [--proof <file>] [--write]
 *
 * The mutation harness (compat-mutation-proof.mjs) also tries tests that were not declared by a row (candidate
 * tests that import the file or quote one of its legacy names). When such a test kills the mutation of the row's own
 * name against the CURRENT bytes of the file and of the test, the row is bound to it: the test is bound to the
 * row's `coveringTest` (replacing the declared test that did not prove it). Nothing else in the ledger changes, and a row whose own mutation survived is never touched
 * (a survivor is fixed by a real test, not by a binding). Without --write the changes are only listed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pairEvidence, isTestFile, PROOF_CLASSES, MUTATION_FILE } from "./compat-boundary-audit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const MAP = path.join(ROOT, "docs/naming/canonical-naming-map.json");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

export function bindingsToApply(map, results, readFile) {
  const byFile = new Map();
  for (const r of results.values()) { const l = byFile.get(r.file) ?? []; l.push(r); byFile.set(r.file, l); }
  const out = [];
  for (const e of map.exceptions ?? []) {
    if (e.status === "REMOVED" || e.census === "baselined" || !PROOF_CLASSES.has(e.exceptionClass) || e.currentName === "*") continue;
    const declared = new Set(String(e.coveringTest ?? "").split(/\s*,\s*/).filter(Boolean));
    for (const p of String(e.path).split(/\s*,\s*/)) {
      if (p === "*" || isTestFile(p) || p.startsWith(".claude/") || !/\.[cm]?[jt]sx?$/.test(p)) continue;
      const proves = (t) => { const ev = pairEvidence(results, p, t, readFile, e.currentName); return ev.fresh && ev.proven; };
      if ([...declared].some(proves)) continue;
      const winner = (byFile.get(p) ?? []).map((r) => r.test).filter((t) => !declared.has(t) && proves(t)).sort()[0];
      if (winner) out.push({ row: e, test: winner });
    }
  }
  return out;
}

function main() {
  const proofFile = path.resolve(arg("--proof") ?? MUTATION_FILE);
  const map = JSON.parse(fs.readFileSync(MAP, "utf8"));
  const results = new Map(JSON.parse(fs.readFileSync(proofFile, "utf8")).results.map((r) => [`${r.file}\u0000${r.test}`, r]));
  const readFile = (p) => { const f = path.join(ROOT, p); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
  const todo = bindingsToApply(map, results, readFile);
  for (const { row, test } of todo) {
    // a row carries ONE covering test (validate-canonical-map): the binding replaces a declared test that did not prove the name
    if (process.argv.includes("--write")) row.coveringTest = test;
  }
  console.log(`${todo.length} row binding(s) ${process.argv.includes("--write") ? "applied" : "to apply (dry run)"}`);
  if (process.argv.includes("--write") && todo.length) fs.writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
