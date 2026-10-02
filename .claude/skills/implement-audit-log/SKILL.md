---
name: implement-audit-log
description: Records who changed what and when without leaking secrets. Use when a planned task requires an audit log entry of who changed what and when.
---
# implement-audit-log

## Classification
- kind: implementation
- domain: security
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Records who changed what and when without leaking secrets.

## Invocation conditions
- A planned task requires an audit log entry of who changed what and when.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for an audit log entry of who changed what and when.

## Procedure
1. Define the entry: actor, tenant, target, action, result and time.
2. Write the entry in the same transaction as the change when the change is data.
3. Exclude secrets and personal values from the entry.
4. Test success, denial and failure entries.

## Expected outputs
- The code for an audit log entry of who changed what and when inside apps/api/src/core/audit and apps/api/src/modules/audit-log.
- The tests: tests for success, denial and failure entries.

## Validation
- The tests pass: tests for success, denial and failure entries.
- Constraints hold: complete fields, no secrets or personal values.
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
