---
name: implement-cache
description: Adds a cache with a tenant-scoped key, an expiry and an invalidation rule. Use when a planned task requires a cache with a tenant-scoped key, an expiry and an invalidation rule.
---
# implement-cache

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds a cache with a tenant-scoped key, an expiry and an invalidation rule.

## Invocation conditions
- A planned task requires a cache with a tenant-scoped key, an expiry and an invalidation rule.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a cache with a tenant-scoped key, an expiry and an invalidation rule.

## Procedure
1. Build the key from the tenant and every variable of the value.
2. Set an expiry that matches how often the data changes.
3. Name the owner of the invalidation and implement it at the write path.
4. Test hit, miss, expiry, invalidation and cross-tenant isolation.

## Expected outputs
- The code for a cache with a tenant-scoped key, an expiry and an invalidation rule inside apps/api/src/cache.
- The tests: cache tests for hit, miss, expiry, invalidation and isolation.

## Validation
- The tests pass: cache tests for hit, miss, expiry, invalidation and isolation.
- Constraints hold: tenant key, expiry, owned invalidation.
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
