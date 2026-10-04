import test from "node:test";
import assert from "node:assert/strict";
import { LABEL, validate, buildManifest, historicalPaths, isCommentLine, bodyOf } from "./historical-records-audit.mjs";

const rec = "docs/OLD_AUDIT.md";
const text = `${LABEL}\n\n# Old audit\n\nconteúdo histórico\n`;
const setup = (over = {}) => {
  const records = [rec];
  const readRecord = (p) => (over.record ?? { [rec]: text })[p] ?? null;
  const manifest = over.manifest ?? buildManifest(records, () => text);
  return { records, manifest, readRecord, files: over.files ?? {} };
};
const checks = (v) => v.map((x) => x.check).sort();

test("a labelled, unchanged record with no consumers passes", () => {
  assert.deepEqual(validate(setup()), []);
});

test("H1: a missing or altered label fails", () => {
  const bad = `# Old audit\n${bodyOf(text)}`;
  assert.deepEqual(checks(validate(setup({ record: { [rec]: bad } }))), ["H1_HEADER"]);
  const variant = text.replace("Historical record.", "Historical document.");
  assert.ok(checks(validate(setup({ record: { [rec]: variant } }))).includes("H1_HEADER"));
});

test("H2: growth or a silent edit of the body fails, a missing file fails", () => {
  const grown = `${text}nova linha em português\n`;
  assert.deepEqual(checks(validate(setup({ record: { [rec]: grown } }))), ["H2_FROZEN"]);
  assert.deepEqual(checks(validate(setup({ record: {} }))), ["H1_HEADER"]);
  assert.deepEqual(checks(validate({ ...setup(), manifest: { records: {} } })), ["H2_FROZEN"]);
});

test("H3: an executable consumer fails, a comment-only mention and the naming tooling do not", () => {
  assert.deepEqual(checks(validate(setup({ files: { "scripts/gen.mjs": `fs.readFileSync("${rec}")` } }))), ["H3_NOT_CONSUMED"]);
  assert.deepEqual(checks(validate(setup({ files: { "apps/api/src/database/migrations/2026_x.ts": `import a from "./a";\n// motivated by ${rec}\n` } }))), []);
  assert.deepEqual(checks(validate(setup({ files: { "apps/api/src/x.ts": `// motivated by ${rec}\n` } }))), ["H3_NOT_CONSUMED"], "an unlabelled comment citation outside migrations fails");
  assert.deepEqual(validate(setup({ files: { "apps/api/src/x.ts": `// historical record: ${rec}\n` } })), []);
  assert.deepEqual(validate(setup({ files: { "scripts/naming/tool.mjs": `const p = "${rec}"` } })), []);
  assert.deepEqual(checks(validate(setup({ files: { "package.json": `{"scripts":{"x":"node ${rec}"}}` } }))), ["H3_NOT_CONSUMED"]);
});

test("H4: an unlabelled reference from an active document fails; labelled, corpus and superseded references pass", () => {
  assert.deepEqual(checks(validate(setup({ files: { "docs/engineering/x.md": `See \`${rec}\` for the current baseline.\n` } }))), ["H4_NOT_NORMATIVE"]);
  assert.deepEqual(validate(setup({ files: { "docs/engineering/x.md": `See \`${rec}\` (historical record).\n` } })), []);
  assert.deepEqual(validate(setup({ files: { "docs/engineering/x.md": `Historical context:\n\n- \`${rec}\`\n` } })), []);
  assert.deepEqual(validate(setup({ files: { "docs/backend-v2/other.md": `see ${rec}\n` } })), []);
  assert.deepEqual(validate(setup({ files: { "docs/runbooks/old.md": `# Old\n\nStatus: SUPERSEDED.\n\nUse ${rec}.\n` } })), []);
});

test("population: only baselined ledger rows define the records", () => {
  const map = { exceptions: [{ census: "baselined", path: "a.md, b.md" }, { path: "c.md" }, { census: "baselined", path: "a.md" }] };
  assert.deepEqual(historicalPaths(map), ["a.md", "b.md"]);
  assert.equal(isCommentLine("  // note"), true);
  assert.equal(isCommentLine("const a = 1"), false);
});

test("the real repository passes (CLI --check exits 0)", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["scripts/naming/historical-records-audit.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
