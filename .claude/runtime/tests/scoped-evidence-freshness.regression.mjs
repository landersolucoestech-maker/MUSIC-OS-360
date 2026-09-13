// Regression test for scoped evidence freshness (lib/hash.mjs pathsChangedSince,
// AcceptanceCriterion.relevantPaths, gate-engine.mjs's criteria-fresh-evidence check).
//
// The bug this fixes: workspaceFingerprint() = sha256(HEAD + status + diff) is a
// single whole-repo value. Any commit anywhere advances HEAD, which changes the
// fingerprint for the WHOLE repo even when the files a given criterion actually
// cares about are byte-identical to before -- so an unrelated commit stales every
// previously-closed criterion's evidence. This proves the fix's two required
// behaviors: (1) a change to a criterion's own relevantPaths DOES stale its
// evidence, (2) an unrelated commit elsewhere does NOT -- while criteria that never
// opt into relevantPaths keep the old, strict, whole-fingerprint behavior exactly
// (no default weakening).
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathsChangedSince, workspaceFingerprint } from "../lib/hash.mjs";
import { evaluateGateFile } from "../gate-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS = join(__dirname, "..", "ops.mjs");

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "eos-scoped-freshness-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  writeFileSync(join(dir, "relevant.txt"), "v1\n");
  writeFileSync(join(dir, "unrelated.txt"), "v1\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

function commitFile(dir, file, content, msg) {
  writeFileSync(join(dir, file), content);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", msg], { cwd: dir });
}

function ops(args, cwd) {
  const out = execFileSync(process.execPath, [OPS, ...args], { cwd, encoding: "utf8" });
  return JSON.parse(out);
}

test("pathsChangedSince: unrelated file change -> changed=false for scoped paths", () => {
  const dir = tempRepo();
  try {
    const head0 = workspaceFingerprint(dir).head;
    commitFile(dir, "unrelated.txt", "v2\n", "touch unrelated only");
    const result = pathsChangedSince(dir, head0, ["relevant.txt"]);
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pathsChangedSince: relevant file change -> changed=true", () => {
  const dir = tempRepo();
  try {
    const head0 = workspaceFingerprint(dir).head;
    commitFile(dir, "relevant.txt", "v2\n", "touch relevant");
    const result = pathsChangedSince(dir, head0, ["relevant.txt"]);
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    assert.deepEqual(result.changedFiles, ["relevant.txt"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pathsChangedSince: uncommitted change to a scoped path -> changed=true", () => {
  const dir = tempRepo();
  try {
    const head0 = workspaceFingerprint(dir).head;
    writeFileSync(join(dir, "relevant.txt"), "dirty\n");
    const result = pathsChangedSince(dir, head0, ["relevant.txt"]);
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pathsChangedSince: unknown sinceHead fails closed (changed=true), never a false negative", () => {
  const dir = tempRepo();
  try {
    const result = pathsChangedSince(dir, "0000000000000000000000000000000000000000", ["relevant.txt"]);
    assert.equal(result.ok, false);
    assert.equal(result.changed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pathsChangedSince: empty paths list fails closed (changed=true)", () => {
  const dir = tempRepo();
  try {
    const head0 = workspaceFingerprint(dir).head;
    const result = pathsChangedSince(dir, head0, []);
    assert.equal(result.ok, false);
    assert.equal(result.changed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- end-to-end through the real gate ---

function bootstrapMission(dir) {
  ops(["init", "--mission", "scoped-freshness-e2e"], dir);
  const req = ops(["requirement", "add", "--text", "relevant.txt behaves correctly"], dir);
  const crit = ops(["criterion", "add", "--requirement", req.requirement.id, "--text", "relevant.txt has content v1 or later"], dir);
  return { reqId: req.requirement.id, critId: crit.criterion.id };
}

test("e2e: criterion WITH relevantPaths stays fresh after an unrelated commit, goes stale after a relevant one", () => {
  const dir = tempRepo();
  try {
    const { critId } = bootstrapMission(dir);
    ops(["criterion", "set-paths", "--criterion", critId, "--paths", "relevant.txt", "--reason", "test"], dir);
    ops(["evidence", "run", "--cmd", "git --version", "--criterion", critId], dir);

    // Unrelated commit elsewhere must NOT stale this criterion.
    commitFile(dir, "unrelated.txt", "v2\n", "touch unrelated only");
    let result = evaluateGateFile("completion", { cwd: dir });
    assert.ok(
      !result.reasons.some((r) => r.includes(critId)),
      `expected no staleness reason for ${critId} after an unrelated commit; got: ${JSON.stringify(result.reasons)}`,
    );

    // A commit touching the criterion's own relevantPaths MUST stale it.
    commitFile(dir, "relevant.txt", "v2\n", "touch relevant.txt");
    result = evaluateGateFile("completion", { cwd: dir });
    assert.ok(
      result.reasons.some((r) => r.includes(critId)),
      `expected a staleness reason for ${critId} after relevant.txt changed; got: ${JSON.stringify(result.reasons)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("e2e: verifiedSinceHead overrides evidence's own head for the plateau-history case", () => {
  const dir = tempRepo();
  try {
    const { critId } = bootstrapMission(dir);
    // Evidence's OWN head (default, no override) points at init -- which already
    // has relevant.txt=v1. Simulate the "long uncommitted plateau" case: the
    // evidence command ran, then relevant.txt was edited AGAIN and committed
    // separately (the batch-commit pattern) -- without an override this would
    // wrongly look stale relative to evidence.head, even though nothing has
    // changed since the REAL anchor commit.
    ops(["criterion", "set-paths", "--criterion", critId, "--paths", "relevant.txt"], dir);
    ops(["evidence", "run", "--cmd", "git --version", "--criterion", critId], dir);
    commitFile(dir, "relevant.txt", "v1-committed-later\n", "batch-commit relevant.txt (simulates plateau capture)");
    const anchorHead = workspaceFingerprint(dir).head;

    // Without override: correctly shows stale (evidence.head predates the batch commit).
    let result = evaluateGateFile("completion", { cwd: dir });
    assert.ok(result.reasons.some((r) => r.includes(critId)), "expected stale without override");

    // With an explicit, reasoned override pointing at the batch-commit anchor: fresh again.
    ops(["criterion", "set-paths", "--criterion", critId, "--paths", "relevant.txt",
      "--verified-since", anchorHead, "--verified-since-reason", "test: simulated batch-commit plateau"], dir);
    commitFile(dir, "unrelated.txt", "v2\n", "unrelated commit after the anchor");
    result = evaluateGateFile("completion", { cwd: dir });
    assert.ok(
      !result.reasons.some((r) => r.includes(critId)),
      `expected fresh with verifiedSinceHead override; got: ${JSON.stringify(result.reasons)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ops.mjs criterion set-paths rejects --verified-since without --verified-since-reason", () => {
  const dir = tempRepo();
  try {
    const { critId } = bootstrapMission(dir);
    assert.throws(
      () => ops(["criterion", "set-paths", "--criterion", critId, "--paths", "relevant.txt", "--verified-since", "abc123"], dir),
      /verified-since-reason|Command failed/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("e2e: criterion WITHOUT relevantPaths keeps the old strict whole-fingerprint behavior (no weakening)", () => {
  const dir = tempRepo();
  try {
    const { critId } = bootstrapMission(dir);
    // Deliberately no `criterion set-paths` call here.
    ops(["evidence", "run", "--cmd", "git --version", "--criterion", critId], dir);

    commitFile(dir, "unrelated.txt", "v2\n", "touch unrelated only");
    const result = evaluateGateFile("completion", { cwd: dir });
    assert.ok(
      result.reasons.some((r) => r.includes(critId)),
      `expected the OLD strict behavior to still stale ${critId} on ANY commit when relevantPaths is not declared; got: ${JSON.stringify(result.reasons)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
