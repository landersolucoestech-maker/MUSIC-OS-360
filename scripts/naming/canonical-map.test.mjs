import test from "node:test";
import assert from "node:assert/strict";
import { validateStructure, rowsWithoutCoveringTest } from "./canonical-map.mjs";

const vocab = { exceptionClass: ["TEMPORARY_MIGRATION_COMPATIBILITY", "UX_TEXT"], status: [], disposition: [] };
const row = (over = {}) => ({
  currentName: "legacy_sample", path: "a.ts", layer: "web", surface: "value", reason: "r", status: "ACTIVE",
  exceptionClass: "TEMPORARY_MIGRATION_COMPATIBILITY", owner: "o", targetState: "t", removalCondition: "census returns 0", ...over,
});
const problems = (rows) => validateStructure({ statusVocabulary: vocab, exceptions: rows, glossary: [] }).filter((p) => p.startsWith("exception"));

test("coveringTest is optional but must name an existing repo path when given", () => {
  assert.deepEqual(problems([row()]), []);
  assert.deepEqual(problems([row({ coveringTest: "scripts/naming/canonical-map.test.mjs" })]), []);
  assert.equal(problems([row({ coveringTest: "no/such/test.spec.ts" })]).length, 1);
});

test("rowsWithoutCoveringTest reports only active temporary rows without a test (warning data, not a failure)", () => {
  const rows = [row(), row({ currentName: "b", coveringTest: "scripts/naming/canonical-map.test.mjs" }), row({ currentName: "c", exceptionClass: "UX_TEXT" }), row({ currentName: "d", status: "REMOVED" })];
  assert.deepEqual(rowsWithoutCoveringTest({ exceptions: rows }).map((e) => e.currentName), ["legacy_sample"]);
});

import { coveringTestRatchet, BLOCKER_REQUIRED_FIELDS } from "./canonical-map.mjs";
import { globToRegExp, danglingGlobRows } from "./validate-canonical-map.mjs";

const gov = { ...vocab, blockerDisposition: ["BLOCKED_PRODUCT_DECISION"], blockerStatus: ["OPEN", "RESOLVED"], status: ["approved", "done"], disposition: ["DONE", "RESOLVED", "BUG", "NEEDS_PRODUCT_DECISION"] };
const blocker = (over = {}) => ({ id: "BLK-X", item: "i", blocker: "b", evidence: "e", requiredAction: "a", owner: "o", disposition: "BLOCKED_PRODUCT_DECISION", status: "OPEN", ...over });
const blockerProblems = (rows) => validateStructure({ statusVocabulary: gov, blockers: rows, glossary: [] }).filter((p) => p.startsWith("blocker") || p.startsWith("duplicate blocker"));

test("a complete blocker passes; a blocker lacking any governance field fails", () => {
  assert.deepEqual(blockerProblems([blocker()]), []);
  for (const f of BLOCKER_REQUIRED_FIELDS) {
    const bad = blocker({ [f]: undefined });
    const out = blockerProblems([bad]);
    assert.equal(out.length, 1, `${f}: ${out}`);
    assert.match(out[0], new RegExp(`missing ${f}$`));
  }
});

test("blocker disposition/status must come from the vocabulary and ids are unique", () => {
  assert.equal(blockerProblems([blocker({ disposition: "WHATEVER" })]).length, 1);
  assert.equal(blockerProblems([blocker({ status: "DONE" })]).length, 1);
  assert.equal(blockerProblems([blocker(), blocker()]).length, 1);
});

const concept = (over = {}) => ({ id: "NC-1", concept: "c", status: "approved", disposition: "NEEDS_PRODUCT_DECISION", ...over });
const conceptProblems = (rows) => validateStructure({ statusVocabulary: gov, concepts: rows, glossary: [] }).filter((p) => p.startsWith("NC-"));

test("an open concept needs an owner; DONE/RESOLVED do not; BUG cannot be done", () => {
  assert.equal(conceptProblems([concept()]).length, 1);
  assert.deepEqual(conceptProblems([concept({ owner: "catalog owner" })]), []);
  assert.deepEqual(conceptProblems([concept({ disposition: "DONE", status: "done" })]), []);
  assert.deepEqual(conceptProblems([concept({ disposition: "RESOLVED", status: "done" })]), []);
  assert.ok(conceptProblems([concept({ disposition: "BUG", status: "done", owner: "o" })]).some((p) => /BUG contradicts status done/.test(p)));
});

test("covering-test ratchet: fails above the baseline, hints below it, quiet at it", () => {
  const rows = (n) => ({ exceptions: Array.from({ length: n }, (_, i) => row({ currentName: `n${i}` })) });
  assert.deepEqual(coveringTestRatchet(rows(3), { untestedTemporaryRows: 3 }), { count: 3, baseline: 3, grew: false, shrunk: false });
  assert.equal(coveringTestRatchet(rows(4), { untestedTemporaryRows: 3 }).grew, true);
  const down = coveringTestRatchet(rows(2), { untestedTemporaryRows: 3 });
  assert.equal(down.grew, false);
  assert.equal(down.shrunk, true);
  assert.throws(() => coveringTestRatchet(rows(1), {}), /untestedTemporaryRows/);
});

test("the committed covering-test baseline is not exceeded by the live map", async () => {
  const { loadAuthority } = await import("./canonical-map.mjs");
  const fs = await import("node:fs");
  const baseline = JSON.parse(fs.readFileSync(new URL("./covering-test-baseline.json", import.meta.url), "utf8"));
  assert.equal(coveringTestRatchet(loadAuthority(), baseline).grew, false);
});

test("whole-file rows may list several exact existing files but never a glob; glob rows must match a tracked file", () => {
  const whole = (path) => problems([row({ currentName: "*", surface: "doc", exceptionClass: "UX_TEXT", path })]);
  assert.deepEqual(whole("scripts/naming/canonical-map.mjs, scripts/naming/canonical-map.test.mjs"), []);
  assert.equal(whole("scripts/naming/*.mjs").length, 1);
  assert.equal(whole("scripts/naming/canonical-map.mjs, no/such/file.md").length, 1);
  assert.ok(globToRegExp("apps/api/drizzle/*.sql").test("apps/api/drizzle/0000_x.sql"));
  assert.ok(!globToRegExp("apps/api/drizzle/*.sql").test("apps/api/drizzle/meta/0000.sql"));
  const map = { exceptions: [row({ path: "apps/api/drizzle/*.sql" })] };
  assert.deepEqual(danglingGlobRows(map, ["apps/api/drizzle/0000_x.sql"]), []);
  assert.equal(danglingGlobRows(map, ["apps/api/src/a.ts"]).length, 1);
});
