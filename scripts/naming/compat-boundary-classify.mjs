#!/usr/bin/env node
/**
 * scripts/naming/compat-boundary-classify.mjs — behavioral classification of EVERY compatibility boundary row.
 *
 *   node scripts/naming/compat-boundary-classify.mjs --check    # recompute and fail on a required boundary without behavioral proof
 *   node scripts/naming/compat-boundary-classify.mjs --report   # write docs/naming/audit/compat-boundary-classification.{tsv,json,md}
 *
 * The boundary audit (compat-boundary-audit.mjs) answers "is there a credited proof"; this tool answers the stricter question
 * "what KIND of proof backs each row, and is a behavioral proof actually required for it". Classes (one per ledger row):
 *   BEHAVIORALLY_PROVEN        a runtime file whose mutation of ITS OWN name is killed by a test (audit state PROVEN, not compiler-only)
 *   COMPILER_PROVEN            a declaration-only row (type/interface/property names) proven by a compile-time reader; no runtime behavior exists
 *   BINDING_ONLY               the row is a test/verification fixture: the test file exists and names the literal. It is the PROOF INPUT of
 *                              the runtime boundary it exercises, not a boundary; binding is NOT behavioral proof and is never counted as such
 *   EXEMPT_WITH_JUSTIFICATION  no behavioral proof is required (legal/domain term, user-facing text, historical record, naming tooling, ...)
 *   UNPROVEN                   a runtime boundary that requires behavioral proof and has none
 * `REQUIRED_BEHAVIORAL` is YES only for runtime boundaries. Counter COMPATIBILITY_WITHOUT_REQUIRED_PROOF = required rows whose class is
 * not BEHAVIORALLY_PROVEN (or COMPILER_PROVEN for declaration-only rows) — computed from the audit rows, never from a stored number.
 * Nothing here changes the audit's scope, denominator, ledger, census or rules: it only reads the audit rows.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuthority } from "./canonical-map.mjs";
import { census } from "./technical-naming-census.mjs";
import { loadProof as loadSchemaProof } from "./schema-boundary-proof.mjs";
import { audit, loadMutation, readRepo, buildOracle, isTestFile, OUT_DIR, PROOF_CLASSES } from "./compat-boundary-audit.mjs";

const pathsOf = (e) => String(e.path).split(/\s*,\s*/).filter(Boolean);
const isCode = (p) => p !== "*" && /\.[cm]?[jt]sx?$/.test(p) && !p.startsWith(".claude/");

/** Pure: classify audit rows. `rows` is the output of audit(). */
export function classify(rows, { productionFiles = [], readFile = () => null, adjudication = [] } = {}) {
  const runtimeNamed = new Map(); // legacy name -> runtime (non-test code) classes
  const schemaProof = loadSchemaProof(); // own-mutation proof of the database-schema boundaries (scripts/naming/schema-boundary-proof.mjs)
  const out = [];
  for (const r of rows) {
    const e = r.row;
    const paths = pathsOf(e);
    const runtimeFiles = paths.filter((p) => isCode(p) && !isTestFile(p));
    let cls; let required = "NO"; let justification = "";
    if (!r.needsProof) {
      cls = "EXEMPT_WITH_JUSTIFICATION";
      justification = r.category !== "NECESSARY_BOUNDARY" ? `${r.category}` : PROOF_CLASSES.has(e.exceptionClass) ? `${r.kind} (naming tooling or pack, not product runtime)` : `${e.exceptionClass}: not a compatibility class that carries runtime behavior`;
    } else if (runtimeFiles.length) {
      required = "YES";
      if (r.mutationState === "PROVEN") { cls = r.compilerOnly ? "COMPILER_PROVEN" : "BEHAVIORALLY_PROVEN"; if (r.compilerOnly) { required = "NO"; justification = "declaration-only name: no runtime behavior to prove, compile-time reader is the proof"; } }
      else { cls = "UNPROVEN"; justification = `mutation state ${r.mutationState}`; }
    } else if (paths.length && paths.every((p) => p !== "*" && isTestFile(p))) {
      cls = r.binding.bound ? "BINDING_ONLY" : "UNPROVEN";
      justification = r.binding.bound ? "fixture/guard in a test or verification script: proof input of the runtime boundary it exercises, not a boundary itself" : `unbound fixture (${r.binding.via})`;
      if (!r.binding.bound) required = "YES";
    } else if (e.surface === "schema" && paths.length === 1 && paths[0] === "database-schema") {
      required = "YES";
      const ok = r.binding.bound && [...schemaProof.proven].some((prefix) => String(e.item ?? "").includes(prefix));
      cls = ok ? "BEHAVIORALLY_PROVEN" : "UNPROVEN";
      justification = ok ? "database object: verified against a real migrated PostgreSQL and killed by its own schema mutation (schema-boundary-proof.json)" : `database-schema boundary without a fresh schema proof (${schemaProof.reason || r.binding.via})`;
    } else {
      // a non-test path without a mutable runtime file (SQL, JSON, YAML, wildcard, docs): binding is the only credit available
      cls = "BINDING_ONLY"; required = "YES"; justification = `non-test path without a mutation target (${paths.join(", ")}): behavioral proof is required and binding cannot supply it`;
    }
    out.push({ r, cls, required, justification });
    if (e.currentName !== "*" && runtimeFiles.length) runtimeNamed.set(e.currentName, [...(runtimeNamed.get(e.currentName) ?? []), cls]);
  }
  // class of the ledger rows by production file (a wildcard row of a file covers every legacy word of that file)
  const rowsByFile = new Map();
  for (const o of out) for (const p of pathsOf(o.r.row)) if (p !== "*" && isCode(p) && !isTestFile(p)) rowsByFile.set(p, [...(rowsByFile.get(p) ?? []), o]);
  const okClass = new Set(["BEHAVIORALLY_PROVEN", "COMPILER_PROVEN", "EXEMPT_WITH_JUSTIFICATION"]);
  const fileText = new Map();
  const text = (f) => { if (!fileText.has(f)) fileText.set(f, readFile(f) ?? ""); return fileText.get(f); };
  const wordHit = (t, n) => { let i = t.indexOf(n); while (i !== -1) { const a = t[i - 1], b = t[i + n.length]; if (!(a && /[A-Za-z0-9_]/.test(a)) && !(b && /[A-Za-z0-9_]/.test(b))) return true; i = t.indexOf(n, i + 1); } return false; };
  for (const o of out) {
    const e = o.r.row;
    o.exercises = "";
    if (o.cls !== "BINDING_ONLY" || e.currentName === "*") continue;
    if (runtimeNamed.has(e.currentName)) { o.exercises = "RUNTIME_ROW_EXISTS"; continue; }
    const where = productionFiles.filter((f) => wordHit(text(f), e.currentName));
    if (!where.length) { o.exercises = "NO_PRODUCTION_OCCURRENCE"; continue; }
    const notCovered = where.filter((f) => !(rowsByFile.get(f) ?? []).some((x) => okClass.has(x.cls) && (x.r.row.currentName === "*" || x.r.row.currentName === e.currentName)));
    // an occurrence in a file without a proven/exempt row is acceptable only when an independent adjudication classified THAT (name, file) pair as
    // human-facing text, a comment or a fragment of a covered compound slug; a technical or boundary-without-row verdict stays open, a missing verdict is open
    const verdict = (f) => adjudication.find((a) => a.name === e.currentName && a.file === f)?.class;
    const harmless = new Set(["UI_TEXT", "COMMENT_OR_DOC", "BOUNDARY_COVERED_BY_COMPOUND_ROW", "RESOLVED"]);
    const uncovered = notCovered.filter((f) => !harmless.has(verdict(f)));
    o.exercises = uncovered.length ? "UNCOVERED_PRODUCTION_OCCURRENCE" : notCovered.length ? "ADJUDICATED_HARMLESS" : "COVERED_BY_FILE_ROW";
    if (uncovered.length) o.uncoveredFiles = uncovered.map((f) => `${f}[${verdict(f) ?? "UNADJUDICATED"}]`);
  }
  return out;
}

export function summarize(out) {
  const by = (f) => out.reduce((m, o) => { const k = f(o); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const required = out.filter((o) => o.required === "YES");
  const withoutProof = required.filter((o) => o.cls !== "BEHAVIORALLY_PROVEN");
  const fixturesNoRuntime = out.filter((o) => o.exercises === "NO_PRODUCTION_OCCURRENCE");
  const uncoveredProd = out.filter((o) => o.exercises === "UNCOVERED_PRODUCTION_OCCURRENCE");
  const exemptByWhy = by((o) => (o.cls === "EXEMPT_WITH_JUSTIFICATION" ? o.r.kind : null));
  delete exemptByWhy.null;
  return {
    rows: out.length,
    byClass: by((o) => o.cls),
    REQUIRED_BEHAVIORAL_ROWS: required.length,
    COMPATIBILITY_WITHOUT_REQUIRED_PROOF: withoutProof.length + uncoveredProd.length,
    BEHAVIORALLY_PROVEN: out.filter((o) => o.cls === "BEHAVIORALLY_PROVEN").length,
    COMPILER_PROVEN: out.filter((o) => o.cls === "COMPILER_PROVEN").length,
    BINDING_ONLY: out.filter((o) => o.cls === "BINDING_ONLY").length,
    EXEMPT_WITH_JUSTIFICATION: out.filter((o) => o.cls === "EXEMPT_WITH_JUSTIFICATION").length,
    UNPROVEN: out.filter((o) => o.cls === "UNPROVEN").length,
    BINDING_ONLY_FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE: fixturesNoRuntime.length,
    BINDING_ONLY_FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE: uncoveredProd.length,
    fixtureExercises: by((o) => o.exercises || null),
    uncoveredProductionRows: uncoveredProd.slice(0, 40).map((o) => `${o.r.row.path} :: ${o.r.row.currentName} -> ${(o.uncoveredFiles ?? []).join(", ")}`),
    exemptByKind: exemptByWhy,
    withoutProofRows: withoutProof.slice(0, 50).map((o) => `${o.r.row.path} :: ${o.r.row.currentName} (${o.cls}: ${o.justification})`),
  };
}

async function compute() {
  const map = loadAuthority();
  const c = census();
  const rows = audit(map, { readFile: readRepo, unusedRows: c.unusedRows, mutation: loadMutation(), oracle: await buildOracle(map) });
  const files = execFileSync("git", ["ls-files", "apps/api/src", "apps/web/src", "packages"], { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."), encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean);
  const productionFiles = files.filter((f) => /\.(ts|tsx|js|mjs|json)$/.test(f) && !isTestFile(f) && !/(^|\/)(migrations|migration-drafts)\//.test(f));
  const adjFile = path.join(OUT_DIR, "fixture-name-adjudication.json");
  const adjudication = fs.existsSync(adjFile) ? JSON.parse(fs.readFileSync(adjFile, "utf8")).entries ?? [] : [];
  return classify(rows, { productionFiles, readFile: readRepo, adjudication });
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  const out = await compute();
  const s = summarize(out);
  if (mode === "--report") {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const tsv = ["path\tname\tsurface\tkind\tclass\trequired_behavioral\tjustification\tmutation_state\tbinding\texercises\tuncovered_production_files",
      ...out.map((o) => [o.r.row.path, o.r.row.currentName, o.r.row.surface ?? "", o.r.kind, o.cls, o.required, o.justification, o.r.mutationState, o.r.binding.via, o.exercises, (o.uncoveredFiles ?? []).join(" ")].map((x) => String(x ?? "").replace(/[\t\r\n]+/g, " ")).join("\t"))].join("\n") + "\n";
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-classification.tsv"), tsv);
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-classification.json"), JSON.stringify(s, null, 1) + "\n");
    const md = ["# Compatibility boundary behavioral classification (generated)", "",
      "Generated by `node scripts/naming/compat-boundary-classify.mjs --report`. One class per ledger row; see the script header for the definitions.", "",
      "| Class | Rows |", "|---|---:|", ...Object.entries(s.byClass).sort().map(([k, v]) => `| ${k} | ${v} |`), "",
      `- REQUIRED_BEHAVIORAL_ROWS: ${s.REQUIRED_BEHAVIORAL_ROWS}`, `- COMPATIBILITY_WITHOUT_REQUIRED_PROOF: ${s.COMPATIBILITY_WITHOUT_REQUIRED_PROOF}`,
      `- BINDING_ONLY fixture names with no production occurrence (asserted refused/gone or pure input): ${s.BINDING_ONLY_FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE}`, `- BINDING_ONLY fixture names occurring in a production file with NO proven/exempt ledger row for that file: ${s.BINDING_ONLY_FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE}`, `- fixture exercise states: ${JSON.stringify(s.fixtureExercises)}`, "",
      "BINDING_ONLY is not behavioral proof. These rows are test fixtures: the runtime boundary they exercise carries its own row and its own mutation proof.", "",
      "Exempt rows by kind: " + Object.entries(s.exemptByKind).map(([k, v]) => `${k}=${v}`).join(", "), ""].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-classification.md"), md);
  }
  console.log(`compat-boundary classification: ${s.rows} rows, ${JSON.stringify(s.byClass)}`);
  console.log(`  REQUIRED_BEHAVIORAL_ROWS=${s.REQUIRED_BEHAVIORAL_ROWS} COMPATIBILITY_WITHOUT_REQUIRED_PROOF=${s.COMPATIBILITY_WITHOUT_REQUIRED_PROOF} FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE=${s.BINDING_ONLY_FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE} FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=${s.BINDING_ONLY_FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE}`);
  if (s.COMPATIBILITY_WITHOUT_REQUIRED_PROOF) { for (const l of [...s.withoutProofRows, ...s.uncoveredProductionRows]) console.error(`  ${l}`); }
  if (mode === "--check" && s.COMPATIBILITY_WITHOUT_REQUIRED_PROOF) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`compat-boundary classification FAILED: ${err.message}`); process.exit(2); });
}
