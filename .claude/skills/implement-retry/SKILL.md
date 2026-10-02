---
name: implement-retry
description: Adds bounded retries with backoff and idempotency. Use when a planned task requires bounded retries with backoff and idempotency.
---
# implement-retry

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds bounded retries with backoff and idempotency.

## Invocation conditions
- A planned task requires bounded retries with backoff and idempotency.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for bounded retries with backoff and idempotency.

## Procedure
1. Decide which errors are transient and retry only those.
2. Use bounded attempts with exponential backoff and jitter.
3. Ensure the retried operation is idempotent or carries an idempotency key.
4. Test the final failure being surfaced and the cross-layer attempt count.

## Expected outputs
- The code for bounded retries with backoff and idempotency inside apps/api/src/core/resilience and the calling module.
- The tests: tests for transient, permanent and exhausted retries.

## Validation
- The tests pass: tests for transient, permanent and exhausted retries.
- Constraints hold: bounded, jittered, idempotent.
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
