---
name: create-queue
description: Creates a queue with limits, retry policy and monitoring. Use when a planned task requires a queue with limits, retry policy and monitoring.
---
# create-queue

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a queue with limits, retry policy and monitoring.

## Invocation conditions
- A planned task requires a queue with limits, retry policy and monitoring.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a queue with limits, retry policy and monitoring.

## Procedure
1. Add the queue name to the constants and register it in the queue module.
2. Set rate limits, attempts, backoff and the removal policy.
3. Expose depth and failure metrics.
4. Extend the queue topology test.

## Expected outputs
- The code for a queue with limits, retry policy and monitoring inside apps/api/src/queues.
- The tests: the queue topology test and a processor test.

## Validation
- The tests pass: the queue topology test and a processor test.
- Constraints hold: limits set, retries bounded, metrics exposed.
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
