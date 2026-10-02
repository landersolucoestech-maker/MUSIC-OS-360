# Approval model

Action classes live in `.claude/policies/authority.json`. The human-in-the-loop classes are `rights-change`,
`share-change`, `percentage-change`, `entity-merge`, `deletion`, `signature`, `legal-action`, `payment`,
`external-send-irreversible`, `external-publish-irreversible`, `auto-fix-legal-financial` and `bulk-data-change`,
alongside the engineering classes (`destructive-git`, `production-write`, `external-send`, `destructive-data`,
`dependency-upgrade-mass`).

Rules (`.claude/policies/human-approval.json`):

1. An approval is bound to the **exact payload hash** it was requested for and is single use.
2. The decider is a human and **never the requester**; an agent can never grant an approval.
3. An expired approval counts as denied; a denied approval stops the automation and the same payload is not retried.
4. Without an approval the automation stops at its checkpoint and the case is routed to the exception owner.

Records: `automation-approval` (contract `automation-approval.schema.json`) and the engineering `approval`
record. Skills: `evaluate-human-approval`, `request-human-approval`, `resume-after-approval`,
`reject-unsafe-automation`, `human-approval-validation`. Agents: `human-approval-agent`, `approval-router`.

Enforcement that is executable today: the gate `.claude/gates/human-approval.json` runs
`automation-approvals-resolved` (a PENDING approval blocks) and `automation-runs-gated` (a completed
`automation-run` record needs evidence, and every DONE step that used a high-impact skill needs a GRANTED approval
of that skill's class, listed in the run and decided by someone other than the requester). The pack validator
additionally refuses a workflow in which a high-impact skill is not in or directly after an approval phase.
`node .claude/runtime/gate-engine.mjs human-approval` runs it; the regression test
`.claude/runtime/tests/operational-gates.regression.mjs` proves each blocking path.
