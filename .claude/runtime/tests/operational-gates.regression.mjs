// Regression test for the human-approval / operational-automation / pack-integrity gates: an automation
// run completed without evidence, or a high-impact step without a GRANTED approval of its class decided by
// someone other than the requester, must BLOCK; a pending approval blocks; a correct run passes; the real
// pack passes the pack-integrity gate. Negative paths are the point: each failure is proven to block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { addRecord } from "../lib/record-store.mjs";
import { evaluateGateFile } from "../gate-engine.mjs";
import { validatePack } from "../validate-pack-contracts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS = join(__dirname, "..", "ops.mjs");
const REAL_ROOT = join(__dirname, "..", "..", "..");

function mission() {
  const dir = mkdtempSync(join(tmpdir(), "eos-op-gates-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "a@a.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "a"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  execFileSync(process.execPath, [OPS, "init"], { cwd: dir });
  return dir;
}

const now = "2026-10-02T00:00:00.000Z";
const run = (over = {}) => ({
  runId: "run-1", workflow: "import-validation-flow", domain: "operations", tenantId: "t1", trigger: "USER", status: "COMPLETED", startedAt: now,
  steps: [{ id: "s1", skill: "execute-approved-import", agent: "import-automation-agent", status: "DONE" }],
  evidenceRefs: ["ev-1"], approvalRefs: [], ...over,
});
const approval = (over = {}) => ({
  runId: "run-1", actionClass: "bulk-data-change", subject: { entityType: "import", entityId: "b1" }, change: { summary: "apply preview" },
  impact: ["bulk"], requestedBy: "import-automation-agent", status: "GRANTED", decidedBy: "owner@example.com", ...over,
});
const gate = (dir, name) => evaluateGateFile(name, { cwd: dir });

test("no automation records: the human-approval gate passes trivially", () => {
  const dir = mission();
  try { assert.equal(gate(dir, "human-approval").status, "PASS"); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a completed run without evidence is blocked", () => {
  const dir = mission();
  try {
    addRecord(dir, "automation-run", run({ steps: [{ id: "s1", skill: "validate-import", agent: "import-automation-agent", status: "DONE" }], evidenceRefs: [] }));
    const r = gate(dir, "human-approval");
    assert.equal(r.status, "BLOCKED");
    assert.ok(r.reasons.some((x) => x.includes("without evidenceRefs")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a high-impact step without any approval is blocked", () => {
  const dir = mission();
  try {
    addRecord(dir, "automation-run", run());
    const r = gate(dir, "human-approval");
    assert.equal(r.status, "BLOCKED");
    assert.ok(r.reasons.some((x) => x.includes("execute-approved-import") && x.includes("bulk-data-change")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an approval of the wrong class, a denied one and a self-decided one do not cover the step", () => {
  const dir = mission();
  try {
    const wrong = addRecord(dir, "automation-approval", approval({ actionClass: "payment" }));
    const denied = addRecord(dir, "automation-approval", approval({ status: "DENIED" }));
    const self = addRecord(dir, "automation-approval", approval({ decidedBy: "import-automation-agent" }));
    addRecord(dir, "automation-run", run({ approvalRefs: [wrong.id, denied.id, self.id] }));
    assert.equal(gate(dir, "human-approval").status, "BLOCKED");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a GRANTED approval of the right class decided by someone else lets the run pass", () => {
  const dir = mission();
  try {
    const ok = addRecord(dir, "automation-approval", approval());
    addRecord(dir, "automation-run", run({ approvalRefs: [ok.id] }));
    assert.equal(gate(dir, "human-approval").status, "PASS");
    assert.equal(gate(dir, "operational-automation").status, "PASS");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a PENDING approval blocks completion", () => {
  const dir = mission();
  try {
    addRecord(dir, "automation-approval", approval({ status: "PENDING", decidedBy: null }));
    const r = gate(dir, "human-approval");
    assert.equal(r.status, "BLOCKED");
    assert.ok(r.reasons.some((x) => x.includes("PENDING")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the real pack satisfies every contract the pack-integrity gate checks", () => {
  // validatePack is exactly what the pack-contracts-valid check runs; calling it directly keeps the
  // test from appending gate telemetry to the repository ops journal.
  const r = validatePack(REAL_ROOT);
  assert.deepEqual(r.problems, []);
});
