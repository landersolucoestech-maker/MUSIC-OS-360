---
name: implement-background-job
description: Moves work to a background job with status and recovery. Use when a planned task requires work moved to a background job with status and recovery.
---
# implement-background-job

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Moves work to a background job with status and recovery.

## Invocation conditions
- A planned task requires work moved to a background job with status and recovery.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for work moved to a background job with status and recovery.

## Procedure
1. Choose the work that exceeds a request time budget and move it behind the queue.
2. Return a job reference to the caller and expose the job status.
3. Define the failure state and the retry path.
4. Test the request path, the job and the status.

## Expected outputs
- The code for work moved to a background job with status and recovery inside apps/api/src/modules and apps/api/src/queues.
- The tests: tests for request, job success and job failure.

## Validation
- The tests pass: tests for request, job success and job failure.
- Constraints hold: status visible, recoverable, idempotent.
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
