---
name: fix-bug
description: Fixes a defect at its root cause with a regression test. Use when a planned task requires a defect fixed at its root cause with a regression test.
---
# fix-bug

## Classification
- kind: implementation
- domain: quality
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Fixes a defect at its root cause with a regression test.

## Invocation conditions
- A planned task requires a defect fixed at its root cause with a regression test.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a defect fixed at its root cause with a regression test.

## Procedure
1. Reproduce the defect and write a test that fails because of it.
2. Find the root cause and fix it there rather than masking the symptom.
3. Check every producer and consumer of the changed behavior.
4. Run the new test and the neighboring suite.

## Expected outputs
- The code for a defect fixed at its root cause with a regression test inside apps/api/src/modules, apps/web/src and the affected package.
- The tests: a regression test that failed before and passes after.

## Validation
- The tests pass: a regression test that failed before and passes after.
- Constraints hold: root cause fixed, no fallback that masks the error.
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
