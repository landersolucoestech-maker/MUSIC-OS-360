---
name: implement-transaction
description: Wraps a multi-step write in a transaction with a defined isolation. Use when a planned task requires a multi-step write in a transaction with a defined isolation.
---
# implement-transaction

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Wraps a multi-step write in a transaction with a defined isolation.

## Invocation conditions
- A planned task requires a multi-step write in a transaction with a defined isolation.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a multi-step write in a transaction with a defined isolation.

## Procedure
1. List the writes that must succeed together.
2. Wrap them in one transaction through the repository helper and keep external calls outside.
3. Choose the isolation level the invariant needs.
4. Test failure after each write and the rollback result.

## Expected outputs
- The code for a multi-step write in a transaction with a defined isolation inside apps/api/src/modules.
- The tests: tests that fail after each step and check the rollback.

## Validation
- The tests pass: tests that fail after each step and check the rollback.
- Constraints hold: atomic writes, no network calls inside.
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
