---
name: migration-safety-check
description: Checks a migration for locks, reversibility and old-new coexistence. Use when a migration must be verified before the next action.
---
# migration-safety-check

## Classification
- kind: check
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks a migration for locks, reversibility and old-new coexistence.

## Invocation conditions
- A migration must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the up and down paths and the registration order.
2. Estimate lock time and check batching on large tables.
3. Check null and default semantics and the reversibility of the backfill.
4. Check the previous application version against the new schema.

## Expected outputs
- A migration safety result per step.

## Validation
- The check answers a single question: does the migration lock, lose data or break the previous application version?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The migration references and the up, down and up run record.

## Failure behavior
- If the migration was not run on a disposable database, report NOT VERIFIED.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
