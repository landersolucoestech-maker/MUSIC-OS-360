# Engineering OS Execution Protocol v2

This rule is the operational entry point. The runtime, not an agent's confidence, decides whether work may advance.

## 1. Intake and state

For every non-trivial request:

1. establish/continue the mission in `.claude/ops/state.json`;
2. reconstruct the repository state before editing;
3. formalize explicit requirements, constraints and non-requirements for L2+ work;
4. run `node .claude/runtime/impact.mjs` and use the maximum of operator-declared and runtime-detected impact;
5. select the smallest dynamic execution graph that covers the detected signals;
6. isolate writers by disjoint file ownership when parallel work exists (no extra branches or writable worktrees: `dev` is the only branch, see `git-safety.md`);
7. execute, verify, review, remediate, re-verify and run the deterministic completion gate.

## 2. Impact levels

- **L0**: documentation/text-only; no product behavior.
- **L1**: isolated low-risk implementation.
- **L2**: module/feature behavior change. Requires formal RequirementRecords and evidence closure.
- **L3**: cross-module, external integration or broad change. Adds independent requirements review, adversarial review and regression review.
- **L4**: architecture, public/shared contract or dependency compatibility change. Adds architecture and signal-routed contract/test-strategy review.
- **L5**: security/authorization boundary, data migration/destructive data, infrastructure, deployment/production. Adds signal-routed security, supply-chain, recovery and production gates.

Impact is not file count. One-line authorization or destructive migration code is L5. Runtime-detected impact cannot be downgraded by an agent.

## 3. Evidence rules

A textual statement such as "tests pass" is not gate evidence. Executed checks and reviewer verdicts are recorded as structured `EvidenceRecord`s bound to the exact workspace fingerprint. A later source/config/dependency change makes change-sensitive PASS evidence stale.

For L2+, every required behavior follows:

`RequirementRecord -> AcceptanceCriterion -> fresh PASS EvidenceRecord`.

No closure means no DONE.

## 4. Failure semantics

- A failed gate transitions to remediation/reanalysis, not narrative approval.
- Two materially identical failures trigger the loop breaker: stop repeating and change strategy/root-cause analysis.
- Missing environment/tool evidence is BLOCKED, never PASS.
- Policy/gate/runtime errors fail visible. Never silently downgrade rigor.

## 5. Completion

`node .claude/runtime/completion-gate.mjs` must agree with repository state. It checks touched-file provenance, unexplained delta, dynamic gates, findings, blockers, fresh evidence and side-effect reconciliation.

The durable boundary remains CI/branch protection/deployment policy; local hooks are an in-session enforcement layer, not a magical substitute for server-side controls.
