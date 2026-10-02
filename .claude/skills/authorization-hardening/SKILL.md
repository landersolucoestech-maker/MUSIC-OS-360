---
name: authorization-hardening
description: Tightens authorization after an audit with tests for each fix. Use when a planned task requires authorization tightened after an audit, with a test for each fix.
---
# authorization-hardening

## Classification
- kind: implementation
- domain: security
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Tightens authorization after an audit with tests for each fix.

## Invocation conditions
- A planned task requires authorization tightened after an audit, with a test for each fix.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for authorization tightened after an audit, with a test for each fix.

## Procedure
1. Take the audit findings and order them by severity.
2. Fix each finding with the existing guard or check and the smallest change.
3. Write a denied-case test for each fix that fails before and passes after.
4. Re-run the authorization audit on the changed area.

## Expected outputs
- The code for authorization tightened after an audit, with a test for each fix inside apps/api/src/core/guards, apps/api/src/core/rbac and the affected modules.
- The tests: a denied-case test per finding.

## Validation
- The tests pass: a denied-case test per finding.
- Constraints hold: deny by default, no widened access, every finding closed or reported.
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
