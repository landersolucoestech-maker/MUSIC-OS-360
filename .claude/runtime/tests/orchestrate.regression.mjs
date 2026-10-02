// Regression test of the orchestration driver: graph building from a workflow and from routes, dependency
// ordering, delegation packages, evidence-first completion, failure -> recovery -> retry, the external block
// contract, approvals that only a human can grant, and the Stop hook that keeps a session going while
// actionable tasks remain (and lets it stop for approval or external waits, and after repeated no-progress blocks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { addRecord, updateRecord } from "../lib/record-store.mjs";
import { plan, next, done, reassign, addTask, fail, blockExternal, syncApprovals, check, stopCheck, promptHook } from "../orchestrate.mjs";

const OPS = join(dirname(fileURLToPath(import.meta.url)), "..", "ops.mjs");

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "eos-orch-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  execFileSync(process.execPath, [OPS, "init"], { cwd: dir });
  return dir;
}
const pass = (dir, label = "ok") => addRecord(dir, "evidence", { type: "COMMAND", label, command: label, status: "PASS", exitCode: 0, workspaceFingerprint: "x", fingerprintStatus: "BOUND" }).id;
const withDir = (fn) => { const dir = mission(); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

test("a workflow becomes a persisted graph; only tasks without open dependencies are READY; a closure task is appended", () => withDir((dir) => {
  const r = plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  assert.equal(r.status, "OK");
  const byId = Object.fromEntries(r.tasks.map((t) => [t.id, t]));
  assert.equal(byId["reproduce"].status, "READY");
  assert.equal(byId["diagnose"].status, "PENDING");
  assert.ok(byId["completion-gate"].dependsOn.includes("closure"));
}));

test("next delegates READY tasks to the named subagent with a bounded prompt and opens a delegation record", () => withDir((dir) => {
  plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  const n = next({}, dir);
  assert.equal(n.status, "DISPATCHED");
  const d = n.dispatched[0];
  assert.equal(d.kind, "delegate");
  assert.equal(d.subagent_type, "root-cause-investigator");
  assert.match(d.prompt, /ACCEPTANCE CRITERIA/);
  assert.match(d.prompt, /evidence-first/);
  assert.ok(d.delegationId);
  assert.equal(next({}, dir).status, "NOTHING_READY");
}));

test("done requires existing PASS evidence; completing a task releases its dependents", () => withDir((dir) => {
  plan({ order: "fix a defect", workflow: "bug-fix" }, dir);
  next({}, dir);
  assert.throws(() => done({ task: "reproduce", evidence: "" }, dir), /EVIDENCE_REQUIRED/);
  assert.throws(() => done({ task: "reproduce", evidence: "evid-nope" }, dir), /UNKNOWN_EVIDENCE/);
  const bad = addRecord(dir, "evidence", { type: "COMMAND", label: "x", command: "x", status: "FAIL", exitCode: 1, workspaceFingerprint: "x", fingerprintStatus: "BOUND" }).id;
  assert.throws(() => done({ task: "reproduce", evidence: bad }, dir), /EVIDENCE_NOT_PASS/);
  const ev = pass(dir);
  done({ task: "reproduce", evidence: ev, summary: "reproduced" }, dir);
  const n = next({}, dir);
  assert.equal(n.dispatched[0].taskId, "diagnose");
  assert.match(n.dispatched[0].prompt, /reproduced/);
}));

test("a failure plans a recovery task and a retry; the third failure escalates and stays blocking", () => withDir((dir) => {
  plan({ order: "x", workflow: "bug-fix" }, dir);
  next({}, dir);
  const f1 = fail({ task: "reproduce", reason: "cannot reproduce" }, dir);
  assert.equal(f1.status, "RETRY_PLANNED");
  const n = next({}, dir);
  assert.equal(n.dispatched[0].taskId, f1.recoveryTask);
  assert.equal(n.dispatched[0].subagent_type, "root-cause-investigator");
  done({ task: f1.recoveryTask, evidence: pass(dir), summary: "cause found" }, dir);
  next({}, dir);
  fail({ task: "reproduce", reason: "again" }, dir);
  const rec2 = "reproduce-recovery-2";
  next({}, dir);
  done({ task: rec2, evidence: pass(dir) }, dir);
  next({}, dir);
  assert.equal(fail({ task: "reproduce", reason: "third" }, dir).status, "ESCALATE");
  assert.equal(check({}, dir).status, "ACTIONABLE_TASKS_REMAIN");
}));

test("block-external demands every field of the contract; an external block is not actionable but never counts as complete", () => withDir((dir) => {
  plan({ order: "x", workflow: "bug-fix" }, dir);
  next({}, dir);
  assert.throws(() => blockExternal({ task: "reproduce", capability: "c" }, dir), /BLOCKED_EXTERNAL_INCOMPLETE/);
  blockExternal({ task: "reproduce", capability: "transcription", cause: "no provider is configured", missing: "speech-to-text provider", contract: "audio in, text out", current: "CAPABILITY_UNAVAILABLE", fallback: "manual transcript", impact: "no automatic lyrics", unblock: "a provider contract and credentials are supplied" }, dir);
  const c = check({}, dir);
  assert.equal(c.status, "ONLY_EXTERNAL_OR_APPROVAL_WAITS");
  assert.equal(c.waiting[0].blockedExternal, "transcription");
}));

test("an approval task waits for a human: the driver never grants it, only a GRANTED record by someone else completes it", () => withDir((dir) => {
  plan({ order: "ship", workflow: "release-validation" }, dir);
  // run everything before the approval phase
  for (const id of ["supply-chain", "plan", "regression", "release-readiness"]) {
    const n = next({}, dir);
    assert.equal(n.dispatched[0].taskId, id);
    done({ task: id, evidence: pass(dir) }, dir);
  }
  const w = next({}, dir);
  assert.equal(w.dispatched[0].kind, "approval");
  const approvalId = w.dispatched[0].approvalId;
  assert.throws(() => done({ task: "deploy-approval", evidence: pass(dir) }, dir), /WAITING_APPROVAL/);
  assert.equal(check({}, dir).status, "ONLY_EXTERNAL_OR_APPROVAL_WAITS");
  syncApprovals({}, dir);
  assert.equal(next({}, dir).status, "NOTHING_READY");
  updateRecord(dir, "approval", approvalId, { status: "GRANTED", grantedBy: "human@example.com" });
  syncApprovals({}, dir);
  assert.equal(next({}, dir).dispatched[0].taskId, "post-deploy");
}));

test("a denied approval fails its task terminally and blocks completion", () => withDir((dir) => {
  plan({ order: "ship", workflow: "release-validation" }, dir);
  for (const id of ["supply-chain", "plan", "regression", "release-readiness"]) { next({}, dir); done({ task: id, evidence: pass(dir) }, dir); }
  const a = next({}, dir).dispatched[0].approvalId;
  updateRecord(dir, "approval", a, { status: "DENIED", grantedBy: "human@example.com" });
  syncApprovals({}, dir);
  assert.equal(check({}, dir).status, "ACTIONABLE_TASKS_REMAIN");
}));

test("stop-check blocks while actionable tasks remain, lets a session stop for waits and after repeated no-progress blocks", () => withDir((dir) => {
  assert.equal(stopCheck(dir), null);
  plan({ order: "x", workflow: "bug-fix" }, dir);
  const first = stopCheck(dir);
  assert.equal(first.decision, "block");
  assert.match(first.reason, /orchestrate\.mjs next/);
  stopCheck(dir); stopCheck(dir);
  assert.equal(stopCheck(dir), null, "after three blocks without progress the stop is allowed");
  // progress resets the counter
  next({}, dir);
  assert.equal(stopCheck(dir).decision, "block");
}));

test("an invalid explicit graph (unknown agent, unknown skill, cycle) is refused", () => withDir((dir) => {
  const file = join(dir, "g.json");
  writeFileSync(file, JSON.stringify({ tasks: [{ id: "a", agent: "no-such-agent", skills: ["no-such-skill"], dependsOn: ["b"] }, { id: "b", agent: "task-orchestrator", dependsOn: ["a"] }] }));
  const r = plan({ order: "x", tasksFile: file }, dir);
  assert.equal(r.status, "INVALID_PLAN");
  assert.ok(r.problems.some((p) => p.includes("unknown agent")));
  assert.ok(r.problems.some((p) => p.includes("unknown skill")));
  assert.ok(r.problems.some((p) => p.includes("cycle")));
}));

test("the prompt hook proposes the orchestrator for a long order and reports the active plan afterwards", () => withDir((dir) => {
  assert.equal(promptHook("short", dir), null);
  const long = "implement the full routing of ".padEnd(320, "x");
  assert.match(promptHook(long, dir).hookSpecificOutput.additionalContext, /orchestrate\.mjs plan/);
  plan({ order: "x", workflow: "bug-fix" }, dir);
  assert.match(promptHook("continue", dir).hookSpecificOutput.additionalContext, /Active orchestration/);
}));

test("explicit capabilities build one task per capability with its executor, skills and acceptance", () => withDir((dir) => {
  const r = plan({ order: "audit", capabilities: "security.review.xss,security.review.ssrf" }, dir);
  assert.equal(r.status, "OK");
  assert.deepEqual(r.tasks.slice(0, 2).map((t) => t.agent), ["xss-reviewer", "ssrf-reviewer"]);
}));

test("reassign swaps the executor of an open task, refuses unknown agents and completed tasks", () => withDir((dir) => {
  plan({ order: "x", workflow: "bug-fix" }, dir);
  assert.equal(reassign({ task: "fix", agent: "backend-engineer" }, dir).agent, "backend-engineer");
  assert.throws(() => reassign({ task: "fix", agent: "no-such-agent" }, dir), /UNKNOWN_AGENT/);
  next({}, dir);
  done({ task: "reproduce", evidence: pass(dir) }, dir);
  assert.throws(() => reassign({ task: "reproduce", agent: "backend-engineer" }, dir), /ALREADY_COMPLETED/);
}));

test("add-task inserts a task found during execution and makes a later task wait for it; a cycle or a completed target is refused", () => withDir((dir) => {
  plan({ order: "x", workflow: "bug-fix" }, dir);
  const r = addTask({ id: "extra-review", agent: "security-reviewer", skills: ["security-audit"], deps: ["fix"], blocks: ["verification"], objective: "independent review" }, dir);
  assert.equal(r.status, "OK");
  assert.throws(() => addTask({ id: "loop", agent: "security-reviewer", deps: ["closure"], blocks: ["fix"], objective: "x" }, dir), /cycle/);
  next({}, dir);
  done({ task: "reproduce", evidence: pass(dir) }, dir);
  assert.throws(() => addTask({ id: "late", agent: "security-reviewer", blocks: ["reproduce"], objective: "x" }, dir), /ALREADY_COMPLETED/);
}));
