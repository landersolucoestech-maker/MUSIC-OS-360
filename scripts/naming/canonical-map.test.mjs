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
