import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { audit, categoryOf, boundaryKind, bindingOf, counters, moduleOf, groupRows } from "./compat-boundary-audit.mjs";
import { findMutations, apply, classifyRun, pairsFromLedger } from "./compat-mutation-proof.mjs";

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
  const rec = (over) => ({ results: [{ file: "apps/api/src/modules/a/a.service.ts", test: "apps/api/src/modules/a/a.service.spec.ts", fileSha256: sha(src), testSha256: sha(tst), verdict: "PROVEN", ...over }] });
  assert.equal(counters(audit(map, { readFile, mutation: rec({}) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 0);
  assert.equal(counters(audit(map, { readFile, mutation: { results: [] } })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1);
  assert.equal(counters(audit(map, { readFile, mutation: rec({ fileSha256: sha("changed") }) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1, "an edited runtime file makes the proof stale");
  assert.equal(counters(audit(map, { readFile, mutation: rec({ verdict: "SURVIVED" }) })).COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF, 1);
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
  assert.equal(classifyRun(1, "Tests:       1 failed, 2 passed"), "assertion-failure");
  assert.equal(classifyRun(1, "Test suite failed to run\nerror TS2304"), "inconclusive");
  assert.equal(classifyRun(1, " Tests  2 failed | 5 passed"), "assertion-failure");
  assert.equal(classifyRun(1, "Error: Cannot find module"), "inconclusive");
});

test("pairsFromLedger: only proof-class rows with a covering test on a runtime file", () => {
  const map = { exceptions: [row(), row({ path: "apps/api/src/x.spec.ts" }), row({ exceptionClass: "UX_TEXT" }), row({ coveringTest: undefined }), row({ path: "*" })] };
  const pairs = pairsFromLedger(map);
  assert.equal(pairs.length, 1);
  assert.deepEqual([...pairs[0].names], ["legacyfield"]);
});
