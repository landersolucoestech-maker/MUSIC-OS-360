---
name: release
description: Runs the release.json workflow end to end — supply-chain check, regression gates, a release-record, an authorized deploy, and production-validation. Short-form entry point for release-checkpoint (mission closure reporting) plus the actual release/deploy phases release-checkpoint doesn't cover.
---

# Release

1. `node .claude/runtime/graph-engine.mjs build release` to get the execution graph for the
   `release.json` workflow.
2. Delegate `supply-chain-check` to `supply-chain-reviewer`, then `regression` via the
   `regression-gates` skill.
3. `node .claude/runtime/ops.mjs release add --data '{"sourceCommit":"<sha>",
   "artifactId":"...","gateResultIds":[...]}'`.
4. Deploy only with a GRANTED `approval-request` (`authority.json`'s `production-write` class),
   then `node .claude/runtime/ops.mjs deployment add --data '{"releaseId":"...",
   "target":"...","strategy":"canary|blue-green|..."}'`.
5. Delegate `production-validator` for the final `production-validation` record.
6. Run `release-checkpoint` to produce the mission closure report once `completion-gate.mjs`
   passes.
