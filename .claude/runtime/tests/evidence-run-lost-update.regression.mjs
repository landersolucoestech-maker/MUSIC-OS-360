// Regression test: `ops.mjs evidence run` must not overwrite state written by
// other ops.mjs invocations while its command was running.
//
// The bug: cmdEvidenceRun loaded state.json BEFORE running the (often
// minutes-long) command and saved that stale snapshot afterwards, silently
// dropping every finding/requirement/criterion recorded in between. Observed
// 2026-09-26: 8 findings added while a background evidence batch ran vanished
// from state.json (the journal only records evidence, so nothing else kept them).
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS = join(__dirname, "..", "ops.mjs");

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "eos-lost-update-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  writeFileSync(join(dir, "f.txt"), "v1\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

const ops = (dir, args) => JSON.parse(execFileSync("node", [OPS, ...args], { cwd: dir, encoding: "utf8" }));

test("a finding recorded while evidence run is executing survives", async () => {
  const dir = tempRepo();
  try {
    ops(dir, ["init", "--mission", "lost-update"]);
    const slow = spawn("node", [OPS, "evidence", "run", "--cmd", "sleep 2"], { cwd: dir });
    const done = new Promise((resolve) => slow.on("close", resolve));
    await new Promise((r) => setTimeout(r, 500)); // evidence run is now inside `sleep 2`
    const added = ops(dir, ["finding", "add", "--category", "L", "--severity", "LOW", "--file", "f.txt", "--summary", "written concurrently"]);
    const exitCode = await done;
    assert.equal(exitCode, 0);
    const state = JSON.parse(readFileSync(join(dir, ".claude/ops/state.json"), "utf8"));
    assert.ok(state.findings.some((f) => f.id === added.finding.id), "concurrently added finding was lost");
    assert.equal(state.evidenceIds.length, 1, "the evidence itself must still be linked");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
