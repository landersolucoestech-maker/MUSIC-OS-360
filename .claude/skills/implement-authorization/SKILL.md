---
name: implement-authorization
description: Implements server-side authorization checks scoped to resource and tenant. Use when a planned task requires server-side authorization checks scoped to resource and tenant.
---
# implement-authorization

## Classification
- kind: implementation
- domain: security
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements server-side authorization checks scoped to resource and tenant.

## Invocation conditions
- A planned task requires server-side authorization checks scoped to resource and tenant.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for server-side authorization checks scoped to resource and tenant.

## Procedure
1. Map the action to permission, ownership and tenant scope.
2. Enforce with the existing guards and decorators on the server.
3. Deny by default for unknown roles, missing context and cross-tenant targets.
4. Test allowed, denied and cross-tenant cases for each changed route.

## Expected outputs
- The code for server-side authorization checks scoped to resource and tenant inside apps/api/src/core/guards, apps/api/src/core/rbac and the module.
- The tests: allowed, denied and cross-tenant tests.

## Validation
- The tests pass: allowed, denied and cross-tenant tests.
- Constraints hold: server enforced, deny by default, ownership checked.
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
