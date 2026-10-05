import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runnerConfigSha, runnerConfigFiles, audit, categoryOf, boundaryKind, bindingOf, counters, moduleOf, groupRows, pairEvidence } from "./compat-boundary-audit.mjs";
import { findMutations, apply, classifyRun, pairsFromLedger, routeAliases, pairVerdict, needsOperatorRerun, blankSqlComments, OPERATORS_VERSION } from "./compat-mutation-proof.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const row = (o) => ({ item: "x", path: "apps/api/src/modules/a/a.service.ts", currentName: "legacyfield", surface: "identifier", exceptionClass: "TEMPORARY_MIGRATION_COMPATIBILITY", reason: "Legacy reader.", consumer: "web", owner: "o", removalCondition: "remove after release", status: "ACTIVE", coveringTest: "apps/api/src/modules/a/a.service.spec.ts", ...o });
const files = { "apps/api/src/modules/a/a.service.ts": "export const a = r.canonicalfield ?? r.legacyfield;", "apps/api/src/modules/a/a.service.spec.ts": "it('legacyfield', () => {})" };
const readFile = (p) => files[p] ?? null;
// a clean census (nothing unmutated) for the synthetic records; `names` lists every legacy name used by these tests
const CENSUS = (extra = {}) => ({ version: 1, siteCount: 0, names: ["legacyfield", "killed_name", "swap_only", "multi", "legacyTitle", "otherName", "survived_name", "guard_name", "plain", "x"], wildcard: true, unmutatedPtSites: [], unmutatedNameSites: [], ...extra });

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
  const rec = (over) => ({ results: [{ file: "apps/api/src/modules/a/a.service.ts", test: "apps/api/src/modules/a/a.service.spec.ts", fileSha256: sha(src), testSha256: sha(tst), verdict: "PROVEN", census: CENSUS(), exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }], ...over }] });
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
  const base = { file: F, test: T, fileSha256: sha(files[F]), testSha256: sha(files[T]), verdict: "PROVEN", census: CENSUS(), exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }] };
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
  const mk = (verdict, mutations) => ({ results: [{ file: F, test: T, fileSha256: sha(files[F]), testSha256: sha(files[T]), verdict, census: CENSUS(), exhaustive: true, mutations }] });
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
  const rec = { file: F, test: T, fileSha256: sha(text[F]), testSha256: sha(text[T]), verdict: "COMPILER_CHECKED", census: CENSUS(), mutations: [], declarations: ["percentual"] };
  const ev = pairEvidence(new Map([[`${F}\u0000${T}`, rec]]), F, T, (p) => text[p] ?? null, "percentual");
  assert.equal(ev.proven, true);
  assert.equal(pairEvidence(new Map([[`${F}\u0000${T}`, rec]]), F, T, (p) => text[p] ?? null, "never_declared").proven, false);
});

test("a name that was never mutated gets no credit from its siblings (r14 finding): only own-name kills (literal, swap or guard sites) and exhaustive wildcards count", () => {
  const F = "apps/web/src/modules/contracts/lib/contract-wizard-party.ts";
  const T = "apps/web/src/modules/contracts/lib/contract-wizard-party.test.ts";
  const text = { [F]: "x", [T]: "y" };
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  const base = { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "PROVEN", census: CENSUS(), census: CENSUS(), exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "killed_name", outcome: "KILLED" }] };
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
    file: F, test: T, fileSha256: sha(src), testSha256: sha("spec"), verdict: "PARTIAL", census: muts.census, exhaustive: true, inconclusive: 0,
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

test("proof fallback: an enum member named by a ledger row is mutated only when the name has no ordinary site", () => {
  const src = "export enum Role { ARTISTA = 'artista', OTHER = 'other' }";
  const m = findMutations(src, "a.ts", new Set(["ARTISTA"]));
  const em = m.lit.filter((x) => x.operator === "ENUM_MEMBER");
  assert.equal(em.length, 1);
  assert.equal(em[0].label, "ARTISTA");
  assert.ok(apply(src, em[0]).includes("__mutated__ = 'artista'"));
  // the member name also exists as a literal elsewhere: the ordinary LEGACY_LITERAL site wins and no fallback is generated
  const both = findMutations("export enum Role { ARTISTA = 'x' }\nconst a = 'ARTISTA';", "a.ts", new Set(["ARTISTA"]));
  assert.equal(both.lit.filter((x) => x.operator === "ENUM_MEMBER").length, 0);
});

test("proof fallback: a legacy namespace prefix is mutated for a name without ordinary site, and the plain name is never touched", () => {
  const src = "const a = 'legacyns:read'; const b = `legacyns:${k}`; const c = 'legacynsx:read'; type T = 'legacyns' | 'canonical';";
  const m = findMutations(src, "a.ts", new Set(["legacyns"]));
  const prefixMutations = m.lit.filter((x) => x.operator === "PREFIX_LITERAL");
  assert.equal(prefixMutations.length, 2);
  assert.ok(apply(src, prefixMutations[0]).includes("'__mutated__:read'"));
  assert.ok(apply(src, prefixMutations[1]).includes("`__mutated__:${k}`"));
});

test("proof basis: a mutation-killed runtime row and a binding-only test-fixture row are counted apart", () => {
  const src = files["apps/api/src/modules/a/a.service.ts"];
  const tst = files["apps/api/src/modules/a/a.service.spec.ts"];
  const results = [{ file: "apps/api/src/modules/a/a.service.ts", test: "apps/api/src/modules/a/a.service.spec.ts", fileSha256: sha(src), testSha256: sha(tst), verdict: "PROVEN", census: CENSUS(), exhaustive: true, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }] }];
  const fixture = row({ path: "apps/api/src/modules/a/a.service.spec.ts", coveringTest: undefined, reason: "Test fixture asserting the legacy value is still mapped." });
  const c = counters(audit({ exceptions: [row(), fixture], concepts: [] }, { readFile, mutation: { results } }));
  assert.equal(c.COMPATIBILITY_ROWS_PROVEN_BY_MUTATION, 1);
  assert.equal(c.COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY, 1);
  assert.equal(c.COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 0);
});

// ---- census (r14 BLOCKER: a wildcard credit must cover EVERY Portuguese site of the file, not only the ones the predicate happened to see) ----
import { makeWildcardPredicate, buildCensus } from "./compat-mutation-proof.mjs";
import { ptWords } from "./pt-lexicon.mjs";

test("wildcard predicate: route paths, accented labels and short words are sites; sentences, URLs and unknown words are not", () => {
  const wc = makeWildcardPredicate(ptWords);
  for (const s of ["/rh", "/auditoria", "/configuracoes/billing", "/contratos-v2/*", "/registro-musicas", "Estágio", "pj", "não_informado", "cessao_direitos"]) assert.equal(wc(s), true, s);
  for (const s of ["Campos conflitantes.", "https://x.com/a", "a/b", "2024-01", "application/json"]) assert.equal(wc(s), false, s);
  // a string with spaces is a NAME only in name position (key, element access, case label, equality operand, array element)
  assert.equal(wc("licença médica"), false);
  assert.equal(wc("licença médica", true), true);
});

test("harness: every `from` of a legacy route table becomes a mutation site and the census of that file is empty", () => {
  const src = 'export const R = [ { from: "/rh", to: "/hr" }, { from: "/auditoria", to: "/audit" }, { from: "/contratos-v2/*", to: "/contracts/*" } ];';
  const wc = makeWildcardPredicate(ptWords);
  const m = findMutations(src, "r.tsx", new Set(), wc, { ptWords });
  assert.deepEqual(m.lit.map((x) => x.label).sort(), ["/auditoria", "/contratos-v2/*", "/rh"]);
  assert.equal(m.census.unmutatedPtSites.length, 0);
});

test("census: unmutated Portuguese sites (template parts, sentences) and skipped syntactic forms of a named legacy field are reported", () => {
  const wc = makeWildcardPredicate(ptWords);
  const src = 'const msg = `Campos conflitantes: ${x}`; const e = new Error("Registro inválido."); const { obra } = dto; const o = { obra };';
  const m = findMutations(src, "a.ts", new Set(["obra"]), wc, { ptWords });
  const texts = m.census.unmutatedPtSites.map((x) => x.text);
  assert.ok(texts.some((t) => t.startsWith("Campos conflitantes")), "template part is reported");
  assert.ok(texts.includes("Registro inválido."), "a sentence is reported (never a site)");
  assert.deepEqual(m.census.unmutatedNameSites.map((x) => x.kind).sort(), ["binding", "shorthand"]);
});

test("audit: a credit needs a coherent, empty census; exemptions need a reason and must stay in use", () => {
  const F = "apps/web/src/app/routes/r.tsx";
  const T = "apps/web/src/app/routes/r.test.tsx";
  const files = { [F]: "x", [T]: "y" };
  const read = (p) => files[p] ?? null;
  const rec = (census) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations: [{ operator: "LEGACY_LITERAL", label: "a", outcome: "KILLED" }], census }]]);
  const clean = { version: 1, names: ["a"], wildcard: true, siteCount: 1, unmutatedPtSites: [], unmutatedNameSites: [] };
  const dirty = { ...clean, unmutatedPtSites: [{ line: 3, kind: "string", text: "/auditoria" }] };
  assert.equal(pairEvidence(rec(clean), F, T, read, "*").proven, true);
  assert.equal(pairEvidence(rec(undefined), F, T, read, "*").state, "CENSUS_MISSING");
  assert.equal(pairEvidence(rec({ ...clean, wildcard: false }), F, T, read, "*").state, "CENSUS_STALE", "a census built for named rows does not close a wildcard row");
  assert.equal(pairEvidence(rec({ ...clean, names: ["b"] }), F, T, read, "a").state, "CENSUS_STALE", "a name added to the ledger after the census is not covered");
  const d = pairEvidence(rec(dirty), F, T, read, "*");
  assert.equal(d.proven, false);
  assert.equal(d.state, "UNMUTATED_SITES");
  assert.equal(pairEvidence(rec(dirty), F, T, read, "*", [{ text: "/auditoria", reason: "x" }]).proven, false, "an exemption without a real reason does not count");
  const ok = pairEvidence(rec(dirty), F, T, read, "*", [{ text: "/auditoria", reason: "UX route label that is not a legacy name" }]);
  assert.equal(ok.proven, true);
  assert.deepEqual(ok.matched, ["/auditoria"]);
  assert.equal(pairEvidence(rec({ ...clean, siteCount: 5 }), F, T, read, "*").state, "SITES_NOT_MUTATED", "the record mutated fewer sites than the harness now sees (r14: 6 of 51 in legacy-redirects)");
  assert.equal(pairEvidence(rec({ ...clean, siteCount: undefined }), F, T, read, "*").state, "SITES_NOT_MUTATED");
  const named = { ...clean, wildcard: false, unmutatedNameSites: [{ name: "a", line: 1, kind: "shorthand", text: "a" }] };
  assert.equal(pairEvidence(rec(named), F, T, read, "a").state, "UNMUTATED_SITES");
});

test("audit: an exemption that matches no census site any more makes its row STALE_EXEMPTION", () => {
  const F = "apps/web/src/app/routes/r.tsx";
  const T = "apps/web/src/app/routes/r.test.tsx";
  const files = { [F]: "x", [T]: "y" };
  const readFile2 = (p) => files[p] ?? null;
  const census = { version: 1, names: [], wildcard: true, siteCount: 1, unmutatedPtSites: [{ line: 1, kind: "string", text: "msg" }], unmutatedNameSites: [] };
  const results = [{ file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations: [{ operator: "LEGACY_LITERAL", label: "a", outcome: "KILLED" }], census }];
  const mk = (proofExemptions) => ({ ...row({ path: F, currentName: "*", coveringTest: T, reason: "Legacy route redirects.", proofExemptions }) });
  const exr = [{ text: "msg", reason: "UX message, not a legacy name" }, { text: "gone", reason: "removed from the code long ago" }];
  assert.equal(audit({ exceptions: [mk(exr)], concepts: [] }, { readFile: readFile2, mutation: { results } })[0].mutationState, "STALE_EXEMPTION");
  assert.equal(audit({ exceptions: [mk([exr[0]])], concepts: [] }, { readFile: readFile2, mutation: { results } })[0].mutationState, "PROVEN");
});

test("census: a template part whose legacy namespace is already mutated (PREFIX_LITERAL) is not reported as unmutated", () => {
  const m = findMutations("const b = `legacyns:${k}`;", "a.ts", new Set(["legacyns"]));
  assert.equal(m.lit.filter((x) => x.operator === "PREFIX_LITERAL").length, 1);
  assert.deepEqual(m.census.unmutatedNameSites, []);
  const other = findMutations("const b = `see legacyns docs ${k}`; const c = 'legacyns';", "a.ts", new Set(["legacyns"]));
  assert.deepEqual(other.census.unmutatedNameSites.map((x) => x.kind), ["template-part"], "a template part with the name as a word and no mutation of it is reported");
});

test("hash binding covers the test-runner configuration: a changed jest/vitest config or setup file makes the proof stale", () => {
  const F = "apps/web/src/m/a.ts";
  const T = "apps/web/src/m/a.test.ts";
  const cfg = { "apps/web/vitest.config.mjs": "export default {}", "apps/web/src/test/setup.ts": "import 'x'" };
  const files = { [F]: "x", [T]: "y", ...cfg };
  const read = (p) => files[p] ?? null;
  assert.deepEqual(runnerConfigFiles(T), ["apps/web/vitest.config.mjs", "apps/web/src/test/setup.ts"]);
  const rec = (configSha256) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), configSha256, verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations: [{ operator: "LEGACY_LITERAL", label: "a", outcome: "KILLED" }], census: { version: 1, names: ["a"], wildcard: false, siteCount: 1, unmutatedPtSites: [], unmutatedNameSites: [] } }]]);
  const good = runnerConfigSha(T, read);
  assert.ok(good);
  assert.equal(pairEvidence(rec(good), F, T, read, "a").fresh, true);
  assert.equal(pairEvidence(rec(good), F, T, (p) => (p === "apps/web/src/test/setup.ts" ? "import 'y'" : read(p)), "a").fresh, false, "an edited setup file stales the proof");
  assert.equal(pairEvidence(rec(undefined), F, T, read, "a").fresh, false, "a record with no config binding is not fresh");
});

// ---- the audit recomputes sites and census from the CURRENT source text; the stored JSON is never trusted alone (r14 re-review F5) ----
test("oracle: a record consistent with the code is credited; a forged census, missing or invented mutations and a stale name list are refused", () => {
  const F = "apps/api/src/m/a.ts";
  const T = "apps/api/src/m/a.spec.ts";
  const src = "export const a = (r) => r.canonicalfield ?? r.legacyfield;";
  const files = { [F]: src, [T]: "y" };
  const read = (p) => files[p] ?? null;
  const m = findMutations(src, F, new Set(["legacyfield"]));
  const expected = { sites: [...m.swap, ...m.guard, ...m.lit].map((x) => `${x.operator}:${x.line}:${x.label}`).sort(), census: m.census };
  const mutations = [...m.swap, ...m.guard, ...m.lit].map((x) => ({ operator: x.operator, line: x.line, label: x.label, labels: x.labels, outcome: "KILLED" }));
  const rec = (over = {}) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha(src), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations, census: m.census, ...over }]]);
  const ev = (r, e = expected, nm = "legacyfield") => pairEvidence(r, F, T, read, nm, [], e);
  assert.equal(ev(rec()).proven, true);
  assert.equal(ev(rec({ census: { ...m.census, unmutatedNameSites: [] , siteCount: 99 } })).state, "CENSUS_FORGED", "a stored census that differs from the recomputed one");
  assert.equal(ev(rec({ mutations: mutations.slice(1) })).state, "SITES_NOT_MUTATED", "fewer mutations than sites");
  assert.equal(ev(rec({ mutations: [...mutations, { operator: "LEGACY_LITERAL", line: 9, label: "ghost", outcome: "KILLED" }] })).state, "CENSUS_FORGED", "a mutation of a site that does not exist");
  assert.equal(ev(rec({ census: { ...m.census, names: ["other"] } })).state, "CENSUS_STALE");
  assert.equal(ev(rec(), { ...expected, census: { ...m.census, unmutatedNameSites: [{ name: "legacyfield", line: 1, kind: "shorthand", text: "legacyfield" }] } }).state, "CENSUS_FORGED", "the code now has an unmutated form the stored census does not list");
});

test("audit: a multi-file row is credited only when EVERY runtime file is proven", () => {
  const A = "apps/api/src/m/a.ts";
  const B = "apps/api/src/m/b.ts";
  const T = "apps/api/src/m/m.spec.ts";
  const text = { [A]: "export const a = r.legacyfield;", [B]: "export const b = r.legacyfield;", [T]: "it('legacyfield', () => {})" };
  const read = (p) => text[p] ?? null;
  const mk = (f) => { const m = findMutations(text[f], f, new Set(["legacyfield"])); return { file: f, test: T, fileSha256: sha(text[f]), testSha256: sha(text[T]), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations: m.lit.map((x) => ({ operator: x.operator, line: x.line, label: x.label, outcome: "KILLED" })), census: m.census }; };
  const map = { exceptions: [row({ path: `${A},${B}`, coveringTest: T })], concepts: [] };
  const both = counters(audit(map, { readFile: read, mutation: { results: [mk(A), mk(B)] } })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF;
  const onlyA = counters(audit(map, { readFile: read, mutation: { results: [mk(A)] } })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF;
  assert.equal(both, 0);
  assert.equal(onlyA, 1, "one proven file does not credit a row that names two runtime files");
});

test("per-name credit also follows the `labels` of a swap or guard mutation", () => {
  const F = "apps/api/src/m/a.ts";
  const T = "apps/api/src/m/a.spec.ts";
  const read = (p) => ({ [F]: "x", [T]: "y" })[p] ?? null;
  const rec = (outcome) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: outcome === "KILLED" ? "PROVEN" : "CANONICAL_FIRST_UNENFORCED", exhaustive: true, mutations: [{ operator: "CANONICAL_FIRST", line: 1, label: "other", labels: ["swapname"], outcome }], census: { version: 1, names: ["swapname"], wildcard: false, siteCount: 1, unmutatedPtSites: [], unmutatedNameSites: [] } }]]);
  assert.equal(pairEvidence(rec("KILLED"), F, T, read, "swapname").proven, true, "credited through labels, not through the label");
  assert.equal(pairEvidence(rec("SURVIVED"), F, T, read, "swapname").proven, false);
});

test("binding: an opt-in verification script counts only when a package script wires it", () => {
  const S = "apps/api/scripts/verify-legacy-x.ts";
  const e = { ...row({ path: S, coveringTest: S }) };
  const withoutWire = bindingOf(e, (p) => (p === S ? "legacyfield" : p === "package.json" ? "{}" : null));
  assert.deepEqual([withoutWire.bound, withoutWire.via], [false, "SCRIPT_NOT_WIRED"]);
  const wired = bindingOf(e, (p) => (p === S ? "legacyfield" : p === "apps/api/package.json" ? '{"scripts":{"v":"ts-node scripts/verify-legacy-x.ts"}}' : null));
  assert.deepEqual([wired.bound, wired.via], [true, "SELF_SCRIPT"]);
});

// ---- the harness's own operators and census (r14 re-review F6) ----
test("name position: a string with spaces is a site as a key, element access, case label, equality operand or array element, and not as a call argument or plain value", () => {
  const wc = makeWildcardPredicate(ptWords);
  const sitesOf = (src) => findMutations(src, "a.ts", new Set(), wc, { ptWords }).lit.map((x) => x.label);
  assert.deepEqual(sitesOf('const o = { "licença médica": 1 };'), ["licença médica"]);
  assert.deepEqual(sitesOf('const v = o["licença médica"];'), ["licença médica"]);
  assert.deepEqual(sitesOf('switch (k) { case "licença médica": break; }'), ["licença médica"]);
  assert.deepEqual(sitesOf('const b = k === "licença médica";'), ["licença médica"]);
  assert.deepEqual(sitesOf('const b = k !== "licença médica";'), ["licença médica"]);
  assert.deepEqual(sitesOf('const l = ["licença médica", "x"];'), ["licença médica"]);
  assert.deepEqual(sitesOf('f("licença médica"); const m = "licença médica";'), [], "a call argument and a plain value are sentences, not names");
});

test("operators: `||` canonical-first swaps and the three quote styles of a namespaced prefix are mutated", () => {
  const sw = findMutations("const a = r.canonicalfield || r.legacyfield;", "a.ts", new Set(["legacyfield"]));
  assert.equal(sw.swap.length, 1);
  assert.ok(apply("const a = r.canonicalfield || r.legacyfield;", sw.swap[0]).includes("(r.legacyfield) || (r.canonicalfield)"));
  const src = `const a = 'legacyns:x'; const b = "legacyns:y"; const c = \`legacyns:z\`;`;
  const prefixSites = findMutations(src, "a.ts", new Set(["legacyns"])).lit.filter((x) => x.operator === "PREFIX_LITERAL");
  assert.equal(prefixSites.length, 3);
});

test("census: keys and members the predicate rejects, JSX attributes, methods, siteCount and import/export/type strings", () => {
  const rejectAll = () => false;
  const ptSites = (src, file = "a.ts") => findMutations(src, file, new Set(), rejectAll, { ptWords }).census.unmutatedPtSites.map((x) => `${x.kind}:${x.text}`);
  assert.deepEqual(ptSites("const o = { contrato: 1 }; const v = o.contrato;"), ["key:contrato", "member:contrato"]);
  const named = findMutations('const m = <Foo obra="x" />; class C { obra() {} }', "a.tsx", new Set(["obra"]));
  assert.deepEqual(named.census.unmutatedNameSites.map((x) => x.kind).sort(), ["jsx-attribute", "method"]);
  const m = findMutations("const a = r.canonicalfield ?? r.legacyfield; const b = 'legacyfield';", "a.ts", new Set(["legacyfield"]));
  assert.equal(m.census.siteCount, m.swap.length + m.guard.length + m.lit.length);
  assert.ok(m.census.siteCount >= 2);
  const wc = makeWildcardPredicate(ptWords);
  const clean = findMutations('import x from "contratos"; export * from "contratos"; type T = "contratos";', "a.ts", new Set(), wc, { ptWords });
  assert.deepEqual(clean.census.unmutatedPtSites, [], "module specifiers and literal types are not sites");
});

test("exemption: a text equal to a legacy NAME of the ledger is refused, and compiler-checked rows are counted apart from mutation", () => {
  const F = "apps/api/src/m/a.ts";
  const T = "apps/api/src/m/a.spec.ts";
  const files = { [F]: "x", [T]: "y" };
  const read = (p) => files[p] ?? null;
  const census = { version: 1, names: ["legacyfield"], wildcard: false, siteCount: 1, unmutatedPtSites: [], unmutatedNameSites: [{ name: "legacyfield", line: 1, kind: "shorthand", text: "legacyfield" }] };
  const rec = new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations: [{ operator: "LEGACY_LITERAL", label: "legacyfield", outcome: "KILLED" }], census }]]);
  const ev = pairEvidence(rec, F, T, read, "legacyfield", [{ text: "legacyfield", reason: "a long enough reason text" }]);
  assert.equal(ev.proven, false, "an exemption whose text is the legacy name itself does not cover its unmutated site");
  assert.equal(ev.state, "UNMUTATED_SITES");
  const compiler = { file: F, test: T, fileSha256: sha("x"), testSha256: sha("y"), verdict: "COMPILER_CHECKED", declarations: ["legacyfield"], mutations: [] };
  const c = counters(audit({ exceptions: [row({ path: F, coveringTest: T })], concepts: [] }, { readFile: (p) => (p === T ? "legacyfield" : read(p)), mutation: { results: [{ ...compiler, testSha256: sha("legacyfield") }] } }));
  assert.equal(c.COMPATIBILITY_ROWS_PROVEN_BY_COMPILER_CHECK, 1);
  assert.equal(c.COMPATIBILITY_ROWS_PROVEN_BY_MUTATION, 0);
});

// ---- SQL_WORD: legacy names that live only inside SQL text ----
const SQL_F = "apps/api/src/modules/a/a.field.ts";
const sqlSites = (src, names = ["faixas"]) => findMutations(src, SQL_F, new Set(names)).lit.filter((m) => m.operator === "SQL_WORD");

test("SQL_WORD: a legacy name inside a SQL statement is a site per whole-word occurrence, mutated alone with a same-length neutral token", () => {
  const src = "const q = `SELECT COALESCE(\"metadata\"->'tracks', \"metadata\"->'faixas') AS t FROM \"releases\" WHERE x = 1`;\nconst u = `UPDATE \"releases\" SET \"metadata\" = \"metadata\" - 'faixas' WHERE \"id\" = $1`;";
  const sites = sqlSites(src);
  assert.deepEqual(sites.map((m) => [m.line, m.label]), [[1, "faixas"], [2, "faixas"]], "one mutant per occurrence, with its own line");
  for (const m of sites) {
    assert.equal(m.end - m.start, "faixas".length);
    assert.equal(m.replacement.length, "faixas".length, "same length");
    assert.notEqual(m.replacement, "faixas");
    const out = apply(src, m);
    assert.equal(out.length, src.length);
    assert.equal(out.split("faixas").length - 1, 1, "exactly one occurrence is replaced, the other survives untouched");
    assert.ok(out.includes(m.replacement));
  }
  const hrSites = sqlSites("const q = `UPDATE \"permissions\" SET \"resource\" = 'hr' WHERE \"resource\" = 'rh' OR \"key\" LIKE 'rh:%'`;", ["rh"]);
  assert.equal(hrSites.length, 3 - 1, "quoted value 'rh' and the namespace 'rh:%' are sites (the `hr` value is not)");
  assert.ok(hrSites.every((m) => !/_/.test(m.replacement)), "no `_` in the token (a LIKE wildcard would keep the mutant matching)");
});

test("SQL_WORD: the neutral token is never another ledger name", () => {
  const src = "const q = `SELECT 1 FROM t WHERE a = 'xx'`;";
  const [m] = sqlSites(src.replace("'xx'", "'aa'"), ["aa", "xx"]);
  assert.ok(m && m.replacement !== "xx" && m.replacement !== "aa" && m.replacement.length === 2);
});

test("SQL_WORD: a word inside a longer identifier, a SQL comment or a non-SQL string is not a site", () => {
  assert.equal(sqlSites("const q = `SELECT \"id\" FROM \"faixas_extra\" WHERE a = 1`;").length, 0, "embedded in a longer identifier (suffix)");
  assert.equal(sqlSites("const q = `SELECT \"id\" FROM \"xfaixas\" WHERE a = 1`;").length, 0, "embedded in a longer identifier (prefix)");
  assert.equal(sqlSites("const q = `SELECT \"id\" -- legacy faixas key\n FROM \"t\"`;").length, 0, "line comment");
  assert.equal(sqlSites("const q = `SELECT /* faixas */ \"id\" FROM \"t\"`;").length, 0, "block comment");
  assert.equal(sqlSites("const msg = 'the faixas key is legacy';\nconst k = `faixas`;").length, 0, "a string that is not SQL is untouched");
  assert.equal(blankSqlComments("a -- b\nc /* d\ne */ f").length, "a -- b\nc /* d\ne */ f".length, "blanking preserves offsets");
  assert.equal(sqlSites("const q = `SELECT \"id\" -- c\n FROM \"t\" WHERE \"k\" = 'faixas'`;").length, 1, "a word after a comment line is still a site");
});

test("SQL_WORD: template parts around placeholders are scanned and the census does not report them as unmutated template parts", () => {
  const src = "const q = `SELECT 1 FROM t WHERE lower(x) NOT IN ('despesa', 'receita') AND y = ${v} AND z = 'despesa'`;";
  const r = findMutations(src, SQL_F, new Set(["despesa", "receita"]));
  const sites = r.lit.filter((m) => m.operator === "SQL_WORD");
  assert.deepEqual(sites.map((m) => m.label).sort(), ["despesa", "despesa", "receita"]);
  assert.equal(r.census.siteCount, 3, "census siteCount counts SQL sites (SITES_NOT_MUTATED stays honest)");
  assert.deepEqual(r.census.unmutatedNameSites, [], "template parts holding a mutated SQL word are accounted for");
  for (const m of sites) assert.equal(apply(src, m).length, src.length);
});

test("SQL_WORD: a name with an ordinary site AND SQL sites needs every site killed; a SQL survivor is SURVIVED and blocks the credit", () => {
  const F = "apps/api/src/m/a.ts";
  const T = "apps/api/src/m/a.spec.ts";
  const src = "export const k = 'legacyname';\nexport const q = `SELECT 1 FROM t WHERE a = 'legacyname'`;";
  const files = { [F]: src, [T]: "y" };
  const read = (p) => files[p] ?? null;
  const m = findMutations(src, F, new Set(["legacyname"]));
  assert.deepEqual(m.lit.map((x) => x.operator).sort(), ["LEGACY_LITERAL", "SQL_WORD"]);
  const mk = (outcomes) => m.lit.map((x, i) => ({ operator: x.operator, line: x.line, label: x.label, outcome: outcomes[x.operator] }));
  const expected = { sites: m.lit.map((x) => `${x.operator}:${x.line}:${x.label}`).sort(), census: m.census, sqlWordSites: 1, operatorsVersion: OPERATORS_VERSION };
  const rec = (mutations, over = {}) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha(src), testSha256: sha("y"), operatorsVersion: OPERATORS_VERSION, verdict: pairVerdict(mutations), exhaustive: true, inconclusive: 0, mutations, census: m.census, ...over }]]);
  const ev = (r) => pairEvidence(r, F, T, read, "legacyname", [], expected);
  const allKilled = ev(rec(mk({ LEGACY_LITERAL: "KILLED", SQL_WORD: "KILLED" })));
  assert.equal(allKilled.proven, true);
  const sqlSurvives = ev(rec(mk({ LEGACY_LITERAL: "KILLED", SQL_WORD: "SURVIVED" })));
  assert.equal(sqlSurvives.proven, false, "the ordinary kill does not cover the SQL site");
  assert.equal(sqlSurvives.state, "SURVIVED");
  assert.equal(sqlSurvives.verdict, "PARTIAL");
  const onlySqlSurvives = ev(rec(mk({ LEGACY_LITERAL: "SURVIVED", SQL_WORD: "SURVIVED" })));
  assert.equal(onlySqlSurvives.verdict, "SURVIVED");
  const sqlNotRun = ev(rec(mk({ LEGACY_LITERAL: "KILLED", SQL_WORD: "KILLED" }).filter((x) => x.operator !== "SQL_WORD")));
  assert.equal(sqlNotRun.proven, false, "a present-but-not-mutated SQL site is never credit");
  assert.equal(sqlNotRun.state, "SITES_NOT_MUTATED");
  const inconclusive = ev(rec(mk({ LEGACY_LITERAL: "KILLED", SQL_WORD: "INCONCLUSIVE" })));
  assert.equal(inconclusive.state === "PROVEN", true, "INCONCLUSIVE neither credits nor blocks (unchanged rule); the kill of the other site credits");
});

test("pairVerdict: SQL_WORD is a name operator (SURVIVED/PARTIAL), the other operators keep their strong verdict", () => {
  const o = (operator, outcome) => ({ operator, outcome });
  assert.equal(pairVerdict([o("SQL_WORD", "SURVIVED")]), "SURVIVED");
  assert.equal(pairVerdict([o("SQL_WORD", "SURVIVED"), o("LEGACY_LITERAL", "KILLED")]), "PARTIAL");
  assert.equal(pairVerdict([o("SQL_WORD", "KILLED")]), "PROVEN");
  assert.equal(pairVerdict([o("CANONICAL_FIRST", "SURVIVED"), o("SQL_WORD", "KILLED")]), "CANONICAL_FIRST_UNENFORCED");
  assert.equal(pairVerdict([]), "NO_MUTATION_SITE");
  assert.equal(pairVerdict([], 1), "COMPILER_CHECKED");
});

test("operators version: a record without the SQL_WORD operator is re-judged for a file that now has SQL sites, and not credited by the audit", () => {
  const F = "apps/api/src/m/a.ts";
  const T = "apps/api/src/m/a.spec.ts";
  const withSql = "export const q = `SELECT 1 FROM t WHERE a = 'legacyname'`;";
  const noSql = "export const k = 'legacyname';";
  const found = (src) => findMutations(src, F, new Set(["legacyname"]));
  assert.equal(needsOperatorRerun({ verdict: "PROVEN" }, found(withSql)), true, "no operatorsVersion = produced before SQL_WORD");
  assert.equal(needsOperatorRerun({ operatorsVersion: 1 }, found(withSql)), true);
  assert.equal(needsOperatorRerun({ operatorsVersion: OPERATORS_VERSION }, found(withSql)), false);
  assert.equal(needsOperatorRerun({ verdict: "PROVEN" }, found(noSql)), false, "files without SQL sites keep their records (resume intact)");
  // audit side: even a record whose mutations were hand-completed is stale without the version
  const files = { [F]: withSql, [T]: "y" };
  const m = found(withSql);
  const mutations = m.lit.map((x) => ({ operator: x.operator, line: x.line, label: x.label, outcome: "KILLED" }));
  const expected = { sites: m.lit.map((x) => `${x.operator}:${x.line}:${x.label}`).sort(), census: m.census, sqlWordSites: 1, operatorsVersion: OPERATORS_VERSION };
  const mk = (over) => new Map([[`${F}\u0000${T}`, { file: F, test: T, fileSha256: sha(withSql), testSha256: sha("y"), verdict: "PROVEN", exhaustive: true, inconclusive: 0, mutations, census: m.census, ...over }]]);
  assert.equal(pairEvidence(mk({}), F, T, (p) => files[p] ?? null, "legacyname", [], expected).fresh, false);
  assert.equal(pairEvidence(mk({ operatorsVersion: OPERATORS_VERSION }), F, T, (p) => files[p] ?? null, "legacyname", [], expected).fresh, true);
});
