---
name: create-job
description: Creates a background job with a unique key and a failure path. Use when a planned task requires a background job with a unique key and a failure path.
---
# create-job

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a background job with a unique key and a failure path.

## Invocation conditions
- A planned task requires a background job with a unique key and a failure path.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a background job with a unique key and a failure path.

## Procedure
1. Define the unique key from the work identity so duplicates cannot be queued.
2. Record the status of the job and its result.
3. Define the failure path and the manual retry.
4. Test enqueue twice, success and failure.

## Expected outputs
- The code for a background job with a unique key and a failure path inside apps/api/src/modules and apps/api/src/queues.
- The tests: tests for duplicate enqueue, success and failure.

## Validation
- The tests pass: tests for duplicate enqueue, success and failure.
- Constraints hold: unique key, recorded status, safe retry.
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
