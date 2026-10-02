---
name: modify-schema
description: Changes a schema through expand, backfill and contract steps. Use when a planned task requires a schema change through expand, backfill and contract steps.
---
# modify-schema

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Changes a schema through expand, backfill and contract steps.

## Invocation conditions
- A planned task requires a schema change through expand, backfill and contract steps.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a schema change through expand, backfill and contract steps.

## Procedure
1. State the end schema and the canonical name of each changed concept.
2. Expand first: add the new column or table compatible with the old code.
3. Backfill through the guarded helper and switch readers and writers.
4. Contract only in a later change after an approved plan; update entities and the drift check.

## Expected outputs
- The code for a schema change through expand, backfill and contract steps inside apps/api/src/database.
- The tests: the entity versus catalog drift check and migration tests.

## Validation
- The tests pass: the entity versus catalog drift check and migration tests.
- Constraints hold: old and new code coexist, no destructive step without approval.
- No file outside the locked scope changed.

## Evidence
- Test output and the change-set record.
- The diff limited to the write scope.

## Failure behavior
- If a constraint cannot be satisfied inside the scope, stop and report to the orchestrator instead of widening the scope.
- If a test fails twice with the same cause, stop and change the root cause analysis instead of retrying.

## Rollback and recovery
- Revert by running the down path and the previous entity version; contract steps are never combined with expand steps.

## Human approval
- Local code change inside the locked scope: no human approval is needed to write it; review and the normal approval policy apply before anything is merged or deployed.
