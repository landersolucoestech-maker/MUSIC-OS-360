import test from "node:test";
import assert from "node:assert/strict";
import { mergeResults } from "./compat-prove-sandbox.mjs";

const rec = (o) => ({ file: "apps/api/src/a.ts", test: "apps/api/src/a.spec.ts", fileSha256: "F1", testSha256: "T1", verdict: "PROVEN", mutations: [], ...o });
const shaOf = (map) => (p) => map[p.split("/repo/").pop()] ?? Object.entries(map).find(([k]) => p.endsWith(k))?.[1] ?? null;

test("merge: the record bound to the current bytes wins over a stale copy of the same pair", () => {
  const sha = shaOf({ "apps/api/src/a.ts": "F2", "apps/api/src/a.spec.ts": "T1" });
  const out = mergeResults([[rec({ verdict: "SURVIVED" })], [rec({ fileSha256: "F2", verdict: "PROVEN", mutations: [{}] })]], sha);
  assert.equal(out.length, 1);
  assert.equal(out[0].verdict, "PROVEN");
  assert.equal(out[0].fileSha256, "F2");
});

test("merge: when no record is fresh the pair stays (stale) so the audit counts it as unproven", () => {
  const sha = shaOf({ "apps/api/src/a.ts": "F9", "apps/api/src/a.spec.ts": "T9" });
  const out = mergeResults([[rec({})]], sha);
  assert.equal(out.length, 1);
  assert.equal(out[0].fileSha256, "F1");
});

test("merge: among fresh copies the one that ran the most mutations wins; output is sorted", () => {
  const sha = shaOf({ "apps/api/src/a.ts": "F1", "apps/api/src/a.spec.ts": "T1", "apps/api/src/b.ts": "F1", "apps/api/src/b.spec.ts": "T1" });
  const out = mergeResults([[rec({ file: "apps/api/src/b.ts", test: "apps/api/src/b.spec.ts" }), rec({ mutations: [{}] })], [rec({ mutations: [{}, {}], verdict: "PARTIAL" })]], sha);
  assert.deepEqual(out.map((r) => r.file), ["apps/api/src/a.ts", "apps/api/src/b.ts"]);
  assert.equal(out[0].verdict, "PARTIAL");
});

test("merge: a strict (exhaustive) record outranks a non-exhaustive one with more mutations from an older run", () => {
  const sha = shaOf({ "apps/api/src/a.ts": "F1", "apps/api/src/a.spec.ts": "T1" });
  const old = rec({ verdict: "PROVEN", mutations: [{}, {}, {}] });
  const strict = rec({ verdict: "PARTIAL", exhaustive: true, mutations: [{}] });
  for (const lists of [[[old], [strict]], [[strict], [old]]]) {
    const out = mergeResults(lists, sha);
    assert.equal(out.length, 1);
    assert.equal(out[0].exhaustive, true);
    assert.equal(out[0].verdict, "PARTIAL");
  }
});
