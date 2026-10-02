---
name: implement-import
description: Implements a validated, previewable, approval-gated import. Use when a planned task requires a validated, previewable, approval-gated import.
---
# implement-import

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements a validated, previewable, approval-gated import.

## Invocation conditions
- A planned task requires a validated, previewable, approval-gated import.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a validated, previewable, approval-gated import.

## Procedure
1. Validate the whole file before writing and report row errors in the product language.
2. Normalize values and detect duplicates against existing data.
3. Produce a preview whose hash the approval is bound to and execute only that preview.
4. Keep rollback information for the batch and test hostile files, duplicates and rollback.

## Expected outputs
- The code for a validated, previewable, approval-gated import inside apps/api/src/modules.
- The tests: tests with hostile files, duplicates and rollback.

## Validation
- The tests pass: tests with hostile files, duplicates and rollback.
- Constraints hold: preview bound approval, idempotent, reversible batch.
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
