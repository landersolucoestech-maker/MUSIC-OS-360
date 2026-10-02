---
name: refactor-component
description: Refactors a component without changing its rendered behavior. Use when a planned task requires a refactored component with unchanged rendered behavior.
---
# refactor-component

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Refactors a component without changing its rendered behavior.

## Invocation conditions
- A planned task requires a refactored component with unchanged rendered behavior.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a refactored component with unchanged rendered behavior.

## Procedure
1. Run the component tests first and record the baseline, adding characterization tests if coverage is missing.
2. Apply one structural change at a time: extract, rename or move.
3. Run the tests after each step and compare the rendered output.
4. Stop and report if behavior must change.

## Expected outputs
- The code for a refactored component with unchanged rendered behavior inside apps/web/src.
- The tests: the same tests pass before and after.

## Validation
- The tests pass: the same tests pass before and after.
- Constraints hold: rendered output and public props unchanged.
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
