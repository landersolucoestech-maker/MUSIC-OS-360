---
name: create-service
description: Creates a backend service with validation, tenant scoping and tests. Use when a planned task requires a backend service with validation, tenant scoping and tests.
---
# create-service

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a backend service with validation, tenant scoping and tests.

## Invocation conditions
- A planned task requires a backend service with validation, tenant scoping and tests.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a backend service with validation, tenant scoping and tests.

## Procedure
1. Read a neighboring service for injection, tenant scoping and error conventions.
2. Validate inputs at the boundary and put the business rules in the service.
3. Scope every query by tenant and use transactions for multi-step writes.
4. Write unit tests for the rules and an integration test with a cross-tenant case.

## Expected outputs
- The code for a backend service with validation, tenant scoping and tests inside apps/api/src/modules.
- The tests: unit tests for rules and an integration test with a cross-tenant case.

## Validation
- The tests pass: unit tests for rules and an integration test with a cross-tenant case.
- Constraints hold: tenant scoped, transactional where required, typed errors.
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
