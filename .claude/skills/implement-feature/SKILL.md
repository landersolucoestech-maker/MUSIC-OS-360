---
name: implement-feature
description: Implements a planned feature end to end across its layers. Use when a planned task requires a planned feature across its layers.
---
# implement-feature

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements a planned feature end to end across its layers.

## Invocation conditions
- A planned task requires a planned feature across its layers.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a planned feature across its layers.

## Procedure
1. Read the task specification, the module map and the API contract.
2. Implement bottom up: persistence, service, controller, client.
3. Keep each layer inside its responsibility and reuse existing helpers.
4. Add tests for the behavior including denial and invalid input, and run them.

## Expected outputs
- The code for a planned feature across its layers inside apps/api/src/modules and apps/web/src.
- The tests: tests of the behavior including denial and invalid input.

## Validation
- The tests pass: tests of the behavior including denial and invalid input.
- Constraints hold: layering respected, tenant scoped, contracts consistent.
- No file outside the locked scope changed.

## Evidence
- Test output and the change-set record.
- The diff limited to the write scope.

## Failure behavior
- If a constraint cannot be satisfied inside the scope, stop and report to the orchestrator instead of widening the scope.
- If a test fails twice with the same cause, stop and change the root cause analysis instead of retrying.

## Rollback and recovery
- Revert the changed files with the version control history of the change; the change produced no data or external effects.

## Human approval
- Local code change inside the locked scope: no human approval is needed to write it; review and the normal approval policy apply before anything is merged or deployed.
