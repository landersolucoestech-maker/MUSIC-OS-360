// Regression test of the second adversarial review of the workflow runtime: F1 record forgery (generic
// `record add`, caller-supplied id/createdAt, in-place overwrite), F2 done only for dispatched tasks with
// evidence produced at or after the dispatch, F3 reopen invalidates downstream phases, F4 unbound-reason
// letters and adoption provenance, F5 null adoption entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadState } from "../lib/state-store.mjs";
import { addRecord, getRecord, listRecords, updateRecord } from "../lib/record-store.mjs";
import { plan, next, done, addTask, workflowStatus, check } from "../orchestrate.mjs";

const OPS = join(dirname(fileURLToPath(import.meta.url)), "..", "ops.mjs");

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "eos-harden-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  execFileSync(process.execPath, [OPS, "init"], { cwd: dir });
  return dir;
}
const withDir = (fn) => { const dir = mission(); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
const pass = (dir, label = "ok") => addRecord(dir, "evidence", { type: "COMMAND", missionId: loadState(dir).missionId, label, command: label, status: "PASS", exitCode: 0, workspaceFingerprint: "x", fingerprintStatus: "BOUND" }).id;
const sleep = (ms) => { const end = Date.now() + ms; while (Date.now() < end); };
const ops = (args, cwd) => spawnSync(process.execPath, [OPS, ...args], { cwd, encoding: "utf8" });
const completeAll = (dir) => {
  for (let i = 0; i < 30; i++) {
    if (workflowStatus({}, dir).status === "COMPLETED") break;
    const n = next({}, dir);
    if (n.status !== "DISPATCHED") break;
    for (const d of n.dispatched) done({ task: d.taskId, evidence: pass(dir, d.taskId), summary: "ok" }, dir);
  }
};

test("F1: addRecord rejects a caller id/createdAt and never overwrites an existing record", () => withDir((dir) => {
  const ev = addRecord(dir, "evidence", { type: "COMMAND", missionId: loadState(dir).missionId, label: "x", command: "x", status: "FAIL", exitCode: 1, workspaceFingerprint: "x", fingerprintStatus: "BOUND" });
  assert.throws(() => addRecord(dir, "evidence", { id: ev.id, type: "COMMAND", status: "PASS", exitCode: 0, label: "x", command: "x" }), /RESERVED_FIELD/);
  assert.throws(() => addRecord(dir, "evidence", { createdAt: "2000-01-01T00:00:00.000Z", type: "COMMAND", status: "PASS", exitCode: 0, label: "x", command: "x" }), /RESERVED_FIELD/);
  assert.throws(() => addRecord(dir, "evidence", null), /INVALID_RECORD_FIELDS/);
  assert.equal(getRecord(dir, "evidence", ev.id).status, "FAIL");
}));

test("F1: `record add` refuses trust-carrying kinds with a pointer to the sanctioned command, other kinds still work", () => withDir((dir) => {
  const before = listRecords(dir, "evidence").length;
  const hints = { evidence: /evidence run/, approval: /human/, delegation: /orchestrate\.mjs next/, orchestration: /orchestrate\.mjs plan/, "workflow-match": /orchestrate\.mjs plan/, "workflow-instance": /orchestrate\.mjs plan/ };
  for (const [kind, hint] of Object.entries(hints)) {
    const r = ops(["record", "add", "--kind", kind, "--data", JSON.stringify({ status: "PASS", type: "COMMAND", id: "evid-forged" })], dir);
    assert.notEqual(r.status, 0, kind);
    assert.match(r.stdout + r.stderr, /RECORD_KIND_FORBIDDEN/, kind);
    assert.match(r.stdout + r.stderr, hint, kind);
  }
  assert.equal(listRecords(dir, "evidence").length, before);
  const ok = ops(["record", "add", "--kind", "task", "--data", JSON.stringify({ title: "t", criterionIds: [], assignedAgent: "backend-reviewer", status: "PLANNED" })], dir);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const bad = ops(["record", "add", "--kind", "task", "--data", JSON.stringify({ id: "x", title: "t", criterionIds: [], assignedAgent: "backend-reviewer", status: "PLANNED" })], dir);
  assert.notEqual(bad.status, 0);
}));

test("F1: the sanctioned producers keep working (evidence run/review, orchestrate next)", () => withDir((dir) => {
  const run = ops(["evidence", "run", "--cmd", "node --version"], dir);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const rev = ops(["evidence", "review", "--reviewer", "qa", "--verdict", "PASS", "--summary", "ok"], dir);
  assert.equal(rev.status, 0, rev.stdout + rev.stderr);
  plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  assert.equal(next({}, dir).status, "DISPATCHED");
}));

test("F2: done refuses a task that was never dispatched and evidence older than the dispatch", () => withDir((dir) => {
  plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  const early = pass(dir, "early");
  assert.throws(() => done({ task: "reproduce", evidence: early }, dir), /TASK_NOT_DISPATCHED/);
  sleep(5);
  next({}, dir);
  assert.throws(() => done({ task: "reproduce", evidence: early }, dir), /EVIDENCE_BEFORE_DISPATCH/);
  // a task that is READY/PENDING (not dispatched) cannot be closed even with fresh evidence
  assert.throws(() => done({ task: "diagnose", evidence: pass(dir) }, dir), /DEPENDENCIES_NOT_COMPLETED|TASK_NOT_DISPATCHED/);
  sleep(5);
  assert.equal(done({ task: "reproduce", evidence: pass(dir, "fresh") }, dir).status, "OK");
  // READY (dependencies done, never dispatched) is refused too
  const st = listRecords(dir, "orchestration")[0].tasks.find((t) => t.id === "diagnose");
  assert.equal(st.status, "READY");
  assert.throws(() => done({ task: "diagnose", evidence: pass(dir) }, dir), /TASK_NOT_DISPATCHED/);
}));

test("F2: a RUNNING task dispatched before the evidence closes (live-plan path); a forged delegation-less RUNNING task does not", () => withDir((dir) => {
  plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  next({}, dir);
  sleep(5);
  const ev = pass(dir);
  const p = listRecords(dir, "orchestration")[0];
  updateRecord(dir, "orchestration", p.id, { tasks: p.tasks.map((t) => (t.id === "reproduce" ? { ...t, delegationId: null } : t)) });
  assert.throws(() => done({ task: "reproduce", evidence: ev }, dir), /TASK_NOT_DISPATCHED/);
  updateRecord(dir, "orchestration", p.id, { tasks: p.tasks });
  assert.equal(done({ task: "reproduce", evidence: ev }, dir).status, "OK");
}));

test("F2: an adopted task keeps its own validation (existing evidence, no dispatch required)", () => withDir((dir) => {
  const old = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  next({}, dir);
  done({ task: "reproduce", evidence: pass(dir) }, dir);
  const adopted = plan({ order: "fix a defect", workflow: "bug-fix", adopt: [{ phase: "reproduce", fromPlan: old.planId, tasks: ["reproduce"] }] }, dir);
  assert.equal(adopted.status, "OK");
  const refs = getRecord(dir, "orchestration", adopted.planId).tasks.find((t) => t.id === "reproduce").adopted[0].evidenceRefs;
  assert.equal(done({ planId: adopted.planId, task: "reproduce", evidence: refs.join(",") }, dir).status, "OK");
}));

test("F3: reopening a completed phase invalidates the phases downstream of it and re-syncs the instance", () => withDir((dir) => {
  const r = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  completeAll(dir);
  assert.equal(workflowStatus({}, dir).status, "COMPLETED");
  addTask({ planId: r.planId, id: "late-repro", agent: "qa-engineer", phase: "reproduce", reopen: true, objective: "more reproduction" }, dir);
  const p = getRecord(dir, "orchestration", r.planId);
  const by = Object.fromEntries(p.tasks.map((t) => [t.id, t]));
  for (const id of ["reproduce", "diagnose", "closure", "completion-gate"]) {
    assert.ok(["PENDING", "READY"].includes(by[id].status), `${id} is ${by[id].status}`);
    if (id !== "reproduce") assert.deepEqual(by[id].evidenceRefs, [], id);
  }
  assert.equal(p.status, "ACTIVE");
  assert.equal(workflowStatus({ planId: r.planId }, dir).status, "ACTIVE");
  assert.equal(getRecord(dir, "workflow-instance", r.workflowInstanceId).status, "ACTIVE");
  assert.equal(check({ planId: r.planId }, dir).status, "ACTIONABLE_TASKS_REMAIN");
}));

test("F4: --unbound-reason needs 12 letters or digits; punctuation and zero-width runs are refused", () => withDir((dir) => {
  const zw = "​".repeat(20);
  for (const bad of ["!!!!!!!!!!!!!!!!!!!!", "............", `abc ${zw}`, `${zw}${zw}`, "a-b-c-d-e-f-g-h", "—".repeat(30)]) {
    assert.equal(plan({ order: "water the plants", capabilities: "security.review.xss", unboundReason: bad }, dir).status, "INVALID_UNBOUND_REASON", JSON.stringify(bad));
  }
  assert.equal(plan({ order: "water the plants", capabilities: "security.review.xss", unboundReason: "justificação válida" }, dir).status, "OK");
}));

test("F4: adoption requires a source plan of the current mission that is not abandoned", () => withDir((dir) => {
  const old = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  next({}, dir);
  done({ task: "reproduce", evidence: pass(dir) }, dir);
  const a = [{ phase: "reproduce", fromPlan: old.planId, tasks: ["reproduce"] }];
  const count = () => listRecords(dir, "orchestration").length;
  const n0 = count();
  updateRecord(dir, "orchestration", old.planId, { missionId: "mission-other" });
  let r = plan({ order: "fix a defect", workflow: "bug-fix", adopt: a }, dir);
  assert.equal(r.status, "INVALID_ADOPTION");
  assert.match(r.problems[0], /mission/);
  updateRecord(dir, "orchestration", old.planId, { missionId: loadState(dir).missionId, status: "ABANDONED" });
  r = plan({ order: "fix a defect", workflow: "bug-fix", adopt: a }, dir);
  assert.equal(r.status, "INVALID_ADOPTION");
  assert.match(r.problems[0], /ABANDONED/);
  assert.equal(count(), n0, "no plan created by refused adoptions");
}));

test("F5: a null or non-object adoption entry is INVALID_ADOPTION, not a crash", () => withDir((dir) => {
  for (const bad of [[null], [1], ["x"], [[]], null, {}]) {
    const r = plan({ order: "fix a defect", workflow: "bug-fix", adopt: bad }, dir);
    assert.equal(r.status, "INVALID_ADOPTION", JSON.stringify(bad));
  }
  assert.equal(listRecords(dir, "orchestration").length, 0);
}));
