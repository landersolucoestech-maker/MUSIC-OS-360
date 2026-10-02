---
name: implement-crud
description: Implements create, read, update and delete with tenant scoping and audit. Use when a planned task requires create, read, update and delete with tenant scoping and audit.
---
# implement-crud

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements create, read, update and delete with tenant scoping and audit.

## Invocation conditions
- A planned task requires create, read, update and delete with tenant scoping and audit.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for create, read, update and delete with tenant scoping and audit.

## Procedure
1. Define DTOs, the service rules and the repository methods for each operation.
2. Scope by tenant and check ownership on read, update and delete.
3. Use soft delete or a recorded delete as the project convention says and write an audit entry for each change.
4. Test each operation with invalid input, another tenant and concurrent update.

## Expected outputs
- The code for create, read, update and delete with tenant scoping and audit inside apps/api/src/modules.
- The tests: tests per operation including another tenant and concurrent update.

## Validation
- The tests pass: tests per operation including another tenant and concurrent update.
- Constraints hold: tenant scoped, audited, concurrency safe.
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
