# Recovery model

Code rollback, schema rollback, data restoration, configuration rollback, deployment rollback and compensation
for external effects are distinct; a source revert undoes only code. A backup is not restore evidence: the
`restore-reviewer` requires a record of an actual restore into a disposable target.

- Engineering: `failure -> retry-orchestrator -> root-cause-investigator -> recovery-orchestrator ->
  verification-controller`. Two identical failure fingerprints trigger the loop breaker: change strategy instead of
  retrying. Workflows: `recovery`, `incident`, `operational-recovery-flow`.
- Operations: `operational-recovery-agent` finds the last good checkpoint, retries only idempotent steps with a
  bound, resumes or compensates, and prepares a rollback; a rollback of live data is class `production-write`
  (or `bulk-data-change` for imports) and needs a recorded approval first. Skills: `create-operational-checkpoint`,
  `resume-operational-workflow`, `retry-failed-operation`, `recover-failed-workflow`, `rollback-operational-action`,
  `rollback-import`.
- External effects that cannot be recalled (a sent message, a submission, a signature request) are compensated by
  a recorded correction, never pretended undone.
- Records: `operational-recovery` (contract `operational-recovery-record.schema.json`) and `recovery-plan`.
