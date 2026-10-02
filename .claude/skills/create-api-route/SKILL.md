---
name: create-api-route
description: Adds an API route with contract, guard, validation and tests. Use when a planned task requires an API route with contract, guard, validation and tests.
---
# create-api-route

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds an API route with contract, guard, validation and tests.

## Invocation conditions
- A planned task requires an API route with contract, guard, validation and tests.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for an API route with contract, guard, validation and tests.

## Procedure
1. Define the route contract and the DTOs before the handler.
2. Add the guard metadata and the validation pipe settings.
3. Implement the handler through the service and map errors to stable responses.
4. Update the client types and write contract and request tests.

## Expected outputs
- The code for an API route with contract, guard, validation and tests inside apps/api/src/modules and apps/web/src.
- The tests: request tests and a contract test with the client type.

## Validation
- The tests pass: request tests and a contract test with the client type.
- Constraints hold: backward compatible contract, guards present, stable errors.
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
