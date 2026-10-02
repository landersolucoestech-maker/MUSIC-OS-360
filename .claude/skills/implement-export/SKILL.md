---
name: implement-export
description: Implements an export that matches the source of truth and leaks nothing internal. Use when a planned task requires an export that matches the source of truth and leaks nothing internal.
---
# implement-export

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements an export that matches the source of truth and leaks nothing internal.

## Invocation conditions
- A planned task requires an export that matches the source of truth and leaks nothing internal.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for an export that matches the source of truth and leaks nothing internal.

## Procedure
1. Scope the query by tenant and the requester permissions.
2. Select only permitted fields with humanized column labels.
3. Neutralize cells that start with formula characters and bound the size.
4. Test against the source records and with a user who may not see some fields.

## Expected outputs
- The code for an export that matches the source of truth and leaks nothing internal inside apps/api/src/modules.
- The tests: export tests against source data and a restricted user.

## Validation
- The tests pass: export tests against source data and a restricted user.
- Constraints hold: permitted fields only, formula-safe, bounded.
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
