---
name: databaseMigrationSafety
description: Checks migration safety rules for locking, backfill and rollback. Use when migration safety rules must be verified before the next action.
---
# databaseMigrationSafety

## Classification
- kind: check
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks migration safety rules for locking, backfill and rollback.

## Invocation conditions
- Migration safety rules must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the repository migration conventions and the guarded backfill helper.
2. Check the migration uses the helper for data backfills and registers its side table.
3. Check locking behavior, batch size and the down path.
4. Report each rule broken with the line.

## Expected outputs
- A rules result listing each rule and the migration line that satisfies or breaks it.

## Validation
- The check answers a single question: does the migration follow the repository rules for locking, backfill and rollback?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Rule results with file and line references.

## Failure behavior
- If the conventions cannot be read, report BLOCKED rather than using generic rules.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
