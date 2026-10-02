---
name: implement-error-boundary
description: Adds a UI error boundary with a safe fallback and a reportable id. Use when a planned task requires a UI error boundary with a safe fallback.
---
# implement-error-boundary

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds a UI error boundary with a safe fallback and a reportable id.

## Invocation conditions
- A planned task requires a UI error boundary with a safe fallback.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a UI error boundary with a safe fallback.

## Procedure
1. Place the boundary at the route or feature level, not around the whole app only.
2. Render a humanized fallback with a retry action and a reportable error id.
3. Report the error with its id to observability without personal data.
4. Test that a thrown render error shows the fallback and the rest of the page survives.

## Expected outputs
- The code for a UI error boundary with a safe fallback inside apps/web/src.
- The tests: a test that throws inside the boundary and checks the fallback.

## Validation
- The tests pass: a test that throws inside the boundary and checks the fallback.
- Constraints hold: no raw error text shown, id reported, recovery action present.
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
