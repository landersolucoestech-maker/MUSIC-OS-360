import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { audit, categoryOf, boundaryKind, bindingOf, counters, moduleOf, groupRows, pairEvidence } from "./compat-boundary-audit.mjs";
import { findMutations, apply, classifyRun, pairsFromLedger, routeAliases } from "./compat-mutation-proof.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const row = (o) => ({ item: "x", path: "apps/api/src/modules/a/a.service.ts", currentName: "legacyfield", surface: "identifier", exceptionClass: "TEMPORARY_MIGRATION_COMPATIBILITY", reason: "Legacy reader.", consumer: "web", owner: "o", removalCondition: "remove after release", status: "ACTIVE", coveringTest: "apps/api/src/modules/a/a.service.spec.ts", ...o });
const files = { "apps/api/src/modules/a/a.service.ts": "export const a = r.canonicalfield ?? r.legacyfield;", "apps/api/src/modules/a/a.service.spec.ts": "it('legacyfield', () => {})" };
const readFile = (p) => files[p] ?? null;

test("moduleOf / boundaryKind are deterministic", () => {
  assert.equal(moduleOf("apps/web/src/modules/leads/x.ts"), "web:leads");
  assert.equal(moduleOf("packages/types/src/a.ts"), "packages:types");
  assert.equal(boundaryKind(row({ path: "apps/api/src/modules/a/dto/a.dto.ts" })), "DEPRECATED_API_ALIAS");
  assert.equal(boundaryKind(row({ exceptionClass: "PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION" })), "LEGAL_DOMAIN_TERM");
  assert.equal(boundaryKind(row({ exceptionClass: "EXTERNAL_CONTRACT" })), "EXTERNAL_PROVIDER_FIELD");
  assert.equal(boundaryKind(row({ path: "docs/x.json", reason: "frozen historical audit data" })), "HISTORICAL_DOCUMENT_OR_DATA");
});

test("category: obsolete, historical and misclassified rows are not necessary boundaries", () => {
  const e = row();
  assert.equal(categoryOf(e, { unused: new Set([e]) }).category, "OBSOLETE_BOUNDARY");
  assert.equal(categoryOf(row({ path: "docs/a.md", reason: "frozen historical record", surface: "doc", exceptionClass: "UX_TEXT" }), { unused: new Set() }).category, "HISTORICAL_ONLY");
  assert.equal(categoryOf(row({ removalCondition: "none while X" }), { unused: new Set() }).category, "MISCLASSIFIED_OPERATIONAL_USAGE");
  assert.equal(categoryOf(row({ exceptionClass: "UX_TEXT", removalCondition: "remove after the web release is deployed" }), { unused: new Set() }).category, "MISCLASSIFIED_OPERATIONAL_USAGE");
  assert.equal(categoryOf(row(), { unused: new Set() }).category, "NECESSARY_BOUNDARY");
});

test("binding: literal, module and self bind; a missing test or an unrelated test does not", () => {
  assert.equal(bindingOf(row(), readFile).via, "LITERAL");
  assert.equal(bindingOf(row({ currentName: "*" }), readFile).via, "NO_BINDING");
  assert.equal(bindingOf(row({ coveringTest: "nope.spec.ts" }), readFile).via, "TEST_MISSING");
  assert.equal(bindingOf(row({ coveringTest: undefined }), readFile).via, "NO_TEST");
  const withImport = { ...files, "apps/api/src/modules/a/a.service.spec.ts": "import { a } from './a.service';" };
  assert.equal(bindingOf(row({ currentName: "*" }), (p) => withImport[p] ?? null).via, "MODULE");
  assert.equal(bindingOf(row({ path: "apps/api/src/modules/a/a.service.spec.ts", coveringTest: undefined }), readFile).via, "SELF");
});

test("a compatibility row is PROVEN only with a fresh mutation kill; stale or absent evidence leaves the counter open", () => {
  const map = { exceptions: [row()], concepts: [] };
  const src = files["apps/api/src/modules/a/a.service.ts"];
  const tst = files["apps/api/src/modules/a/a.service.spec.ts"];
  const rec = (over) => ({ results: [{ file: "apps/api/src/modules/a/a.service.ts", test: "apps/api/src/modules/a/a.service.spec.ts", fileSha256: sha(src), testSha256: sha(tst), verdict: "PROVEN", exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }], ...over }] });
  assert.equal(counters(audit(map, { readFile, mutation: rec({}) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 0);
  assert.equal(counters(audit(map, { readFile, mutation: { results: [] } })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1);
  assert.equal(counters(audit(map, { readFile, mutation: rec({ fileSha256: sha("changed") }) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1, "an edited runtime file makes the proof stale");
  assert.equal(counters(audit(map, { readFile, mutation: rec({ verdict: "SURVIVED", mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "SURVIVED" }] }) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1);
  const lf = counters(audit(map, { readFile, mutation: rec({ legacyFirst: [{ line: 1, text: "r.legacyfield ?? r.canonicalfield" }] }) }));
  assert.equal(lf.LEGACY_FIRST_READS, 1, "a legacy-first read is reported");
  assert.ok(groupRows(audit(map, { readFile, mutation: rec({}) })).length === 1);
});

test("mutation operators: canonical-first swap, legacy-first detection, alias guard, literal rename", () => {
  const names = new Set(["legacyfield"]);
  const m = findMutations("const a = r.canonicalfield ?? r.legacyfield;", "a.ts", names);
  assert.equal(m.swap.length, 1);
  assert.equal(apply("const a = r.canonicalfield ?? r.legacyfield;", m.swap[0]), "const a = (r.legacyfield) ?? (r.canonicalfield);");
  const lf = findMutations("const a = r.legacyfield ?? r.canonicalfield;", "a.ts", names);
  assert.equal(lf.swap.length, 0);
  assert.equal(lf.legacyFirst.length, 1, "legacy preferred over canonical is flagged");
  const g = findMutations("if (out['canonicalfield'] === undefined) out['canonicalfield'] = out['legacyfield'];", "a.ts", names);
  assert.equal(g.guard.length, 1);
  assert.ok(apply("if (out['canonicalfield'] === undefined) out['canonicalfield'] = out['legacyfield'];", g.guard[0]).startsWith("if (true)"));
  const l = findMutations("const m = { 'legacyfield': 'canonicalfield' };", "a.ts", names);
  assert.ok(l.lit.length >= 1);
  assert.ok(apply("const m = { 'legacyfield': 'canonicalfield' };", l.lit[0]).includes("__mutated__"));
  assert.equal(findMutations("import x from 'legacyfield';", "a.ts", names).lit.length, 0, "import specifiers are never mutated");
});

test("classifyRun: only a failed assertion is a kill; compile or resolution errors are inconclusive", () => {
  assert.equal(classifyRun(0, "Tests: 3 passed"), "pass");
  assert.equal(classifyRun(1, "expect(received).toBe(expected)\nTests:       1 failed, 2 passed"), "assertion-failure");
  assert.equal(classifyRun(1, "Test suite failed to run\nerror TS2304"), "inconclusive");
  assert.equal(classifyRun(1, "AssertionError: expected 1 to be 2\n Tests  2 failed | 5 passed"), "assertion-failure");
  assert.equal(classifyRun(1, "Error: Cannot find module"), "inconclusive");
});

test("pairsFromLedger: only proof-class rows with a covering test on a runtime file", () => {
  const map = { exceptions: [row(), row({ path: "apps/api/src/x.spec.ts" }), row({ exceptionClass: "UX_TEXT" }), row({ coveringTest: undefined }), row({ path: "*" })] };
  const pairs = pairsFromLedger(map);
  assert.equal(pairs.length, 1);
  assert.deepEqual([...pairs[0].names], ["legacyfield"]);
});

test("harness and audit share one definition of test file and proof classes (no drift)", async () => {
  const h = await import("./compat-mutation-proof.mjs");
  const a = await import("./compat-boundary-audit.mjs");
  assert.deepEqual([...h.PROOF_CLASSES].sort(), [...a.PROOF_CLASSES].sort());
  for (const p of ["x/tests/y.ts", "a/b.regression.mjs", "apps/api/src/a.spec.ts", "apps/api/src/modules/a/a.service.ts", "apps/api/scripts/verify-x.ts"]) assert.equal(h.isTestFile(p), a.isTestFile(p), p);
});

test("classifyRun: crashes before any test ran, empty or timed out output and zero-fail summaries are never kills", () => {
  assert.equal(classifyRun(1, "Test Suites: 1 failed, 1 total\nTests:       0 total"), "inconclusive");
  assert.equal(classifyRun(1, ""), "inconclusive", "timeout or spawn error leaves no output");
  assert.equal(classifyRun(1, "# tests 1\n# pass 1\n# fail 0"), "inconclusive");
  assert.equal(classifyRun(1, "Error [ERR_MODULE_NOT_FOUND]: x\n# fail 1"), "inconclusive");
  assert.equal(classifyRun(1, "\u001b[31mTransform failed\u001b[0m\nExpected: 1\n Tests  1 failed"), "assertion-failure", "a real failed-test count wins over a transform warning");
  assert.equal(classifyRun(1, "Received: 2\nTests:       1 skipped, 1 failed, 2 passed"), "assertion-failure");
  assert.equal(classifyRun(0, "Tests: 1 failed"), "pass", "exit status 0 is a pass whatever the text says");
});

test("a proof is bound to BOTH sources and to the declared pair: a changed test, a missing test hash or another test's proof do not count", () => {
  const map = { exceptions: [row()], concepts: [] };
  const F = "apps/api/src/modules/a/a.service.ts";
  const T = "apps/api/src/modules/a/a.service.spec.ts";
  const base = { file: F, test: T, fileSha256: sha(files[F]), testSha256: sha(files[T]), verdict: "PROVEN", exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }] };
  const open = (r) => counters(audit(map, { readFile, mutation: { results: [r] } })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF;
  assert.equal(open(base), 0);
  assert.equal(open({ ...base, testSha256: sha("edited test") }), 1, "an edited covering test makes the proof stale");
  assert.equal(open({ ...base, testSha256: null }), 1);
  assert.equal(open({ ...base, test: "apps/api/src/modules/a/other.spec.ts" }), 1, "a proof by a test the row does not declare is ignored");
  for (const verdict of ["BASELINE_RED", "NO_MUTATION_SITE", "TEST_MISSING"]) assert.equal(open({ ...base, verdict }), 1, verdict);
});

test("a failed count without any assertion marker (a load-time TypeError, a timeout) is inconclusive, never a kill", () => {
  assert.equal(classifyRun(1, "TypeError: x is not a function\nTests:       3 failed, 0 passed"), "inconclusive");
});

test("per-name proof: a name whose own mutation survived is never proven by another name's kill; a PARTIAL pair proves only the killed names", () => {
  const F = "apps/api/src/modules/a/a.service.ts";
  const T = "apps/api/src/modules/a/a.service.spec.ts";
  const mk = (verdict, mutations) => ({ results: [{ file: F, test: T, fileSha256: sha(files[F]), testSha256: sha(files[T]), verdict, exhaustive: true, mutations }] });
  const ledger = { exceptions: [row({ currentName: "legacyTitle" }), row({ currentName: "otherName" })], concepts: [] };
  const partial = mk("PARTIAL", [{ operator: "LEGACY_LITERAL", label: "legacyTitle", outcome: "KILLED" }, { operator: "LEGACY_LITERAL", label: "otherName", outcome: "SURVIVED" }]);
  const rows = audit({ ...ledger, exceptions: ledger.exceptions.map((e) => ({ ...e, coveringTest: T })) }, { readFile: (p) => (p === T ? "legacyTitle otherName" : readFile(p)), mutation: { results: [{ ...partial.results[0], testSha256: sha("legacyTitle otherName") }] } });
  const byName = Object.fromEntries(rows.map((r) => [r.row.currentName, r.proof]));
  assert.equal(byName["legacyTitle"], "PROVEN");
  assert.notEqual(byName["otherName"], "PROVEN", "the survivor is not proven by its sibling's kill");
});

test("route names: the controller-relative form of a ledger route is mutated and labelled with the ledger name", () => {
  const names = new Set(["/artists/stats/generos"]);
  assert.deepEqual([...routeAliases(names).entries()], [["stats/generos", "/artists/stats/generos"]]);
  const src = "@Controller('artists') class C { @Get(['stats/genres', 'stats/generos']) list() {} }";
  const muts = findMutations(src, "apps/api/src/modules/artists/artists.controller.ts", names);
  assert.equal(muts.lit.length, 1);
  assert.equal(muts.lit[0].label, "/artists/stats/generos");
});

test("naming-gate exemption tables are their own kind and need no behavioral proof", () => {
  const e = row({ path: "scripts/naming/technical-naming-census.mjs", currentName: "EXTERNAL_TOOL_NAMES", exceptionClass: "PROVIDER_DEFINED", item: "exemption table", reason: "third-party names" });
  assert.equal(boundaryKind(e), "NAMING_TOOLING");
  const rows = audit({ exceptions: [e], concepts: [] }, { readFile: () => null });
  assert.equal(rows[0].needsProof, false);
});

test("declaration-only names are COMPILER_CHECKED by the harness and proven by the audit only for the declared name", () => {
  const src = "export interface Share { percentual?: number | null; other?: string }";
  const muts = findMutations(src, "apps/web/src/modules/releases/types/index.ts", new Set(["percentual"]));
  assert.equal(muts.lit.length + muts.swap.length + muts.guard.length, 0);
  assert.deepEqual(muts.declarations.map((d) => d.label), ["percentual"]);
  const F = "apps/web/src/modules/releases/types/index.ts";
  const T = "apps/web/src/modules/releases/lib/legacy-reads.test.ts";
  const text = { [F]: src, [T]: "it('x', () => {})" };
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const rec = { file: F, test: T, fileSha256: sha(text[F]), testSha256: sha(text[T]), verdict: "COMPILER_CHECKED", mutations: [], declarations: ["percentual"] };
  const ev = pairEvidence(new Map([[`${F}\u0000${T}`, rec]]), F, T, (p) => text[p] ?? null, "percentual");
  assert.equal(ev.proven, true);
  assert.equal(pairEvidence(new Map([[`${F}\u0000${T}`, rec]]), F, T, (p) => text[p] ?? null, "never_declared").proven, false);
});

test("a name that was never mutated gets no credit from its siblings (r14 finding): only own-name kills (literal, swap or guard sites) and exhaustive wildcards count", () => {
  const F = "apps/web/src/modules/contracts/lib/contract-wizard-party.ts";
  const T = "apps/web/src/modules/contracts/lib/contract-wizard-party.test.ts";
  const text = { [F]: "x", [T]: "y" };
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const base = { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "killed_name", outcome: "KILLED" }] };
  const results = (rec) => new Map([[`${F}\u0000${T}`, rec]]);
  const read = (p) => text[p] ?? null;
  const proven = (rec, name) => pairEvidence(results(rec), F, T, read, name).proven;
  assert.equal(proven(base, "killed_name"), true);
  assert.equal(proven(base, "never_mutated"), false, "sibling kills prove nothing for an unmutated name");
  assert.equal(proven({ ...base, exhaustive: true, namesWithoutSite: ["swap_only"] }, "swap_only"), false, "an exhaustive pair no longer credits a name that has no mutation of its own (r14 G1)");
  const swapKill = { operator: "CANONICAL_FIRST", label: "swap_only", labels: ["swap_only"], outcome: "KILLED" };
  assert.equal(proven({ ...base, mutations: [...base.mutations, swapKill] }, "swap_only"), true, "a labelled canonical-first kill credits the name it reads");
  assert.equal(proven({ ...base, mutations: [...base.mutations, { ...swapKill, outcome: "SURVIVED" }], verdict: "CANONICAL_FIRST_UNENFORCED" }, "swap_only"), false);
  assert.equal(proven({ ...base, mutations: [...base.mutations, { ...swapKill, outcome: "SURVIVED" }], verdict: "CANONICAL_FIRST_UNENFORCED" }, "killed_name"), true, "a surviving swap blocks only the name it reads");
  const sites = [{ operator: "LEGACY_LITERAL", label: "multi", outcome: "KILLED" }, { operator: "LEGACY_LITERAL", label: "multi", outcome: "SURVIVED" }];
  assert.equal(proven({ ...base, mutations: sites, verdict: "PARTIAL" }, "multi"), false, "a survivor at any site of a name blocks it (r14 G2)");
  assert.equal(proven({ ...base, mutations: [...sites.slice(0, 1), { operator: "LEGACY_LITERAL", label: "multi", outcome: "INCONCLUSIVE" }] }, "multi"), true, "an inconclusive site neither credits nor blocks");
  assert.equal(proven(base, "*"), false, "a non-exhaustive record never credits a wildcard row (r14 G3)");
  assert.equal(proven({ ...base, exhaustive: true, inconclusive: 0 }, "*"), true);
  assert.equal(proven({ ...base, exhaustive: true, inconclusive: 2 }, "*"), false, "inconclusive mutations leave a wildcard row unproven");
  assert.equal(proven({ ...base, exhaustive: true, inconclusive: 0, verdict: "PARTIAL" }, "*"), false);
});

test("producer and consumer agree: records built from the REAL findMutations output feed pairEvidence per name (r14 G7)", () => {
  const F = "apps/api/src/modules/a/a.service.ts";
  const T = "apps/api/src/modules/a/a.service.spec.ts";
  const src = [
    "export const A = { legacyone: 1, other: 2 };",
    "export function read(r) { return r.canonicaltwo ?? r.legacytwo; }",
    "export const B = 'legacythree';",
  ].join("\n");
  const names = new Set(["legacyone", "legacytwo", "legacythree"]);
  const muts = findMutations(src, F, names);
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const files = { [F]: src, [T]: "spec" };
  const read = (p) => files[p] ?? null;
  const build = (survives) => ({
    file: F, test: T, fileSha256: sha(src), testSha256: sha("spec"), verdict: "PARTIAL", exhaustive: true, inconclusive: 0,
    mutations: [...muts.swap, ...muts.guard, ...muts.lit].map((m) => ({ operator: m.operator, line: m.line, label: m.label, labels: m.labels, outcome: survives.includes(m.label) ? "SURVIVED" : "KILLED" })),
  });
  const ev = (rec, name) => pairEvidence(new Map([[`${F}\u0000${T}`, rec]]), F, T, read, name).proven;
  const allKilled = build([]);
  for (const n of names) assert.equal(ev(allKilled, n), true, `${n} is proven by its own labelled kill (literal, key or canonical-first swap)`);
  const swapSurvives = build(["legacytwo"]);
  assert.equal(ev(swapSurvives, "legacytwo"), false, "the surviving swap blocks the name it reads");
  assert.equal(ev(swapSurvives, "legacyone"), true, "and only that name");
  assert.equal(ev(swapSurvives, "legacythree"), true);
  assert.equal(ev({ ...allKilled, exhaustive: undefined }, "legacyone"), false, "a record that is not exhaustive credits no named row");
});
