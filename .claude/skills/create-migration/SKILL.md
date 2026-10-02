---
name: create-migration
description: Writes a guarded, reversible database migration through the repository tooling. Use when a planned task requires a guarded, reversible database migration.
---
# create-migration

## Classification
- kind: implementation
- domain: database
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Writes a guarded, reversible database migration through the repository tooling.

## Invocation conditions
- A planned task requires a guarded, reversible database migration.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a guarded, reversible database migration.

## Procedure
1. Read the migration index, the guarded backfill helper and the previous migration for conventions.
2. Write the up and the down path and register the migration once in order.
3. Use the helper for data backfills and register its side table for retention.
4. Run up, down and up on a disposable database and record the output.

## Expected outputs
- The code for a guarded, reversible database migration inside apps/api/src/database/migrations.
- The tests: a migration spec and the up, down and up run on a disposable database.

## Validation
- The tests pass: a migration spec and the up, down and up run on a disposable database.
- Constraints hold: reversible, bounded lock time, registered once.
- No file outside the locked scope changed.

## Evidence
- Test output and the change-set record.
- The diff limited to the write scope.

## Failure behavior
- If a constraint cannot be satisfied inside the scope, stop and report to the orchestrator instead of widening the scope.
- If a test fails twice with the same cause, stop and change the root cause analysis instead of retrying.

## Rollback and recovery
- Run the down path on the disposable database and revert the migration files; never run it against a shared database.

## Human approval
- Local code change inside the locked scope: no human approval is needed to write it; review and the normal approval policy apply before anything is merged or deployed.
