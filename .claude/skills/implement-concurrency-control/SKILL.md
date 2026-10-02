---
name: implement-concurrency-control
description: Implements optimistic locking or version checks. Use when a planned task requires optimistic locking or version checks.
---
# implement-concurrency-control

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements optimistic locking or version checks.

## Invocation conditions
- A planned task requires optimistic locking or version checks.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for optimistic locking or version checks.

## Procedure
1. Add or reuse the version column and include it in the update condition.
2. Turn a zero-row update into a typed conflict error.
3. Send the read version from the client and show a humanized conflict message.
4. Test two concurrent updates and a stale update.

## Expected outputs
- The code for optimistic locking or version checks inside apps/api/src/modules and apps/web/src/modules.
- The tests: concurrent and stale update tests.

## Validation
- The tests pass: concurrent and stale update tests.
- Constraints hold: update guarded by version, conflict surfaced to the user.
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
