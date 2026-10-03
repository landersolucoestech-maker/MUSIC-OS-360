import { test } from "node:test";
import assert from "node:assert/strict";
import { compareStates, summarize, layerOfPath, parseKey, LAYERS } from "./normalization-audit.mjs";

test("layerOfPath: tests and fixtures are their own layer, whatever app they sit in", () => {
  assert.equal(layerOfPath("apps/api/src/a.service.ts"), "BACKEND_API");
  assert.equal(layerOfPath("apps/api/src/a.service.spec.ts"), "TESTS_FIXTURES_MOCKS");
  assert.equal(layerOfPath("apps/web/src/A.tsx"), "FRONTEND");
  assert.equal(layerOfPath("apps/web/src/A.test.tsx"), "TESTS_FIXTURES_MOCKS");
  assert.equal(layerOfPath("e2e/x.spec.ts"), "TESTS_FIXTURES_MOCKS");
  assert.equal(layerOfPath("packages/types/src/a.ts"), "SHARED_PACKAGES");
  assert.equal(layerOfPath("apps/api/src/database/migrations/x.ts"), "DATABASE");
  assert.equal(layerOfPath("apps/api/drizzle/0000.sql"), "DATABASE");
  assert.equal(layerOfPath("docs/a.md"), "DOCUMENTATION");
  assert.equal(layerOfPath("scripts/a.mjs"), "TOOLING_SCRIPTS_CI");
  assert.equal(layerOfPath(".github/workflows/ci.yml"), "TOOLING_SCRIPTS_CI");
});

test("parseKey: every surface key shape", () => {
  assert.deepEqual(parseKey("identifier::apps/api/src/a.ts::class::Foo"), { surface: "identifier", file: "apps/api/src/a.ts", kind: "class", name: "Foo" });
  assert.deepEqual(parseKey("doc::docs/a.md"), { surface: "doc", file: "docs/a.md", kind: "doc", name: "*" });
  assert.equal(parseKey("dbColumn::artists.nome").file, "apps/api/src/database/entities.ts");
  assert.equal(parseKey("toolMessage::e2e/a.spec.ts::message::some tool message").name, "some tool message");
});

test("compareStates + summarize: audited = normalized + remaining on every layer, and nothing is hidden", () => {
  const base = { debt: {
    "identifier::apps/api/src/a.ts::class::Antigo": 1,
    "identifier::apps/web/src/B.tsx::class::Velho": 2,
    "doc::docs/h.md": 10,
    "value::apps/api/src/c.ts::string::mantido": 3,
    "value::apps/api/src/d.ts::string::cresceu": 1,
  } };
  const head = {
    debt: { "doc::docs/h.md": 10, "doc::docs/novo.md": 4, "value::apps/api/src/d.ts::string::cresceu": 2 },
    excepted: { "value::apps/api/src/c.ts::string::mantido": 3 },
    exceptedClass: { "value::apps/api/src/c.ts::string::mantido": "LEGACY_DATABASE_COMPATIBILITY" },
  };
  const rows = compareStates(base, head, { historicalDocs: new Set(["docs/h.md"]) });
  const by = Object.fromEntries(rows.map((r) => [`${r.surface}:${r.file}`, r]));
  assert.equal(by["identifier:apps/api/src/a.ts"].classification, "NORMALIZED");
  assert.equal(by["doc:docs/h.md"].classification, "HISTORICAL_RECORD");
  assert.equal(by["doc:docs/novo.md"].classification, "NOT_NORMALIZED", "a new Portuguese document is never historical");
  assert.equal(by["value:apps/api/src/c.ts"].classification, "LEGITIMATE_COMPATIBILITY_BOUNDARY");
  assert.equal(by["value:apps/api/src/d.ts"].classification, "NOT_NORMALIZED", "growth without an exception is not hidden");
  const s = summarize(rows, {});
  for (const layer of LAYERS) {
    const x = s[layer];
    assert.equal(x.audited, x.normalized + x.legit + x.historical + x.notNormalized, layer);
  }
  assert.equal(s.BACKEND_API.normalized, 1);
  assert.equal(s.FRONTEND.normalized, 2);
  assert.equal(s.BACKEND_API.notNormalized, 2);
  assert.equal(s.DOCUMENTATION.notNormalized, 4);
  assert.equal(s.DOCUMENTATION.historical, 10);
});
