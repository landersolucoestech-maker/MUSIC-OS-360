// Regression test: finding-correlation.mjs still ranks the legacy Portuguese severities
// (CRITICO/ALTO/MEDIO/BAIXO/INFORMATIVO) like their English twins. Stored ops findings and the
// completion gate still carry them (ledgered TEMPORARY_MIGRATION_COMPATIBILITY aliases).
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { correlateFindings } from "../lib/finding-correlation.mjs";

function winner(first, second) {
  const [finding] = correlateFindings([
    { tool: "a", fingerprint: "fp", file: "f", summary: "s", severity: first },
    { tool: "b", fingerprint: "fp", file: "f", summary: "s", severity: second },
  ]);
  return finding.severity;
}

// [legacy, strictly lower English rank, strictly higher English rank | null]
const CASES = [
  ["CRITICO", "HIGH", null],
  ["ALTO", "MEDIUM", "CRITICAL"],
  ["MEDIO", "LOW", "HIGH"],
  ["BAIXO", "INFO", "MEDIUM"],
  ["INFORMATIVO", "UNKNOWN_SEVERITY", "LOW"],
];

for (const [legacy, lower, higher] of CASES) {
  test(`${legacy} outranks ${lower} (either order)`, () => {
    assert.equal(winner(legacy, lower), legacy);
    assert.equal(winner(lower, legacy), legacy);
  });
  if (higher) {
    test(`${legacy} is outranked by ${higher} (either order)`, () => {
      assert.equal(winner(legacy, higher), higher);
      assert.equal(winner(higher, legacy), higher);
    });
  }
}

test("legacy severities are case-insensitive", () => {
  assert.equal(winner("alto", "medium"), "alto");
});
