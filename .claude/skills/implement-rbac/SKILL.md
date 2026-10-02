---
name: implement-rbac
description: Implements role and permission checks end to end. Use when a planned task requires role and permission checks end to end.
---
# implement-rbac

## Classification
- kind: implementation
- domain: security
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements role and permission checks end to end.

## Invocation conditions
- A planned task requires role and permission checks end to end.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for role and permission checks end to end.

## Procedure
1. Define the permission in the single source shared by server and client.
2. Enforce it in the guard on the server and reflect it in the client only for display.
3. Default to deny for unknown roles and missing context.
4. Test allowed, denied and cross-tenant cases for each changed route.

## Expected outputs
- The code for role and permission checks end to end inside apps/api/src/core/rbac, apps/api/src/core/guards and apps/api/src/modules/rbac.
- The tests: allowed, denied and cross-tenant tests.

## Validation
- The tests pass: allowed, denied and cross-tenant tests.
- Constraints hold: server enforced, one source of permissions, deny by default.
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
