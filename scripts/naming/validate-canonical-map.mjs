#!/usr/bin/env node
/**
 * scripts/naming/validate-canonical-map.mjs
 *
 * Validates the naming authority (docs/naming/canonical-naming-map.json):
 * structure/vocabulary (canonical-map.mjs) and, against the CURRENT code
 * instead of trusting it, every concept with disposition DONE: each
 * backticked snake_case name in its database field must exist as a physical column in
 * apps/api/src/database/entities.ts, and each backticked snake_case legacy
 * alias must NOT exist as a physical column anymore (a DONE rename whose old
 * column is still live is a stale map row).
 *
 *   node scripts/naming/validate-canonical-map.mjs   # exit 1 on any mismatch
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadAuthority, validateStructure, rowsWithoutCoveringTest, coveringTestRatchet } from "./canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
export const COVERING_TEST_BASELINE = path.join(here, "covering-test-baseline.json");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

export function physicalColumns() {
  const file = path.join(ROOT, "apps/api/src/database/entities.ts");
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const byTable = new Map();
  const nameOpt = (call) => {
    const opts = call.arguments.find((a) => ts.isObjectLiteralExpression(a));
    const p = opts?.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(sf) === "name");
    return p && ts.isStringLiteral(p.initializer) ? p.initializer.text : null;
  };
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt)) continue;
    const ent = (ts.getDecorators?.(stmt) ?? []).find((d) => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === "Entity");
    const arg = ent?.expression.arguments[0];
    if (!arg || !ts.isStringLiteral(arg)) continue;
    const cols = new Set();
    for (const m of stmt.members) {
      if (!ts.isPropertyDeclaration(m) || !m.name || !ts.isIdentifier(m.name)) continue;
      for (const d of ts.getDecorators?.(m) ?? []) {
        if (!ts.isCallExpression(d.expression)) continue;
        const callee = d.expression.expression.getText(sf);
        if (/Column$/.test(callee)) cols.add(nameOpt(d.expression) ?? m.name.text);
        if (callee === "JoinColumn") { const n = nameOpt(d.expression); if (n) cols.add(n); }
      }
    }
    byTable.set(arg.text, cols);
  }
  return byTable;
}

/** Glob (`*` within a segment, `**` across segments) to RegExp, for exception rows that name a file family. */
export function globToRegExp(glob) {
  const re = glob.split("**").map((part) => part.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*");
  return new RegExp(`^${re}$`);
}

/** A glob path in the ledger must still match at least one tracked file, otherwise the row is dangling. */
export function danglingGlobRows(map, tracked) {
  return (map.exceptions ?? [])
    .filter((e) => e.status !== "REMOVED" && e.path !== "*" && String(e.path).includes("*"))
    .filter((e) => String(e.path).split(/\s*,\s*/).some((g) => !tracked.some((f) => globToRegExp(g).test(f))))
    .map((e) => `exception ${e.item ?? e.currentName}: path glob '${e.path}' matches no tracked file`);
}

function main() {
  const map = loadAuthority();
  const problems = validateStructure(map);
  const byTable = physicalColumns();
  const all = new Set([...byTable.values()].flatMap((c) => [...c]));
  let checked = 0;
  const ticks = (s) => [...String(s ?? "").matchAll(/`([a-z][a-z0-9_]*)`/g)].map((m) => m[1]);
  for (const c of map.concepts) {
    if (c.disposition !== "DONE" || !c.database) continue;
    // scope: tables named in parentheses in the database cell, when they exist in the schema
    const scope = [...c.database.matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[,/]/).map((t) => t.replace(/[`*\s]|\d+\+?|tables?|only|rows?/g, "")))
      .filter((t) => byTable.has(t));
    for (const col of ticks(c.database)) {
      checked++;
      const ok = scope.length ? scope.some((t) => byTable.get(t).has(col)) : all.has(col);
      if (!ok) problems.push(`${c.id} ${c.concept}: canonical column \`${col}\` not found ${scope.length ? `in ${scope.join(", ")}` : "in entities.ts"}`);
    }
    for (const alias of c.legacyAliases ?? []) {
      if (!/^[a-z][a-z0-9_]*$/.test(alias)) continue;
      checked++;
      const live = scope.filter((t) => byTable.get(t).has(alias));
      if (live.length) problems.push(`${c.id} ${c.concept}: legacy alias \`${alias}\` is still a physical column on ${live.join(", ")}`);
    }
  }
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  problems.push(...danglingGlobRows(map, tracked));
  const ratchet = coveringTestRatchet(map, JSON.parse(fs.readFileSync(COVERING_TEST_BASELINE, "utf8")));
  if (ratchet.grew) {
    problems.push(`${ratchet.count} ACTIVE TEMPORARY_MIGRATION_COMPATIBILITY rows have no coveringTest, above the baseline ${ratchet.baseline} (scripts/naming/covering-test-baseline.json): add the covering test path to the new rows instead of raising the baseline`);
  }
  if (problems.length) {
    console.error(`canonical naming map validation failed (${problems.length}):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  const untested = rowsWithoutCoveringTest(map);
  const temporary = (map.exceptions ?? []).filter((e) => e.status === "ACTIVE" && e.exceptionClass === "TEMPORARY_MIGRATION_COMPATIBILITY").length;
  if (untested.length) {
    console.warn(`warning: ${untested.length}/${temporary} ACTIVE TEMPORARY_MIGRATION_COMPATIBILITY rows have no coveringTest (ratchet baseline ${ratchet.baseline}: may only go down; add the test path that proves the alias)`);
  }
  if (ratchet.shrunk) {
    console.warn(`hint: untested temporary rows dropped to ${ratchet.count} (baseline ${ratchet.baseline}); lower untestedTemporaryRows in scripts/naming/covering-test-baseline.json to ${ratchet.count} to lock the gain`);
  }
  console.log(`canonical naming map valid: structure ok, ${checked} column assertions against ${byTable.size} tables`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
