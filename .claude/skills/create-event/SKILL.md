---
name: create-event
description: Creates a domain event with a typed payload and its consumers. Use when a planned task requires a domain event with a typed payload and its consumers.
---
# create-event

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a domain event with a typed payload and its consumers.

## Invocation conditions
- A planned task requires a domain event with a typed payload and its consumers.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a domain event with a typed payload and its consumers.

## Procedure
1. Name the event by the fact that happened and define the typed payload.
2. List the consumers and make each handler idempotent.
3. Include the tenant and a correlation id in the payload.
4. Test redelivery and out-of-order handling.

## Expected outputs
- The code for a domain event with a typed payload and its consumers inside apps/api/src/modules.
- The tests: handler tests for redelivery and ordering.

## Validation
- The tests pass: handler tests for redelivery and ordering.
- Constraints hold: typed payload with tenant, idempotent handlers.
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
