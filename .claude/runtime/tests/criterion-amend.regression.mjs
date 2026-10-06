// A criterion that contradicts a decision already taken is corrected through `criterion amend`: the correction is
// reasoned and auditable, the old text and its evidence are kept in history, and the criterion reopens (the new text
// must be proven by fresh evidence; the old PASS never carries over).
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OPS = join(dirname(fileURLToPath(import.meta.url)), "..", "ops.mjs");

function ops(args, cwd, allowFail = false) {
  try {
    return JSON.parse(execFileSync(process.execPath, [OPS, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (err) {
    if (!allowFail) throw err;
    return { failed: true, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "eos-amend-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "init"], { cwd: dir });
  ops(["init", "--name", "amend-test"], dir);
  const req = ops(["requirement", "add", "--text", "r"], dir).requirement;
  const crit = ops(["criterion", "add", "--requirement", req.id, "--text", "old text"], dir).criterion;
  return { dir, crit };
}

const state = (dir) => JSON.parse(readFileSync(join(dir, ".claude/ops/state.json"), "utf8"));
const find = (dir, id) => state(dir).requirements.flatMap((r) => r.acceptanceCriteria).find((c) => c.id === id);

test("amend rewrites the text, keeps the history and reopens the criterion", () => {
  const { dir, crit } = repo();
  try {
    ops(["evidence", "run", "--cmd", "node --version", "--criterion", crit.id], dir);
    const before = find(dir, crit.id);
    assert.equal(before.evidenceIds.length, 1);
    ops(["criterion", "amend", "--criterion", crit.id, "--text", "new text", "--reason", "the old text contradicted a decision already taken"], dir);
    const after = find(dir, crit.id);
    assert.equal(after.text, "new text");
    assert.equal(after.status, "open");
    assert.deepEqual(after.evidenceIds, []);
    assert.equal(after.amendments.length, 1);
    assert.equal(after.amendments[0].previousText, "old text");
    assert.deepEqual(after.amendments[0].supersededEvidenceIds, before.evidenceIds);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("amend refuses a missing or trivial reason, an unknown criterion and a no-op", () => {
  const { dir, crit } = repo();
  try {
    assert.equal(ops(["criterion", "amend", "--criterion", crit.id, "--text", "x"], dir, true).failed, true);
    assert.equal(ops(["criterion", "amend", "--criterion", crit.id, "--text", "x", "--reason", "short"], dir, true).failed, true);
    assert.equal(ops(["criterion", "amend", "--criterion", "ac-nope", "--text", "x", "--reason", "a sufficiently long reason here"], dir, true).failed, true);
    assert.equal(ops(["criterion", "amend", "--criterion", crit.id, "--text", "old text", "--reason", "a sufficiently long reason here"], dir, true).failed, true);
    assert.equal(find(dir, crit.id).text, "old text");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
