---
name: create-hook
description: Creates a data or state hook with its query keys and tests. Use when a planned task requires a data or state hook with stable query keys.
---
# create-hook

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a data or state hook with its query keys and tests.

## Invocation conditions
- A planned task requires a data or state hook with stable query keys.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a data or state hook with stable query keys.

## Procedure
1. Read neighboring hooks for the key factory and the client in use.
2. Build the query key from every variable the request depends on including the tenant.
3. Define the invalidation of related keys for each mutation.
4. Test the hook with a mocked client for success, error and refetch.

## Expected outputs
- The code for a data or state hook with stable query keys inside apps/web/src/modules and apps/web/src/shared.
- The tests: hook tests for key stability, invalidation and error handling.

## Validation
- The tests pass: hook tests for key stability, invalidation and error handling.
- Constraints hold: keys include every variable, no duplicate local copy of server data.
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
