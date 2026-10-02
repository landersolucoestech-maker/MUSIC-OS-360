---
name: create-repository
description: Creates a repository that always scopes by tenant. Use when a planned task requires a repository that always scopes by tenant.
---
# create-repository

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a repository that always scopes by tenant.

## Invocation conditions
- A planned task requires a repository that always scopes by tenant.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a repository that always scopes by tenant.

## Procedure
1. Read the entity and the neighboring repositories.
2. Make the tenant a required argument of every method.
3. Use parameters for every value and an allowlist for identifiers.
4. Test each method with two tenants and an empty result.

## Expected outputs
- The code for a repository that always scopes by tenant inside apps/api/src/modules.
- The tests: integration tests with two tenants.

## Validation
- The tests pass: integration tests with two tenants.
- Constraints hold: tenant required, parameterized queries, paginated lists.
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
