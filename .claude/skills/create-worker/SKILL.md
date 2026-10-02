---
name: create-worker
description: Creates a queue worker with idempotency, retries and observability. Use when a planned task requires a queue worker with idempotency, retries and observability.
---
# create-worker

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a queue worker with idempotency, retries and observability.

## Invocation conditions
- A planned task requires a queue worker with idempotency, retries and observability.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a queue worker with idempotency, retries and observability.

## Procedure
1. Read the queue constants and an existing processor.
2. Run the job inside the tenant context and make the effect idempotent on a job key.
3. Set attempts and backoff deliberately and handle failures into a visible state.
4. Add logs and metrics with the correlation id and test redelivery and failure.

## Expected outputs
- The code for a queue worker with idempotency, retries and observability inside apps/api/src/queues.
- The tests: processor tests for redelivery, failure and tenant context.

## Validation
- The tests pass: processor tests for redelivery, failure and tenant context.
- Constraints hold: idempotent, bounded retries, tenant context, graceful shutdown.
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
