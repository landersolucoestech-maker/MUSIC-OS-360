// Regression test for the opt-in STRICT_MULTI_AGENT execution mode (state.executionMode,
// see lib/state-store.mjs, lib/capability-ledger.mjs, and the "Execution mode" section of
// .claude/agents/mission-orchestrator.md). Proves, against real code paths (not narrative
// claims): DEFAULT stays the default and is unaffected; the mode can be set explicitly via
// both the CLI and the state-store API; the capability ledger derives status from real task
// records (not assumed); an unjustified NOT_APPLICABLE_WITH_EVIDENCE is fail-closed; and
// gate-engine.mjs's full-mobilization-when-strict check is a true no-op in DEFAULT mode but
// actually blocks/passes correctly in STRICT_MULTI_AGENT mode depending on ledger state --
// including the specific acceptance scenario from the mission that introduced this feature:
// a killed/failed required capability must NOT be silently treated as complete.
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultState, EXECUTION_MODES } from "../lib/state-store.mjs";
import { addRecord } from "../lib/record-store.mjs";
import { computeCapabilityLedger, outstandingCapabilities } from "../lib/capability-ledger.mjs";
import { evaluateGateFile } from "../gate-engine.mjs";
import { build as buildGraph, nextRunnable } from "../graph-engine.mjs";
import { buildRegistry } from "../registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS = join(__dirname, "..", "ops.mjs");

function tempMission() {
  const dir = mkdtempSync(join(tmpdir(), "eos-strict-mode-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

function ops(args, cwd) {
  const out = execFileSync(process.execPath, [OPS, ...args], { cwd, encoding: "utf8" });
  return JSON.parse(out);
}

test("DEFAULT is the mode for a mission created with no --mode, and behavior is unchanged", () => {
  const state = defaultState("m");
  assert.equal(state.executionMode, "DEFAULT");
});

test("EXECUTION_MODES is the canonical, exhaustive list the CLI validates against", () => {
  assert.deepEqual(EXECUTION_MODES, ["DEFAULT", "STRICT_MULTI_AGENT"]);
});

test("ops.mjs init --mode STRICT_MULTI_AGENT sets the mode via the real CLI", () => {
  const dir = tempMission();
  try {
    const created = ops(["init", "--mission", "strict-test", "--mode", "STRICT_MULTI_AGENT"], dir);
    assert.equal(created.status, "CREATED");
    assert.equal(created.executionMode, "STRICT_MULTI_AGENT");
    const status = ops(["status"], dir);
    assert.equal(status.executionMode, "STRICT_MULTI_AGENT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ops.mjs init rejects an invalid --mode instead of silently accepting it", () => {
  const dir = tempMission();
  try {
    assert.throws(() => ops(["init", "--mode", "MAXIMUM_OVERDRIVE"], dir), /INVALID_MODE|Command failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ops.mjs mode set switches an existing mission's mode explicitly", () => {
  const dir = tempMission();
  try {
    ops(["init", "--mission", "m"], dir);
    assert.equal(ops(["status"], dir).executionMode, "DEFAULT");
    const set = ops(["mode", "set", "--mode", "STRICT_MULTI_AGENT"], dir);
    assert.equal(set.executionMode, "STRICT_MULTI_AGENT");
    assert.equal(ops(["status"], dir).executionMode, "STRICT_MULTI_AGENT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("registry discovers real registered agents and skills (no hardcoded count)", () => {
  const { agents, skills } = buildRegistry(process.cwd());
  assert.ok(agents.length > 0, "expected at least one registered agent");
  assert.ok(skills.length > 0, "expected at least one registered skill");
  assert.ok(agents.some((a) => a.name === "mission-orchestrator"), "registry should discover mission-orchestrator itself");
});

test("capability ledger reports a real registered agent as DISCOVERED when no task record references it", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir);
    const { capabilities } = computeCapabilityLedger(dir);
    const backend = capabilities.find((c) => c.name === "backend-reviewer");
    assert.ok(backend, "backend-reviewer should be discovered from the real registry");
    assert.equal(backend.status, "DISCOVERED");
    assert.equal(backend.taskId, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a COMPLETED task record marks the matching capability COMPLETED in the ledger", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir);
    const task = addRecord(dir, "task", {
      id: "t1", title: "review billing", criterionIds: [],
      assignedAgent: "backend-reviewer", status: "COMPLETED",
    });
    const { capabilities, summary } = computeCapabilityLedger(dir);
    const entry = capabilities.find((c) => c.name === "backend-reviewer");
    assert.equal(entry.status, "COMPLETED");
    assert.equal(entry.taskId, task.id);
    assert.equal(summary.completed >= 1, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("NOT_APPLICABLE_WITH_EVIDENCE without a reason is fail-closed back to DISCOVERED (not trusted)", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir);
    addRecord(dir, "task", {
      id: "t2", title: "n/a check", criterionIds: [],
      assignedAgent: "cost-efficiency-reviewer", status: "NOT_APPLICABLE_WITH_EVIDENCE",
    });
    const { capabilities } = computeCapabilityLedger(dir);
    const entry = capabilities.find((c) => c.name === "cost-efficiency-reviewer");
    assert.equal(entry.status, "DISCOVERED", "an unjustified N/A must not count as a real disposition");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("NOT_APPLICABLE_WITH_EVIDENCE with a concrete reason is respected and excluded from outstanding work", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir);
    addRecord(dir, "task", {
      id: "t3", title: "n/a check", criterionIds: [],
      assignedAgent: "cost-efficiency-reviewer", status: "NOT_APPLICABLE_WITH_EVIDENCE",
      notApplicableReason: "no infra/cost-relevant change in this diff",
    });
    const { capabilities } = computeCapabilityLedger(dir);
    const entry = capabilities.find((c) => c.name === "cost-efficiency-reviewer");
    assert.equal(entry.status, "NOT_APPLICABLE_WITH_EVIDENCE");
    assert.equal(outstandingCapabilities(dir).some((c) => c.name === "cost-efficiency-reviewer"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a FAILED or BLOCKED task keeps the capability outstanding -- never silently counted as done", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir);
    addRecord(dir, "task", { id: "t4", title: "x", criterionIds: [], assignedAgent: "security-reviewer", status: "FAILED" });
    addRecord(dir, "task", { id: "t5", title: "y", criterionIds: [], assignedAgent: "database-reviewer", status: "BLOCKED" });
    const outstanding = outstandingCapabilities(dir).map((c) => c.name);
    assert.ok(outstanding.includes("security-reviewer"));
    assert.ok(outstanding.includes("database-reviewer"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("full-mobilization-when-strict is a true no-op in DEFAULT mode, even with 100% undispatched capabilities", () => {
  const dir = tempMission();
  try {
    ops(["init"], dir); // DEFAULT — no task records created at all, maximally "incomplete"
    const result = evaluateGateFile("completion", { cwd: dir });
    const reason = result.reasons.find((r) => r.startsWith("STRICT_MULTI_AGENT"));
    assert.equal(reason, undefined, "DEFAULT mode must not be affected by capability mobilization at all");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("full-mobilization-when-strict BLOCKS completion in STRICT_MULTI_AGENT mode when capabilities are undispatched", () => {
  const dir = tempMission();
  try {
    ops(["init", "--mode", "STRICT_MULTI_AGENT"], dir); // no task records — everything DISCOVERED
    const result = evaluateGateFile("completion", { cwd: dir });
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.reasons.some((r) => r.includes("STRICT_MULTI_AGENT")), "must name the mobilization gap as a blocking reason");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acceptance scenario: repeated kills of a required capability in STRICT_MULTI_AGENT mode stay BLOCKED, never silently COMPLETED", () => {
  const dir = tempMission();
  try {
    ops(["init", "--mode", "STRICT_MULTI_AGENT"], dir);
    // Simulate 4 launch attempts of one required capability, all killed/failed.
    for (let i = 0; i < 4; i++) {
      addRecord(dir, "failure", { fingerprint: "agent-killed", summary: `attempt ${i + 1} killed`, gateResultId: null, taskId: null });
    }
    addRecord(dir, "task", { id: "t-repeated", title: "z", criterionIds: [], assignedAgent: "distributed-systems-reviewer", status: "BLOCKED" });
    const result = evaluateGateFile("completion", { cwd: dir });
    assert.equal(result.status, "BLOCKED");
    assert.ok(
      result.reasons.some((r) => r.includes("distributed-systems-reviewer")),
      "the repeatedly-killed capability must be named, not silently dropped from the ledger"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("full-mobilization-when-strict PASSES once every discovered capability has a terminal disposition", () => {
  const dir = tempMission();
  try {
    ops(["init", "--mode", "STRICT_MULTI_AGENT"], dir);
    const { agents, skills } = buildRegistry(dir);
    let i = 0;
    for (const a of agents.filter((x) => x.valid)) {
      addRecord(dir, "task", { id: `ta-${i++}`, title: a.name, criterionIds: [], assignedAgent: a.name, status: "COMPLETED" });
    }
    for (const s of skills.filter((x) => x.valid)) {
      addRecord(dir, "task", {
        id: `ts-${i++}`, title: s.name, criterionIds: [], assignedAgent: s.name,
        status: "NOT_APPLICABLE_WITH_EVIDENCE", notApplicableReason: "synthetic full-coverage test — not exercised against real mission scope",
      });
    }
    const result = evaluateGateFile("completion", { cwd: dir });
    const reason = result.reasons.find((r) => r.startsWith("STRICT_MULTI_AGENT"));
    assert.equal(reason, undefined, `expected no mobilization-gap reason, got: ${JSON.stringify(result.reasons)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("graph-engine's nextRunnable already returns multiple independent nodes as one concurrent batch (not one-at-a-time)", () => {
  // brownfield-change.json is a real shipped workflow manifest — proves this against
  // the actual workflow shape, not a synthetic fixture.
  const graph = buildGraph("brownfield-change", process.cwd());
  const runnable = nextRunnable(graph);
  assert.ok(runnable.length >= 1, "at least the graph's root-level phase(s) must be immediately runnable");
  // Every node with an empty dependsOn is independent of every other such node and
  // must appear in the same batch — that's the concurrency guarantee this function exists for.
  const rootless = graph.nodes.filter((n) => n.dependsOn.length === 0);
  for (const n of rootless) {
    assert.ok(runnable.some((r) => r.id === n.id), `dependency-free node ${n.id} should be in the first runnable batch`);
  }
});
