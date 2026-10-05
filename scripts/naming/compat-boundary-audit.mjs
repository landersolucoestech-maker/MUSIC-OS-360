#!/usr/bin/env node
/**
 * scripts/naming/compat-boundary-audit.mjs: semantic audit of every ledger exception row
 * (the census's LEGITIMATE_COMPATIBILITY_BOUNDARY occurrences).
 *
 *   node scripts/naming/compat-boundary-audit.mjs --check     gate: exit 1 on any open counter
 *   node scripts/naming/compat-boundary-audit.mjs --report    write docs/naming/audit/compat-boundary-*.{md,tsv,json}
 *
 * Every row is classified (NECESSARY_BOUNDARY | OBSOLETE_BOUNDARY | MISCLASSIFIED_OPERATIONAL_USAGE | HISTORICAL_ONLY),
 * grouped into a semantic group (module, boundary kind, covering test, removal condition) and, when it is a
 * compatibility boundary, held to a BEHAVIORAL PROOF:
 *   1. binding: a covering test exists and names the legacy literal or exercises the row's module;
 *   2. mutation: a mutation of the row's runtime file is KILLED by that test (compat-mutation-proof.mjs), the result
 *      being bound to the sha256 of the current runtime file and test, so a later edit makes the proof stale.
 * Counters (all must be 0): UNBOUND (no covering test / no binding), UNMUTATED (runtime pair without a fresh kill),
 * OBSOLETE (row that matches no occurrence), MISCLASSIFIED, LEGACY_FIRST (a runtime read that prefers the legacy value).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadAuthority } from "./canonical-map.mjs";
import { census } from "./technical-naming-census.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
export const OUT_DIR = path.join(ROOT, "docs/naming/audit");
export const MUTATION_FILE = path.join(OUT_DIR, "compat-mutation-proof.json");

export const PROOF_CLASSES = new Set(["TEMPORARY_MIGRATION_COMPATIBILITY", "LEGACY_DATABASE_COMPATIBILITY", "PUBLIC_API_COMPATIBILITY", "EXTERNAL_CONTRACT", "PROVIDER_DEFINED"]);
/** Opt-in executable checks of the API (they insert legacy-shape rows into a disposable database or smoke a running API): test code, not runtime. */
export const isVerificationScript = (f) => /^apps\/api\/scripts\/(verify|smoke|reports-smoke)[-.\w]*\.ts$/.test(f);
export const isTestFile = (f) => /[.-](test|spec|e2e-spec|regression)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(e2e|__tests__|__fixtures__|fixtures|tests)\//.test(f) || isVerificationScript(f);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const pathsOf = (e) => String(e.path).split(/\s*,\s*/);
const testsOf = (e) => (e.coveringTest ? String(e.coveringTest).split(/\s*,\s*/) : []);

/** Module (semantic owner area) of a repository path. */
export function moduleOf(p) {
  let m;
  if ((m = /^apps\/(api|web)\/src\/modules\/([^/]+)/.exec(p))) return `${m[1]}:${m[2]}`;
  if ((m = /^apps\/(api|web)\/src\/([^/]+)\/([^/]+)/.exec(p))) return `${m[1]}:${m[2]}`;
  if ((m = /^apps\/(api|web)\/([^/]+)/.exec(p))) return `${m[1]}:${m[2]}`;
  if ((m = /^packages\/([^/]+)/.exec(p))) return `packages:${m[1]}`;
  if (p.startsWith(".claude/")) return "pack:.claude";
  if (p === "*") return "any";
  return p.split("/")[0];
}

/** What kind of boundary the row documents. Rule based and deterministic. */
export function boundaryKind(e) {
  const paths = pathsOf(e);
  const allTests = paths.every((p) => p !== "*" && isTestFile(p));
  const text = `${e.item} ${e.reason}`;
  if (paths.every((p) => /^(docs|reports)\//.test(p))) return /historical|frozen/i.test(text) ? "HISTORICAL_DOCUMENT_OR_DATA" : "LIVING_REGISTRY";
  if (paths.every((p) => p.startsWith(".claude/"))) return "PACK_TOOLING";
  // exemption tables of the naming gates themselves: governed by technical-naming-census.test.mjs, which pins each table to exactly one ledger row
  if (paths.every((p) => p.startsWith("scripts/naming/"))) return "NAMING_TOOLING";
  if (e.exceptionClass === "EXTERNAL_CONTRACT" || e.exceptionClass === "PROVIDER_DEFINED") return "EXTERNAL_PROVIDER_FIELD";
  if (e.exceptionClass === "UX_TEXT") return "USER_FACING_TEXT";
  if (e.exceptionClass === "PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION") return "LEGAL_DOMAIN_TERM";
  if (e.exceptionClass === "LEGACY_DATABASE_COMPATIBILITY") return allTests && /immutable|squash|baseline|removed column|migration guard/i.test(`${e.removalCondition} ${text}`) ? "MIGRATION_HISTORY_GUARD" : "PERSISTED_LEGACY_STRUCTURE";
  if (allTests) return /negative|never sent|never read|prove[s]? .*(gone|removed|never)|guard/i.test(text) ? "NEGATIVE_GUARD_TEST" : "LEGACY_ALIAS_TEST_FIXTURE";
  if (paths.some((p) => /\/dto\//.test(p)) || /deprecated .*(request|input|DTO|alias)|pre-rename|released before|deploy skew/i.test(text)) return "DEPRECATED_API_ALIAS";
  if (/persisted|stored|rows|jsonb|varchar|backfill|saved|metadata/i.test(text)) return "PERSISTED_VALUE_READER";
  return "LEGACY_NAME_READER";
}

const KIND_PRODUCER = {
  DEPRECATED_API_ALIAS: "web builds released before the rename (deploy skew window)",
  PERSISTED_VALUE_READER: "rows and documents persisted before the rename (data)",
  PERSISTED_LEGACY_STRUCTURE: "live database objects awaiting an approved destructive migration",
  EXTERNAL_PROVIDER_FIELD: "external provider (wire format outside this repository)",
  LEGACY_NAME_READER: "callers or stored payloads still using the deprecated spelling",
  LEGACY_ALIAS_TEST_FIXTURE: "test fixture (simulates the legacy producer)",
  NEGATIVE_GUARD_TEST: "test fixture (asserts the legacy name is refused or gone)",
  MIGRATION_HISTORY_GUARD: "migration history (published migrations are immutable)",
  LEGAL_DOMAIN_TERM: "Brazilian legal/fiscal vocabulary (permanent)",
  USER_FACING_TEXT: "end-user language (permanent)",
  HISTORICAL_DOCUMENT_OR_DATA: "frozen point-in-time record",
  LIVING_REGISTRY: "the naming registry itself",
  PACK_TOOLING: "engineering pack tooling",
  NAMING_TOOLING: "exemption table of the naming gates (pinned by technical-naming-census.test.mjs)",
};

/**
 * Category of a row. `unused` is the set of rows that match no occurrence (OBSOLETE_BOUNDARY).
 * MISCLASSIFIED rules are explicit and each names the contradiction it found.
 */
export function categoryOf(e, { unused }) {
  const kind = boundaryKind(e);
  if (unused.has(e)) return { category: "OBSOLETE_BOUNDARY", kind, why: "the row matches no occurrence in the tree" };
  if (kind === "HISTORICAL_DOCUMENT_OR_DATA" || kind === "MIGRATION_HISTORY_GUARD" || e.census === "baselined") return { category: "HISTORICAL_ONLY", kind };
  const paths = pathsOf(e);
  const allTests = paths.every((p) => p !== "*" && isTestFile(p));
  const noneTests = paths.every((p) => p === "*" || !isTestFile(p));
  if (e.exceptionClass === "TEMPORARY_MIGRATION_COMPATIBILITY" && /^none\b/i.test(e.removalCondition ?? "")) return { category: "MISCLASSIFIED_OPERATIONAL_USAGE", kind, why: "temporary class without a removal condition (permanent usage filed as compatibility)" };
  if (["PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION", "UX_TEXT"].includes(e.exceptionClass) && kind !== "LIVING_REGISTRY" && kind !== "HISTORICAL_DOCUMENT_OR_DATA" && /^(remove|delete) (after|once|when) .*(migration|backfill|release|deploy)/i.test(e.removalCondition ?? "")) return { category: "MISCLASSIFIED_OPERATIONAL_USAGE", kind, why: "permanent class whose removal condition is a migration or release (it is a temporary compatibility)" };
  if (noneTests && /^(test|tests|characterization|parity|guard and|negative test|legacy-alias test|[a-z0-9-]+ (wire )?test)\b/i.test(e.reason ?? "") && e.exceptionClass !== "UX_TEXT") return { category: "MISCLASSIFIED_OPERATIONAL_USAGE", kind, why: "the reason describes a test but the row names a runtime file" };
  if (allTests && /\b(reader|mapper|accepted at the API boundary)\b/i.test(e.reason ?? "") && !/test|fixture|assert|prove|characteriz|guard|simulat/i.test(e.reason ?? "")) return { category: "MISCLASSIFIED_OPERATIONAL_USAGE", kind, why: "the reason describes a runtime reader but the row names a test file" };
  return { category: "NECESSARY_BOUNDARY", kind };
}

/** Binding of a row to its covering tests. `readFile` returns the text or null. */
export function bindingOf(e, readFile) {
  const paths = pathsOf(e);
  const declared = testsOf(e);
  const selfTests = paths.filter((p) => p !== "*" && isTestFile(p));
  const tests = declared.length ? declared : selfTests;
  if (!tests.length) return { tests, bound: false, via: "NO_TEST" };
  const bodies = tests.map((t) => readFile(t));
  if (bodies.some((b) => b == null)) return { tests, bound: false, via: "TEST_MISSING" };
  const body = bodies.join("\n");
  if (tests.some((t) => paths.includes(t))) {
    // an opt-in verification script is the check itself, but only counts when a package script wires it
    const scripts = paths.filter(isVerificationScript);
    if (scripts.length) {
      const wired = scripts.every((s) => ["package.json", "apps/api/package.json"].some((manifestPath) => (readFile(manifestPath) ?? "").includes(path.basename(s))));
      return { tests, bound: wired, via: wired ? "SELF_SCRIPT" : "SCRIPT_NOT_WIRED" };
    }
    return { tests, bound: true, via: "SELF" };
  }
  if (e.currentName !== "*" && body.includes(e.currentName)) return { tests, bound: true, via: "LITERAL" };
  const module = paths.some((p) => {
    if (p === "*") return false;
    const base = p.split("/").pop().replace(/\.[cm]?[jt]sx?$/, "").replace(/\.(d)$/, "");
    const rel = p.replace(/^apps\/(api|web)\/src\//, "").replace(/\.[cm]?[jt]sx?$/, "");
    return body.includes(base) || body.includes(rel);
  });
  return module ? { tests, bound: true, via: "MODULE" } : { tests, bound: false, via: "NO_BINDING" };
}

/**
 * The test-runner configuration a proof depends on besides the runtime file and its test: a change to it can turn a killed mutation into a survivor
 * (or the reverse) without touching either source file. Null when the test is not under a known app.
 */
export function runnerConfigFiles(test) {
  if (test.startsWith("apps/api/")) return ["apps/api/jest.config.ts", "apps/api/tsconfig.json"];
  if (test.startsWith("apps/web/")) return ["apps/web/vitest.config.mjs", "apps/web/src/test/setup.ts"];
  return [];
}
export function runnerConfigSha(test, readFile) {
  const files = runnerConfigFiles(test);
  if (!files.length) return null;
  const parts = files.map((f) => { const t = readFile(f); return t == null ? null : `${f}\u0000${t}`; });
  return parts.some((x) => x == null) ? null : sha256(parts.join("\u0001"));
}

/** Mutation evidence of a (runtime file, test) pair, fresh only for the current sources. */
export function pairEvidence(results, file, test, readFile, name = "*", exemptions = [], expected = null) {
  const rec = results.get(`${file}\u0000${test}`);
  if (!rec) return { verdict: "NOT_RUN", fresh: false };
  const f = readFile(file);
  const t = readFile(test);
  const fresh = f != null && t != null && sha256(f) === rec.fileSha256 && sha256(t) === rec.testSha256 && (rec.configSha256 ?? null) === runnerConfigSha(test, readFile);
  // a mutation belongs to a name through its label (literal rename) or its labels (canonical-first swap / alias guard that reads the name)
  const own = name === "*" ? null : (rec.mutations ?? []).filter((m) => m.label === name || (m.labels ?? []).includes(name));
  const ownKilled = own ? own.some((m) => m.outcome === "KILLED") : false;
  const ownSurvived = own ? own.some((m) => m.outcome === "SURVIVED") : false;
  // A named row is credited by ITS OWN mutations only: every site of the name was mutated, at least one kill, no survivor at any site
  // (INCONCLUSIVE sites, such as a mutation that crashes the module at load time, neither credit nor block). A name that was never mutated
  // gets no credit from its siblings, from a swap/guard it does not read, or from the verdict of the pair.
  // COMPILER_CHECKED: the name only appears in declarations (type, interface, property signature, function): a rename breaks the typecheck, there is no runtime value to mutate
  const declared = rec.verdict === "COMPILER_CHECKED" && name !== "*" && (rec.declarations ?? []).includes(name);
  // a pair whose baseline is red, whose test file is missing, or that has no mutation site credits no row (a surviving canonical-first swap blocks only the name it reads)
  const usable = !["BASELINE_RED", "TEST_MISSING", "NO_MUTATION_SITE"].includes(rec.verdict);
  // wildcard rows (every legacy word of the file): only an exhaustive pair with every word killed and nothing inconclusive credits them
  const wildcardOk = rec.exhaustive === true && rec.verdict === "PROVEN" && (rec.inconclusive ?? 1) === 0;
  const baseProven = declared || (usable && (name === "*" ? wildcardOk : rec.exhaustive === true && ownKilled && !ownSurvived));
  // CENSUS (computed by the harness from the same source text): a credit needs every site it could not mutate to be accounted for.
  // A wildcard row is a whole-file claim, so every Portuguese string/key/member/template part of the file must be a mutated site or carry a ledger exemption
  // with a reason; a named row must have no occurrence in a form the operators skip (shorthand, binding element, JSX attribute, method, template part).
  // `expected` is what the harness would compute NOW from the current source text (sites and census): the stored JSON is never trusted on its own
  const census = expected ? expected.census : rec.census;
  // an exemption is for interface prose, never for a legacy NAME: a text equal to any ledger name of the pair is refused
  const ledgerNames = new Set([...(census?.names ?? []), ...(rec.census?.names ?? []), name]);
  const valid = (exemptions ?? []).filter((x) => x && typeof x.text === "string" && String(x.reason ?? "").trim().length >= 12 && !ledgerNames.has(x.text));
  let censusState = null;
  let matched = [];
  if (!declared && baseProven) {
    if (!rec.census) censusState = "CENSUS_MISSING";
    else if (expected && JSON.stringify(rec.census.names) !== JSON.stringify(expected.census.names)) censusState = "CENSUS_STALE"; // a ledger name added after the run
    else if (expected && JSON.stringify(rec.census) !== JSON.stringify(expected.census)) censusState = "CENSUS_FORGED"; // the stored census is not what the code yields
    else if (expected && JSON.stringify((rec.mutations ?? []).map((m) => `${m.operator}:${m.line}:${m.label}`).sort()) !== JSON.stringify(expected.sites)) {
      const have = new Set((rec.mutations ?? []).map((m) => `${m.operator}:${m.line}:${m.label}`));
      censusState = expected.sites.some((x) => !have.has(x)) ? "SITES_NOT_MUTATED" : "CENSUS_FORGED"; // fewer mutations than sites, or mutations of sites that do not exist
    }
    else if (name === "*" ? census.wildcard !== true : !(census.names ?? []).includes(name)) censusState = "CENSUS_STALE";
    else if (!Number.isInteger(census.siteCount) || (rec.mutations?.length ?? 0) < census.siteCount) censusState = "SITES_NOT_MUTATED"; // the harness sees more sites than the record mutated (e.g. a predicate widened after the run)
    else {
      const sites = name === "*" ? census.unmutatedPtSites ?? [] : (census.unmutatedNameSites ?? []).filter((x) => x.name === name);
      matched = [...new Set(sites.filter((x) => valid.some((v) => v.text === x.text)).map((x) => x.text))];
      if (sites.some((x) => !valid.some((v) => v.text === x.text))) censusState = "UNMUTATED_SITES";
    }
  }
  const proven = baseProven && !censusState;
  // the state of THIS name (never the verdict of the pair, which describes other names too)
  const state = proven ? "PROVEN" : censusState ? censusState : ownSurvived ? "SURVIVED" : ["NO_MUTATION_SITE", "CANONICAL_FIRST_UNENFORCED", "BASELINE_RED", "TEST_MISSING", "COMPILER_CHECKED"].includes(rec.verdict) ? rec.verdict : "NOT_MUTATED";
  return { verdict: rec.verdict, state, fresh, legacyFirst: rec.legacyFirst ?? [], proven, matched, granularity: name === "*" ? "WILDCARD" : declared ? "COMPILER_CHECKED" : own.length > 0 ? "EXACT_NAME" : "UNMUTATED" };
}

/** Pure audit over a ledger. */
export function audit(map, { readFile, unusedRows = [], mutation = { results: [] }, oracle = null }) {
  const unused = new Set(unusedRows);
  const results = new Map((mutation.results ?? []).map((r) => [`${r.file}\u0000${r.test}`, r]));
  const rows = [];
  const concept = new Map();
  for (const c of map.concepts ?? []) for (const a of c.legacyAliases ?? []) if (!concept.has(a)) concept.set(a, c);
  for (const e of map.exceptions ?? []) {
    if (e.status === "REMOVED") continue;
    const cat = categoryOf(e, { unused });
    const needsProof = PROOF_CLASSES.has(e.exceptionClass) && cat.category === "NECESSARY_BOUNDARY" && cat.kind !== "PACK_TOOLING" && cat.kind !== "NAMING_TOOLING";
    const bind = bindingOf(e, readFile);
    const runtimeFiles = pathsOf(e).filter((p) => p !== "*" && !isTestFile(p) && /\.[cm]?[jt]sx?$/.test(p) && !p.startsWith(".claude/"));
    let mutationState = "N/A";
    let compilerOnly = false;
    let legacyFirst = [];
    if (needsProof && runtimeFiles.length) {
      const states = [];
      const matchedAll = new Set();
      compilerOnly = true;
      for (const f of runtimeFiles) {
        const ev = bind.tests.map((t) => pairEvidence(results, f, t, readFile, e.currentName, e.proofExemptions, oracle ? oracle(f, t, readFile) : null));
        for (const x of ev) for (const m of x.matched ?? []) matchedAll.add(m);
        if (!ev.some((x) => x.proven && x.granularity === "COMPILER_CHECKED")) compilerOnly = false;
        for (const x of ev) legacyFirst.push(...(x.legacyFirst ?? []).map((l) => ({ file: f, ...l })));
        states.push(ev.some((x) => x.fresh && x.proven) ? "PROVEN" : ev.some((x) => !x.fresh && x.verdict !== "NOT_RUN") ? "STALE" : ev.find((x) => x.verdict !== "NOT_RUN")?.state ?? "NOT_RUN");
      }
      mutationState = states.every((s) => s === "PROVEN") ? "PROVEN" : states.find((s) => s !== "PROVEN");
      // an exemption that matches no census site any more is stale (the code changed): it must be removed, never kept as a blanket allowance
      const staleEx = (e.proofExemptions ?? []).filter((x) => !matchedAll.has(x?.text));
      if (mutationState === "PROVEN" && staleEx.length) mutationState = "STALE_EXEMPTION";
    }
    const proof = !needsProof ? "NOT_REQUIRED" : !bind.bound ? bind.via : mutationState === "N/A" || mutationState === "PROVEN" ? "PROVEN" : mutationState;
    const names = e.currentName === "*" ? [] : [e.currentName];
    const c = names.map((n) => concept.get(n)).find(Boolean);
    rows.push({ row: e, ...cat, binding: bind, mutationState, proof, needsProof, compilerOnly: compilerOnly && mutationState === "PROVEN", canonical: c ? `${c.id} ${c.application ?? c.api ?? c.database}` : "", legacyFirst });
  }
  return rows;
}

export function groupRows(rows) {
  const groups = new Map();
  for (const r of rows) {
    const e = r.row;
    const mods = [...new Set(pathsOf(e).map(moduleOf))].sort().join("+");
    const key = [r.category, r.kind, mods, testsOf(e).join("+") || "-", String(e.removalCondition ?? "").slice(0, 80)].join("\u0001");
    const g = groups.get(key) ?? { category: r.category, kind: r.kind, module: mods, tests: testsOf(e), removal: e.removalCondition ?? "", reason: e.reason ?? "", consumer: e.consumer ?? "", owner: e.owner ?? "", rows: [], names: new Set(), concepts: new Set(), proofs: {} };
    g.rows.push(r);
    if (e.currentName !== "*") g.names.add(e.currentName);
    if (r.canonical) g.concepts.add(r.canonical);
    g.proofs[r.proof] = (g.proofs[r.proof] ?? 0) + 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.category + a.kind + a.module).localeCompare(b.category + b.kind + b.module));
}

export function counters(rows) {
  const c = { rows: rows.length, byCategory: {}, byKind: {}, byProof: {} };
  for (const r of rows) {
    c.byCategory[r.category] = (c.byCategory[r.category] ?? 0) + 1;
    c.byKind[r.kind] = (c.byKind[r.kind] ?? 0) + 1;
    c.byProof[r.proof] = (c.byProof[r.proof] ?? 0) + 1;
  }
  const proofRows = rows.filter((r) => r.needsProof);
  c.COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF = proofRows.filter((r) => r.proof !== "PROVEN").length;
  c.COMPATIBILITY_BOUNDARIES_REQUIRING_PROOF = proofRows.length;
  // rows whose path is only a test file (a legacy literal used as a fixture) or a script: credited by binding (the file exists and names the literal), never by mutation
  c.COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY = proofRows.filter((r) => r.proof === "PROVEN" && r.mutationState === "N/A").length;
  c.COMPATIBILITY_ROWS_PROVEN_BY_COMPILER_CHECK = proofRows.filter((r) => r.proof === "PROVEN" && r.mutationState === "PROVEN" && r.compilerOnly).length;
  c.COMPATIBILITY_ROWS_PROVEN_BY_MUTATION = proofRows.filter((r) => r.proof === "PROVEN" && r.mutationState === "PROVEN" && !r.compilerOnly).length;
  c.OBSOLETE_BOUNDARIES = rows.filter((r) => r.category === "OBSOLETE_BOUNDARY").length;
  c.MISCLASSIFIED_OPERATIONAL_USAGE = rows.filter((r) => r.category === "MISCLASSIFIED_OPERATIONAL_USAGE").length;
  c.LEGACY_FIRST_READS = rows.reduce((n, r) => n + r.legacyFirst.length, 0);
  return c;
}

export function loadMutation() {
  return fs.existsSync(MUTATION_FILE) ? JSON.parse(fs.readFileSync(MUTATION_FILE, "utf8")) : { results: [] };
}
export const readRepo = (p) => { const f = path.join(ROOT, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, "utf8") : null; };

const tsvCell = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Recomputes, from the current source text, the mutation sites and the census of a pair exactly as the harness does (dynamic import: the harness imports this module). */
export async function buildOracle(map) {
  const proof = await import("./compat-mutation-proof.mjs");
  const { ptWords } = await import("./pt-lexicon.mjs");
  const wildcard = proof.makeWildcardPredicate(ptWords);
  const pairs = new Map(proof.pairsFromLedger(map).map((p) => [`${p.file}\u0000${p.test}`, p]));
  const cache = new Map();
  return (file, test, readFile) => {
    const key = `${file}\u0000${test}`;
    if (cache.has(key)) return cache.get(key);
    const pair = pairs.get(key);
    const text = readFile(file);
    let out = null;
    if (pair && text != null) {
      const m = proof.findMutations(text, file, pair.names, pair.wildcard ? wildcard : null, { ptWords });
      out = { sites: [...m.swap, ...m.guard, ...m.lit].map((x) => `${x.operator}:${x.line}:${x.label}`).sort(), census: m.census };
    }
    cache.set(key, out);
    return out;
  };
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  const map = loadAuthority();
  const c = census();
  const rows = audit(map, { readFile: readRepo, unusedRows: c.unusedRows, mutation: loadMutation(), oracle: await buildOracle(map) });
  const cnt = counters(rows);
  const groups = groupRows(rows);
  const open = ["COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF", "OBSOLETE_BOUNDARIES", "MISCLASSIFIED_OPERATIONAL_USAGE", "LEGACY_FIRST_READS"];
  if (mode === "--report") {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const rowTsv = ["path\tname\tsurface\tclass\tcategory\tkind\tproof\tmutation\tbinding\tcovering_test\tremoval_condition",
      ...rows.map((r) => [r.row.path, r.row.currentName, r.row.surface ?? "", r.row.exceptionClass, r.category, r.kind, r.proof, r.mutationState, r.binding.via, testsOf(r.row).join(" "), r.row.removalCondition].map(tsvCell).join("\t"))].join("\n") + "\n";
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-rows.tsv"), rowTsv);
    const grpTsv = ["category\tkind\tmodule\tconcept_canonical\tlegacy_aliases\trows\tproducer\tconsumer\treason\tremoval_condition\tcovering_tests\tproof",
      ...groups.map((g) => [g.category, g.kind, g.module, [...g.concepts].slice(0, 4).join("; ") || "(value/shape mapped by the reader; see reason)", [...g.names].slice(0, 8).join(",") + (g.names.size > 8 ? ` (+${g.names.size - 8})` : "") || "(whole file)", g.rows.length, KIND_PRODUCER[g.kind] ?? "", g.consumer, g.reason, g.removal, g.tests.join(" "), Object.entries(g.proofs).map(([k, v]) => `${k}:${v}`).join(" ")].map(tsvCell).join("\t"))].join("\n") + "\n";
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-groups.tsv"), grpTsv);
    const md = [
      "# Compatibility boundary audit (generated)",
      "",
      "Generated by `node scripts/naming/compat-boundary-audit.mjs --report`. Every ledger exception row is classified, grouped by meaning (module, boundary kind, covering test, removal condition) and, when it is a compatibility boundary, proven by behavior: a covering test that names the legacy literal or exercises the module (binding) and a mutation of the runtime file that the test kills (`compat-mutation-proof.json`, bound to the sha256 of the sources).",
      "",
      `Rows: ${cnt.rows}. Semantic groups: ${groups.length}.`,
      "",
      "## Counters",
      "",
      "| Counter | Value |", "|---|---:|",
      ...open.map((k) => `| ${k} | ${cnt[k]} |`),
      `| COMPATIBILITY_BOUNDARIES_REQUIRING_PROOF | ${cnt.COMPATIBILITY_BOUNDARIES_REQUIRING_PROOF} |`,
      `| COMPATIBILITY_ROWS_PROVEN_BY_MUTATION | ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_MUTATION} |`,
      `| COMPATIBILITY_ROWS_PROVEN_BY_COMPILER_CHECK | ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_COMPILER_CHECK} |`,
      `| COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY | ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY} |`,
      "",
      "## Rows by category", "", "| Category | Rows |", "|---|---:|",
      ...Object.entries(cnt.byCategory).sort().map(([k, v]) => `| ${k} | ${v} |`),
      "",
      "## Rows by boundary kind", "", "| Kind | Rows | Producer |", "|---|---:|---|",
      ...Object.entries(cnt.byKind).sort().map(([k, v]) => `| ${k} | ${v} | ${KIND_PRODUCER[k] ?? ""} |`),
      "",
      "## Rows by proof state", "", "| Proof | Rows |", "|---|---:|",
      ...Object.entries(cnt.byProof).sort().map(([k, v]) => `| ${k} | ${v} |`),
      "",
      "Proof states: `PROVEN` (binding plus a fresh mutation kill, or binding only where the row is a test), `NOT_REQUIRED` (permanent vocabulary, user-facing text, registry, pack tooling, history), anything else is an open counter.",
      "",
      "Full per-row and per-group data: `compat-boundary-rows.tsv`, `compat-boundary-groups.tsv`.",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-audit.md"), md);
    fs.writeFileSync(path.join(OUT_DIR, "compat-boundary-audit.json"), JSON.stringify({ rows: cnt.rows, groups: groups.length, ...cnt }, null, 1) + "\n");
    console.log(md.split("\n").slice(4, 20).join("\n"));
    return;
  }
  console.log(`compat-boundary audit: ${cnt.rows} rows, ${groups.length} groups, ${JSON.stringify(Object.fromEntries(open.map((k) => [k, cnt[k]])))}`);
  console.log(`  proof basis: ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_MUTATION} rows by mutation, ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_COMPILER_CHECK} by the compiler only (declaration names, no mutation executed), ${cnt.COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY} rows by binding only (legacy literal used as a test fixture or script): binding is not behavioral proof`);
  const bad = rows.filter((r) => (r.needsProof && r.proof !== "PROVEN") || ["OBSOLETE_BOUNDARY", "MISCLASSIFIED_OPERATIONAL_USAGE"].includes(r.category) || r.legacyFirst.length);
  for (const r of bad.slice(0, 60)) console.error(`  ${r.category} ${r.proof} ${r.row.exceptionClass} ${r.row.path} :: ${r.row.currentName}${r.why ? ` (${r.why})` : ""}${r.legacyFirst.length ? ` legacy-first at ${r.legacyFirst.map((l) => `${l.file}:${l.line}`).join(",")}` : ""}`);
  if (bad.length > 60) console.error(`  ... ${bad.length - 60} more`);
  if (open.some((k) => cnt[k] > 0)) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`compat-boundary-audit FAILED: ${err.stack ?? err.message}`); process.exit(2); });
}
