---
name: safe-refactor
description: Refactors without changing behavior, proven by tests before and after. Use when a planned task requires a refactor with unchanged behavior, proven by tests before and after.
---
# safe-refactor

## Classification
- kind: implementation
- domain: quality
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Refactors without changing behavior, proven by tests before and after.

## Invocation conditions
- A planned task requires a refactor with unchanged behavior, proven by tests before and after.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a refactor with unchanged behavior, proven by tests before and after.

## Procedure
1. Run the tests first and record the baseline, adding characterization tests where coverage is missing.
2. Make one small structural change at a time and keep public contracts unchanged.
3. Run the tests after each step and compare with the baseline.
4. Stop and report if behavior must change.

## Expected outputs
- The code for a refactor with unchanged behavior, proven by tests before and after inside apps/api/src/modules, apps/web/src and packages.
- The tests: the same suite passes before and after.

## Validation
- The tests pass: the same suite passes before and after.
- Constraints hold: public contracts unchanged, no behavior change.
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
