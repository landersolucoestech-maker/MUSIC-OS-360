#!/usr/bin/env node
/**
 * scripts/naming/historical-records-audit.mjs: per-file validation of the HISTORICAL_RECORD documents.
 *
 *   node scripts/naming/historical-records-audit.mjs --check     gate (exit 1 on any violation)
 *   node scripts/naming/historical-records-audit.mjs --report    also write docs/naming/audit/historical-records-audit.{md,tsv}
 *   node scripts/naming/historical-records-audit.mjs --write     regenerate docs/naming/historical-records.json (frozen content manifest)
 *
 * The population is the set of paths of the ledger rows with `census: "baselined"` (frozen Markdown whose Portuguese prose
 * is counted by the doc ratchet instead of being translated). Each file must satisfy, individually:
 *   H1 HEADER      the first line is the explicit label "> Historical record. Kept as recorded; not the current contract.";
 *   H2 FROZEN      its body (everything after the label) matches the sha256 and line count of the manifest: no new growth,
 *                  no silent edit (a legitimate edit is a manifest regeneration in the same commit, reviewed as such);
 *   H3 NOT_CONSUMED no executable consumer (apps, packages, scripts other than the audit tooling, .github, pack runtime,
 *                  package manifests) reads the path, so no tool or runtime treats it as a canonical source;
 *   H4 NOT_NORMATIVE every reference from an ACTIVE Markdown document labels it historical/frozen/superseded on the same
 *                  or the preceding lines (a self-claim of authority inside a record is overridden by its label);
 *   H5 LEDGER      the ledger row that covers it is a `doc` row of class UX_TEXT with census "baselined".
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadAuthority } from "./canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
export const MANIFEST = path.join(ROOT, "docs/naming/historical-records.json");
export const LABEL = "> Historical record. Kept as recorded; not the current contract.";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function historicalPaths(map) {
  return [...new Set((map.exceptions ?? []).filter((e) => e.census === "baselined").flatMap((e) => String(e.path).split(/\s*,\s*/)))].sort();
}

export const bodyOf = (text) => text.split("\n").slice(1).join("\n");

/**
 * Files that are part of the frozen corpus or are evidence of a past audit: they may cite records freely
 * (docs/backend-v2 and reports hold the frozen point-in-time audits; .audit-runtime holds the forensic evidence of one).
 */
export const CORPUS = /^(docs\/backend-v2\/|reports\/|\.audit-runtime\/)/;
/** A reference line that is only a code comment (a published migration may cite the audit that motivated it). */
export const isCommentLine = (line) => /^\s*(\/\/|\*|\/\*|--|#)/.test(line);
/** Published migrations are immutable history: only they may cite a record in a comment without labelling it. */
export const isMigration = (f) => /(^|\/)migrations\/[^/]+$/.test(f);
const LABELLED = /historical|frozen|superseded|point-in-time|archived|kept as recorded|not the current contract|histórico/i;

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
}

/** Pure validation. `files` maps path -> text for every tracked text file that may reference a record. */
export function validate({ records, manifest, files, readRecord }) {
  const violations = [];
  const hist = new Set(records);
  const isHistoricalFile = (f) => hist.has(f);
  for (const p of records) {
    const text = readRecord(p);
    if (text == null) { violations.push({ file: p, check: "H1_HEADER", detail: "file is missing" }); continue; }
    if (text.split("\n")[0].trim() !== LABEL) violations.push({ file: p, check: "H1_HEADER", detail: "first line is not the historical-record label" });
    const m = manifest.records?.[p];
    const body = bodyOf(text);
    if (!m) violations.push({ file: p, check: "H2_FROZEN", detail: "no manifest entry" });
    else if (m.sha256 !== sha256(body) || m.lines !== body.split("\n").length) violations.push({ file: p, check: "H2_FROZEN", detail: `body changed (manifest ${m.lines} lines, now ${body.split("\n").length})` });
  }
  const baseCount = new Map();
  for (const r of records) baseCount.set(r.split("/").pop(), (baseCount.get(r.split("/").pop()) ?? 0) + 1);
  // a basename identifies a record only when it is long and unique among the records (integrations.md would match docs/engineering/integrations.md)
  const base = (p) => { const b = p.split("/").pop(); return b.length >= 22 && baseCount.get(b) === 1 ? b : p; };
  for (const [f, text] of Object.entries(files)) {
    if (isHistoricalFile(f)) continue;
    const executable = /^(apps|packages|\.github|\.claude\/runtime|\.claude\/hooks|scripts)\//.test(f) && !/\.md$/.test(f) || /(^|\/)package\.json$/.test(f);
    const inCorpus = CORPUS.test(f);
    const isNamingTool = inCorpus || /^scripts\/naming\//.test(f) || f === "docs/naming/canonical-naming-map.json" || /^docs\/naming\/(audit\/|historical-records\.json)/.test(f);
    const lines = text.split("\n");
    for (const p of records) {
      if (!text.includes(p) && !(f.endsWith(".md") && text.includes(base(p)))) continue;
      if (executable && !isNamingTool && lines.some((l) => l.includes(p) && (!isCommentLine(l) || (!isMigration(f) && !LABELLED.test(l))))) violations.push({ file: p, check: "H3_NOT_CONSUMED", detail: `referenced by executable ${f}` });
      if (f.endsWith(".md") && !isNamingTool) {
        lines.forEach((line, i) => {
          if (!(line.includes(p) || line.includes(base(p)))) return;
          const ctx = lines.slice(Math.max(0, i - 2), i + 1).join(" ");
          if (!LABELLED.test(ctx) && !/^\s*\|?\s*$/.test(line)) violations.push({ file: p, check: "H4_NOT_NORMATIVE", detail: `unlabelled reference from ${f}:${i + 1}` });
        });
      }
    }
  }
  return violations;
}

export function buildManifest(records, readRecord) {
  const out = { schemaVersion: 1, label: LABEL, records: {} };
  for (const p of records) {
    const body = bodyOf(readRecord(p) ?? "");
    out.records[p] = { sha256: sha256(body), lines: body.split("\n").length };
  }
  return out;
}

/** Every tracked Markdown file of the frozen corpora (docs/backend-v2, reports) is a record even when it has no Portuguese prose; the corpus README is the status document, not a record. */
export function corpusMarkdown(tracked) {
  return tracked.filter((f) => /\.md$/.test(f) && /^(docs\/backend-v2\/|reports\/)/.test(f) && f !== "docs/backend-v2/README.md");
}

function main() {
  const mode = process.argv[2] ?? "--check";
  const map = loadAuthority();
  const ledgerRecords = historicalPaths(map);
  const records = [...new Set([...ledgerRecords, ...corpusMarkdown(trackedFiles())])].sort();
  const readRecord = (p) => { const f = path.join(ROOT, p); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
  if (mode === "--write") {
    fs.writeFileSync(MANIFEST, JSON.stringify(buildManifest(records, readRecord), null, 1) + "\n");
    console.log(`historical-records manifest written: ${records.length} records`);
    return;
  }
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { records: {} };
  const files = {};
  for (const f of trackedFiles()) {
    if (!/\.(md|mdx|mjs|cjs|js|ts|tsx|json|ya?ml|sh|toml)$/.test(f) || /(^|\/)(pnpm-lock\.yaml)$/.test(f)) continue;
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs) || fs.statSync(abs).size > 3_000_000) continue;
    files[f] = fs.readFileSync(abs, "utf8");
  }
  const violations = validate({ records, manifest, files, readRecord });
  // H5: every record is covered by a doc row of class UX_TEXT with census "baselined"
  const covered = new Set((map.exceptions ?? []).filter((e) => e.census === "baselined" && e.surface === "doc" && e.exceptionClass === "UX_TEXT").flatMap((e) => String(e.path).split(/\s*,\s*/)));
  for (const p of ledgerRecords) if (!covered.has(p)) violations.push({ file: p, check: "H5_LEDGER", detail: "not covered by a baselined doc row of class UX_TEXT" });
  const unique = [...new Map(violations.map((v) => [`${v.file}|${v.check}|${v.detail}`, v])).values()];
  console.log(`historical-records audit: ${records.length} records, MISCLASSIFIED_HISTORICAL_RECORDS=${new Set(unique.map((v) => v.file)).size}, violations=${unique.length}`);
  for (const v of unique.slice(0, 80)) console.error(`  ${v.check} ${v.file}: ${v.detail}`);
  if (mode === "--report") {
    const dir = path.join(ROOT, "docs/naming/audit");
    fs.mkdirSync(dir, { recursive: true });
    const bad = new Set(unique.map((v) => v.file));
    const tsv = ["path\tbody_lines\tbody_sha256\theader\tfrozen\tnot_consumed\tnot_normative\tledger\tresult",
      ...records.map((p) => {
        const has = (c) => unique.some((v) => v.file === p && v.check === c) ? "FAIL" : "ok";
        return [p, manifest.records?.[p]?.lines ?? "", (manifest.records?.[p]?.sha256 ?? "").slice(0, 16), has("H1_HEADER"), has("H2_FROZEN"), has("H3_NOT_CONSUMED"), has("H4_NOT_NORMATIVE"), has("H5_LEDGER"), bad.has(p) ? "MISCLASSIFIED" : "HISTORICAL_RECORD"].join("\t");
      })].join("\n") + "\n";
    fs.writeFileSync(path.join(dir, "historical-records-audit.tsv"), tsv);
    fs.writeFileSync(path.join(dir, "historical-records-audit.md"), [
      "# Historical records audit (generated)", "",
      `Generated by \`node scripts/naming/historical-records-audit.mjs --report\`. ${records.length} documents, each validated individually (per-file result in \`historical-records-audit.tsv\`).`, "",
      "| Check | Meaning |", "|---|---|",
      "| H1 header | first line is the explicit label \"Historical record. Kept as recorded; not the current contract.\" |",
      "| H2 frozen | the body after the label matches the sha256 and line count of `docs/naming/historical-records.json` (no growth, no silent edit) |",
      "| H3 not consumed | no executable consumer (apps, packages, scripts other than the naming tooling, .github, pack runtime, package manifests) reads the path |",
      "| H4 not normative | every reference from an active Markdown document labels it historical, and the file claims no current authority |",
      "| H5 ledger | covered by a baselined `doc` row of class UX_TEXT; Portuguese prose lines are held by the per-file ratchet |", "",
      `MISCLASSIFIED_HISTORICAL_RECORDS = ${bad.size}`, "",
    ].join("\n"));
  }
  if (unique.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`historical-records audit FAILED: ${err.stack ?? err.message}`); process.exit(2); }
}
