// Regression test of the workflow layer: discovery, matching (all candidates persisted), refusal to build a
// task graph without a workflow, instances bound to plans, adoption of completed work only with existing
// evidence, per-phase status, completion tied to the instance, and the coverage and instance gate checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { addRecord, listRecords, getRecord } from "../lib/record-store.mjs";
import { discover, matchOrder, coverage, MATCH_THRESHOLD, normalize } from "../workflow-match.mjs";
import { plan, next, done, addTask, workflowStatus } from "../orchestrate.mjs";
import { evaluateGateFile } from "../gate-engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = join(HERE, "..", "ops.mjs");
const MISSION = "Continue the normalization of technical language, naming blockers and legacy compatibility boundaries";

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "eos-wf-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  execFileSync(process.execPath, [OPS, "init"], { cwd: dir });
  return dir;
}
const pass = (dir, label = "ok") => addRecord(dir, "evidence", { type: "COMMAND", label, command: label, status: "PASS", exitCode: 0, workspaceFingerprint: "x", fingerprintStatus: "BOUND" }).id;
const withDir = (fn) => { const dir = mission(); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

test("discovery finds every shipped workflow, all valid, none with problems", () => {
  const d = discover();
  assert.deepEqual(d.problems, []);
  assert.ok(d.workflows.length >= 25);
  assert.ok(d.workflows.some((w) => w.name === "naming-normalization"));
  assert.ok(d.workflows.every((w) => w.match && w.match.keywords.length && w.match.examples.length));
});

test("coverage: every workflow is selected by its own examples", () => {
  assert.deepEqual(coverage().failures, []);
});

test("the normalization mission selects naming-normalization and every candidate is scored", () => {
  const r = matchOrder({ order: MISSION });
  assert.equal(r.status, "MATCHED");
  assert.equal(r.selected, "naming-normalization");
  assert.ok(r.candidates.length >= 25);
  assert.ok(r.candidates[0].score >= MATCH_THRESHOLD && r.candidates[0].score > r.candidates[1].score);
  assert.ok(r.candidates[0].reasons.length > 0);
});

test("an order no workflow serves is NO_MATCH, and plan refuses to build a task graph from it", () => withDir((dir) => {
  const order = "water the office plants every thursday";
  assert.equal(matchOrder({ order }).status, "NO_MATCH");
  const r = plan({ order }, dir);
  assert.equal(r.status, "NO_WORKFLOW_MATCH");
  assert.match(r.message, /gap in the pack/);
  assert.equal(listRecords(dir, "orchestration").length, 0);
  assert.equal(listRecords(dir, "workflow-match").length, 1, "the failed match is still recorded with all candidates");
}));

test("an excluded term lowers the score so a bug order is not taken for normalization", () => {
  const r = matchOrder({ order: "fix the bug in naming normalization export" });
  assert.notEqual(r.selected, "naming-normalization");
});

test("plan binds the matched workflow, records the match and creates an instance with one step per phase", () => withDir((dir) => {
  const r = plan({ order: MISSION }, dir);
  assert.equal(r.status, "OK");
  assert.equal(r.workflow, "naming-normalization");
  assert.ok(r.workflowInstanceId && r.matchId);
  const inst = getRecord(dir, "workflow-instance", r.workflowInstanceId);
  assert.equal(inst.steps.length, 11);
  assert.equal(inst.status, "ACTIVE");
  const match = getRecord(dir, "workflow-match", r.matchId);
  assert.ok(match.candidates.length >= 25);
  const ws = workflowStatus({}, dir);
  assert.equal(ws.status, "ACTIVE");
  assert.equal(ws.steps.find((s) => s.phase === "census").status, "READY");
}));

test("extra tasks must name a phase of the bound workflow and block that phase", () => withDir((dir) => {
  const file = join(dir, "extra.json");
  writeFileSync(file, JSON.stringify({ tasks: [{ id: "x1", agent: "naming-analyzer", skills: ["naming-analysis"], objective: "o", acceptance: ["a"] }] }));
  assert.equal(plan({ order: MISSION, tasksFile: file }, dir).status, "INVALID_PLAN");
  writeFileSync(file, JSON.stringify({ tasks: [{ id: "x1", phase: "no-such-phase", agent: "naming-analyzer", skills: [], objective: "o", acceptance: ["a"] }] }));
  assert.equal(plan({ order: MISSION, tasksFile: file }, dir).status, "INVALID_PLAN");
  writeFileSync(file, JSON.stringify({ tasks: [{ id: "x1", phase: "census", agent: "naming-analyzer", skills: ["naming-analysis"], objective: "o", acceptance: ["a"] }] }));
  const r = plan({ order: MISSION, tasksFile: file }, dir);
  assert.equal(r.status, "OK");
  assert.ok(r.tasks.find((t) => t.id === "census").dependsOn.includes("x1"));
}));

test("add-task on a bound plan needs a phase and blocks it", () => withDir((dir) => {
  plan({ order: MISSION }, dir);
  assert.throws(() => addTask({ id: "n1", agent: "naming-analyzer", skills: [], objective: "x" }, dir), /PHASE_REQUIRED/);
  assert.equal(addTask({ id: "n1", agent: "naming-analyzer", skills: [], phase: "classify", objective: "x" }, dir).status, "OK");
  assert.throws(() => addTask({ id: "n2", agent: "naming-analyzer", skills: [], phase: "nope", objective: "x" }, dir), /UNKNOWN_PHASE/);
}));

test("adoption: completed tasks of an earlier plan with existing evidence are adopted, never duplicated; fake evidence is refused", () => withDir((dir) => {
  const old = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  next({}, dir);
  const ev = pass(dir);
  done({ task: "reproduce", evidence: ev, summary: "ok" }, dir);
  const adopted = plan({ order: MISSION, adopt: [{ phase: "census", fromPlan: old.planId, tasks: ["reproduce"], complete: true }] }, dir);
  assert.equal(adopted.status, "OK");
  const t = adopted.tasks.find((x) => x.id === "census");
  assert.equal(t.status, "COMPLETED");
  const rec = listRecords(dir, "orchestration").find((p) => p.id === adopted.planId);
  assert.deepEqual(rec.tasks.find((x) => x.id === "census").evidenceRefs, [ev]);
  assert.equal(rec.tasks.filter((x) => x.id === "reproduce").length, 0, "no task of the old plan was copied");
  const inst = getRecord(dir, "workflow-instance", adopted.workflowInstanceId);
  assert.deepEqual(inst.adoptedFrom, [old.planId]);
  // not completed in the old plan
  const bad = plan({ order: MISSION, adopt: [{ phase: "census", fromPlan: old.planId, tasks: ["diagnose"] }] }, dir);
  assert.equal(bad.status, "INVALID_ADOPTION");
  // forged evidence reference
  const p0 = listRecords(dir, "orchestration").find((p) => p.id === old.planId);
  const { id, createdAt, ...rest } = p0;
  rest.tasks = rest.tasks.map((x) => (x.id === "diagnose" ? { ...x, status: "COMPLETED", evidenceRefs: ["evid-forged"] } : x));
  addRecord(dir, "orchestration", { ...rest });
  const forged = listRecords(dir, "orchestration").filter((p) => p.tasks.some((x) => x.id === "diagnose" && x.evidenceRefs.includes("evid-forged")))[0];
  assert.equal(plan({ order: MISSION, adopt: [{ phase: "census", fromPlan: forged.id, tasks: ["diagnose"] }] }, dir).status, "INVALID_ADOPTION");
}));

test("the instance completes only when every phase is COMPLETED, and the gate follows it", () => withDir((dir) => {
  const r = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  const gate = () => evaluateGateFile("workflow-runtime", { cwd: dir });
  assert.ok(gate().reasons.some((x) => /phases not COMPLETED/.test(x)));
  for (let i = 0; i < 20; i++) {
    if (workflowStatus({}, dir).status === "COMPLETED") break;
    const n = next({}, dir);
    if (n.status !== "DISPATCHED") break;
    for (const d of n.dispatched) done({ task: d.taskId, evidence: pass(dir, d.taskId), summary: "ok" }, dir);
  }
  assert.equal(workflowStatus({}, dir).status, "COMPLETED");
  assert.equal(getRecord(dir, "workflow-instance", r.workflowInstanceId).status, "COMPLETED");
  assert.ok(!gate().reasons.some((x) => /phases not COMPLETED/.test(x)));
}));

test("the runtime gate blocks when no workflow was ever instantiated", () => withDir((dir) => {
  const g = evaluateGateFile("workflow-runtime", { cwd: dir });
  assert.equal(g.status, "BLOCKED");
  assert.ok(g.reasons.some((x) => /never exercised/.test(x)));
}));

test("a plan with an unbound reason is the only way around matching, and the gate then ignores it", () => withDir((dir) => {
  const r = plan({ order: "water the plants", capabilities: "security.review.xss", unboundReason: "test of the escape hatch" }, dir);
  assert.equal(r.status, "OK");
  assert.equal(r.workflowInstanceId, null);
  const p = listRecords(dir, "orchestration")[0];
  assert.equal(p.requireWorkflow, false);
  assert.equal(p.unboundReason, "test of the escape hatch");
}));

test("normalize strips accents so the Portuguese order matches", () => {
  assert.equal(normalize("Normalização técnica"), "normalizacao tecnica");
  assert.equal(matchOrder({ order: "Normalização da nomenclatura e dos aliases legados (naming blockers)" }).selected, "naming-normalization");
});
