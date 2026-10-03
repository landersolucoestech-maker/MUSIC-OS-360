#!/usr/bin/env node
/**
 * scripts/naming/normalization-audit.mjs: comparative audit of the technical-language normalization.
 *
 *   node scripts/naming/normalization-audit.mjs --baseline <sha> [--out docs/naming/audit]
 *
 * Runs the CURRENT census detectors over two states of the repository and compares them:
 *   - BASELINE: the tree of <sha> (`git archive`, extracted to a temp directory with the current detector scripts
 *     and an EMPTY exception index, so every Portuguese signal is a raw candidate);
 *   - HEAD: the working tree with the real ledger (exceptions) and baseline.
 * Same lexicon, same scanners, same surfaces on both sides: the only variable is the repository.
 *
 * Output (deterministic for a given pair of states):
 *   <out>/normalization-audit-matrix.tsv   every item of either state: layer, surface, path, kind, name,
 *                                          baseline count, head count, classification, exception class
 *   <out>/normalization-audit-summary.md   per-layer table and the cross-checks
 *
 * Item = one census key (surface::path::kind::name) with its occurrence count (a Markdown document is one key whose
 * count is its Portuguese prose lines). Per key: audited = max(base, head); normalized = max(0, base - head);
 * remaining = head. audited = normalized + remaining holds on every layer.
 * Classification of the remaining items: LEGITIMATE_COMPATIBILITY_BOUNDARY (ledger exception row),
 * HISTORICAL_RECORD (frozen Markdown records counted by the doc ratchet), NOT_NORMALIZED (anything else).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadAuthority } from "./canonical-map.mjs";
import { census } from "./technical-naming-census.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

export const isTestFile = (f) => /[.-](test|spec|e2e-spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(e2e|__tests__|__fixtures__|fixtures)\//.test(f);

/** Layer of a repository path. Tests and fixtures are their own layer, whatever app they sit in. */
export function layerOfPath(file) {
  if (/\.mdx?$/.test(file)) return "DOCUMENTATION";
  if (isTestFile(file)) return "TESTS_FIXTURES_MOCKS";
  if (file.startsWith("apps/api/drizzle/") || /(^|\/)migrations\//.test(file)) return "DATABASE";
  if (file.startsWith("apps/api/")) return "BACKEND_API";
  if (file.startsWith("apps/web/")) return "FRONTEND";
  if (file.startsWith("packages/")) return "SHARED_PACKAGES";
  if (file.startsWith("docs/")) return "DOCUMENTATION";
  return "TOOLING_SCRIPTS_CI";
}

/** `surface::path::kind::name` -> { surface, file, name }. dbColumn keys have no file (`dbColumn::table.column`). */
export function parseKey(key) {
  const [surface, ...rest] = key.split("::");
  if (surface === "dbColumn") return { surface, file: "apps/api/src/database/entities.ts", kind: "column", name: rest.join("::") };
  if (surface === "directory") return { surface, file: rest.join("::"), kind: "directory", name: rest.join("::") };
  if (surface === "doc") return { surface, file: rest.join("::"), kind: "doc", name: "*" };
  const [file, kind, ...name] = rest;
  return { surface, file, kind: kind ?? "", name: name.join("::") };
}

export const SURFACE_LAYER = { dbColumn: "DATABASE", dataFile: null };

function baselineCensus(sha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "naming-baseline-"));
  const archive = execFileSync("git", ["archive", sha], { cwd: ROOT, maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", dir], { input: archive });
  fs.mkdirSync(path.join(dir, "scripts/naming"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs/naming"), { recursive: true });
  for (const f of fs.readdirSync(here)) if (/\.(mjs|txt)$/.test(f)) fs.copyFileSync(path.join(here, f), path.join(dir, "scripts/naming", f));
  fs.copyFileSync(path.join(ROOT, "docs/naming/canonical-naming-map.json"), path.join(dir, "docs/naming/canonical-naming-map.json"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
  const driver = path.join(dir, "driver.mjs");
  fs.writeFileSync(driver, `import { census } from ${JSON.stringify(pathToFileURL(path.join(dir, "scripts/naming/technical-naming-census.mjs")).href)};\n` +
    "const c = census({ exceptions: { get: () => undefined } });\nprocess.stdout.write(JSON.stringify({ debt: c.debt, files: c.filesScanned }));\n");
  const out = execFileSync("node", [driver], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 30 });
  fs.rmSync(dir, { recursive: true, force: true });
  return JSON.parse(out);
}

/** Pure comparison of two raw censuses. `head` carries debt, excepted and exceptedClass. */
export function compareStates(base, head, { historicalDocs }) {
  const rows = [];
  const keys = new Set([...Object.keys(base.debt), ...Object.keys(head.debt), ...Object.keys(head.excepted)]);
  for (const key of [...keys].sort()) {
    const b = base.debt[key] ?? 0;
    const hDebt = head.debt[key] ?? 0;
    const hExc = head.excepted[key] ?? 0;
    const h = hDebt + hExc;
    const p = parseKey(key);
    const layer = SURFACE_LAYER[p.surface] ?? layerOfPath(p.file);
    let classification = "NORMALIZED";
    let excClass = "";
    if (hExc > 0) { classification = "LEGITIMATE_COMPATIBILITY_BOUNDARY"; excClass = head.exceptedClass[key] ?? ""; }
    else if (hDebt > 0) classification = p.surface === "doc" && historicalDocs.has(p.file) ? "HISTORICAL_RECORD" : "NOT_NORMALIZED";
    rows.push({ layer, surface: p.surface, file: p.file, kind: p.kind, name: p.name, base: b, head: h, headDebt: hDebt, headExc: hExc, classification, excClass });
  }
  return rows;
}

export const LAYERS = ["DATABASE", "BACKEND_API", "FRONTEND", "SHARED_PACKAGES", "TESTS_FIXTURES_MOCKS", "TOOLING_SCRIPTS_CI", "DOCUMENTATION"];

export function summarize(rows, changedFilesByLayer) {
  const out = Object.fromEntries(LAYERS.map((l) => [l, { audited: 0, changedFiles: changedFilesByLayer[l] ?? 0, normalized: 0, legit: 0, historical: 0, notNormalized: 0 }]));
  for (const r of rows) {
    const s = out[r.layer];
    s.audited += Math.max(r.base, r.head);
    s.normalized += Math.max(0, r.base - r.head);
    if (r.classification === "LEGITIMATE_COMPATIBILITY_BOUNDARY") s.legit += r.headExc;
    if (r.classification === "HISTORICAL_RECORD") s.historical += r.headDebt;
    if (r.classification === "NOT_NORMALIZED") s.notNormalized += r.headDebt;
    // a key that is partly excepted and partly debt: the debt part is never hidden
    if (r.classification === "LEGITIMATE_COMPATIBILITY_BOUNDARY" && r.headDebt > 0) s.notNormalized += r.headDebt;
  }
  return out;
}

function changedFiles(sha) {
  const out = execFileSync("git", ["diff", "--name-only", sha, "HEAD"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(Boolean);
  const by = {};
  for (const f of out) { const l = layerOfPath(f); by[l] = (by[l] ?? 0) + 1; }
  return { by, total: out.length };
}

function main() {
  const sha = arg("--baseline");
  if (!sha) throw new Error("usage: normalization-audit.mjs --baseline <sha> [--out <dir>]");
  const outDir = path.resolve(ROOT, arg("--out") ?? "docs/naming/audit");
  const fullSha = execFileSync("git", ["rev-parse", sha], { cwd: ROOT, encoding: "utf8" }).trim();
  const head = census();
  const base = baselineCensus(fullSha);
  const map = loadAuthority();
  const historicalDocs = new Set(map.exceptions.filter((e) => e.census === "baselined").flatMap((e) => String(e.path).split(/\s*,\s*/)));
  const rows = compareStates(base, head, { historicalDocs });
  const changed = changedFiles(fullSha);
  const summary = summarize(rows, changed.by);
  fs.mkdirSync(outDir, { recursive: true });
  const tsv = ["layer\tsurface\tpath\tkind\tname\tbaseline_count\thead_count\tclassification\texception_class",
    ...rows.map((r) => [r.layer, r.surface, r.file, r.kind, r.name.replace(/[\t\n]/g, " "), r.base, r.head, r.classification, r.excClass].join("\t"))].join("\n") + "\n";
  fs.writeFileSync(path.join(outDir, "normalization-audit-matrix.tsv"), tsv);
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const T = (k) => LAYERS.reduce((a, l) => a + summary[l][k], 0);
  const lines = [
    "# Technical language normalization: comparative audit (generated)",
    "",
    `Baseline: \`${fullSha}\` (${base.files} files scanned). Audited tree: \`${headSha}\` (${head.filesScanned} files scanned). Files changed between them: ${changed.total}.`,
    "Generated by `scripts/naming/normalization-audit.mjs`; the per-item matrix is `normalization-audit-matrix.tsv` (every item, not a sample).",
    "",
    "Unit: one census item with its occurrence count (identifier, object key, string value, route, file name, data-file name, tool message; a Markdown document counts its Portuguese prose lines). `audited = normalized + remaining` on every row.",
    "",
    "| CAMADA | ITENS AUDITADOS | ALTERADOS (files) | NORMALIZED | LEGITIMATE_COMPATIBILITY_BOUNDARY | HISTORICAL_RECORD | NOT_NORMALIZED |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...LAYERS.map((l) => { const s = summary[l]; return `| ${l} | ${s.audited} | ${s.changedFiles} | ${s.normalized} | ${s.legit} | ${s.historical} | ${s.notNormalized} |`; }),
    `| **TOTAL** | ${T("audited")} | ${changed.total} | ${T("normalized")} | ${T("legit")} | ${T("historical")} | ${T("notNormalized")} |`,
    "",
  ];
  fs.writeFileSync(path.join(outDir, "normalization-audit-summary.md"), lines.join("\n"));
  fs.writeFileSync(path.join(outDir, "normalization-audit-summary.json"), JSON.stringify({ baseline: fullSha, head: headSha, files: { baseline: base.files, head: head.filesScanned }, changedFiles: changed.total, layers: summary }, null, 1) + "\n");
  console.log(lines.slice(6).join("\n"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`normalization-audit FAILED: ${err.message}`); process.exit(2); }
}
