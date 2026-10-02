// The generated pack maps must match the registries: a stale map would document a capability that no longer exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocs } from "../build-pack-docs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("every generated pack map in .claude/docs/pack equals what the registries produce", () => {
  const docs = buildDocs(ROOT);
  assert.ok(Object.keys(docs).length >= 8);
  for (const [name, body] of Object.entries(docs)) {
    const onDisk = readFileSync(join(ROOT, ".claude", "docs", "pack", name), "utf8");
    assert.equal(onDisk, body.endsWith("\n") ? body : body + "\n", `${name} is stale: run node .claude/runtime/build-pack-docs.mjs`);
  }
});

test("the agent and skill maps list every pack agent and skill exactly once", () => {
  const docs = buildDocs(ROOT);
  const registry = JSON.parse(readFileSync(join(ROOT, ".claude", "registry", "pack-registry.json"), "utf8"));
  for (const a of registry.agents) assert.equal(docs["agents-map.md"].split(`| \`${a.name}\` |`).length - 1, 1, a.name);
  for (const s of registry.skills) assert.equal(docs["skills-map.md"].split(`| \`${s.name}\` |`).length - 1, 1, s.name);
});
