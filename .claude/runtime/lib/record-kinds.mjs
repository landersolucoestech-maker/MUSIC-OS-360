// Registry mapping each file-per-record contract to its schema and storage
// directory. One mechanism (record-store.mjs) serves all of them instead of a
// bespoke CLI command per kind — see docs/ARCHITECTURE.md "Generic record store".
// Requirement/Finding are NOT here: they're small, hierarchical, and queried
// together, so they stay embedded in run-state.json (see lib/state-store.mjs).
export const RECORD_KINDS = {
  evidence: { schema: "evidence-record.schema.json", dir: ".claude/ops/evidence" },
  checkpoint: { schema: "checkpoint-record.schema.json", dir: ".claude/ops/checkpoints" },
  baseline: { schema: "baseline-record.schema.json", dir: ".claude/ops/baselines" },
  effect: { schema: "side-effect-record.schema.json", dir: ".claude/ops/effects" },
  approval: { schema: "approval-request.schema.json", dir: ".claude/ops/records/approval" },
  assumption: { schema: "assumption-record.schema.json", dir: ".claude/ops/records/assumption" },
  changeset: { schema: "change-set.schema.json", dir: ".claude/ops/records/changeset" },
  conflict: { schema: "conflict-record.schema.json", dir: ".claude/ops/records/conflict" },
  decision: { schema: "decision-record.schema.json", dir: ".claude/ops/records/decision" },
  deployment: { schema: "deployment-record.schema.json", dir: ".claude/ops/records/deployment" },
  "recovery-plan": { schema: "recovery-plan.schema.json", dir: ".claude/ops/records/recovery-plan" },
  release: { schema: "release-record.schema.json", dir: ".claude/ops/records/release" },
  run: { schema: "run-record.schema.json", dir: ".claude/ops/records/run" },
  task: { schema: "task-spec.schema.json", dir: ".claude/ops/records/task" },
  "production-validation": { schema: "production-validation-record.schema.json", dir: ".claude/ops/records/production-validation" },
  delegation: { schema: "context-package.schema.json", dir: ".claude/ops/records/delegation" },
  failure: { schema: "failure-record.schema.json", dir: ".claude/ops/records/failure" },
  "gate-result": { schema: "gate-result.schema.json", dir: ".claude/ops/records/gate-result" },
  "perf-baseline": { schema: "perf-baseline-record.schema.json", dir: ".claude/ops/records/perf-baseline" },
  "automation-run": { schema: "operational-automation-run.schema.json", dir: ".claude/ops/records/automation-run" },
  "automation-approval": { schema: "automation-approval.schema.json", dir: ".claude/ops/records/automation-approval" },
  "operational-recovery": { schema: "operational-recovery-record.schema.json", dir: ".claude/ops/records/operational-recovery" },
  orchestration: { schema: "orchestration-plan.schema.json", dir: ".claude/ops/records/orchestration" },
  vote: { schema: "vote-record.schema.json", dir: ".claude/ops/records/vote" },
};

export function recordKindNames() {
  return Object.keys(RECORD_KINDS);
}
